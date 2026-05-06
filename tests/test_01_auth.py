"""
Test Suite 1 — Authentication & Authorization
==============================================
Covers: registration, login, token refresh, /auth/me, role guards,
        validation, duplicate detection, and security edge cases.
"""

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Root health-check endpoint."""

    def test_root_returns_status(self, client: TestClient):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "Diacheck API is running"
        assert data["version"] == "2.0.0"


class TestPatientRegistration:
    """POST /auth/register/patient"""

    def test_register_patient_success(self, client: TestClient):
        payload = {
            "full_name": "Alice Smith",
            "email": "alice@example.com",
            "password": "AlicePass1",
            "gender": "female",
            "height_cm": 165.0,
            "weight_kg": 60.0,
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["message"] == "Patient registration successful"
        assert data["user"]["email"] == "alice@example.com"
        assert data["user"]["role"] == "patient"
        assert data["user"]["full_name"] == "Alice Smith"

    def test_register_duplicate_email(self, client: TestClient):
        payload = {
            "full_name": "Alice Duplicate",
            "email": "alice@example.com",
            "password": "AlicePass1",
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    def test_register_weak_password_no_uppercase(self, client: TestClient):
        payload = {
            "full_name": "Bob",
            "email": "bob@example.com",
            "password": "weakpass1",  # no uppercase
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 422

    def test_register_weak_password_no_digit(self, client: TestClient):
        payload = {
            "full_name": "Charlie",
            "email": "charlie@example.com",
            "password": "NoDigitHere",  # no digit
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 422

    def test_register_short_password(self, client: TestClient):
        payload = {
            "full_name": "Dave",
            "email": "dave@example.com",
            "password": "Sh1",  # less than 8 chars
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 422

    def test_register_invalid_email(self, client: TestClient):
        payload = {
            "full_name": "Eve",
            "email": "not-an-email",
            "password": "ValidPass1",
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 422

    def test_register_invalid_gender(self, client: TestClient):
        payload = {
            "full_name": "Frank",
            "email": "frank@example.com",
            "password": "ValidPass1",
            "gender": "unknown",  # invalid
        }
        resp = client.post("/auth/register/patient", json=payload)
        assert resp.status_code == 422


class TestDoctorRegistration:
    """POST /auth/register/doctor"""

    def test_register_doctor_success(self, client: TestClient):
        payload = {
            "full_name": "Dr. House",
            "email": "house@hospital.com",
            "password": "HousePass1",
            "specialization_id": 1,
        }
        resp = client.post("/auth/register/doctor", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["role"] == "doctor"
        assert data["user"]["full_name"] == "Dr. House"

    def test_register_doctor_duplicate_email(self, client: TestClient):
        payload = {
            "full_name": "Dr. House Copy",
            "email": "house@hospital.com",
            "password": "HousePass1",
        }
        resp = client.post("/auth/register/doctor", json=payload)
        assert resp.status_code == 409


class TestLogin:
    """POST /auth/login"""

    def test_login_patient_success(self, client: TestClient, patient_auth):
        # patient_auth fixture already logged in successfully
        assert "headers" in patient_auth
        assert patient_auth["user"]["role"] == "patient"

    def test_login_doctor_success(self, client: TestClient, doctor_auth):
        assert "headers" in doctor_auth
        assert doctor_auth["user"]["role"] == "doctor"

    def test_login_wrong_password(self, client: TestClient):
        payload = {"email": "patient@test.com", "password": "WrongPass1"}
        resp = client.post("/auth/login", json=payload)
        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()

    def test_login_nonexistent_user(self, client: TestClient):
        payload = {"email": "nobody@test.com", "password": "AnyPass1"}
        resp = client.post("/auth/login", json=payload)
        assert resp.status_code == 401

    def test_login_response_has_tokens(self, client: TestClient):
        payload = {"email": "patient@test.com", "password": "TestPass123"}
        resp = client.post("/auth/login", json=payload)
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0


class TestTokenRefresh:
    """POST /auth/refresh"""

    def test_refresh_success(self, client: TestClient, patient_auth):
        payload = {"refresh_token": patient_auth["refresh_token"]}
        resp = client.post("/auth/refresh", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_invalid_token(self, client: TestClient):
        payload = {"refresh_token": "garbage.token.value"}
        resp = client.post("/auth/refresh", json=payload)
        assert resp.status_code == 401


class TestAuthMe:
    """GET /auth/me"""

    def test_me_authenticated(self, client: TestClient, patient_auth):
        resp = client.get("/auth/me", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "patient@test.com"
        assert data["role"] == "patient"

    def test_me_no_token(self, client: TestClient):
        resp = client.get("/auth/me")
        assert resp.status_code == 401  # HTTPBearer returns 401 if missing

    def test_me_invalid_token(self, client: TestClient):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalid"})
        assert resp.status_code == 401


class TestRoleGuards:
    """Verify patient-only and doctor-only endpoints enforce role checks."""

    def test_patient_endpoint_with_doctor_token(self, client: TestClient, doctor_auth):
        resp = client.get("/patient/dashboard", headers=doctor_auth["headers"])
        assert resp.status_code == 403
        assert "patient role required" in resp.json()["detail"].lower()

    def test_doctor_endpoint_with_patient_token(self, client: TestClient, patient_auth):
        resp = client.get("/doctor/dashboard", headers=patient_auth["headers"])
        assert resp.status_code == 403
        assert "doctor role required" in resp.json()["detail"].lower()
