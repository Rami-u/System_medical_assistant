"""
Diacheck — Single source of truth for database configuration.

SQLite with:
  • check_same_thread=False  (required for FastAPI's threaded workers)
  • PRAGMA foreign_keys=ON   (enforced per-connection via event listener)
  • PRAGMA journal_mode=WAL  (write-ahead logging for concurrency)
"""

import os
from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./diacheck.db")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ── SQLite PRAGMAs — executed on EVERY new connection ───────
@event.listens_for(Engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record) -> None:  # noqa: ANN001
    """Enable FK enforcement and WAL journal mode for SQLite."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.close()


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency — yields a DB session per request.
    The finally block ALWAYS closes the session, even if the route crashes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
