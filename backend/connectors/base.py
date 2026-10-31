"""
Abstract Connector class for external platform integrations (Telegram, Discord, YouTube).
Defines contracts for fetching and normalizing incoming chat messages.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from models import NormalizedMessage


class Connector(ABC):
    def __init__(self, platform: str, config: Dict[str, Any] = None):
        self.platform = platform
        self.config = config or {}

    @abstractmethod
    async def fetch_new_messages(self, source_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Polls or queries platform-specific API to fetch recent unreviewed messages.
        Returns raw platform payload list.
        """
        pass

    @abstractmethod
    def normalize(self, raw_message: Dict[str, Any]) -> NormalizedMessage:
        """
        Normalizes a platform-specific raw dictionary into Vaani's common NormalizedMessage schema.
        """
        pass
