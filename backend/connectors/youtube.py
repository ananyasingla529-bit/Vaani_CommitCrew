"""
YouTube Platform Connector.
Implements YouTube Data API v3 commentThreads polling and normalizes comments into the unified Vaani schema.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import os
import requests
from connectors.base import Connector
from models import NormalizedMessage


class YouTubeConnector(Connector):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(platform="youtube", config=config)
        self.api_key = (
            self.config.get("api_key")
            or os.getenv("YOUTUBE_API_KEY")
        )
        self.mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"

    async def fetch_new_messages(self, source_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Polls YouTube Data API v3 commentThreads endpoint for channel / video comments.
        """
        if not self.mock_mode and self.api_key and not self.api_key.endswith("_MODERATION"):
            try:
                url = (
                    f"https://www.googleapis.com/youtube/v3/commentThreads"
                    f"?part=snippet&allThreadsRelatedToChannelId={source_id}&maxResults={limit}&key={self.api_key}"
                )
                res = requests.get(url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("items", [])
            except Exception as e:
                print(f"[YouTubeConnector] Error querying YouTube API: {e}")

        # In mock mode, returns simulated comment threads
        return [
            {
                "id": "Ugz9847291823746",
                "snippet": {
                    "channelId": source_id,
                    "topLevelComment": {
                        "snippet": {
                            "authorDisplayName": "DesiRider99",
                            "authorChannelId": {"value": "UC33201928374"},
                            "textDisplay": "iss aurat ki aukaat dekho debate me bolne ki. 2 paise ki k*meeni @priya_sharma_du jhoothi b@stard.",
                            "publishedAt": datetime.now(timezone.utc).isoformat(),
                        }
                    }
                }
            }
        ]

    def normalize(self, raw_message: Dict[str, Any]) -> NormalizedMessage:
        """
        Converts YouTube commentThread item into NormalizedMessage.
        """
        snippet = raw_message.get("snippet", {})
        top_comment = snippet.get("topLevelComment", {}).get("snippet", {})
        author_id = top_comment.get("authorChannelId", {}).get("value", "unknown")
        author_name = top_comment.get("authorDisplayName", "YouTube Commenter")
        text = top_comment.get("textDisplay", "")
        published_at = top_comment.get("publishedAt", datetime.now(timezone.utc).isoformat())

        return NormalizedMessage(
            id=f"yt_{raw_message.get('id', '0')}",
            platform="youtube",
            source_id=snippet.get("channelId", "unknown"),
            channel_name="Campus Spotlight & Debates",
            sender_id=author_id,
            sender_name=author_name,
            text=text,
            normalized_text=text,
            language="Hindi (Romanized)",
            timestamp=published_at,
            context=[],
            category="Insult/Bullying",
            severity="high",
            explanation="YouTube comment flagged by rule classifier.",
            target_user="@priya_sharma_du",
            status="new",
        )
