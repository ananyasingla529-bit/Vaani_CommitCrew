import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv(".env")
import asyncio
from connectors.telegram import TelegramConnector
from connectors.discord import DiscordConnector
from connectors.youtube import YouTubeConnector

async def main():
    print("1. Testing Telegram...")
    tg = TelegramConnector()
    print("TG is_real:", tg.is_real_mode_available())
    m_tg = await tg.fetch_new_messages("-1001839201948")
    print("TG messages:", len(m_tg))

    print("2. Testing Discord...")
    dc = DiscordConnector()
    print("DC is_real:", dc.is_real_mode_available())
    m_dc = await dc.fetch_new_messages("928374615243109283")
    print("DC messages:", len(m_dc))

    print("3. Testing YouTube...")
    yt = YouTubeConnector()
    print("YT is_real:", yt.is_real_mode_available())
    m_yt = await yt.fetch_new_messages("UCX984720194837261")
    print("YT messages:", len(m_yt))

    print("ALL CONNECTORS FETCH OK!")

if __name__ == "__main__":
    asyncio.run(main())

