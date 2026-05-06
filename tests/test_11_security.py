"""
Test Suite 11 — Security & Edge Cases
=======================================
Covers: password hashing, JWT token creation/validation,
        token expiry, CORS headers, and edge cases.
"""

import pytest
import time
from fastapi.testclient import TestClient

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


class TestPasswordHashing:
    """Direct unit tests for bcrypt password utilities."""

    def test_hash_creates_valid_hash(self):
        password = "MySecurePass123"
        hashed = hash_password(password)
        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_verify_correct_password(self):
        password = "CorrectHorse1"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("RealPassword1")
        assert verify_password("WrongPassword1", hashed) is False

    def test_hash_uniqueness(self):
        """Same password should produce different hashes (random salt)."""
        p = "SamePass123"
        h1 = hash_password(p)
        h2 = hash_password(p)
        assert h1 != h2  # Different salts
        assert verify_password(p, h1) is True
        assert verify_password(p, h2) is True


class TestJWTTokens:
    """Direct unit tests for JWT creation and decoding."""

    def test_create_and_decode_access_token(self):
        token = create_access_token(user_id=42, role_id=1)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["role_id"] == 1
        assert payload["type"] == "access"

    def test_create_and_decode_refresh_token(self):
        token = create_refresh_token(user_id=99, role_id=2)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "99"
        assert payload["type"] == "refresh"

    def test_decode_invalid_token(self):
        payload = decode_token("not.a.valid.jwt.token")
        assert payload is None

    def test_decode_empty_token(self):
        payload = decode_token("")
        assert payload is None

    def test_token_contains_expiry(self):
        token = create_access_token(user_id=1, role_id=1)
        payload = decode_token(token)
        assert "exp" in payload


class TestCORSHeaders:
    """Verify CORS is configured correctly."""

    def test_cors_allows_origin(self, client: TestClient):
        resp = client.options(
            "/auth/login",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers


class TestEdgeCases:
    """Various edge cases and boundary conditions."""

    def test_nonexistent_endpoint(self, client: TestClient):
        resp = client.get("/api/v99/does-not-exist")
        assert resp.status_code in (404, 307)  # May redirect or 404

    def test_method_not_allowed(self, client: TestClient, patient_auth):
        # GET on a POST-only endpoint
        resp = client.get("/auth/login")
        assert resp.status_code == 405

    def test_empty_body_on_post(self, client: TestClient):
        resp = client.post("/auth/login", content="")
        assert resp.status_code == 422

    def test_malformed_json(self, client: TestClient):
        resp = client.post(
            "/auth/login",
            content="{bad json}",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422

    def test_docs_endpoint_available(self, client: TestClient):
        resp = client.get("/docs")
        assert resp.status_code == 200

    def test_redoc_endpoint_available(self, client: TestClient):
        resp = client.get("/redoc")
        assert resp.status_code == 200

    def test_openapi_schema(self, client: TestClient):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["info"]["title"] == "Diacheck API"
        assert data["info"]["version"] == "2.0.0"
