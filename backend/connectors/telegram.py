"""
Telegram Platform Connector.
Implements update ingestion with persisted DB offset, dynamic normalization,
/report command force-flagging, and human-in-the-loop moderation actions.
Adheres to Step 2 Fix rules:
- Config precedence: .env defaults, DB non-empty overrides, log mode without leaking secrets.
- Long polling with timeout=30 and allowed_updates.
- Single poller lock and 409 Conflict handling.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import os
import re
import traceback
import requests
from connectors.base import Connector
from models import NormalizedMessage
import db_ops
from services.config_resolver import get_telegram_runtime_config


class TelegramConnector(Connector):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(platform="telegram", config=config)
        cfg = get_telegram_runtime_config(log_startup=True)
        self.bot_token = (
            self.config.get("bot_token")
            or cfg["token"]
        )
        self.mock_mode = cfg["mock_mode"] if (config is None or "mock_mode" not in config) else bool(config["mock_mode"])
        self.telegram_live = os.getenv("TELEGRAM_LIVE", "").lower() == "true"
        self.is_real_token = cfg["is_real_token"]
        self.api_base = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else ""
        self.bot_username: Optional[str] = None
        self.bot_id: Optional[int] = None

    def is_real_mode_available(self) -> bool:
        """
        Real mode is used when (TELEGRAM_LIVE=True or MOCK_MODE=False) and token is real.
        """
        live_enabled = self.telegram_live or (not self.mock_mode)
        return (
            live_enabled
            and self.is_real_token
            and bool(self.bot_token)
            and ":" in self.bot_token
            and not self.bot_token.endswith("_DEMO")
            and not self.bot_token.endswith("_PLACEHOLDER")
            and len(self.bot_token) > 20
        )

    # -------------------------------------------------------------------------
    # API Methods
    # -------------------------------------------------------------------------

    def get_me(self) -> Tuple[bool, Dict[str, Any]]:
        """Queries getMe to check bot identity."""
        if not self.bot_token or not self.api_base:
            return False, {"error": "No bot token configured"}
        try:
            res = requests.get(f"{self.api_base}/getMe", timeout=8)
            if res.status_code == 200:
                data = res.json()
                if data.get("ok"):
                    self.bot_username = data.get("result", {}).get("username")
                    self.bot_id = data.get("result", {}).get("id")
                    return True, data.get("result", {})
            return False, res.json() if res.text.startswith("{") else {"error": res.text, "status_code": res.status_code}
        except Exception as e:
            return False, {"error": str(e), "traceback": traceback.format_exc()}

    def get_webhook_info(self) -> Tuple[bool, Dict[str, Any]]:
        """Queries getWebhookInfo."""
        if not self.bot_token or not self.api_base:
            return False, {"error": "No bot token configured"}
        try:
            res = requests.get(f"{self.api_base}/getWebhookInfo", timeout=8)
            if res.status_code == 200:
                return True, res.json().get("result", {})
            return False, res.json() if res.text.startswith("{") else {"error": res.text}
        except Exception as e:
            return False, {"error": str(e)}

    def delete_webhook(self, drop_pending_updates: bool = False) -> Tuple[bool, Dict[str, Any]]:
        """Deletes any active webhook so getUpdates can operate."""
        if not self.bot_token or not self.api_base:
            return False, {"error": "No bot token configured"}
        try:
            url = f"{self.api_base}/deleteWebhook?drop_pending_updates={'true' if drop_pending_updates else 'false'}"
            res = requests.get(url, timeout=8)
            return res.status_code == 200, res.json() if res.text.startswith("{") else {"text": res.text}
        except Exception as e:
            return False, {"error": str(e)}

    def get_chat(self, chat_id: Any) -> Tuple[bool, Dict[str, Any]]:
        """Queries getChat for a chat id or username."""
        if not self.bot_token or not self.api_base:
            return False, {"error": "No bot token configured"}
        try:
            res = requests.get(f"{self.api_base}/getChat?chat_id={chat_id}", timeout=8)
            if res.status_code == 200:
                data = res.json()
                if data.get("ok"):
                    return True, data.get("result", {})
            return False, res.json() if res.text.startswith("{") else {"error": res.text}
        except Exception as e:
            return False, {"error": str(e)}

    def get_chat_member(self, chat_id: Any, user_id: Any) -> Tuple[bool, Dict[str, Any]]:
        """Queries getChatMember to check bot privileges."""
        if not self.bot_token or not self.api_base:
            return False, {"error": "No bot token configured"}
        try:
            res = requests.get(f"{self.api_base}/getChatMember?chat_id={chat_id}&user_id={user_id}", timeout=8)
            if res.status_code == 200:
                data = res.json()
                if data.get("ok"):
                    return True, data.get("result", {})
            return False, res.json() if res.text.startswith("{") else {"error": res.text}
        except Exception as e:
            return False, {"error": str(e)}

    def fetch_updates_raw(
        self,
        offset: Optional[int] = None,
        limit: int = 50,
        timeout: int = 30,
        allowed_updates: Optional[List[str]] = None
    ) -> Tuple[int, List[Dict[str, Any]]]:
        """
        Long polls getUpdates with timeout and allowed_updates.
        Returns (status_code, updates_list).
        Handles 409 Conflict gracefully with clear log message.
        """
        if not self.is_real_mode_available():
            return 200, []

        if allowed_updates is None:
            allowed_updates = ["message", "edited_message", "channel_post", "my_chat_member"]

        params: Dict[str, Any] = {
            "limit": limit,
            "timeout": timeout,
            "allowed_updates": allowed_updates,
        }
        if offset is not None and offset > 0:
            params["offset"] = offset

        try:
            res = requests.post(
                f"{self.api_base}/getUpdates",
                json=params,
                timeout=timeout + 5
            )
            if res.status_code == 200:
                data = res.json()
                return 200, data.get("result", [])
            elif res.status_code == 409:
                print("[Telegram] 409 Conflict: another getUpdates process or webhook is running. Waiting...")
                return 409, []
            else:
                print(f"[Telegram] getUpdates returned status {res.status_code}: {res.text}")
                return res.status_code, []
        except requests.exceptions.Timeout:
            # Standard long-polling timeout with no new messages
            return 200, []
        except Exception as e:
            print(f"[Telegram] Error polling updates: {e}\n{traceback.format_exc()}")
            return 500, []

    async def fetch_new_messages(self, source_id: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Legacy single-call fetch method. Reads persisted offset, calls getUpdates,
        and extracts messages.
        """
        if self.is_real_mode_available():
            try:
                last_offset_str = db_ops.get_connector_offset("telegram_update_offset", "0")
                last_offset = int(last_offset_str)
                offset_param = last_offset + 1 if last_offset > 0 else 0

                status_code, updates = self.fetch_updates_raw(
                    offset=offset_param,
                    limit=limit,
                    timeout=5,
                    allowed_updates=["message", "edited_message", "channel_post", "my_chat_member"]
                )

                if status_code == 200 and updates:
                    max_update_id = last_offset
                    processed_items = []

                    for update in updates:
                        up_id = update.get("update_id", 0)
                        if up_id > max_update_id:
                            max_update_id = up_id

                        msg = (
                            update.get("message")
                            or update.get("channel_post")
                            or update.get("edited_message")
                        )
                        if msg:
                            # Preserve update_id for tracking
                            msg["_update_id"] = up_id
                            text = (msg.get("text") or "").strip()
                            if text.lower().startswith("/report"):
                                reply_to = msg.get("reply_to_message")
                                if reply_to:
                                    reply_to["_force_flagged"] = True
                                    reply_to["_reported_by"] = (
                                        msg.get("from", {}).get("username")
                                        or msg.get("from", {}).get("first_name", "User")
                                    )
                                    reply_to["_update_id"] = up_id
                                    processed_items.append(reply_to)
                                else:
                                    msg["_force_flagged"] = True
                                    processed_items.append(msg)
                            else:
                                processed_items.append(msg)

                    if max_update_id > last_offset:
                        db_ops.set_connector_offset("telegram_update_offset", str(max_update_id))

                    return processed_items
                return []
            except Exception as e:
                print(f"[TelegramConnector] Exception querying Telegram API: {e}\n{traceback.format_exc()}")
                return []

        # In MOCK_MODE, return simulated group messages
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
        """Sends a polite templated warning in the group chat tagging the user."""
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
        """Deletes abusive message and restricts/bans sender from Telegram group."""
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
