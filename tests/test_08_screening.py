"""
Test Suite 8 — Screening & ML Predictions
==========================================
Covers: screening questions endpoint, predict (simple & advanced),
        anonymous vs authenticated, history, and validation.
        
NOTE: These tests mock the AIModelService since the real sklearn
models may not be loaded in test environment.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import numpy as np


class TestScreeningQuestions:
    """GET /screening/questions/{test_type}"""

    def test_get_simple_questions(self, client: TestClient):
        resp = client.get("/screening/questions/simple")
        assert resp.status_code == 200
        data = resp.json()
        assert data["test_type"] == "simple"
        assert data["title"] == "Simple Screening"
        assert len(data["questions"]) == 6

    def test_get_advanced_questions(self, client: TestClient):
        resp = client.get("/screening/questions/advanced")
        assert resp.status_code == 200
        data = resp.json()
        assert data["test_type"] == "advanced"
        assert data["title"] == "Advanced Screening"
        assert len(data["questions"]) == 8

    def test_get_invalid_type_questions(self, client: TestClient):
        resp = client.get("/screening/questions/nonexistent")
        assert resp.status_code == 404


class TestScreeningPredict:
    """POST /screening/predict"""

    @patch("app.services.screening_service.AIModelService")
    def test_predict_simple_anonymous(self, mock_service, client: TestClient):
        """Anonymous simple screening — no DB save."""
        # Mock the ML model
        mock_model = MagicMock()
        mock_model.predict_proba.return_value = np.array([[0.8, 0.2]])
        mock_model.classes_ = np.array([0, 1])
        mock_service.models_ready.return_value = True
        mock_service._advanced_model = mock_model

        payload = {
            "screening_type": "simple",
            "answers": [
                {"question_id": 1, "answer_numeric": 25},
                {"question_id": 2, "answer_value": "175,70"},
                {"question_id": 3, "answer_numeric": 90},
                {"question_id": 4, "answer_value": "active"},
                {"question_id": 5, "answer_value": "no"},
                {"question_id": 6, "answer_value": "no"},
            ],
        }
        resp = client.post("/screening/predict", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "risk_level" in data
        assert "risk_score" in data
        assert data["risk_level"] in ("low", "moderate", "high")

    @patch("app.services.screening_service.AIModelService")
    def test_predict_advanced_authenticated(self, mock_service, client: TestClient, patient_auth):
        """Authenticated advanced screening — saves to DB."""
        mock_model = MagicMock()
        mock_model.predict_proba.return_value = np.array([[0.3, 0.7]])
        mock_model.classes_ = np.array([0, 1])
        mock_service.models_ready.return_value = True
        mock_service._advanced_model = mock_model

        payload = {
            "screening_type": "advanced",
            "answers": [
                {"question_id": 1, "answer_value": "male"},
                {"question_id": 2, "answer_numeric": 50},
                {"question_id": 3, "answer_value": "yes"},
                {"question_id": 4, "answer_value": "no"},
                {"question_id": 5, "answer_value": "former"},
                {"question_id": 6, "answer_value": "175,88"},
                {"question_id": 7, "answer_numeric": 6.5},
                {"question_id": 8, "answer_numeric": 160},
            ],
        }
        resp = client.post("/screening/predict", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201
        data = resp.json()
        assert data["risk_level"] in ("low", "moderate", "high")

    def test_predict_invalid_type(self, client: TestClient):
        payload = {
            "screening_type": "invalid",
            "answers": [],
        }
        resp = client.post("/screening/predict", json=payload)
        assert resp.status_code == 422  # pattern validation


class TestScreeningHistory:
    """GET /screening/history"""

    def test_get_history_authenticated(self, client: TestClient, patient_auth):
        resp = client.get("/screening/history", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_history_unauthorized(self, client: TestClient):
        resp = client.get("/screening/history")
        assert resp.status_code == 401
