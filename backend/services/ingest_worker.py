"""
Real-time ingestion worker for Vaani.
Polls connected channels (Telegram, Discord, YouTube), runs incoming messages through
the classification engine, inserts flagged items into SQLite, and triggers moderator alerts.
"""

import asyncio
import os
from datetime import datetime, timezone
from typing import List, Dict, Any
import database as db
from connectors.telegram import TelegramConnector
from connectors.discord import DiscordConnector
from connectors.youtube import YouTubeConnector
from services.classifier import classify_text
from services.alerts import send_high_severity_alert, queue_low_severity_digest


def get_connector_for_platform(platform: str):
    if platform == "telegram":
        return TelegramConnector()
    elif platform == "discord":
        return DiscordConnector()
    elif platform == "youtube":
        return YouTubeConnector()
    return None


async def sync_connected_source(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Polls a single connected source for new messages, classifies them,
    and stores flagged incidents in the database.
    """
    platform = source.get("platform")
    source_id = source.get("channel_id") or source.get("id")
    connector = get_connector_for_platform(platform)
    if not connector:
        return []

    new_flagged_messages = []
    try:
        raw_items = await connector.fetch_new_messages(source_id=source_id, limit=20)
        for raw in raw_items:
            norm = connector.normalize(raw)
            
            # Check if already processed
            existing = db.get_message_by_id(norm.id)
            if existing:
                continue

            # Classify message text in real time
            classification = classify_text(norm.text, norm.target_user)
            
            # If toxic / flagged, record into database
            if classification.get("flagged"):
                conn = db.get_db_connection()
                cursor = conn.cursor()
                cursor.execute("""
                INSERT OR IGNORE INTO messages (
                    id, platform, source_id, channel_name, sender_id, sender_name,
                    text, normalized_text, language, timestamp, context, category,
                    severity, explanation, target_user, status, reviewed_by, reviewed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    norm.id,
                    norm.platform,
                    source.get("id"),
                    source.get("channel_name", norm.channel_name),
                    norm.sender_id,
                    norm.sender_name,
                    norm.text,
                    classification.get("normalized_text", norm.text),
                    classification.get("language", norm.language),
                    norm.timestamp,
                    "[]",
                    classification.get("category", "Insult/Bullying"),
                    classification.get("severity", "medium"),
                    classification.get("explanation", ""),
                    classification.get("target_user"),
                    "new",
                    None,
                    None
                ))
                # Update source flag count
                cursor.execute("""
                UPDATE sources SET flags_count = flags_count + 1 WHERE id = ?
                """, (source.get("id"),))
                conn.commit()
                conn.close()

                # High severity alert dispatch
                msg_dict = db.get_message_by_id(norm.id)
                if classification.get("severity") == "high" and msg_dict:
                    send_high_severity_alert(msg_dict)
                elif msg_dict:
                    queue_low_severity_digest(msg_dict)

                new_flagged_messages.append(msg_dict)

    except Exception as e:
        print(f"[IngestWorker] Error syncing source {source.get('id')}: {e}")

    return new_flagged_messages


async def sync_all_sources() -> Dict[str, Any]:
    """
    Syncs all active sources across Telegram, Discord, and YouTube.
    """
    sources = db.get_sources()
    total_new = 0
    all_flagged = []

    for src in sources:
        if src.get("status") == "connected":
            flagged = await sync_connected_source(src)
            total_new += len(flagged)
            all_flagged.extend(flagged)

    return {
        "synced_sources_count": len(sources),
        "new_flagged_incidents": total_new,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "messages": all_flagged
    }
