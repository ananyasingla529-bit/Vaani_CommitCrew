"""
Operations database manager for Vaani moderation console.
Houses tables for audit logs, moderator feedback, student warning history,
persisted connector offsets, and retention cleanup.
"""

import sqlite3
import json
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "vaani.db")


def get_ops_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute('PRAGMA journal_mode=WAL;')
    conn.row_factory = sqlite3.Row
    return conn


def init_ops_db(existing_conn: Optional[sqlite3.Connection] = None):
    """
    Initializes operational tables:
    - audit_log: records moderator punitive and administrative actions
    - moderator_feedback: false_positive and confirmed reviews
    - student_warnings: warning count and discipline history per sender
    - connector_offsets: persisted cursor/update offsets per source/platform
    Also safely adds privacy_mode to sources table if missing.
    """
    conn = existing_conn or get_ops_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        action TEXT NOT NULL,
        moderator TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        platform_result TEXT,
        success INTEGER NOT NULL DEFAULT 1
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS moderator_feedback (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        moderator TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        notes TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_warnings (
        sender_id TEXT PRIMARY KEY,
        sender_name TEXT,
        platform TEXT NOT NULL,
        warning_count INTEGER NOT NULL DEFAULT 0,
        last_warned_at TEXT,
        banned INTEGER NOT NULL DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS connector_offsets (
        source_key TEXT PRIMARY KEY,
        offset_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # Check and add privacy_mode column to sources table if not present
    try:
        cursor.execute("PRAGMA table_info(sources)")
        columns = [row[1] for row in cursor.fetchall()]
        if "privacy_mode" not in columns:
            cursor.execute("ALTER TABLE sources ADD COLUMN privacy_mode TEXT DEFAULT 'full'")
    except Exception as e:
        print(f"[db_ops] Notice checking sources table schema: {e}")

    conn.commit()
    if not existing_conn:
        conn.close()


# ============================================================================
# Audit Log Methods
# ============================================================================

def insert_audit_log(
    message_id: str,
    action: str,
    moderator: str,
    platform_result: Any,
    success: bool = True
) -> Dict[str, Any]:
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    log_id = f"aud_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    ts = datetime.now(timezone.utc).isoformat()
    result_str = json.dumps(platform_result) if not isinstance(platform_result, str) else platform_result

    cursor.execute("""
    INSERT INTO audit_log (id, message_id, action, moderator, timestamp, platform_result, success)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (log_id, message_id, action, moderator, ts, result_str, 1 if success else 0))
    conn.commit()
    conn.close()

    return {
        "id": log_id,
        "message_id": message_id,
        "action": action,
        "moderator": moderator,
        "timestamp": ts,
        "platform_result": platform_result,
        "success": success
    }


def get_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["success"] = bool(d["success"])
        if d.get("platform_result"):
            try:
                d["platform_result"] = json.loads(d["platform_result"])
            except Exception:
                pass
        results.append(d)
    return results


# ============================================================================
# Feedback Methods
# ============================================================================

def record_moderator_feedback(
    message_id: str,
    feedback_type: str,
    moderator: str,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    fb_id = f"fb_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    ts = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO moderator_feedback (id, message_id, feedback_type, moderator, timestamp, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (fb_id, message_id, feedback_type, moderator, ts, notes))
    conn.commit()
    conn.close()

    return {
        "id": fb_id,
        "message_id": message_id,
        "feedback_type": feedback_type,
        "moderator": moderator,
        "timestamp": ts,
        "notes": notes
    }


# ============================================================================
# Student Warning & Discipline History
# ============================================================================

def increment_student_warning(sender_id: str, sender_name: str, platform: str) -> Dict[str, Any]:
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    ts = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT warning_count, banned FROM student_warnings WHERE sender_id = ?", (sender_id,))
    row = cursor.fetchone()
    if row:
        new_count = row["warning_count"] + 1
        banned = row["banned"]
        cursor.execute("""
        UPDATE student_warnings
        SET warning_count = ?, last_warned_at = ?, sender_name = ?
        WHERE sender_id = ?
        """, (new_count, ts, sender_name, sender_id))
    else:
        new_count = 1
        banned = 0
        cursor.execute("""
        INSERT INTO student_warnings (sender_id, sender_name, platform, warning_count, last_warned_at, banned)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (sender_id, sender_name, platform, 1, ts, 0))

    conn.commit()
    conn.close()
    return {
        "sender_id": sender_id,
        "sender_name": sender_name,
        "platform": platform,
        "warning_count": new_count,
        "last_warned_at": ts,
        "banned": bool(banned)
    }


def record_student_ban(sender_id: str, sender_name: str, platform: str):
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    ts = datetime.now(timezone.utc).isoformat()
    cursor.execute("SELECT warning_count FROM student_warnings WHERE sender_id = ?", (sender_id,))
    row = cursor.fetchone()
    if row:
        cursor.execute("""
        UPDATE student_warnings
        SET banned = 1, last_warned_at = ?, sender_name = ?
        WHERE sender_id = ?
        """, (ts, sender_name, sender_id))
    else:
        cursor.execute("""
        INSERT INTO student_warnings (sender_id, sender_name, platform, warning_count, last_warned_at, banned)
        VALUES (?, ?, ?, ?, ?, 1)
        """, (sender_id, sender_name, platform, 1, ts))
    conn.commit()
    conn.close()


def get_student_history(sender_id: str) -> Dict[str, Any]:
    conn = get_ops_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM student_warnings WHERE sender_id = ?", (sender_id,))
    warn_row = cursor.fetchone()

    # Get all flagged messages by this sender
    cursor.execute("SELECT * FROM messages WHERE sender_id = ? ORDER BY timestamp DESC", (sender_id,))
    msg_rows = cursor.fetchall()
    messages = []
    for r in msg_rows:
        d = dict(r)
        if "context" in d and isinstance(d["context"], str):
            try:
                d["context"] = json.loads(d["context"])
            except Exception:
                d["context"] = []
        messages.append(d)

    # Get all audit actions targeting this sender's messages
    msg_ids = [m["id"] for m in messages]
    audit_logs = []
    if msg_ids:
        placeholders = ",".join(["?"] * len(msg_ids))
        cursor.execute(f"SELECT * FROM audit_log WHERE message_id IN ({placeholders}) ORDER BY timestamp DESC", msg_ids)
        audit_logs = [dict(r) for r in cursor.fetchall()]

    conn.close()

    warning_count = warn_row["warning_count"] if warn_row else 0
    banned = bool(warn_row["banned"]) if warn_row else False
    last_warned_at = warn_row["last_warned_at"] if warn_row else None
    sender_name = warn_row["sender_name"] if warn_row else (messages[0]["sender_name"] if messages else "Unknown")
    platform = warn_row["platform"] if warn_row else (messages[0]["platform"] if messages else "unknown")

    return {
        "sender_id": sender_id,
        "sender_name": sender_name,
        "platform": platform,
        "warning_count": warning_count,
        "banned": banned,
        "last_warned_at": last_warned_at,
        "total_flagged_messages": len(messages),
        "messages": messages,
        "actions_taken": audit_logs
    }


# ============================================================================
# Connector Offset Persistence
# ============================================================================

def get_connector_offset(source_key: str, default: str = "0") -> str:
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT offset_value FROM connector_offsets WHERE source_key = ?", (source_key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row["offset_value"]
    return default


def set_connector_offset(source_key: str, offset_value: str):
    conn = get_ops_db_connection()
    cursor = conn.cursor()
    ts = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT OR REPLACE INTO connector_offsets (source_key, offset_value, updated_at)
    VALUES (?, ?, ?)
    """, (source_key, str(offset_value), ts))
    conn.commit()
    conn.close()


# ============================================================================
# Retention Cleanup Job
# ============================================================================

def cleanup_old_messages(retention_days: Optional[int] = None) -> int:
    """
    Hard Rule 7: Privacy retention cleanup job.
    Deletes flagged messages older than RETENTION_DAYS (default 30).
    """
    days = retention_days or int(os.getenv("RETENTION_DAYS", "30"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    conn = get_ops_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE timestamp < ?", (cutoff_iso,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

