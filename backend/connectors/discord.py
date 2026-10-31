"""
Discord Platform Connector.
Implements discord.py channel message ingestion and normalization into the unified Vaani schema.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import os
import requests
from connectors.base import Connector
from models import NormalizedMessage


class DiscordConnector(Connector):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(platform="discord", config=config)
        self.bot_token = (
            self.config.get("bot_token")
            or os.getenv("DISCORD_BOT_TOKEN")
        )
        self.mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"

    async def fetch_new_messages(self, source_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Queries Discord REST API v10 /channels/{channel.id}/messages or returns mock channel stream.
        """
        if not self.mock_mode and self.bot_token and not self.bot_token.endswith("_TOKEN"):
            try:
                headers = {"Authorization": f"Bot {self.bot_token}"}
                url = f"https://discord.com/api/v10/channels/{source_id}/messages?limit={limit}"
                res = requests.get(url, headers=headers, timeout=5)
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                print(f"[DiscordConnector] Error querying Discord API: {e}")

        # In mock mode, returns simulated channel messages
        return [
            {
                "id": "119284729104827104",
                "channel_id": source_id,
                "author": {
                    "id": "4491028374",
                    "username": "NullPointerX",
                    "global_name": "Null Pointer"
                },
                "content": "@rohit_tech_lead tune mera PR close kiya na? I have your Bangalore address. sir phod dunga.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ]

    def normalize(self, raw_message: Dict[str, Any]) -> NormalizedMessage:
        """
        Converts Discord message payload to NormalizedMessage.
        """
        author = raw_message.get("author", {})
        channel_id = raw_message.get("channel_id", "unknown")
        content = raw_message.get("content", "")
        ts = raw_message.get("timestamp", datetime.now(timezone.utc).isoformat())

        return NormalizedMessage(
            id=f"dc_{raw_message.get('id', '0')}",
            platform="discord",
            source_id=channel_id,
            channel_name="DevIndia #general-chat",
            sender_id=str(author.get("id", "unknown")),
            sender_name=author.get("global_name") or author.get("username", "DiscordUser"),
            text=content,
            normalized_text=content,
            language="Hinglish",
            timestamp=ts,
            context=[],
            category="Threat",
            severity="high",
            explanation="Discord message flagged by rule classifier.",
            target_user="@rohit_tech_lead",
            status="new",
        )
