"""
Diacheck — Centralized application settings.

Reads all config from environment variables / .env file.
"""

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """
    Reads config from .env using plain os.getenv.
    All settings are centralised here for easy reference.
    """

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./diacheck.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")
    )
    DOCTOR_ACCESS_KEY: str = os.getenv("DOCTOR_ACCESS_KEY", "DIACHECK-DOC-2026-SECURE")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()