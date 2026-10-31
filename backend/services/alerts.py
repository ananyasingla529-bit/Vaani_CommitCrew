"""
Telegram Moderator Alert and Notification Service.
Sends instant high-severity alerts with interactive inline buttons [Dismiss] [Warn] [Delete + Ban],
handles callback queries from registered moderator chat ID, updates alert message state,
batches low-severity incidents into daily digests, and respects notification settings.
"""

import os
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import database as db
import db_ops

# In-memory digest queue for batching low severity flags
DIGEST_QUEUE: List[Dict[str, Any]] = []


def is_real_telegram_available() -> bool:
    mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"
    telegram_live = os.getenv("TELEGRAM_LIVE", "").lower() == "true"
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    live_enabled = telegram_live or (not mock_mode)
    return (
        live_enabled
        and bool(token)
        and not token.endswith("_DEMO")
        and not token.endswith("_PLACEHOLDER")
        and ":" in token
    )


def send_high_severity_alert(message: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends an immediate Telegram DM alert to the community moderator with:
    snippet, category, channel, sender, explanation, deep link,
    and interactive inline buttons [Dismiss] [Warn] [Delete + Ban].
    Respects system setting: instant_high_severity.
    """
    settings = db.get_settings()
    if not settings.get("instant_high_severity", True):
        return {"dispatched": False, "reason": "instant_high_severity disabled in settings"}

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_MODERATOR_CHAT_ID", settings.get("telegram_chat_id", "984729182"))
    msg_id = message.get("id", "unknown")
    channel_name = message.get("channel_name", "Community Channel")
    platform = str(message.get("platform", "telegram")).upper()
    category = message.get("category", "Threat")
    severity = message.get("severity", "high").upper()
    sender_name = message.get("sender_name", "Unknown")
    target_user = message.get("target_user") or "None"
    explanation = message.get("explanation", "High-severity violation detected.")

    dashboard_url = f"http://localhost:5173/?msg_id={msg_id}"
    snippet = message.get("text", "")
    if len(snippet) > 120:
        snippet = snippet[:120] + "..."

    alert_body = (
        f"🚨 *[VAANI HIGH-SEVERITY ALERT]*\n\n"
        f"• *Channel:* {channel_name} ({platform})\n"
        f"• *Severity:* {severity} | *Category:* {category}\n"
        f"• *Sender:* {sender_name}\n"
        f"• *Target User:* {target_user}\n"
        f"• *Rationale:* {explanation}\n\n"
        f"💬 *Message Snippet:*\n_{snippet}_\n\n"
        f"🔗 [Open in Moderator Console]({dashboard_url})"
    )

    inline_keyboard = {
        "inline_keyboard": [
            [
                {"text": "❌ Dismiss", "callback_data": f"act:dismiss:{msg_id}"},
                {"text": "⚠️ Warn", "callback_data": f"act:warn:{msg_id}"},
                {"text": "🚫 Delete + Ban", "callback_data": f"act:delete_and_ban:{msg_id}"}
            ]
        ]
    }

    if is_real_telegram_available() and chat_id:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": alert_body,
                "parse_mode": "Markdown",
                "reply_markup": inline_keyboard,
                "disable_web_page_preview": False,
            }
            res = requests.post(url, json=payload, timeout=6)
            if res.status_code == 200:
                resp_json = res.json()
                sent_msg_id = resp_json.get("result", {}).get("message_id")
                return {
                    "dispatched": True,
                    "channel": "telegram_bot",
                    "chat_id": chat_id,
                    "sent_message_id": sent_msg_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "simulated": False
                }
        except Exception as e:
            print(f"[AlertService] Telegram dispatch failed: {e}")

    # Simulated dispatch for mock mode / development
    print("\n--- [VAANI TELEGRAM MODERATOR ALERT DISPATCHED] ---")
    print(alert_body.encode("ascii", errors="replace").decode("ascii"))
    print("Inline Buttons: [Dismiss] [Warn] [Delete + Ban]")
    print("---------------------------------------------------\n")
    return {
        "dispatched": True,
        "channel": "telegram_bot",
        "chat_id": chat_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "simulated": True,
        "formatted_alert": alert_body,
        "actions_available": ["dismiss", "warn", "delete_and_ban"]
    }


def handle_telegram_callback(callback_query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handles inline button callback queries from the moderator Telegram DM.
    1. Verifies callback is strictly from TELEGRAM_MODERATOR_CHAT_ID.
    2. Invokes action handler (services/actions.py).
    3. Edits original alert message to 'Warned by moderator at HH:MM'.
    """
    from services.actions import execute_moderator_action

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    allowed_chat_id = str(os.getenv("TELEGRAM_MODERATOR_CHAT_ID", "984729182")).strip()

    cb_id = callback_query.get("id")
    from_user = callback_query.get("from", {})
    from_id = str(from_user.get("id", ""))
    message_obj = callback_query.get("message", {})
    chat_obj = message_obj.get("chat", {})
    chat_id = str(chat_obj.get("id", ""))
    orig_msg_id = message_obj.get("message_id")
    orig_text = message_obj.get("text", "")
    data = callback_query.get("data", "")

    # Security check: verify sender is registered moderator
    if from_id != allowed_chat_id and chat_id != allowed_chat_id:
        print(f"[AlertService] Unauthorized callback from {from_id} (allowed: {allowed_chat_id})")
        if is_real_telegram_available() and cb_id:
            try:
                requests.post(
                    f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery",
                    json={"callback_query_id": cb_id, "text": "Unauthorized moderator account.", "show_alert": True},
                    timeout=5
                )
            except Exception:
                pass
        return {"success": False, "error": "Unauthorized moderator"}

    # Parse callback action: format 'act:{action}:{message_id}'
    parts = data.split(":")
    if len(parts) < 3 or parts[0] != "act":
        return {"success": False, "error": "Invalid callback data"}

    action_name = parts[1]
    target_msg_id = parts[2]
    now_time = datetime.now(timezone.utc).strftime("%H:%M UTC")

    action_label_map = {
        "warn": f"Warned by moderator at {now_time}",
        "dismiss": f"Dismissed by moderator at {now_time}",
        "false_positive": f"Dismissed as false positive at {now_time}",
        "delete_and_ban": f"Deleted & Banned by moderator at {now_time}",
        "escalate": f"Escalated by moderator at {now_time}"
    }
    resolution_label = action_label_map.get(action_name, f"Processed ({action_name}) at {now_time}")

    # Execute moderator action in backend pipeline
    action_result = execute_moderator_action(
        message_id=target_msg_id,
        status="reviewed" if action_name == "warn" else ("dismissed" if action_name == "dismiss" else "escalated"),
        action=action_name,
        reviewed_by=from_user.get("username") or f"tg_mod_{from_id}"
    )

    # Acknowledge Telegram callback query
    if is_real_telegram_available() and cb_id:
        try:
            requests.post(
                f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery",
                json={"callback_query_id": cb_id, "text": resolution_label},
                timeout=5
            )
        except Exception as e:
            print(f"[AlertService] Error answering callback query: {e}")

    # Edit the original alert message to show resolved state
    updated_text = f"{orig_text}\n\n✅ *Status:* {resolution_label}"
    if is_real_telegram_available() and orig_msg_id and chat_id:
        try:
            requests.post(
                f"https://api.telegram.org/bot{bot_token}/editMessageText",
                json={
                    "chat_id": chat_id,
                    "message_id": orig_msg_id,
                    "text": updated_text,
                    "parse_mode": "Markdown",
                    "reply_markup": {"inline_keyboard": []}  # Remove buttons after decision
                },
                timeout=5
            )
        except Exception as e:
            print(f"[AlertService] Error editing alert message: {e}")

    return {
        "success": True,
        "action": action_name,
        "message_id": target_msg_id,
        "resolution": resolution_label,
        "action_result": action_result
    }


def queue_low_severity_digest(message: Dict[str, Any]):
    """
    Batches low-severity items for daily digest delivery.
    Respects system setting: daily_digest_low.
    """
    settings = db.get_settings()
    if not settings.get("daily_digest_low", True):
        return

    DIGEST_QUEUE.append({
        "id": message.get("id"),
        "channel": message.get("channel_name"),
        "platform": message.get("platform"),
        "category": message.get("category"),
        "text": message.get("text"),
        "timestamp": message.get("timestamp"),
    })


def send_daily_digest() -> Dict[str, Any]:
    """
    Dispatches batched low-severity digest to moderator.
    """
    if not DIGEST_QUEUE:
        return {"sent": False, "count": 0, "message": "No queued items for daily digest."}

    settings = db.get_settings()
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_MODERATOR_CHAT_ID", settings.get("telegram_chat_id", "984729182"))

    items_count = len(DIGEST_QUEUE)
    digest_text = f"📋 *[VAANI DAILY LOW-SEVERITY DIGEST]*\nSummary of {items_count} minor incidents flagged today:\n\n"

    for idx, item in enumerate(DIGEST_QUEUE[:10], start=1):
        txt_snippet = item.get("text", "")[:60]
        digest_text += f"{idx}. [{item.get('platform')}] *{item.get('channel')}*: _{txt_snippet}_\n"

    if items_count > 10:
        digest_text += f"\n...and {items_count - 10} more in the dashboard."

    digest_text += f"\n\nReview all: http://localhost:5173"

    if is_real_telegram_available() and chat_id:
        try:
            requests.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": digest_text, "parse_mode": "Markdown"},
                timeout=6
            )
        except Exception as e:
            print(f"[AlertService] Error sending daily digest: {e}")

    print(f"\n--- [VAANI DAILY DIGEST DISPATCHED ({items_count} items)] ---\n{digest_text}\n-----------------------------------\n")
    DIGEST_QUEUE.clear()
    return {"sent": True, "count": items_count}


def get_pending_digest() -> List[Dict[str, Any]]:
    return list(DIGEST_QUEUE)
