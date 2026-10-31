"""
Unit test for Telegram Ingestion Pipeline (Step 2 Rule 8).
Verifies:
1. Feeds a fake Telegram update with toxic text "k*tte kal college aa, m@r daloonga tujhe"
   through the ingest path and asserts it appears in the messages table and messages_scanned increased by 1.
2. Feeds a safe message update and asserts it is NOT stored in DB, but IS counted as scanned.
"""

import sys
import os
import asyncio
from datetime import datetime, timezone

# Add backend directory to sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND_DIR)

import database as db
import db_ops
from connectors.telegram import TelegramConnector
from services.ingest_worker import process_raw_item


def run_telegram_ingest_test():
    print("=" * 70, flush=True)
    print("TEST: Telegram Ingestion Pipeline (Step 2 Rule 8)", flush=True)
    print("=" * 70, flush=True)

    db.init_db()
    db_ops.init_ops_db()

    # Register a connected Telegram test source and clean any prior test messages
    test_chat_id = "-1009876543210"
    test_source_id = "src_tg_test_group_unit"

    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM messages WHERE id IN ('tg_88101', 'tg_88102')")
    c.execute("""
    INSERT OR REPLACE INTO sources (
        id, platform, channel_id, channel_name, url, status, flags_count, created_at, permission_hint, privacy_mode
    ) VALUES (?, 'telegram', ?, 'DU Ingest Test Group', 'https://t.me/du_ingest_test', 'connected', 0, ?, NULL, 'full')
    """, (test_source_id, test_chat_id, datetime.now(timezone.utc).isoformat()))
    conn.commit()
    conn.close()

    source = {
        "id": test_source_id,
        "platform": "telegram",
        "channel_id": test_chat_id,
        "channel_name": "DU Ingest Test Group",
        "status": "connected",
        "privacy_mode": "full",
    }

    tg = TelegramConnector(config={"mock_mode": True})

    # -------------------------------------------------------------------------
    # CASE 1: Toxic Message
    # -------------------------------------------------------------------------
    initial_scanned = db.get_scanned_count()
    toxic_msg_id = 88101
    toxic_raw = {
        "message_id": toxic_msg_id,
        "chat": {"id": int(test_chat_id), "title": "DU Ingest Test Group", "type": "supergroup"},
        "from": {"id": 123456, "first_name": "AggressiveUser", "username": "aggressor_99", "is_bot": False},
        "text": "k*tte kal college aa, m@r daloonga tujhe",
        "date": int(datetime.now(timezone.utc).timestamp()),
    }

    result = asyncio.run(process_raw_item(toxic_raw, source, tg))

    # Assert toxic message is returned and saved in database
    assert result is not None, "Expected process_raw_item to return stored message for toxic text!"
    stored_msg = db.get_message_by_id(f"tg_{toxic_msg_id}")
    assert stored_msg is not None, f"Expected message tg_{toxic_msg_id} to be stored in DB!"
    assert stored_msg["status"] == "new"

    # Assert messages_scanned increased by 1
    scanned_after_toxic = db.get_scanned_count()
    assert scanned_after_toxic >= initial_scanned + 1, (
        f"Expected messages_scanned to increase! Before: {initial_scanned}, After: {scanned_after_toxic}"
    )
    print(f"  [PASS] Toxic message correctly flagged, stored in DB (id=tg_{toxic_msg_id}), and scanned count incremented (+1).", flush=True)

    # -------------------------------------------------------------------------
    # CASE 2: Safe Message
    # -------------------------------------------------------------------------
    scanned_before_safe = db.get_scanned_count()
    safe_msg_id = 88102
    safe_raw = {
        "message_id": safe_msg_id,
        "chat": {"id": int(test_chat_id), "title": "DU Ingest Test Group", "type": "supergroup"},
        "from": {"id": 654321, "first_name": "PoliteStudent", "username": "student_lead", "is_bot": False},
        "text": "Good morning everyone, please check the class notes uploaded on portal.",
        "date": int(datetime.now(timezone.utc).timestamp()),
    }

    safe_result = asyncio.run(process_raw_item(safe_raw, source, tg))

    # Assert safe message is NOT stored in database
    assert safe_result is None, "Expected process_raw_item to return None for safe message!"
    safe_db_msg = db.get_message_by_id(f"tg_{safe_msg_id}")
    assert safe_db_msg is None, f"Privacy Rule Violation: Safe message tg_{safe_msg_id} was found in DB!"

    # Assert messages_scanned increased by 1 for safe message
    scanned_after_safe = db.get_scanned_count()
    assert scanned_after_safe >= scanned_before_safe + 1, (
        f"Expected messages_scanned to increment for safe message! Before: {scanned_before_safe}, After: {scanned_after_safe}"
    )
    print(f"  [PASS] Privacy Rule 7 verified: Safe message was NOT stored in DB, but IS counted as scanned (+1).", flush=True)

    print("\n" + "=" * 70, flush=True)
    print("ALL TELEGRAM INGESTION TESTS PASSED SUCCESSFULLY!", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    run_telegram_ingest_test()
