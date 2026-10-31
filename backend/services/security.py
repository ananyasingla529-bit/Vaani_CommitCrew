"""
Security and authentication service for Vaani moderation console.
Implements bcrypt password verification, JWT issuance and validation,
Fernet encryption for stored integration secrets, and token masking.
"""

import os
import time
import base64
import bcrypt
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from cryptography.fernet import Fernet

JWT_SECRET = os.getenv("JWT_SECRET", "vaani-super-secure-jwt-key-328917491823749")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 86400 * 7 # 7 days

# Ensure a stable Fernet encryption key
_RAW_FERNET = os.getenv("FERNET_KEY")
if not _RAW_FERNET:
    # Use deterministic 32-byte key for consistent local encryption
    _RAW_FERNET = base64.urlsafe_b64encode(b"vaani-secret-fernet-key-32bytes!".ljust(32, b"0")[:32]).decode()

try:
    cipher_suite = Fernet(_RAW_FERNET.encode())
except Exception:
    _RAW_FERNET = base64.urlsafe_b64encode(b"vaani-secret-fernet-key-32bytes!".ljust(32, b"0")[:32]).decode()
    cipher_suite = Fernet(_RAW_FERNET.encode())


# Default moderator credentials for development/demo
DEFAULT_MODERATOR_EMAIL = os.getenv("MODERATOR_EMAIL", "moderator@vaani.org")
# Default password: "Password123!"
DEFAULT_PW_HASH = os.getenv(
    "MODERATOR_PASSWORD_HASH",
    bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()
)

security_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def hash_password(plain_password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(subject: str, role: str = "moderator") -> str:
    """Generates a signed JWT access token."""
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRATION_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a JWT access token."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)) -> Dict[str, Any]:
    """
    FastAPI dependency for protecting routes.
    If AUTH_DISABLED=True (default in dev), bypasses check so frontend works out-of-the-box.
    """
    auth_disabled = os.getenv("AUTH_DISABLED", "True").lower() == "true"
    if auth_disabled:
        return {"sub": DEFAULT_MODERATOR_EMAIL, "role": "moderator"}

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ============================================================================
# Fernet Token Encryption & Masking
# ============================================================================

def encrypt_token(raw_token: str) -> str:
    """Encrypts external API bot tokens or OAuth secrets."""
    if not raw_token:
        return ""
    return cipher_suite.encrypt(raw_token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str) -> str:
    """Decrypts external API bot tokens."""
    if not encrypted_token:
        return ""
    try:
        return cipher_suite.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except Exception:
        # Fall back if unencrypted
        return encrypted_token


def mask_token(token: Optional[str]) -> str:
    """
    Masks a sensitive credential for safe UI display (e.g., 7192********8347).
    """
    if not token or len(token) < 8:
        return "********" if token else ""
    return f"{token[:4]}{'*' * 8}{token[-4:]}"

