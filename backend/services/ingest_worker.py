"""
Real-time ingestion and background pipeline worker for Vaani.
Continuously processes connected sources (Telegram, Discord, YouTube),
manages an in-memory rolling buffer of the last 5 messages per source for conversational context,
runs incoming messages through the classification engine, adheres to privacy rules
(safe messages are NEVER stored in DB), increments scanned count, and triggers moderator alerts.
"""

import asyncio
import os
import json
import inspect
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

# Hard Rule 7: In-memory rolling buffer of the last 5 messages per source
# Safe messages are NEVER written to database; only kept in-memory for context.
ROLLING_BUFFER: Dict[str, deque] = defaultdict(lambda: deque(maxlen=5))

# Global control flag for the continuous background worker loop
BACKGROUND_WORKER_TASK: Optional[asyncio.Task] = None
IS_WORKER_RUNNING = False


def run_classifier_safely(text: str, target_user: Optional[str] = None, context: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Hard Rule 2: Calls classifier ONLY through classify_text(text, target_user=None, context=None).
    Adapts safely whether teammate's context parameter has merged or not.
    """
    try:
        sig = inspect.signature(classify_text)
        if "context" in sig.parameters:
            return classify_text(text, target_user=target_user, context=context)
        else:
            return classify_text(text, target_user=target_user)
    except Exception:
        return classify_text(text, target_user=target_user)


def record_scanned_increment(count: int = 1):
    """
    Hard Rule 3: After classifying each incoming message call db_brain.increment_scanned(1)
    inside a try/except ImportError.
    """
    try:
        import db_brain
        if hasattr(db_brain, "increment_scanned"):
            db_brain.increment_scanned(count)
    except (ImportError, Exception):
        pass


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
    Processes a single raw message item through the pipeline:
    1. Check for Telegram callback_query
    2. Normalize message
    3. Respect source privacy_mode (full | trigger_only | report_only)
    4. Retrieve 3 preceding messages from rolling buffer
    5. Run classifier & increment scanned count
    6. Store in DB ONLY if flagged
    7. Push to in-memory buffer
    """
    # Check if raw item is a Telegram moderator callback query
    if "callback_query" in raw:
        handle_telegram_callback(raw["callback_query"])
        return None

    norm = connector.normalize(raw)
    source_key = str(source.get("id"))

    # Check if already processed and stored
    existing = db.get_message_by_id(norm.id)
    if existing:
        return None

    # Retrieve up to 3 preceding messages for conversational context
    preceding_context = list(ROLLING_BUFFER[source_key])[-3:]

    # Check privacy mode on source
    privacy_mode = source.get("privacy_mode", "full")
    is_force_flagged = raw.get("_force_flagged", False)

    if privacy_mode == "report_only" and not is_force_flagged:
        # report_only: skip automated scanning; only record in memory buffer
        ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")
        return None

    if privacy_mode == "trigger_only" and not is_force_flagged:
        # trigger_only: only scan if message mentions a user (@)
        if not norm.target_user and "@" not in norm.text:
            ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")
            return None

    # Classify message text
    classification = run_classifier_safely(
        text=norm.text,
        target_user=norm.target_user,
        context=preceding_context
    )

    # Hard Rule 3: Call db_brain.increment_scanned(1)
    record_scanned_increment(1)

    is_flagged = classification.get("flagged", False) or is_force_flagged

    # Privacy Rule 7: NEVER store safe messages in database
    if not is_flagged:
        # Buffer safe message in memory for situational context of future messages
        ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")
        return None

    # Flagged incident: store in database
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

    # Increment source flags_count
    cursor.execute("""
    UPDATE sources SET flags_count = flags_count + 1 WHERE id = ?
    """, (source.get("id"),))
    conn.commit()
    conn.close()

    # Append to rolling buffer as well so future messages see it in context
    ROLLING_BUFFER[source_key].append(f"{norm.sender_name}: {norm.text}")

    # Dispatch alerts
    msg_dict = db.get_message_by_id(norm.id)
    if msg_dict:
        if severity == "high":
            send_high_severity_alert(msg_dict)
        else:
            queue_low_severity_digest(msg_dict)

    return msg_dict


async def sync_connected_source(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Polls a single connected source for new messages, classifies them,
    and stores flagged incidents.
    """
    platform = source.get("platform")
    source_id = source.get("channel_id") or source.get("id")
    connector = get_connector_for_platform(platform)
    if not connector:
        return []

    new_flagged = []
    try:
        raw_items = await connector.fetch_new_messages(source_id=source_id, limit=20)
        for raw in raw_items:
            res = await process_raw_item(raw, source, connector)
            if res:
                new_flagged.append(res)
    except Exception as e:
        print(f"[IngestWorker] Error syncing source {source.get('id')}: {e}")

    return new_flagged


async def sync_all_sources() -> Dict[str, Any]:
    """
    Manual trigger endpoint (POST /sources/sync) and periodic background routine.
    Syncs all connected community sources across platforms.
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


# ============================================================================
# Background Worker Task (Task 2)
# ============================================================================

async def background_ingest_loop():
    """
    Task 2: Continuous background task started on app startup.
    Periodically processes connected sources and triggers retention cleanup.
    """
    global IS_WORKER_RUNNING
    IS_WORKER_RUNNING = True
    print("[BackgroundWorker] Continuous source ingestion worker started.")

    cleanup_counter = 0

    while IS_WORKER_RUNNING:
        try:
            # Sync sources
            await sync_all_sources()

            # Once every ~300 iterations (approx 25 mins), run retention cleanup
            cleanup_counter += 1
            if cleanup_counter >= 300:
                cleanup_counter = 0
                db_ops.cleanup_old_messages()

        except asyncio.CancelledError:
            print("[BackgroundWorker] Ingestion worker cancelled.")
            break
        except Exception as e:
            print(f"[BackgroundWorker] Unexpected error in loop: {e}")

        # Sleep before next cycle (5 seconds interval for responsive real-time moderation)
        await asyncio.sleep(5)


def start_background_worker():
    """Starts the background worker task if not already running."""
    global BACKGROUND_WORKER_TASK
    if BACKGROUND_WORKER_TASK is None or BACKGROUND_WORKER_TASK.done():
        loop = asyncio.get_event_loop()
        BACKGROUND_WORKER_TASK = loop.create_task(background_ingest_loop())


def stop_background_worker():
    """Gracefully cancels the background worker task."""
    global BACKGROUND_WORKER_TASK, IS_WORKER_RUNNING
    IS_WORKER_RUNNING = False
    if BACKGROUND_WORKER_TASK and not BACKGROUND_WORKER_TASK.done():
        BACKGROUND_WORKER_TASK.cancel()
