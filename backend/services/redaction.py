"""
services/redaction.py - PII Redaction for Vaani.
Replaces phone numbers, email addresses, and URLs with redaction tokens before sending to any cloud LLM.
"""

import re

# Comprehensive patterns for Indian & International phone numbers, emails, and URLs
URL_PATTERN = re.compile(
    r'(?:https?://|www\.)[^\s<>"]+|t\.me/[^\s<>"]+|discord\.gg/[^\s<>"]+|youtu(?:\.be|be\.com)/[^\s<>"]+',
    flags=re.IGNORECASE
)
EMAIL_PATTERN = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
)
PHONE_PATTERN = re.compile(
    r'(?:\+?91[\-\s]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{5}[-.\s]?\d{5}\b'
)


def redact_pii(text: str) -> str:
    """
    Replaces URLs, emails, and phone numbers with [URL], [EMAIL], [PHONE] tokens.
    URLs are replaced first to avoid matching domain parts as emails or numbers.
    """
    if not text:
        return ""
    
    redacted = URL_PATTERN.sub("[URL]", text)
    redacted = EMAIL_PATTERN.sub("[EMAIL]", redacted)
    redacted = PHONE_PATTERN.sub("[PHONE]", redacted)
    return redacted

