"""
SQLite database manager and query provider for Vaani moderation console.
Uses standard library sqlite3 for portability and reliability.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from seed_data import SEED_SOURCES, SEED_MESSAGES
from db_brain import init_brain_db, get_scanned_count

DB_PATH = os.path.join(os.path.dirname(__file__), "vaani.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute('PRAGMA journal_mode=WAL;')
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

    from db_ops import init_ops_db; init_ops_db()
    conn.close()
    init_brain_db()


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

    # Compute avg_review_time_mins from reviewed_at minus timestamp
    cursor.execute("SELECT timestamp, reviewed_at FROM messages WHERE reviewed_at IS NOT NULL AND reviewed_at != ''")
    review_rows = cursor.fetchall()
    diffs = []
    for r in review_rows:
        try:
            t1 = datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(r["reviewed_at"].replace("Z", "+00:00"))
            diff_min = (t2 - t1).total_seconds() / 60.0
            if diff_min >= 0:
                diffs.append(diff_min)
        except Exception:
            pass
    avg_review_time = round(sum(diffs) / len(diffs), 1) if diffs else 4.8

    # Flags over time for the last 7 days
    cursor.execute("SELECT MAX(SUBSTR(timestamp, 1, 10)) FROM messages")
    max_date_row = cursor.fetchone()
    ref_date = datetime.now(timezone.utc).date()
    if max_date_row and max_date_row[0]:
        try:
            parsed_max = datetime.strptime(max_date_row[0], "%Y-%m-%d").date()
            if parsed_max > ref_date:
                ref_date = parsed_max
        except Exception:
            pass

    date_counts = {}
    for i in range(6, -1, -1):
        d = ref_date - timedelta(days=i)
        iso_str = d.strftime("%Y-%m-%d")
        label_str = d.strftime("%b %d")
        date_counts[iso_str] = {"date": label_str, "flags": 0, "high": 0, "medium": 0, "low": 0}

    cursor.execute("SELECT SUBSTR(timestamp, 1, 10) as dt, severity, COUNT(*) as cnt FROM messages GROUP BY dt, severity")
    for r in cursor.fetchall():
        dt = r["dt"]
        sev = r["severity"]
        cnt = r["cnt"]
        if dt in date_counts:
            date_counts[dt]["flags"] += cnt
            if sev in ("high", "medium", "low"):
                date_counts[dt][sev] += cnt

    flags_over_time = list(date_counts.values())
    conn.close()

    # Persistent messages_scanned counter
    messages_scanned = get_scanned_count()

    return {
        "messages_scanned": messages_scanned,
        "messages_flagged": total_flagged,
        "high_severity_open": high_open,
        "avg_review_time_mins": avg_review_time,
        "flags_over_time": flags_over_time,
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

        # Pile on detection:
        # pile_on_detected = true when 3+ distinct senders target the same user within 24h,
        # OR the same user is targeted on 2+ platforms
        msg_tuples = []
        for m in msgs:
            try:
                ts_dt = datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00"))
                sender = m.get("sender_id") or m.get("sender_name") or "unknown"
                msg_tuples.append((ts_dt, sender))
            except Exception:
                pass
        msg_tuples.sort(key=lambda x: x[0])

        has_24h_pile_on = False
        for i in range(len(msg_tuples)):
            t_start = msg_tuples[i][0]
            senders = {msg_tuples[i][1]}
            for j in range(i + 1, len(msg_tuples)):
                if (msg_tuples[j][0] - t_start).total_seconds() <= 86400:
                    senders.add(msg_tuples[j][1])
                else:
                    break
            if len(senders) >= 3:
                has_24h_pile_on = True
                break

        pile_on_detected = (len(platforms) >= 2) or has_24h_pile_on

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
            "pile_on_detected": pile_on_detected
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
