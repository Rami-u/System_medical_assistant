"""
Shared pytest fixtures for Diacheck test suite.

Key design:
  - Uses StaticPool so ALL SQLite in-memory connections share
    the same database (otherwise each connection gets its own empty DB).
  - Patches database.engine and database.SessionLocal BEFORE main.py
    is imported, so the lifespan naturally uses the test database.
"""

import os
import sys
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure project root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Build test engine with StaticPool (CRITICAL for in-memory SQLite) ─
test_engine = create_engine(
    "sqlite:///:memory:",
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # <-- all connections share one DB
)

TestingSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@event.listens_for(test_engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


# ── Patch database module BEFORE importing main ──────────────
import app.models.database as db_mod

db_mod.engine = test_engine
db_mod.SessionLocal = TestingSessionLocal

# Now import main — its `from app.models.database import engine`
# picks up our patched test_engine, and lifespan + _seed_lookup_data
# will naturally use the test database.
from app.models.database import Base, get_db
from main import app


# Override FastAPI dependency to use test sessions
def _override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


# ── Fixtures ─────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client() -> TestClient:
    """
    FastAPI TestClient using the in-memory test DB.
    Session-scoped: all test modules share the same client + DB state.
    """
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="session")
def patient_auth(client: TestClient) -> dict:
    """Register a test patient and return auth headers + metadata."""
    reg_payload = {
        "full_name": "Test Patient",
        "email": "patient@test.com",
        "password": "TestPass123",
        "gender": "male",
        "height_cm": 175.0,
        "weight_kg": 80.0,
        "diabetes_type_id": 1,
    }
    reg_resp = client.post("/auth/register/patient", json=reg_payload)
    assert reg_resp.status_code == 201, (
        f"Patient registration failed: {reg_resp.status_code} {reg_resp.text}"
    )

    login_payload = {"email": "patient@test.com", "password": "TestPass123"}
    resp = client.post("/auth/login", json=login_payload)
    assert resp.status_code == 200, (
        f"Patient login failed: {resp.status_code} {resp.text}"
    )
    data = resp.json()
    return {
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "user": data["user"],
        "refresh_token": data["refresh_token"],
    }


@pytest.fixture(scope="session")
def doctor_auth(client: TestClient, patient_auth: dict) -> dict:
    """Register a test doctor and return auth headers + metadata.
    
    Depends on patient_auth to ensure patient is registered first,
    so the auto-assignment in register_doctor fires correctly.
    """
    reg_payload = {
        "full_name": "Dr. Test Doctor",
        "email": "doctor@test.com",
        "password": "DoctorPass123",
        "specialization_id": 1,
    }
    reg_resp = client.post("/auth/register/doctor", json=reg_payload)
    assert reg_resp.status_code == 201, (
        f"Doctor registration failed: {reg_resp.status_code} {reg_resp.text}"
    )

    login_payload = {"email": "doctor@test.com", "password": "DoctorPass123"}
    resp = client.post("/auth/login", json=login_payload)
    assert resp.status_code == 200, (
        f"Doctor login failed: {resp.status_code} {resp.text}"
    )
    data = resp.json()
    return {
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "user": data["user"],
        "refresh_token": data["refresh_token"],
    }
