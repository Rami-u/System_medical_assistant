"""
Test Suite 5 — Alerts
======================
Covers: list alerts, mark alerts read, filtering, authorization.
"""

import pytest
from fastapi.testclient import TestClient


class TestAlertsList:
    """GET /alerts/"""

    def test_list_alerts_success(self, client: TestClient, patient_auth):
        resp = client.get("/alerts/", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_list_alerts_filter_unread(self, client: TestClient, patient_auth):
        resp = client.get("/alerts/?is_read=false", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_list_alerts_filter_read(self, client: TestClient, patient_auth):
        resp = client.get("/alerts/?is_read=true", headers=patient_auth["headers"])
        assert resp.status_code == 200

    def test_list_alerts_pagination(self, client: TestClient, patient_auth):
        resp = client.get("/alerts/?skip=0&limit=10", headers=patient_auth["headers"])
        assert resp.status_code == 200

    def test_list_alerts_unauthorized(self, client: TestClient):
        resp = client.get("/alerts/")
        assert resp.status_code == 401


class TestAlertsMarkRead:
    """PATCH /alerts/read"""

    def test_mark_alerts_read_empty_list(self, client: TestClient, patient_auth):
        """Marking an empty list should fail validation (min_length=1)."""
        payload = {"alert_ids": []}
        resp = client.patch("/alerts/read", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422  # min_length=1

    def test_mark_alerts_read_nonexistent(self, client: TestClient, patient_auth):
        """Marking non-existent IDs should still succeed (no-op)."""
        payload = {"alert_ids": [99999]}
        resp = client.patch("/alerts/read", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 200
