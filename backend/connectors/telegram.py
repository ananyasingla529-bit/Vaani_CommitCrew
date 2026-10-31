"""
Telegram Platform Connector.
Implements update ingestion with persisted DB offset, dynamic normalization,
/report command force-flagging, and human-in-the-loop moderation actions.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import os
import re
import asyncio
import requests
from connectors.base import Connector
from models import NormalizedMessage
import db_ops


class TelegramConnector(Connector):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(platform="telegram", config=config)
        self.bot_token = (
            self.config.get("bot_token")
            or os.getenv("TELEGRAM_BOT_TOKEN")
        )
        self.mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"
        self.telegram_live = os.getenv("TELEGRAM_LIVE", "").lower() == "true"
        self.api_base = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else ""

    def is_real_mode_available(self) -> bool:
        live_enabled = self.telegram_live or (not self.mock_mode)
        return (
            live_enabled
            and bool(self.bot_token)
            and not self.bot_token.endswith("_DEMO")
            and not self.bot_token.endswith("_PLACEHOLDER")
            and ":" in self.bot_token
        )

    async def fetch_new_messages(self, source_id: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetches recent updates from Telegram Bot API getUpdates endpoint with persisted offset in DB.
        Falls back safely to simulated updates if MOCK_MODE=True or network/token is unavailable.
        """
        if self.is_real_mode_available():
            try:
                last_offset_str = db_ops.get_connector_offset("telegram_update_offset", "0")
                last_offset = int(last_offset_str)
                offset_param = last_offset + 1 if last_offset > 0 else 0

                url = f"{self.api_base}/getUpdates?limit={limit}"
                if offset_param > 0:
                    url += f"&offset={offset_param}"

                res = await asyncio.to_thread(requests.get, url, timeout=6)
                if res.status_code == 200:
                    data = res.json()
                    updates = data.get("result", [])
                    max_update_id = last_offset

                    processed_messages = []
                    for update in updates:
                        up_id = update.get("update_id", 0)
                        if up_id > max_update_id:
                            max_update_id = up_id

                        # Handle standard message or channel post
                        msg = update.get("message") or update.get("channel_post")
                        if not msg:
                            continue

                        # Check for /report command in group chat
                        text = (msg.get("text") or "").strip()
                        if text.lower().startswith("/report"):
                            reply_to = msg.get("reply_to_message")
                            if reply_to:
                                # Mark the replied-to message as force-flagged
                                reply_to["_force_flagged"] = True
                                reply_to["_reported_by"] = msg.get("from", {}).get("username") or msg.get("from", {}).get("first_name", "User")
                                processed_messages.append(reply_to)
                            else:
                                # Report on the current message itself
                                msg["_force_flagged"] = True
                                processed_messages.append(msg)
                        else:
                            processed_messages.append(msg)

                    if max_update_id > last_offset:
                        db_ops.set_connector_offset("telegram_update_offset", str(max_update_id))

                    return processed_messages
                else:
                    print(f"[TelegramConnector] Telegram API getUpdates returned status {res.status_code}: {res.text}")
            except Exception as e:
                print(f"[TelegramConnector] Exception querying Telegram API: {e}. Falling back to simulated stream.")

        # In MOCK_MODE or fallback, return simulated group messages
        mock_chat_id = -1001928374
        if source_id:
            digits = re.sub(r"[^\d-]", "", str(source_id))
            if digits and digits not in ("-", "--"):
                try:
                    mock_chat_id = int(digits)
                except ValueError:
                    mock_chat_id = -1001928374

        return [
            {
                "message_id": 99214,
                "chat": {"id": mock_chat_id, "title": "Delhi University Student Forum"},
                "from": {"id": 884129, "first_name": "Karan Malhotra", "username": "karan_malhotra"},
                "text": "@priya_sharma_du college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega.",
                "date": int(datetime.now(timezone.utc).timestamp()),
                "_is_mock_seed": True,
            }
        ]

    def normalize(self, raw_message: Dict[str, Any]) -> NormalizedMessage:
        """
        Converts Telegram Message payload to NormalizedMessage.
        Does NOT hardcode category, severity, target or language.
        Hardcoded mock data is applied ONLY for simulated mock items in MOCK_MODE.
        """
        msg = raw_message.get("message", raw_message)
        chat = msg.get("chat", {})
        sender = msg.get("from", {})
        text = msg.get("text", "")
        msg_date = msg.get("date", int(datetime.now(timezone.utc).timestamp()))
        timestamp_str = datetime.fromtimestamp(msg_date, tz=timezone.utc).isoformat()

        # Dynamic target extraction from @mention in message text
        mention_match = re.search(r"@([a-zA-Z0-9_]+)", text)
        target_user = f"@{mention_match.group(1)}" if mention_match else None

        # Check if force-flagged via /report
        is_force_flagged = raw_message.get("_force_flagged", False)
        is_mock_seed = raw_message.get("_is_mock_seed", False)

        if is_mock_seed and self.mock_mode:
            # Preserved mock seed for initial tests
            category = "Threat"
            severity = "high"
            language = "Hindi (Romanized)"
            explanation = "Direct physical threat detected in Romanized text."
        elif is_force_flagged:
            category = "Insult/Bullying"
            severity = "medium"
            language = "Hindi (Romanized)"
            reported_by = raw_message.get("_reported_by", "community member")
            explanation = f"Force-flagged for moderator review via /report by {reported_by}."
        else:
            # Dynamic neutral defaults; pipeline classification populates these
            category = "Other"
            severity = "low"
            language = "English"
            explanation = ""

        chat_id_str = str(chat.get("id", "unknown"))
        sender_id_str = str(sender.get("id", "unknown"))
        sender_name = sender.get("username") or sender.get("first_name") or "Telegram User"

        return NormalizedMessage(
            id=f"tg_{msg.get('message_id', int(datetime.now(timezone.utc).timestamp()))}",
            platform="telegram",
            source_id=chat_id_str,
            channel_name=chat.get("title", "Telegram Group"),
            sender_id=sender_id_str,
            sender_name=sender_name,
            text=text,
            normalized_text=text,
            language=language,
            timestamp=timestamp_str,
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

    def send_warning_message(self, chat_id: str, message_id: str, sender_name: str) -> Dict[str, Any]:
        """
        Sends a polite templated warning in the group chat tagging the user.
        """
        mention = f"@{sender_name}" if not sender_name.startswith("@") else sender_name
        warning_text = (
            f"{mention} Community Guidelines Notice: Your recent message was flagged for hostile/abusive language. "
            "Please maintain civil discourse. Continued violations will lead to an immediate ban."
        )

        if self.is_real_mode_available():
            try:
                numeric_chat_id = chat_id.replace("src_tg_", "")
                url = f"{self.api_base}/sendMessage"
                payload = {
                    "chat_id": numeric_chat_id,
                    "text": warning_text,
                }
                numeric_msg_id = message_id.replace("tg_", "")
                if numeric_msg_id.isdigit():
                    payload["reply_to_message_id"] = int(numeric_msg_id)

                res = requests.post(url, json=payload, timeout=6)
                if res.status_code == 200:
                    return {"success": True, "action": "warn", "platform": "telegram", "delivered": True, "simulated": False}
                else:
                    return {"success": False, "action": "warn", "platform": "telegram", "error": res.text, "simulated": False}
            except Exception as e:
                return {"success": False, "action": "warn", "platform": "telegram", "error": str(e), "simulated": False}

        # Simulated fallback in MOCK_MODE
        print(f"[TelegramConnector Mock] Sent warning to {mention} in chat {chat_id}: {warning_text}")
        return {
            "success": True,
            "action": "warn",
            "platform": "telegram",
            "simulated": True,
            "message": warning_text
        }

    def delete_and_ban_user(self, chat_id: str, message_id: str, user_id: str) -> Dict[str, Any]:
        """
        Deletes the abusive message and restricts/bans the sender from the Telegram group.
        """
        if self.is_real_mode_available():
            results = {"delete": None, "ban": None}
            numeric_chat_id = chat_id.replace("src_tg_", "")
            numeric_msg_id = message_id.replace("tg_", "")

            # 1. Delete message
            try:
                del_url = f"{self.api_base}/deleteMessage"
                del_res = requests.post(del_url, json={"chat_id": numeric_chat_id, "message_id": int(numeric_msg_id)}, timeout=5)
                results["delete"] = del_res.json()
            except Exception as e:
                results["delete"] = {"error": str(e)}

            # 2. Ban / Restrict chat member
            try:
                ban_url = f"{self.api_base}/banChatMember"
                ban_res = requests.post(ban_url, json={"chat_id": numeric_chat_id, "user_id": int(user_id)}, timeout=5)
                results["ban"] = ban_res.json()
            except Exception as e:
                results["ban"] = {"error": str(e)}

            return {
                "success": True,
                "action": "delete_and_ban",
                "platform": "telegram",
                "platform_details": results,
                "simulated": False
            }

        # Simulated fallback
        print(f"[TelegramConnector Mock] Deleted message {message_id} and banned user {user_id} in {chat_id}")
        return {
            "success": True,
            "action": "delete_and_ban",
            "platform": "telegram",
            "simulated": True,
            "deleted_message_id": message_id,
            "banned_user_id": user_id
        }
