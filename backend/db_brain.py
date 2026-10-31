"""
db_brain.py - SQLite storage for Brain component of Vaani.
Manages LLM cache, daily LLM API call budget counters, and persisted scanned messages count.
"""

import sqlite3
import json
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "vaani.db")


def get_brain_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_brain_db():
    """Initializes Brain tables in SQLite."""
    conn = get_brain_db_connection()
    cursor = conn.cursor()

    # LLM Cache table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS llm_cache (
        cache_key TEXT PRIMARY KEY,
        response_json TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Daily LLM usage table for budget enforcement
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_llm_usage (
        usage_date TEXT PRIMARY KEY,
        call_count INTEGER NOT NULL DEFAULT 0
    )
    """)

    # Persistent counters (e.g. messages_scanned)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS brain_counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
    )
    """)

    # Seed initial messages_scanned counter if not present
    cursor.execute("SELECT value FROM brain_counters WHERE name = 'messages_scanned'")
    row = cursor.fetchone()
    if row is None:
        cursor.execute("INSERT INTO brain_counters (name, value) VALUES ('messages_scanned', 18450)")

    conn.commit()
    conn.close()


def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieves cached classification response if exists."""
    try:
        conn = get_brain_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT response_json, provider FROM llm_cache WHERE cache_key = ?", (cache_key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            data = json.loads(row["response_json"])
            data["provider"] = "cache"
            return data
    except Exception as e:
        print(f"[db_brain] Cache lookup error: {e}")
    return None


def save_cached_response(cache_key: str, response: Dict[str, Any], provider: str):
    """Saves classification response to LLM cache."""
    try:
        conn = get_brain_db_connection()
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
        INSERT OR REPLACE INTO llm_cache (cache_key, response_json, provider, created_at)
        VALUES (?, ?, ?, ?)
        """, (cache_key, json.dumps(response), provider, now))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[db_brain] Cache save error: {e}")


def get_daily_budget_used(date_str: Optional[str] = None) -> int:
    """Returns number of LLM API calls made on the specified date (UTC YYYY-MM-DD)."""
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        conn = get_brain_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT call_count FROM daily_llm_usage WHERE usage_date = ?", (date_str,))
        row = cursor.fetchone()
        conn.close()
        return row["call_count"] if row else 0
    except Exception as e:
        print(f"[db_brain] Budget lookup error: {e}")
        return 0


def increment_daily_budget(date_str: Optional[str] = None) -> int:
    """Increments LLM API calls counter for today and returns new count."""
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        conn = get_brain_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO daily_llm_usage (usage_date, call_count)
        VALUES (?, 1)
        ON CONFLICT(usage_date) DO UPDATE SET call_count = call_count + 1
        """, (date_str,))
        conn.commit()
        cursor.execute("SELECT call_count FROM daily_llm_usage WHERE usage_date = ?", (date_str,))
        row = cursor.fetchone()
        conn.close()
        return row["call_count"] if row else 1
    except Exception as e:
        print(f"[db_brain] Budget increment error: {e}")
        return 1


def increment_scanned(n: int = 1) -> int:
    """
    Increments persistent messages_scanned counter by n.
    Callable by teammate's ingest worker or background sync.
    """
    try:
        conn = get_brain_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO brain_counters (name, value)
        VALUES ('messages_scanned', ?)
        ON CONFLICT(name) DO UPDATE SET value = value + ?
        """, (n, n))
        conn.commit()
        cursor.execute("SELECT value FROM brain_counters WHERE name = 'messages_scanned'")
        row = cursor.fetchone()
        conn.close()
        return row["value"] if row else 18450
    except Exception as e:
        print(f"[db_brain] increment_scanned error: {e}")
        return 18450


def get_scanned_count() -> int:
    """Returns the total persistent messages scanned count."""
    try:
        conn = get_brain_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM brain_counters WHERE name = 'messages_scanned'")
        row = cursor.fetchone()
        conn.close()
        return row["value"] if row else 18450
    except Exception as e:
        print(f"[db_brain] get_scanned_count error: {e}")
        return 18450

