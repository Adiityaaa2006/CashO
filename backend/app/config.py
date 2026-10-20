from typing import List
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
    
    DATABASE_URL: str = "sqlite:///./backend/app/db/casho.db"
    MERCHANTS_FILE: str = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "merchants.json"
    )
    
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
