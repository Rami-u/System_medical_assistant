"""
Test Suite 10 — Settings (Profile, Preferences, Password)
==========================================================
Covers: GET/PUT profile, GET/PUT preferences, password change,
        validation, and authorization.
"""

import pytest
from fastapi.testclient import TestClient


class TestSettingsProfile:
    """GET /settings/profile and PUT /settings/profile"""

    def test_get_profile(self, client: TestClient, patient_auth):
        resp = client.get("/settings/profile", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "full_name" in data
        assert "email" in data
        assert "weight_kg" in data
        assert "height_cm" in data

    def test_update_profile(self, client: TestClient, patient_auth):
        payload = {
            "full_name": "Updated Patient Name",
            "weight_kg": 82.0,
            "height_cm": 176.0,
            "gender": "male",
        }
        resp = client.put("/settings/profile", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert data["full_name"] == "Updated Patient Name"
        assert data["weight_kg"] == 82.0

        # Revert
        revert = {
            "full_name": "Test Patient",
            "weight_kg": 85.0,
            "height_cm": 175.0,
            "gender": "male",
        }
        client.put("/settings/profile", json=revert, headers=patient_auth["headers"])

    def test_update_profile_invalid_gender(self, client: TestClient, patient_auth):
        payload = {
            "full_name": "Test",
            "gender": "invalid",
        }
        resp = client.put("/settings/profile", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422

    def test_get_profile_unauthorized(self, client: TestClient):
        resp = client.get("/settings/profile")
        assert resp.status_code == 401


class TestSettingsPreferences:
    """GET /settings/preferences and PUT /settings/preferences"""

    def test_get_preferences(self, client: TestClient, patient_auth):
        resp = client.get("/settings/preferences", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "min_glucose" in data
        assert "max_glucose" in data
        assert "carb_limit_g" in data

    def test_update_preferences(self, client: TestClient, patient_auth):
        payload = {
            "min_glucose": 80.0,
            "max_glucose": 150.0,
            "carb_limit_g": 50.0,
            "diet_type": "Mediterranean",
        }
        resp = client.put("/settings/preferences", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert data["min_glucose"] == 80.0
        assert data["max_glucose"] == 150.0
        assert data["diet_type"] == "Mediterranean"

        # Revert to defaults
        revert = {
            "min_glucose": 70.0,
            "max_glucose": 140.0,
            "carb_limit_g": 60.0,
        }
        client.put("/settings/preferences", json=revert, headers=patient_auth["headers"])

    def test_update_preferences_invalid_range(self, client: TestClient, patient_auth):
        """min_glucose must be < max_glucose."""
        payload = {
            "min_glucose": 200.0,
            "max_glucose": 100.0,
            "carb_limit_g": 50.0,
        }
        resp = client.put("/settings/preferences", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422

    def test_update_preferences_equal_range(self, client: TestClient, patient_auth):
        """min_glucose == max_glucose should fail."""
        payload = {
            "min_glucose": 100.0,
            "max_glucose": 100.0,
            "carb_limit_g": 50.0,
        }
        resp = client.put("/settings/preferences", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422


class TestPasswordChange:
    """PUT /settings/password"""

    def test_change_password_wrong_current(self, client: TestClient, patient_auth):
        payload = {
            "current_password": "WrongCurrent1",
            "new_password": "NewSecure123",
            "confirm_password": "NewSecure123",
        }
        resp = client.put("/settings/password", json=payload, headers=patient_auth["headers"])
        assert resp.status_code in (400, 401, 403)

    def test_change_password_mismatch(self, client: TestClient, patient_auth):
        payload = {
            "current_password": "TestPass123",
            "new_password": "NewSecure123",
            "confirm_password": "DifferentPass1",
        }
        resp = client.put("/settings/password", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422  # model_validator catches mismatch

    def test_change_password_too_short(self, client: TestClient, patient_auth):
        payload = {
            "current_password": "TestPass123",
            "new_password": "Short1",
            "confirm_password": "Short1",
        }
        resp = client.put("/settings/password", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422
