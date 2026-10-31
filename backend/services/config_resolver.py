"""
Runtime configuration resolver for Vaani.
Enforces Step 2 Rule 1:
Config precedence:
.env values are the default.
A database setting overrides them only if it is non-empty.
If MOCK_MODE=False and the token is real (not ending in _DEMO or _PLACEHOLDER),
the real platform path must be used with no fake data fallback.
"""

import os
import json
from typing import Dict, Any

# Ensure .env is loaded
try:
    from dotenv import load_dotenv
    backend_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(backend_env):
        load_dotenv(dotenv_path=backend_env, override=False)
    else:
        load_dotenv(override=False)
except Exception:
    pass

_STARTUP_LOGGED = False

def get_telegram_runtime_config(log_startup: bool = False) -> Dict[str, Any]:
    global _STARTUP_LOGGED
    
    # 1. Defaults from .env / os.environ
    env_mock_str = os.getenv("MOCK_MODE", "True").strip()
    mock_mode = env_mock_str.lower() == "true"
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    mod_chat_id = os.getenv("TELEGRAM_MODERATOR_CHAT_ID", "").strip()

    # 2. Database settings override if non-empty
    try:
        import database as db
        db_settings = db.get_settings()
        if isinstance(db_settings, dict):
            db_token = str(db_settings.get("telegram_bot_token") or "").strip()
            # If DB has a custom token that isn't empty and isn't the dummy demo seed
            DUMMY_SEEDS = {"7192837461:AAFk9102834710928347", "123456789:ABCdefGHIjklMNOpqrsTUVwxyz_PLACEHOLDER"}
            if db_token and db_token not in DUMMY_SEEDS:
                token = db_token
            elif not token and db_token:
                token = db_token

            db_chat_id = str(db_settings.get("telegram_chat_id") or "").strip()
            if db_chat_id and db_chat_id != "984729182":
                mod_chat_id = db_chat_id

            # If .env has MOCK_MODE=False, use False. Otherwise check DB
            if env_mock_str.lower() == "false":
                mock_mode = False
            elif "mock_mode" in db_settings and db_settings["mock_mode"] is not None:
                mock_mode = bool(db_settings["mock_mode"])
    except Exception:
        pass

    # Check if token is real
    is_real_token = (
        bool(token)
        and ":" in token
        and not token.endswith("_DEMO")
        and not token.endswith("_PLACEHOLDER")
        and len(token) > 20
    )

    masked_token = f"(ends ...{token[-4:]})" if token and len(token) >= 4 else "(none)"

    if log_startup and not _STARTUP_LOGGED:
        _STARTUP_LOGGED = True
        print(f"[Vaani] MOCK_MODE={mock_mode}, Telegram token loaded {masked_token}")

    return {
        "mock_mode": mock_mode,
        "token": token,
        "is_real_token": is_real_token,
        "mod_chat_id": mod_chat_id,
        "masked_token": masked_token,
    }
