"""
Alert service for moderator notifications via Telegram Bot webhook.
Dispatches instant alerts for high-severity incidents and batches low-severity flags into digests.
"""

import os
import requests
from typing import Dict, Any, List
from datetime import datetime, timezone

# In-memory digest queue for batching low severity flags
DIGEST_QUEUE: List[Dict[str, Any]] = []


def send_high_severity_alert(message: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends an immediate Telegram DM alert to the community moderator with:
    snippet, category, channel, sender, and deep link to the dashboard item.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_MODERATOR_CHAT_ID")
    mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"

    dashboard_url = f"http://localhost:5173/?msg_id={message.get('id', 'unknown')}"
    snippet = message.get("text", "")
    if len(snippet) > 100:
        snippet = snippet[:100] + "..."

    alert_body = (
        f"[VAANI HIGH-SEVERITY ALERT]\n\n"
        f"• Channel: {message.get('channel_name')} ({message.get('platform', '').upper()})\n"
        f"• Category: {message.get('category')}\n"
        f"• Sender: {message.get('sender_name')}\n"
        f"• Target User: {message.get('target_user') or 'None'}\n\n"
        f"• Message Snippet:\n_{snippet}_\n\n"
        f"Review in Dashboard: {dashboard_url}"
    )

    # Real dispatch if credentials provided and not mock demo token
    if not mock_mode and bot_token and chat_id and not bot_token.endswith("_DEMO"):
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": alert_body,
                "disable_web_page_preview": False,
            }
            res = requests.post(url, json=payload, timeout=5)
            if res.status_code == 200:
                return {
                    "dispatched": True,
                    "channel": "telegram_bot",
                    "chat_id": chat_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "simulated": False
                }
        except Exception as e:
            print(f"[AlertService] Telegram dispatch failed: {e}")

    # Simulated / MOCK_MODE dispatch
    print(f"\n--- [VAANI TELEGRAM MODERATOR ALERT DISPATCHED] ---\n{alert_body.encode('ascii', errors='replace').decode('ascii')}\n------------------------------------------------\n")
    return {
        "dispatched": True,
        "channel": "telegram_bot",
        "chat_id": chat_id or "984729182",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "simulated": True,
        "formatted_alert": alert_body
    }


def queue_low_severity_digest(message: Dict[str, Any]):
    """
    Batches low-severity items for daily digest delivery.
    """
    DIGEST_QUEUE.append({
        "id": message.get("id"),
        "channel": message.get("channel_name"),
        "platform": message.get("platform"),
        "category": message.get("category"),
        "text": message.get("text"),
        "timestamp": message.get("timestamp"),
    })


def get_pending_digest() -> List[Dict[str, Any]]:
    return list(DIGEST_QUEUE)
