"""
Real-time ingestion and background pipeline worker for Vaani.
Continuously processes connected sources across Telegram, Discord, and YouTube.
Adheres to Step 2 Fix rules:
- Long-polling background loop for Telegram (timeout=30, allowed_updates).
- Persist update offset (offset = last update_id + 1).
- Never run two getUpdates pollers at once (single poller lock).
- Handles Telegram 409 Conflict gracefully.
- Matching: process message if chat_id equals channel_id of any connected Telegram source.
  Unregistered chats logged at INFO level and skipped.
  Ignore bot messages.
- Pipeline per message:
  * increment messages_scanned (db_brain.increment_scanned) for every processed text message.
  * store last 5 messages in rolling buffer per source.
  * classify_text(text, target_user, context=last 3 messages).
  * store in messages table ONLY when flagged=True.
  * update flags_count on source.
  * dispatch high severity alert.
- Make errors loud: remove silent pass blocks, log with traceback, keep loop alive.
"""

import asyncio
import os
import json
import inspect
import time
import traceback
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import database as db
import db_ops
from connectors.telegram import TelegramConnector
from connectors.discord import DiscordConnector
from connectors.youtube import YouTubeConnector
from services.classifier import classify_text
from services.alerts import send_high_severity_alert, queue_low_severity_digest, handle_telegram_callback
from services.config_resolver import get_telegram_runtime_config

logger = logging.getLogger("vaani.ingest")

# Rolling buffer of last 5 messages per source
ROLLING_BUFFER: Dict[str, deque] = defaultdict(lambda: deque(maxlen=5))

# Debug tracking
UPDATES_FETCHED_TIMESTAMPS: deque = deque()
LAST_SKIPPED_MESSAGES: deque = deque(maxlen=20)
LAST_UPDATE_ID_PROCESSED: Optional[int] = None

# Background worker controls
IS_WORKER_RUNNING = False
BACKGROUND_WORKER_TASK: Optional[asyncio.Task] = None
TELEGRAM_WORKER_TASK: Optional[asyncio.Task] = None
TELEGRAM_POLL_LOCK = asyncio.Lock()


def run_classifier_safely(text: str, target_user: Optional[str] = None, context: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Hard Rule 2: Calls classifier ONLY through classify_text(text, target_user=None, context=None).
    """
    try:
        sig = inspect.signature(classify_text)
        if "context" in sig.parameters:
            return classify_text(text, target_user=target_user, context=context)
        else:
            return classify_text(text, target_user=target_user)
    except Exception as e:
        logger.error(f"[Classifier] Error in classify_text: {e}\n{traceback.format_exc()}")
        return {
            "flagged": False,
            "category": "Other",
            "severity": "low",
            "language": "Hindi (Romanized)",
            "normalized_text": text,
            "explanation": f"Classifier error fallback: {e}",
            "target_user": target_user
        }


def record_scanned_increment(count: int = 1):
    """
    Hard Rule 3 & Step 2 Rule 5: Increment messages_scanned for every processed text message.
    """
    try:
        import db_brain
        if hasattr(db_brain, "increment_scanned"):
            db_brain.increment_scanned(count)
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"[IngestWorker] Error calling db_brain.increment_scanned: {e}\n{traceback.format_exc()}")


def get_connector_for_platform(platform: str):
    if platform == "telegram":
        return TelegramConnector()
    elif platform == "discord":
        return DiscordConnector()
    elif platform == "youtube":
        return YouTubeConnector()
    return None


async def process_raw_item(raw: Dict[str, Any], source: Dict[str, Any], connector) -> Optional[Dict[str, Any]]:
    """
    Processes a single raw message item through the moderation pipeline.
    Stores in DB ONLY if flagged.
    """
    if "callback_query" in raw:
        handle_telegram_callback(raw["callback_query"])
        return None

    norm = connector.normalize(raw)
    source_key = str(source.get("id"))

    # Check if already processed
    existing = db.get_message_by_id(norm.id)
    if existing:
        return None

    # Retrieve up to 3 preceding messages for context
    preceding_context = list(ROLLING_BUFFER[source_key])[-3:]

    # Check privacy mode on source
    privacy_mode = source.get("privacy_mode", "full")
    is_force_flagged = raw.get("_force_flagged", False)

    if privacy_mode == "report_only" and not is_force_flagged:
        ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")
        return None

    if privacy_mode == "trigger_only" and not is_force_flagged:
        if not norm.target_user and "@" not in norm.text:
            ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")
            return None

    # Classify message text
    classification = run_classifier_safely(
        text=norm.text,
        target_user=norm.target_user,
        context=preceding_context
    )

    # Increment scanned count for every processed text message
    record_scanned_increment(1)

    is_flagged = classification.get("flagged", False) or is_force_flagged

    # Privacy Rule 7: Safe messages are NEVER stored in DB
    if not is_flagged:
        ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")
        LAST_SKIPPED_MESSAGES.append({
            "chat_id": str(source.get("channel_id") or source.get("id")),
            "sender": norm.sender_name,
            "text": norm.text[:60],
            "reason": "safe_message",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        return None

    # Flagged incident: store in DB
    category = "Insult/Bullying" if (is_force_flagged and not classification.get("flagged")) else classification.get("category", "Insult/Bullying")
    severity = classification.get("severity", "medium")
    explanation = classification.get("explanation", "Flagged by community safety filter.")
    if is_force_flagged and not classification.get("flagged"):
        reported_by = raw.get("_reported_by", "community user")
        explanation = f"Force-flagged for moderator review via /report by {reported_by}."

    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR IGNORE INTO messages (
        id, platform, source_id, channel_name, sender_id, sender_name,
        text, normalized_text, language, timestamp, context, category,
        severity, explanation, target_user, status, reviewed_by, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        norm.id,
        norm.platform,
        source.get("id"),
        source.get("channel_name", norm.channel_name),
        norm.sender_id,
        norm.sender_name,
        norm.text,
        classification.get("normalized_text", norm.text),
        classification.get("language", norm.language or "Hindi (Romanized)"),
        norm.timestamp,
        json.dumps(preceding_context),
        category,
        severity,
        explanation,
        classification.get("target_user") or norm.target_user,
        "new",
        None,
        None
    ))

    # Update flags count on source
    cursor.execute("UPDATE sources SET flags_count = flags_count + 1 WHERE id = ?", (source.get("id"),))
    conn.commit()
    conn.close()

    # Append to rolling buffer
    ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")

    # Dispatch alerts
    msg_dict = db.get_message_by_id(norm.id)
    if msg_dict:
        if severity == "high":
            send_high_severity_alert(msg_dict)
        else:
            queue_low_severity_digest(msg_dict)

    return msg_dict


# ============================================================================
# Telegram Long-Polling Worker (Step 2 Rules 3, 4, 5, 6)
# ============================================================================

async def telegram_long_polling_loop():
    """
    Dedicated background worker for Telegram getUpdates long-polling.
    Uses timeout=30 and allowed_updates=['message', 'edited_message', 'channel_post', 'my_chat_member'].
    Persists offset (last update_id + 1) in DB.
    Never runs two getUpdates pollers at once.
    Handles 409 Conflict gracefully.
    """
    global IS_WORKER_RUNNING, LAST_UPDATE_ID_PROCESSED
    tg = TelegramConnector()

    if not tg.is_real_mode_available():
        logger.info("[TelegramWorker] Real mode not active (MOCK_MODE=True or demo token). Real long-polling skipped.")
        return

    logger.info("[TelegramWorker] Telegram long-polling worker started.")

    while IS_WORKER_RUNNING:
        async with TELEGRAM_POLL_LOCK:
            try:
                # Read persisted offset
                last_offset_str = db_ops.get_connector_offset("telegram_update_offset", "0")
                last_offset = int(last_offset_str)
                offset_param = last_offset + 1 if last_offset > 0 else 0

                # Run synchronous requests in thread pool to avoid blocking asyncio event loop
                loop = asyncio.get_event_loop()
                status_code, updates = await loop.run_in_executor(
                    None,
                    lambda: tg.fetch_updates_raw(
                        offset=offset_param,
                        limit=50,
                        timeout=30,
                        allowed_updates=["message", "edited_message", "channel_post", "my_chat_member"]
                    )
                )

                if status_code == 409:
                    logger.warning("[Telegram] 409 Conflict: another getUpdates process or webhook is running. Waiting 5s...")
                    await asyncio.sleep(5)
                    continue

                if status_code == 200 and updates:
                    now_sec = time.time()
                    for _ in updates:
                        UPDATES_FETCHED_TIMESTAMPS.append(now_sec)

                    # Clean old timestamps (> 300 seconds)
                    while UPDATES_FETCHED_TIMESTAMPS and (now_sec - UPDATES_FETCHED_TIMESTAMPS[0] > 300):
                        UPDATES_FETCHED_TIMESTAMPS.popleft()

                    # Query connected Telegram sources for matching
                    sources = db.get_sources()
                    connected_tg_sources = {
                        str(s.get("channel_id")): s
                        for s in sources
                        if s.get("platform") == "telegram" and s.get("status") == "connected" and s.get("channel_id")
                    }

                    max_up_id = last_offset
                    for up in updates:
                        up_id = up.get("update_id", 0)
                        if up_id > max_up_id:
                            max_up_id = up_id
                        LAST_UPDATE_ID_PROCESSED = up_id

                        # Handle moderator callback query
                        if "callback_query" in up:
                            handle_telegram_callback(up["callback_query"])
                            continue

                        # Extract message object
                        msg = (
                            up.get("message")
                            or up.get("channel_post")
                            or up.get("edited_message")
                        )
                        if not msg:
                            continue

                        # Ignore messages from bots
                        sender = msg.get("from", {})
                        if sender.get("is_bot") is True:
                            LAST_SKIPPED_MESSAGES.append({
                                "chat_id": str(msg.get("chat", {}).get("id")),
                                "sender": sender.get("username") or "bot",
                                "text": (msg.get("text") or "")[:60],
                                "reason": "bot_message",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            })
                            continue

                        text = (msg.get("text") or msg.get("caption") or "").strip()
                        if not text:
                            continue

                        chat = msg.get("chat", {})
                        chat_id_str = str(chat.get("id"))

                        # Match chat_id against connected Telegram sources
                        matching_source = connected_tg_sources.get(chat_id_str)
                        if not matching_source:
                            # Step 2 Rule 4: Unregistered chat
                            logger.info(f"[Telegram] message from unregistered chat {chat_id_str}")
                            LAST_SKIPPED_MESSAGES.append({
                                "chat_id": chat_id_str,
                                "sender": sender.get("username") or sender.get("first_name", "unknown"),
                                "text": text[:60],
                                "reason": "unregistered_chat",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            })
                            continue

                        # Check for /report command in group chat
                        if text.lower().startswith("/report"):
                            reply_to = msg.get("reply_to_message")
                            if reply_to:
                                reply_to["_force_flagged"] = True
                                reply_to["_reported_by"] = sender.get("username") or sender.get("first_name", "User")
                                await process_raw_item(reply_to, matching_source, tg)
                            else:
                                msg["_force_flagged"] = True
                                await process_raw_item(msg, matching_source, tg)
                        else:
                            await process_raw_item(msg, matching_source, tg)

                    # Persist advance offset
                    if max_up_id > last_offset:
                        db_ops.set_connector_offset("telegram_update_offset", str(max_up_id))

            except asyncio.CancelledError:
                logger.info("[TelegramWorker] Long-polling worker cancelled.")
                break
            except Exception as e:
                # Step 2 Rule 6: Make errors loud with traceback
                logger.error(f"[TelegramWorker] Error in long-polling loop: {e}\n{traceback.format_exc()}")
                await asyncio.sleep(3)

        # Brief pause between polls
        await asyncio.sleep(0.5)


# ============================================================================
# Unified Source Sync (POST /sources/sync)
# ============================================================================

async def sync_connected_source(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    platform = source.get("platform")
    source_id = source.get("channel_id") or source.get("id")
    connector = get_connector_for_platform(platform)
    if not connector:
        return []

    # If Telegram is in real mode, the dedicated long-poll worker handles it.
    # Avoid running a concurrent second poll!
    if platform == "telegram" and connector.is_real_mode_available():
        return []

    new_flagged = []
    try:
        raw_items = await connector.fetch_new_messages(source_id=source_id, limit=20)
        for raw in raw_items:
            res = await process_raw_item(raw, source, connector)
            if res:
                new_flagged.append(res)
    except Exception as e:
        logger.error(f"[IngestWorker] Error syncing source {source.get('id')}: {e}\n{traceback.format_exc()}")

    return new_flagged


async def sync_all_sources() -> Dict[str, Any]:
    """
    POST /sources/sync trigger.
    Syncs connected sources without duplicating Telegram long-poll calls.
    """
    sources = db.get_sources()
    total_new = 0
    all_flagged = []

    for src in sources:
        if src.get("status") == "connected":
            flagged = await sync_connected_source(src)
            total_new += len(flagged)
            all_flagged.extend(flagged)

    return {
        "synced_sources_count": len(sources),
        "new_flagged_incidents": total_new,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "messages": all_flagged
    }


async def background_ingest_loop():
    """General background task for Discord/YouTube sources and retention cleanup."""
    global IS_WORKER_RUNNING
    IS_WORKER_RUNNING = True
    logger.info("[BackgroundWorker] Continuous source ingestion worker started.")

    cleanup_counter = 0

    while IS_WORKER_RUNNING:
        try:
            await sync_all_sources()

            cleanup_counter += 1
            if cleanup_counter >= 300:
                cleanup_counter = 0
                db_ops.cleanup_old_messages()

        except asyncio.CancelledError:
            logger.info("[BackgroundWorker] Ingestion worker cancelled.")
            break
        except Exception as e:
            logger.error(f"[BackgroundWorker] Unexpected error in loop: {e}\n{traceback.format_exc()}")

        await asyncio.sleep(5)


def start_background_worker():
    """Starts both the general ingest worker and the Telegram long-poll worker."""
    global BACKGROUND_WORKER_TASK, TELEGRAM_WORKER_TASK, IS_WORKER_RUNNING
    IS_WORKER_RUNNING = True
    loop = asyncio.get_event_loop()

    if BACKGROUND_WORKER_TASK is None or BACKGROUND_WORKER_TASK.done():
        BACKGROUND_WORKER_TASK = loop.create_task(background_ingest_loop())

    if TELEGRAM_WORKER_TASK is None or TELEGRAM_WORKER_TASK.done():
        TELEGRAM_WORKER_TASK = loop.create_task(telegram_long_polling_loop())


def stop_background_worker():
    """Cancels both workers."""
    global BACKGROUND_WORKER_TASK, TELEGRAM_WORKER_TASK, IS_WORKER_RUNNING
    IS_WORKER_RUNNING = False
    if BACKGROUND_WORKER_TASK and not BACKGROUND_WORKER_TASK.done():
        BACKGROUND_WORKER_TASK.cancel()
    if TELEGRAM_WORKER_TASK and not TELEGRAM_WORKER_TASK.done():
        TELEGRAM_WORKER_TASK.cancel()


def get_telegram_debug_status() -> Dict[str, Any]:
    """
    Step 2 Rule 7: GET /debug/telegram status payload.
    Masks all secrets.
    """
    cfg = get_telegram_runtime_config()
    tg = TelegramConnector()
    
    bot_username = None
    webhook_url = ""
    if tg.is_real_token:
        ok_me, me_data = tg.get_me()
        if ok_me:
            bot_username = me_data.get("username")
        ok_wh, wh_data = tg.get_webhook_info()
        if ok_wh:
            webhook_url = wh_data.get("url", "")

    # Count updates fetched in last 5 minutes (300s)
    now_sec = time.time()
    recent_updates_count = sum(1 for ts in UPDATES_FETCHED_TIMESTAMPS if now_sec - ts <= 300)

    # Get registered chat IDs from connected Telegram sources
    sources = db.get_sources()
    registered_chat_ids = [
        s.get("channel_id")
        for s in sources
        if s.get("platform") == "telegram" and s.get("status") == "connected" and s.get("channel_id")
    ]

    last_offset_str = db_ops.get_connector_offset("telegram_update_offset", "0")
    last_offset = int(last_offset_str) if last_offset_str.isdigit() else None

    return {
        "mock_mode": cfg["mock_mode"],
        "token_loaded": cfg["is_real_token"],
        "bot_username": bot_username,
        "webhook_url": webhook_url,
        "last_update_id_processed": LAST_UPDATE_ID_PROCESSED or last_offset,
        "updates_fetched_last_5min": recent_updates_count,
        "registered_chat_ids": registered_chat_ids,
        "last_10_skipped_messages": list(LAST_SKIPPED_MESSAGES)[-10:]
    }
