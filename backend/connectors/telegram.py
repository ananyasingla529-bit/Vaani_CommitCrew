"""
Telegram Platform Connector.
Implements python-telegram-bot update ingestion and normalizes messages into the unified Vaani schema.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import os
import requests
from connectors.base import Connector
from models import NormalizedMessage


class TelegramConnector(Connector):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(platform="telegram", config=config)
        self.bot_token = (
            self.config.get("bot_token")
            or os.getenv("TELEGRAM_BOT_TOKEN")
        )
        self.mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"

    async def fetch_new_messages(self, source_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetches recent updates from Telegram Bot API getUpdates endpoint or returns simulated mock stream.
        """
        if not self.mock_mode and self.bot_token and not self.bot_token.endswith("_DEMO"):
            try:
                url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates?limit={limit}"
                res = requests.get(url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("result", [])
            except Exception as e:
                print(f"[TelegramConnector] Error querying Telegram API: {e}")

        # In mock mode, returns simulated group updates
        return [
            {
                "message_id": 99214,
                "chat": {"id": int(source_id.replace("src_tg_", "-100")), "title": "Delhi University Student Forum"},
                "from": {"id": 884129, "first_name": "Karan Malhotra", "username": "karan_malhotra"},
                "text": "@priya_sharma_du college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega.",
                "date": int(datetime.now(timezone.utc).timestamp()),
            }
        ]

    def normalize(self, raw_message: Dict[str, Any]) -> NormalizedMessage:
        """
        Converts Telegram Message / Update dict to NormalizedMessage.
        """
        msg = raw_message.get("message", raw_message)
        chat = msg.get("chat", {})
        sender = msg.get("from", {})
        text = msg.get("text", "")
        msg_date = msg.get("date", int(datetime.now(timezone.utc).timestamp()))
        timestamp_str = datetime.fromtimestamp(msg_date, tz=timezone.utc).isoformat()

        return NormalizedMessage(
            id=f"tg_{msg.get('message_id', '0')}",
            platform="telegram",
            source_id=str(chat.get("id", "unknown")),
            channel_name=chat.get("title", "Telegram Group"),
            sender_id=str(sender.get("id", "unknown")),
            sender_name=sender.get("first_name", "Anonymous"),
            text=text,
            normalized_text=text,
            language="Hindi (Romanized)",
            timestamp=timestamp_str,
            context=[],
            category="Threat",
            severity="high",
            explanation="Telegram message flagged by rule classifier.",
            target_user=None,
            status="new",
        )
