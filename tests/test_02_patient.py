"""
Test Suite 2 — Patient Profile & Dashboard
===========================================
Covers: GET/PATCH patient profile, dashboard aggregation,
        weekly stats, and edge cases.
"""

import pytest
from fastapi.testclient import TestClient


class TestPatientProfile:
    """GET /patient/profile and PATCH /patient/profile"""

    def test_get_profile_success(self, client: TestClient, patient_auth):
        resp = client.get("/patient/profile", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert data["full_name"] == "Test Patient"
        assert data["gender"] == "male"
        assert data["height_cm"] == 175.0
        assert data["weight_kg"] == 80.0

    def test_get_profile_unauthorized(self, client: TestClient):
        resp = client.get("/patient/profile")
        assert resp.status_code == 401

    def test_update_profile_weight(self, client: TestClient, patient_auth):
        resp = client.patch(
            "/patient/profile",
            json={"weight_kg": 85.0},
            headers=patient_auth["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["weight_kg"] == 85.0

    def test_update_profile_name(self, client: TestClient, patient_auth):
        resp = client.patch(
            "/patient/profile",
            json={"full_name": "Test Patient Updated"},
            headers=patient_auth["headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Test Patient Updated"

        # Revert
        client.patch(
            "/patient/profile",
            json={"full_name": "Test Patient"},
            headers=patient_auth["headers"],
        )


class TestPatientDashboard:
    """GET /patient/dashboard"""

    def test_dashboard_success(self, client: TestClient, patient_auth):
        resp = client.get("/patient/dashboard", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        # Even with no data yet, all fields should exist
        assert "today_avg_glucose" in data
        assert "last_meal_time" in data
        assert "active_alerts" in data
        assert "risk_level" in data

    def test_dashboard_unauthorized(self, client: TestClient):
        resp = client.get("/patient/dashboard")
        assert resp.status_code == 401

    def test_dashboard_doctor_forbidden(self, client: TestClient, doctor_auth):
        resp = client.get("/patient/dashboard", headers=doctor_auth["headers"])
        assert resp.status_code == 403


class TestPatientStats:
    """GET /patient/stats"""

    def test_stats_success(self, client: TestClient, patient_auth):
        resp = client.get("/patient/stats", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "weekly_glucose" in data
        assert isinstance(data["weekly_glucose"], list)
