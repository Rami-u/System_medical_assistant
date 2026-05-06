"""
Test Suite 3 — Glucose Logging & Statistics
============================================
Covers: create glucose log, list logs, stats aggregation,
        pagination, validation, and auto-alerting.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient


class TestGlucoseCreate:
    """POST /glucose/logs"""

    def test_create_glucose_log_success(self, client: TestClient, patient_auth):
        payload = {
            "glucose_value": 120.5,
            "reading_type": "fasting",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "notes": "Normal morning reading",
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201
        data = resp.json()
        assert data["glucose_value"] == 120.5
        assert data["reading_type"] == "fasting"
        assert data["notes"] == "Normal morning reading"
        assert "id" in data
        assert "patient_id" in data

    def test_create_glucose_log_after_meal(self, client: TestClient, patient_auth):
        payload = {
            "glucose_value": 180.0,
            "reading_type": "after_meal",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201
        assert resp.json()["reading_type"] == "after_meal"

    def test_create_glucose_log_high_triggers_alert(self, client: TestClient, patient_auth):
        """A reading > 140 (default max) should trigger a background alert."""
        payload = {
            "glucose_value": 350.0,
            "reading_type": "random",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "notes": "Very high reading",
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201

    def test_create_glucose_log_low_triggers_alert(self, client: TestClient, patient_auth):
        """A reading < 70 (default min) should trigger a background alert."""
        payload = {
            "glucose_value": 45.0,
            "reading_type": "fasting",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201

    def test_create_glucose_log_invalid_reading_type(self, client: TestClient, patient_auth):
        payload = {
            "glucose_value": 100.0,
            "reading_type": "invalid_type",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422

    def test_create_glucose_log_zero_value(self, client: TestClient, patient_auth):
        payload = {
            "glucose_value": 0,
            "reading_type": "fasting",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422  # gt=0 constraint

    def test_create_glucose_log_too_high(self, client: TestClient, patient_auth):
        payload = {
            "glucose_value": 1000,
            "reading_type": "fasting",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/glucose/logs", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422  # le=900 constraint

    def test_create_glucose_log_unauthorized(self, client: TestClient):
        payload = {
            "glucose_value": 100.0,
            "reading_type": "fasting",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/glucose/logs", json=payload)
        assert resp.status_code == 401


class TestGlucoseList:
    """GET /glucose/logs"""

    def test_list_glucose_logs(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/logs", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 4  # We created 4 readings above

    def test_list_glucose_logs_pagination(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/logs?skip=0&limit=2", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 2

    def test_list_glucose_logs_invalid_limit(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/logs?limit=200", headers=patient_auth["headers"])
        assert resp.status_code == 422  # limit max is 100


class TestGlucoseStats:
    """GET /glucose/stats"""

    def test_stats_success(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/stats?days=7", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "average" in data
        assert "minimum" in data
        assert "maximum" in data
        assert "reading_count" in data
        assert "in_range_pct" in data
        assert data["reading_count"] >= 4

    def test_stats_different_range(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/stats?days=30", headers=patient_auth["headers"])
        assert resp.status_code == 200

    def test_stats_invalid_days(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/stats?days=0", headers=patient_auth["headers"])
        assert resp.status_code == 422  # ge=1

    def test_stats_too_many_days(self, client: TestClient, patient_auth):
        resp = client.get("/glucose/stats?days=100", headers=patient_auth["headers"])
        assert resp.status_code == 422  # le=90
