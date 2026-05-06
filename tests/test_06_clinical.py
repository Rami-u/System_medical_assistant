"""
Test Suite 6 — Clinical Notes
==============================
Covers: create clinical note (doctor), list notes (patient & doctor),
        role enforcement.
"""

import pytest
from fastapi.testclient import TestClient


class TestClinicalNoteCreate:
    """POST /clinical/notes (doctor only)"""

    def test_create_note_doctor_success(self, client: TestClient, doctor_auth, patient_auth):
        """Doctor creates a clinical note for the test patient."""
        patient_id = patient_auth["user"]["id"]
        # We need patient's Patient row ID, not user ID
        # The clinical note API expects the notes to reference patient
        # Let's try creating with doctor auth
        payload = {
            "patient_id": 1,  # First patient in test DB
            "note_text": "Patient shows stable glucose levels. Continue current regimen.",
            "priority": "routine",
        }
        resp = client.post("/clinical/notes", json=payload, headers=doctor_auth["headers"])
        assert resp.status_code == 201
        data = resp.json()
        assert data["note_text"] == "Patient shows stable glucose levels. Continue current regimen."
        assert data["priority"] == "routine"

    def test_create_note_urgent(self, client: TestClient, doctor_auth):
        payload = {
            "patient_id": 1,
            "note_text": "Urgent: Recurring hyperglycemia. Adjust medication immediately.",
            "priority": "urgent",
        }
        resp = client.post("/clinical/notes", json=payload, headers=doctor_auth["headers"])
        assert resp.status_code == 201
        assert resp.json()["priority"] == "urgent"

    def test_create_note_patient_forbidden(self, client: TestClient, patient_auth):
        """Patients should NOT be able to create clinical notes."""
        payload = {
            "patient_id": 1,
            "note_text": "I feel fine",
            "priority": "routine",
        }
        resp = client.post("/clinical/notes", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 403

    def test_create_note_invalid_priority(self, client: TestClient, doctor_auth):
        payload = {
            "patient_id": 1,
            "note_text": "Test note",
            "priority": "invalid",  # not routine|urgent|critical
        }
        resp = client.post("/clinical/notes", json=payload, headers=doctor_auth["headers"])
        assert resp.status_code == 422


class TestClinicalNoteList:
    """GET /clinical/notes"""

    def test_list_notes_patient(self, client: TestClient, patient_auth):
        """Patient should see their own notes (no patient_id required)."""
        resp = client.get("/clinical/notes", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_list_notes_doctor_requires_patient_id(self, client: TestClient, doctor_auth):
        """Doctor MUST provide patient_id."""
        resp = client.get("/clinical/notes", headers=doctor_auth["headers"])
        assert resp.status_code == 400
        assert "patient_id" in resp.json()["detail"].lower()

    def test_list_notes_doctor_with_patient_id(self, client: TestClient, doctor_auth):
        resp = client.get("/clinical/notes?patient_id=1", headers=doctor_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
