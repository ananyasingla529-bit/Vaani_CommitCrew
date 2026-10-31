"""
services/cache.py - Brain Cache, Daily API Call Budget, and Rate Limiter.
Keys cache by sha256(normalized text + context hash).
Enforces LLM_DAILY_BUDGET (default 500); falls back to rules with provider="rules" when exceeded.
Includes an in-memory sliding window rate limiter.
"""

import os
import hashlib
import json
import time
import threading
from typing import Optional, List, Dict, Any, Tuple

from db_brain import (
    get_cached_response,
    save_cached_response,
    get_daily_budget_used,
    increment_daily_budget,
)


class SlidingWindowRateLimiter:
    """Thread-safe sliding window rate limiter for cloud LLM API calls."""
    def __init__(self, max_requests_per_minute: int = 60):
        self.max_requests = max_requests_per_minute
        self.timestamps: List[float] = []
        self._lock = threading.Lock()

    def allow_request(self) -> bool:
        with self._lock:
            now = time.time()
            cutoff = now - 60.0
            self.timestamps = [t for t in self.timestamps if t > cutoff]
            if len(self.timestamps) >= self.max_requests:
                return False
            self.timestamps.append(now)
            return True


# Global rate limiter instance (default 60 calls/min)
_rate_limiter = SlidingWindowRateLimiter(
    max_requests_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
)


def compute_cache_key(normalized_text: str, context: Optional[List[str]] = None) -> str:
    """
    Computes a deterministic SHA-256 hash of the normalized message and its context.
    """
    ctx = context or []
    # Join the last 3-5 messages in context
    recent_context = ctx[-5:] if len(ctx) > 5 else ctx
    ctx_serialized = json.dumps(recent_context, sort_keys=True)
    raw = f"{normalized_text.strip().lower()}##{ctx_serialized}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def check_cache(normalized_text: str, context: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """Checks SQLite cache for previously classified identical message + context."""
    key = compute_cache_key(normalized_text, context)
    return get_cached_response(key)


def store_in_cache(
    normalized_text: str,
    response: Dict[str, Any],
    provider: str,
    context: Optional[List[str]] = None
):
    """Saves classification result in SQLite cache."""
    key = compute_cache_key(normalized_text, context)
    save_cached_response(key, response, provider)


def can_make_llm_call() -> Tuple[bool, str]:
    """
    Validates both daily call budget and sliding window rate limiter.
    Returns (True, "OK") or (False, reason).
    """
    daily_budget = int(os.getenv("LLM_DAILY_BUDGET", "500"))
    used_today = get_daily_budget_used()

    if used_today >= daily_budget:
        return False, f"Daily LLM call budget exceeded ({used_today}/{daily_budget})"

    if not _rate_limiter.allow_request():
        return False, "Rate limit reached (too many requests per minute)"

    return True, "OK"


def record_successful_llm_call():
    """Increments the daily persisted LLM call counter."""
    increment_daily_budget()

