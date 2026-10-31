"""
SQLite database manager and query provider for Vaani moderation console.
Uses standard library sqlite3 for portability and reliability.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from seed_data import SEED_SOURCES, SEED_MESSAGES

DB_PATH = os.path.join(os.path.dirname(__file__), "vaani.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables and seeds initial mock data if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        source_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        text TEXT NOT NULL,
        normalized_text TEXT NOT NULL,
        language TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        context TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        explanation TEXT NOT NULL,
        target_user TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        reviewed_by TEXT,
        reviewed_at TEXT
    )
    """)

    # Connected sources table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'connected',
        flags_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        permission_hint TEXT
    )
    """)

    # System settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    conn.commit()

    # Seed if messages table is empty
    cursor.execute("SELECT COUNT(*) FROM messages")
    count = cursor.fetchone()[0]
    if count == 0:
        # Seed sources
        for src in SEED_SOURCES:
            cursor.execute("""
            INSERT INTO sources (id, platform, channel_id, channel_name, url, status, flags_count, created_at, permission_hint)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                src["id"],
                src["platform"],
                src["channel_id"],
                src["channel_name"],
                src["url"],
                src["status"],
                src["flags_count"],
                src["created_at"],
                src["permission_hint"]
            ))

        # Seed messages
        for msg in SEED_MESSAGES:
            cursor.execute("""
            INSERT INTO messages (
                id, platform, source_id, channel_name, sender_id, sender_name,
                text, normalized_text, language, timestamp, context, category,
                severity, explanation, target_user, status, reviewed_by, reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                msg["id"],
                msg["platform"],
                msg["source_id"],
                msg["channel_name"],
                msg["sender_id"],
                msg["sender_name"],
                msg["text"],
                msg["normalized_text"],
                msg["language"],
                msg["timestamp"],
                json.dumps(msg["context"]),
                msg["category"],
                msg["severity"],
                msg["explanation"],
                msg["target_user"],
                msg["status"],
                msg["reviewed_by"],
                msg["reviewed_at"]
            ))

        # Default settings
        default_settings = {
            "instant_high_severity": True,
            "daily_digest_low": True,
            "telegram_bot_token": os.getenv("TELEGRAM_BOT_TOKEN", "7192837461:AAFk9102834710928347"),
            "telegram_chat_id": os.getenv("TELEGRAM_MODERATOR_CHAT_ID", "984729182"),
            "monitored_languages": ["Hindi (Romanized)", "Hinglish", "Punjabi (Romanized)", "English"],
            "mock_mode": True
        }
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('config', ?)", (json.dumps(default_settings),))

        conn.commit()

    conn.close()


def row_to_message(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    if "context" in d and isinstance(d["context"], str):
        try:
            d["context"] = json.loads(d["context"])
        except Exception:
            d["context"] = []
    return d


def get_messages(
    platform: Optional[str] = None,
    channel: Optional[str] = None,
    severity: Optional[str] = None,
    language: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "time",
    sort_order: str = "desc"
) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM messages WHERE 1=1"
    params = []

    if platform and platform != "all":
        query += " AND platform = ?"
        params.append(platform)
    if channel and channel != "all":
        query += " AND channel_name = ?"
        params.append(channel)
    if severity and severity != "all":
        query += " AND severity = ?"
        params.append(severity)
    if language and language != "all":
        query += " AND language = ?"
        params.append(language)
    if category and category != "all":
        query += " AND category = ?"
        params.append(category)
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query += " AND (LOWER(text) LIKE ? OR LOWER(sender_name) LIKE ? OR LOWER(channel_name) LIKE ? OR LOWER(target_user) LIKE ? OR LOWER(normalized_text) LIKE ?)"
        params.extend([term, term, term, term, term])

    if sort_by == "severity":
        # high > medium > low
        case_order = "CASE severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END"
        query += f" ORDER BY {case_order} {sort_order.upper()}, timestamp DESC"
    else:
        query += f" ORDER BY timestamp {sort_order.upper()}"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    results = [row_to_message(r) for r in rows]
    conn.close()
    return results


def get_message_by_id(msg_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row_to_message(row)
    return None


def update_message_status(msg_id: str, status: str, reviewed_by: str, reviewed_at: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE messages
    SET status = ?, reviewed_by = ?, reviewed_at = ?
    WHERE id = ?
    """, (status, reviewed_by, reviewed_at, msg_id))
    conn.commit()
    conn.close()
    return get_message_by_id(msg_id)


def get_sources() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sources ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def insert_source(source_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO sources (id, platform, channel_id, channel_name, url, status, flags_count, created_at, permission_hint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        source_data["id"],
        source_data["platform"],
        source_data["channel_id"],
        source_data["channel_name"],
        source_data["url"],
        source_data["status"],
        source_data.get("flags_count", 0),
        source_data["created_at"],
        source_data.get("permission_hint")
    ))
    conn.commit()
    conn.close()
    return source_data


def delete_source(source_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    conn.commit()
    conn.close()
    return True


def get_stats() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM messages")
    total_flagged = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM messages WHERE severity = 'high' AND status = 'new'")
    high_open = cursor.fetchone()[0]

    # Category breakdown
    cursor.execute("SELECT category, COUNT(*) as cnt FROM messages GROUP BY category ORDER BY cnt DESC")
    by_category = [{"category": r["category"], "count": r["cnt"]} for r in cursor.fetchall()]

    # Language breakdown
    cursor.execute("SELECT language, COUNT(*) as cnt FROM messages GROUP BY language ORDER BY cnt DESC")
    by_language = [{"language": r["language"], "count": r["cnt"]} for r in cursor.fetchall()]

    # Platform breakdown
    cursor.execute("SELECT platform, COUNT(*) as cnt FROM messages GROUP BY platform ORDER BY cnt DESC")
    by_platform = [{"platform": r["platform"], "count": r["cnt"]} for r in cursor.fetchall()]

    conn.close()

    return {
        "messages_scanned": 18450,
        "messages_flagged": total_flagged,
        "high_severity_open": high_open,
        "avg_review_time_mins": 4.8,
        "flags_over_time": [
            {"date": "Oct 25", "flags": 4, "high": 1, "medium": 2, "low": 1},
            {"date": "Oct 26", "flags": 6, "high": 2, "medium": 3, "low": 1},
            {"date": "Oct 27", "flags": 8, "high": 3, "medium": 3, "low": 2},
            {"date": "Oct 28", "flags": 9, "high": 2, "medium": 5, "low": 2},
            {"date": "Oct 29", "flags": 7, "high": 3, "medium": 3, "low": 1},
            {"date": "Oct 30", "flags": 11, "high": 5, "medium": 4, "low": 2},
            {"date": "Oct 31", "flags": 12, "high": 6, "medium": 4, "low": 2},
        ],
        "flags_by_category": by_category,
        "flags_by_language": by_language,
        "flags_by_platform": by_platform,
    }


def get_repeat_targets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM messages WHERE target_user IS NOT NULL AND target_user != ''")
    rows = cursor.fetchall()
    conn.close()

    messages = [row_to_message(r) for r in rows]
    target_map: Dict[str, List[Dict[str, Any]]] = {}

    for m in messages:
        target = m["target_user"]
        if target not in target_map:
            target_map[target] = []
        target_map[target].append(m)

    results = []
    for target, msgs in target_map.items():
        platforms = list(set(m["platform"] for m in msgs))
        channels = list(set(m["channel_name"] for m in msgs))
        timestamps = sorted([m["timestamp"] for m in msgs])
        high_cnt = sum(1 for m in msgs if m["severity"] == "high")
        med_cnt = sum(1 for m in msgs if m["severity"] == "medium")
        low_cnt = sum(1 for m in msgs if m["severity"] == "low")

        results.append({
            "target_user": target,
            "incident_count": len(msgs),
            "severity_breakdown": {
                "high": high_cnt,
                "medium": med_cnt,
                "low": low_cnt
            },
            "platforms": platforms,
            "channels": channels,
            "first_seen": timestamps[0],
            "last_seen": timestamps[-1],
            "sample_messages": msgs,
            "pile_on_detected": len(msgs) >= 3 and len(channels) >= 2
        })

    results.sort(key=lambda x: x["incident_count"], reverse=True)
    return results


def get_settings() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'config'")
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return {
        "instant_high_severity": True,
        "daily_digest_low": True,
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "monitored_languages": ["Hindi (Romanized)", "Hinglish", "Punjabi (Romanized)", "English"],
        "mock_mode": True
    }


def save_settings(config: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('config', ?)", (json.dumps(config),))
    conn.commit()
    conn.close()
    return config
