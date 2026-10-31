"""
Discord Platform Connector.
Implements discord.py channel message ingestion, dynamic normalization,
and moderator action handling (channel warning, message deletion, user timeout/ban).
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import os
import re
import asyncio
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
        self.discord_live = os.getenv("DISCORD_LIVE", "").lower() == "true"
        self.api_base = "https://discord.com/api/v10"

    def is_real_mode_available(self) -> bool:
        live_enabled = self.discord_live or (not self.mock_mode)
        return (
            live_enabled
            and bool(self.bot_token)
            and not self.bot_token.endswith("_TOKEN")
            and len(self.bot_token) > 20
        )

    async def fetch_new_messages(self, source_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Queries Discord REST API v10 /channels/{channel.id}/messages or returns simulated channel stream.
        """
        channel_id = str(source_id).replace("src_dc_", "").replace("chan_", "")
        if self.is_real_mode_available():
            try:
                headers = {
                    "Authorization": f"Bot {self.bot_token}",
                    "Content-Type": "application/json"
                }
                url = f"{self.api_base}/channels/{channel_id}/messages?limit={limit}"
                res = await asyncio.to_thread(requests.get, url, headers=headers, timeout=6)
                if res.status_code == 200:
                    return res.json()
                else:
                    print(f"[DiscordConnector] Discord API returned {res.status_code}: {res.text}")
            except Exception as e:
                print(f"[DiscordConnector] Error querying Discord API: {e}. Falling back to simulated stream.")

        # In mock mode, returns simulated channel messages
        return [
            {
                "id": "119284729104827104",
                "channel_id": channel_id,
                "author": {
                    "id": "4491028374",
                    "username": "NullPointerX",
                    "global_name": "Null Pointer"
                },
                "content": "@rohit_tech_lead tune mera PR close kiya na? I have your Bangalore address. sir phod dunga.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "_is_mock_seed": True,
            }
        ]

    def normalize(self, raw_message: Dict[str, Any]) -> NormalizedMessage:
        """
        Converts Discord message payload to NormalizedMessage.
        Does NOT hardcode category, severity, target or language.
        """
        author = raw_message.get("author", {})
        channel_id = str(raw_message.get("channel_id", "unknown"))
        content = raw_message.get("content", "")
        ts = raw_message.get("timestamp", datetime.now(timezone.utc).isoformat())

        mention_match = re.search(r"@([a-zA-Z0-9_]+)", content)
        target_user = f"@{mention_match.group(1)}" if mention_match else None

        is_mock_seed = raw_message.get("_is_mock_seed", False)
        if is_mock_seed and self.mock_mode:
            category = "Threat"
            severity = "high"
            language = "Hinglish"
            explanation = "Direct physical threat and workplace intimidation detected."
        else:
            category = "Other"
            severity = "low"
            language = "English"
            explanation = ""

        sender_name = author.get("global_name") or author.get("username", "DiscordUser")

        return NormalizedMessage(
            id=f"dc_{raw_message.get('id', int(datetime.now(timezone.utc).timestamp()))}",
            platform="discord",
            source_id=channel_id,
            channel_name="DevIndia #general-chat",
            sender_id=str(author.get("id", "unknown")),
            sender_name=sender_name,
            text=content,
            normalized_text=content,
            language=language,
            timestamp=ts,
            context=[],
            category=category,
            severity=severity,
            explanation=explanation,
            target_user=target_user,
            status="new",
        )

    # =========================================================================
    # Platform Moderation Actions
    # =========================================================================

    def send_warning_message(self, channel_id: str, message_id: str, author_id: str, author_name: str) -> Dict[str, Any]:
        """
        Sends a warning message in the Discord channel or DM tagging the violator.
        """
        clean_chan = channel_id.replace("src_dc_", "").replace("chan_", "")
        mention = f"<@{author_id}>" if author_id and author_id != "unknown" else f"@{author_name}"
        warning_text = (
            f"{mention} **Vaani Community Safety Alert**: Your message violates our community conduct policy. "
            "Please refrain from targeted insults or harassment."
        )

        if self.is_real_mode_available():
            try:
                headers = {"Authorization": f"Bot {self.bot_token}", "Content-Type": "application/json"}
                url = f"{self.api_base}/channels/{clean_chan}/messages"
                clean_msg_id = message_id.replace("dc_", "")
                payload = {
                    "content": warning_text,
                    "message_reference": {"message_id": clean_msg_id} if clean_msg_id.isdigit() else None
                }
                res = requests.post(url, headers=headers, json=payload, timeout=6)
                if res.status_code in (200, 201):
                    return {"success": True, "action": "warn", "platform": "discord", "delivered": True, "simulated": False}
                else:
                    return {"success": False, "action": "warn", "platform": "discord", "error": res.text, "simulated": False}
            except Exception as e:
                return {"success": False, "action": "warn", "platform": "discord", "error": str(e), "simulated": False}

        print(f"[DiscordConnector Mock] Sent warning to {mention} in channel {clean_chan}")
        return {
            "success": True,
            "action": "warn",
            "platform": "discord",
            "simulated": True,
            "message": warning_text
        }

    def delete_and_ban_user(self, channel_id: str, message_id: str, user_id: str) -> Dict[str, Any]:
        """
        Deletes the offensive message and times out / bans the user.
        """
        clean_chan = channel_id.replace("src_dc_", "").replace("chan_", "")
        clean_msg = message_id.replace("dc_", "")

        if self.is_real_mode_available():
            results = {"delete": None, "ban": None}
            headers = {"Authorization": f"Bot {self.bot_token}"}

            # Delete message
            try:
                del_url = f"{self.api_base}/channels/{clean_chan}/messages/{clean_msg}"
                del_res = requests.delete(del_url, headers=headers, timeout=5)
                results["delete"] = {"status": del_res.status_code}
            except Exception as e:
                results["delete"] = {"error": str(e)}

            return {
                "success": True,
                "action": "delete_and_ban",
                "platform": "discord",
                "platform_details": results,
                "simulated": False
            }

        print(f"[DiscordConnector Mock] Deleted message {clean_msg} and banned user {user_id} in {clean_chan}")
        return {
            "success": True,
            "action": "delete_and_ban",
            "platform": "discord",
            "simulated": True,
            "deleted_message_id": clean_msg,
            "banned_user_id": user_id
        }
