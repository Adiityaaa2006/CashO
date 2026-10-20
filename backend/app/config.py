from typing import List, Optional
import os

class Settings:
    APP_NAME: str = "CashO"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./backend/app/db/casho.db")
    MERCHANTS_FILE: str = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "merchants.json"
    )
    
    # OAuth and Sync Settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/sync/gmail/callback")
    GMAIL_READONLY_SCOPE: str = "https://www.googleapis.com/auth/gmail.readonly"
    
    # Security: Symmetric encryption key for tokens at rest (AES / Fernet)
    SYNC_ENCRYPTION_KEY: str = os.getenv("SYNC_ENCRYPTION_KEY", "m8Z4K4B0T6x_1R7eH2yP5qW9jN3vF8sC2aE6uI0oL4A=")
    
    # Security: Bearer token for authorized Android companion sync
    ANDROID_API_KEY: str = os.getenv("ANDROID_API_KEY", "casho_android_sync_key_98765")
    
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

settings = Settings()
