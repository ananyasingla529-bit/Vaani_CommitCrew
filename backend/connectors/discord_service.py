"""
Discord gateway integration using discord.py with message_content intent.
Runs as a background asyncio task, ingests real-time channel messages,
and routes them through the Vaani moderation pipeline.
Falls back gracefully in mock mode or with invalid tokens.
"""

import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
import discord

import database as db
from connectors.discord import DiscordConnector
from services.ingest_worker import process_raw_item

DISCORD_CLIENT: Optional[discord.Client] = None
DISCORD_TASK: Optional[asyncio.Task] = None


class VaaniDiscordClient(discord.Client):
    def __init__(self, *args, **kwargs):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents, *args, **kwargs)
        self.connector = DiscordConnector()

    async def on_ready(self):
        print(f"[DiscordGateway] Bot connected as {self.user} (ID: {self.user.id})")

    async def on_message(self, message: discord.Message):
        # Ignore messages sent by the bot itself
        if message.author == self.user:
            return

        raw_item = {
            "id": str(message.id),
            "channel_id": str(message.channel.id),
            "author": {
                "id": str(message.author.id),
                "username": message.author.name,
                "global_name": getattr(message.author, "global_name", None) or message.author.name,
            },
            "content": message.content,
            "timestamp": message.created_at.isoformat(),
        }

        # Check if source exists in database; if not, create dynamic source entry
        channel_id_str = str(message.channel.id)
        channel_title = getattr(message.channel, "name", f"Discord #{channel_id_str}")
        sources = db.get_sources()
        matched_source = next((s for s in sources if s.get("channel_id") == channel_id_str), None)

        if not matched_source:
            matched_source = {
                "id": f"src_dc_{channel_id_str}",
                "platform": "discord",
                "channel_id": channel_id_str,
                "channel_name": f"Discord #{channel_title}",
                "url": f"https://discord.com/channels/{getattr(message.guild, 'id', 'guild')}/{channel_id_str}",
                "status": "connected",
                "flags_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "permission_hint": None,
                "privacy_mode": "full",
            }
            try:
                db.insert_source(matched_source)
            except Exception:
                pass

        await process_raw_item(raw_item, matched_source, self.connector)


async def run_discord_bot():
    global DISCORD_CLIENT
    token = os.getenv("DISCORD_BOT_TOKEN")
    mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"
    discord_live = os.getenv("DISCORD_LIVE", "").lower() == "true"

    live_enabled = discord_live or (not mock_mode)
    if not live_enabled or not token or token.endswith("_TOKEN") or len(token) < 20:
        print("[DiscordGateway] Discord bot live gateway skipped (MOCK_MODE=True and DISCORD_LIVE=False, or demo token). Using simulated connector.")
        return

    try:
        DISCORD_CLIENT = VaaniDiscordClient()
        print("[DiscordGateway] Starting discord.py gateway with message_content intent...")
        await DISCORD_CLIENT.start(token)
    except asyncio.CancelledError:
        print("[DiscordGateway] Discord gateway task stopped.")
    except Exception as e:
        print(f"[DiscordGateway] Discord gateway failed to start: {e}. Falling back to REST connector.")


def start_discord_gateway():
    """Starts the discord.py client in the background."""
    global DISCORD_TASK
    if DISCORD_TASK is None or DISCORD_TASK.done():
        loop = asyncio.get_event_loop()
        DISCORD_TASK = loop.create_task(run_discord_bot())


def stop_discord_gateway():
    """Stops the discord gateway task."""
    global DISCORD_CLIENT, DISCORD_TASK
    if DISCORD_CLIENT and not DISCORD_CLIENT.is_closed():
        asyncio.create_task(DISCORD_CLIENT.close())
    if DISCORD_TASK and not DISCORD_TASK.done():
        DISCORD_TASK.cancel()

