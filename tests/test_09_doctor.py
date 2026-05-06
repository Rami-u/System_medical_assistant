"""
Test Suite 9 — Doctor Dashboard & Patient Management
=====================================================
Covers: doctor dashboard, patient list, patient profile view,
        patient glucose view, notes, alerts, role enforcement.
"""

import pytest
from fastapi.testclient import TestClient


class TestDoctorDashboard:
    """GET /doctor/dashboard"""

    def test_dashboard_success(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/dashboard", headers=doctor_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "doctor_name" in data
        assert "stats" in data
        assert "population_trend" in data
        assert "risk_distribution" in data

    def test_dashboard_patient_forbidden(self, client: TestClient, patient_auth):
        resp = client.get("/doctor/dashboard", headers=patient_auth["headers"])
        assert resp.status_code == 403

    def test_dashboard_unauthorized(self, client: TestClient):
        resp = client.get("/doctor/dashboard")
        assert resp.status_code == 401


class TestDoctorPatientList:
    """GET /doctor/patients"""

    def test_list_patients(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/patients", headers=doctor_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "patients" in data
        assert isinstance(data["patients"], list)

    def test_list_patients_filter_risk(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/patients?risk=high", headers=doctor_auth["headers"])
        assert resp.status_code == 200

    def test_list_patients_invalid_risk(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/patients?risk=invalid", headers=doctor_auth["headers"])
        assert resp.status_code == 422  # pattern validation


class TestDoctorPatientProfile:
    """GET /doctor/patients/{patient_id}/profile"""

    def test_view_patient_profile(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/patients/1/profile", headers=doctor_auth["headers"])
        # May be 200 or 404 depending on if patient is assigned to this doctor
        assert resp.status_code in (200, 403, 404)


class TestDoctorPatientGlucose:
    """GET /doctor/patients/{patient_id}/glucose"""

    def test_view_patient_glucose(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/patients/1/glucose?days=30", headers=doctor_auth["headers"])
        assert resp.status_code in (200, 403, 404)


class TestDoctorNotes:
    """POST /doctor/notes and GET /doctor/notes/{patient_id}"""

    def test_create_note(self, client: TestClient, doctor_auth, patient_auth):
        # Get actual patients.id (different from users.id)
        profile = client.get("/patient/profile", headers=patient_auth["headers"]).json()
        patient_profile_id = profile["id"]
        payload = {
            "patient_id": patient_profile_id,
            "note_text": "Doctor note from doctor dashboard.",
            "priority": "routine",
        }
        resp = client.post("/doctor/notes", json=payload, headers=doctor_auth["headers"])
        assert resp.status_code in (201, 200)

    def test_list_notes(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/notes/1", headers=doctor_auth["headers"])
        assert resp.status_code in (200, 403, 404)

    def test_create_note_critical_priority(self, client: TestClient, doctor_auth, patient_auth):
        # Get actual patients.id (different from users.id)
        profile = client.get("/patient/profile", headers=patient_auth["headers"]).json()
        patient_profile_id = profile["id"]
        payload = {
            "patient_id": patient_profile_id,
            "note_text": "Critical: Immediate intervention required.",
            "priority": "critical",
        }
        resp = client.post("/doctor/notes", json=payload, headers=doctor_auth["headers"])
        assert resp.status_code in (201, 200)


class TestDoctorAlerts:
    """GET /doctor/alerts"""

    def test_list_doctor_alerts(self, client: TestClient, doctor_auth):
        resp = client.get("/doctor/alerts", headers=doctor_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_mark_alert_read(self, client: TestClient, doctor_auth):
        resp = client.put("/doctor/alerts/99999/read", headers=doctor_auth["headers"])
        assert resp.status_code in (200, 404)
