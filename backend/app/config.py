from typing import List, Optional
from pathlib import Path
import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Determine stable absolute paths so configuration loading does not depend on CWD
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent

# Load .env from project root if present, falling back to backend directory
root_env = PROJECT_DIR / ".env"
backend_env = BACKEND_DIR / ".env"

if root_env.is_file():
    load_dotenv(dotenv_path=root_env)
elif backend_env.is_file():
    load_dotenv(dotenv_path=backend_env)
else:
    load_dotenv()


class Settings:
    APP_NAME: str = "CashO"
    VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'app' / 'db' / 'casho.db'}"
    )
    MERCHANTS_FILE: str = str(BACKEND_DIR / "data" / "merchants.json")

    # OAuth and Sync Settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/sync/gmail/callback"
    )
    GMAIL_READONLY_SCOPE: str = "https://www.googleapis.com/auth/gmail.readonly"

    # Security: Symmetric encryption key for tokens at rest (AES / Fernet)
    # Must be loaded from environment or .env. Never provide hardcoded defaults in code.
    SYNC_ENCRYPTION_KEY: str = os.getenv("SYNC_ENCRYPTION_KEY", "")

    # Security: Bearer token for authorized Android companion sync
    # Must be loaded from environment or .env. Never provide hardcoded defaults in code.
    ANDROID_API_KEY: str = os.getenv("ANDROID_API_KEY", "")

    CATEGORIES: List[str] = [
        "Food & Dining",
        "Groceries",
        "Shopping",
        "Travel & Transport",
        "Bills & Utilities",
        "Entertainment",
        "Health & Fitness",
        "Investments",
        "Income",
        "Miscellaneous",
    ]

    def validate_security_config(self) -> None:
        """
        Validate that required security keys are configured without exposing their values.
        Raises ValueError with clear remediation instructions if missing.
        """
        missing = []
        if not self.SYNC_ENCRYPTION_KEY:
            missing.append("SYNC_ENCRYPTION_KEY")
        if not self.ANDROID_API_KEY:
            missing.append("ANDROID_API_KEY")
        if missing:
            raise ValueError(
                f"Missing required security configuration: {', '.join(missing)}. "
                f"Please define these variables in your local .env file or environment."
            )


settings = Settings()

