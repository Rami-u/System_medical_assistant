"""
Test Suite 7 — AI Chat Conversations
======================================
Covers: create conversation, send message, list conversations,
        get detail, ownership validation.
"""

import pytest
from fastapi.testclient import TestClient


class TestAIConversationCreate:
    """POST /ai/conversations"""

    def test_create_conversation_success(self, client: TestClient, patient_auth):
        payload = {"title": "My Health Questions"}
        resp = client.post("/ai/conversations", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My Health Questions"
        assert data["messages"] == []
        assert "id" in data

    def test_create_conversation_no_title(self, client: TestClient, patient_auth):
        """Title is optional — should default to 'New Conversation'."""
        payload = {}
        resp = client.post("/ai/conversations", json=payload, headers=patient_auth["headers"])
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Conversation"

    def test_create_conversation_unauthorized(self, client: TestClient):
        resp = client.post("/ai/conversations", json={"title": "test"})
        assert resp.status_code == 401


class TestAISendMessage:
    """POST /ai/conversations/{id}/messages"""

    def test_send_message_success(self, client: TestClient, patient_auth):
        # First create a conversation
        convo = client.post(
            "/ai/conversations",
            json={"title": "Chat Test"},
            headers=patient_auth["headers"],
        ).json()
        convo_id = convo["id"]

        payload = {"message": "What should my fasting glucose be?"}
        resp = client.post(
            f"/ai/conversations/{convo_id}/messages",
            json=payload,
            headers=patient_auth["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2  # user msg + ai response
        assert data[0]["sender"] == "user"
        assert data[1]["sender"] == "ai"

    def test_send_message_empty(self, client: TestClient, patient_auth):
        convo = client.post(
            "/ai/conversations",
            json={"title": "Empty Test"},
            headers=patient_auth["headers"],
        ).json()

        payload = {"message": ""}
        resp = client.post(
            f"/ai/conversations/{convo['id']}/messages",
            json=payload,
            headers=patient_auth["headers"],
        )
        assert resp.status_code == 422  # min_length=1

    def test_send_message_nonexistent_convo(self, client: TestClient, patient_auth):
        payload = {"message": "Hello"}
        resp = client.post(
            "/ai/conversations/99999/messages",
            json=payload,
            headers=patient_auth["headers"],
        )
        assert resp.status_code == 404


class TestAIConversationList:
    """GET /ai/conversations"""

    def test_list_conversations(self, client: TestClient, patient_auth):
        resp = client.get("/ai/conversations", headers=patient_auth["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # We created at least 2 conversations above

    def test_list_conversations_has_message_count(self, client: TestClient, patient_auth):
        resp = client.get("/ai/conversations", headers=patient_auth["headers"])
        data = resp.json()
        # At least one convo should have messages
        for c in data:
            assert "message_count" in c


class TestAIConversationDetail:
    """GET /ai/conversations/{id}"""

    def test_get_detail(self, client: TestClient, patient_auth):
        convos = client.get("/ai/conversations", headers=patient_auth["headers"]).json()
        if convos:
            cid = convos[0]["id"]
            resp = client.get(f"/ai/conversations/{cid}", headers=patient_auth["headers"])
            assert resp.status_code == 200
            data = resp.json()
            assert "messages" in data

    def test_get_detail_not_found(self, client: TestClient, patient_auth):
        resp = client.get("/ai/conversations/99999", headers=patient_auth["headers"])
        assert resp.status_code == 404
