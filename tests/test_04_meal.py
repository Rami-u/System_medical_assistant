"""
Test Suite 4 — Meal Logging
============================
Covers: create meal log (confirm), list meals, get detail, validation.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient


class TestMealConfirm:
    """POST /meal/confirm"""

    def test_confirm_meal_success(self, client: TestClient, patient_auth):
        payload = {
            "meal_name": "Grilled Chicken Salad",
            "total_carbs_g": 25.5,
            "total_calories": 450.0,
            "meal_time": datetime.now(timezone.utc).isoformat(),
            "detected_items": [
                {
                    "food_name": "Grilled Chicken",
                    "confidence_pct": 95.0,
                    "quantity_desc": "1 piece",
                    "carbs_g": 0.5,
                    "calories": 250.0,
                    "protein_g": 30.0,
                    "fat_g": 12.0,
                },
                {
                    "food_name": "Garden Salad",
                    "confidence_pct": 90.0,
                    "quantity_desc": "1 bowl",
                    "carbs_g": 10.0,
                    "calories": 80.0,
                    "protein_g": 3.0,
                    "fat_g": 2.0,
                },
            ],
        }
        resp = client.post("/meal/confirm", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201
        data = resp.json()
        assert data["meal_name"] == "Grilled Chicken Salad"
        assert len(data["detected_items"]) == 2
        assert data["total_carbs_g"] == 25.5

    def test_confirm_meal_no_items(self, client: TestClient, patient_auth):
        """A meal with no detected items should still work."""
        payload = {
            "meal_name": "Quick Snack",
            "total_carbs_g": 10.0,
            "total_calories": 100.0,
            "meal_time": datetime.now(timezone.utc).isoformat(),
            "detected_items": [],
        }
        resp = client.post("/meal/confirm", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201

    def test_confirm_meal_missing_meal_time(self, client: TestClient, patient_auth):
        payload = {
            "meal_name": "Missing Time",
            "detected_items": [],
        }
        resp = client.post("/meal/confirm", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 422

    def test_confirm_meal_unauthorized(self, client: TestClient):
        payload = {
            "meal_name": "Test Meal",
            "meal_time": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/meal/confirm", json=payload)
        assert resp.status_code == 401


class TestMealList:
    """GET /meal/"""

    def test_list_meals_success(self, client: TestClient, patient_auth):
        resp = client.get("/meal/?skip=0&limit=50", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # We created 2 meals above

    def test_list_meals_pagination(self, client: TestClient, patient_auth):
        resp = client.get("/meal/?skip=0&limit=1", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 1

    def test_list_meals_invalid_limit(self, client: TestClient, patient_auth):
        resp = client.get("/meal/?skip=0&limit=200", headers=patient_auth["headers"])
        assert resp.status_code == 422  # limit max is 100


class TestMealDetail:
    """GET /meal/{meal_id}"""

    def test_get_meal_detail(self, client: TestClient, patient_auth):
        # First create a meal and get its ID
        meals = client.get("/meal/?skip=0&limit=1", headers=patient_auth["headers"]).json()
        if meals:
            meal_id = meals[0]["id"]
            resp = client.get(f"/meal/{meal_id}", headers=patient_auth["headers"])
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == meal_id

    def test_get_meal_not_found(self, client: TestClient, patient_auth):
        resp = client.get("/meal/99999", headers=patient_auth["headers"])
        assert resp.status_code == 404
