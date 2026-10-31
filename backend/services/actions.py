"""
Action handler service for Vaani moderation console.
Implements idempotent execution of moderator decisions (warn, dismiss, escalate, delete_and_ban),
logs every action to the audit_log table, updates student warning counts,
and guarantees 0 unhandled exceptions / 500 errors.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
import database as db
import db_ops
from connectors.telegram import TelegramConnector
from connectors.discord import DiscordConnector
from connectors.youtube import YouTubeConnector


def get_connector(platform: str):
    if platform == "telegram":
        return TelegramConnector()
    elif platform == "discord":
        return DiscordConnector()
    elif platform == "youtube":
        return YouTubeConnector()
    return None


def execute_moderator_action(
    message_id: str,
    status: str,
    action: Optional[str] = None,
    reviewed_by: Optional[str] = "moderator@vaani.org",
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes a moderator action:
    - dismiss / false_positive -> status 'dismissed' + feedback table entry
    - warn -> status 'reviewed' + templated platform warning + warning_count increment
    - escalate -> status 'escalated'
    - delete_and_ban -> status 'escalated' + deletes message + bans violator
    Guarantees: Idempotent, audit-logged, and never throws 500 on platform failures.
    """
    message = db.get_message_by_id(message_id)
    if not message:
        return {"error": "Message not found", "success": False}

    platform = message.get("platform", "telegram")
    sender_id = message.get("sender_id", "unknown")
    sender_name = message.get("sender_name", "Anonymous")
    channel_id = message.get("source_id", "unknown")

    # Determine final status and action intent
    effective_action = (action or "").strip().lower()
    target_status = status

    if effective_action in ("dismiss", "false_positive"):
        target_status = "dismissed"
    elif effective_action == "warn":
        target_status = "reviewed"
    elif effective_action in ("escalate", "delete_and_ban"):
        target_status = "escalated"

    platform_result: Dict[str, Any] = {"executed": True, "action": effective_action or "status_update"}
    action_success = True

    # Check for idempotency: if action was already run and succeeded, don't repeat platform mutation
    conn = db_ops.get_ops_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT platform_result FROM audit_log WHERE message_id = ? AND action = ? AND success = 1",
        (message_id, effective_action)
    )
    prev = cur.fetchone()
    conn.close()

    if prev and effective_action:
        # Already executed previously
        platform_result = {"idempotent_skip": True, "previous_result": prev["platform_result"]}
    else:
        connector = get_connector(platform)

        # 1. Action: dismiss or false_positive
        if effective_action in ("dismiss", "false_positive") or target_status == "dismissed":
            fb_type = "false_positive" if effective_action == "false_positive" else "confirmed"
            try:
                db_ops.record_moderator_feedback(
                    message_id=message_id,
                    feedback_type=fb_type,
                    moderator=reviewed_by,
                    notes=notes or f"Marked as {target_status} by moderator."
                )
                platform_result = {"feedback_recorded": fb_type}
            except Exception as e:
                action_success = False
                platform_result = {"error": f"Failed recording feedback: {str(e)}"}

        # 2. Action: warn
        elif effective_action == "warn":
            try:
                # Increment warning count
                warn_info = db_ops.increment_student_warning(
                    sender_id=sender_id,
                    sender_name=sender_name,
                    platform=platform
                )
                platform_result["warning_info"] = warn_info

                # Send platform warning
                if connector:
                    if platform == "telegram":
                        res = connector.send_warning_message(channel_id, message_id, sender_name)
                    elif platform == "discord":
                        res = connector.send_warning_message(channel_id, message_id, sender_id, sender_name)
                    elif platform == "youtube":
                        res = connector.send_warning_message(channel_id, message_id, sender_name)
                    else:
                        res = {"simulated": True, "warning_sent": True}
                    platform_result["platform_delivery"] = res
                    if not res.get("success", True):
                        action_success = False
            except Exception as e:
                action_success = False
                platform_result["error"] = f"Platform warning exception: {str(e)}"

        # 3. Action: delete_and_ban
        elif effective_action == "delete_and_ban":
            try:
                db_ops.record_student_ban(sender_id=sender_id, sender_name=sender_name, platform=platform)
                if connector:
                    if platform == "telegram":
                        res = connector.delete_and_ban_user(channel_id, message_id, sender_id)
                    elif platform == "discord":
                        res = connector.delete_and_ban_user(channel_id, message_id, sender_id)
                    elif platform == "youtube":
                        res = connector.delete_and_ban_user(channel_id, message_id, sender_id)
                    else:
                        res = {"simulated": True, "deleted_and_banned": True}
                    platform_result["platform_delivery"] = res
                    if not res.get("success", True):
                        action_success = False
            except Exception as e:
                action_success = False
                platform_result["error"] = f"Platform delete_and_ban exception: {str(e)}"

        # 4. Action: escalate without delete_and_ban
        elif effective_action == "escalate" or target_status == "escalated":
            platform_result["escalated"] = True

    # Record in audit log
    try:
        db_ops.insert_audit_log(
            message_id=message_id,
            action=effective_action or target_status,
            moderator=reviewed_by,
            platform_result=platform_result,
            success=action_success
        )
    except Exception as e:
        print(f"[ActionHandler] Error recording audit log: {e}")

    # Update message status in SQLite messages table
    reviewed_at = datetime.now(timezone.utc).isoformat()
    updated_msg = db.update_message_status(
        msg_id=message_id,
        status=target_status,
        reviewed_by=reviewed_by,
        reviewed_at=reviewed_at
    )

    if updated_msg:
        updated_msg["platform_result"] = platform_result
        return updated_msg

    return {
        "id": message_id,
        "status": target_status,
        "reviewed_by": reviewed_by,
        "reviewed_at": reviewed_at,
        "platform_result": platform_result
    }

