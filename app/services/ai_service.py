"""
AiService — conversation management with stub AI responses.

Uses selectinload to prevent N+1 when loading messages.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_conversation import AiConversation, AiMessage
from app.models.patient_doctor import Patient
from app.schemas.ai_schemas import (
    AiChatRequest, AiConversationCreate, AiConversationListItem,
    AiConversationResponse, AiMessageResponse,
)


def _resolve_patient_id(user_id: int, db: Session) -> int:
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    pid = db.execute(stmt).scalar_one_or_none()
    if pid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return pid


def _generate_ai_response(user_message: str) -> str:
    """Stub AI response — replace with real AI provider integration."""
    return (
        "Thank you for your message. I'm your Diacheck AI assistant. "
        "AI provider integration is pending — this is a placeholder response. "
        "Please consult your doctor for medical advice."
    )


def create_conversation(data: AiConversationCreate, user_id: int, db: Session) -> AiConversationResponse:
    patient_id = _resolve_patient_id(user_id, db)
    convo = AiConversation(patient_id=patient_id, title=data.title or "New Conversation")
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return AiConversationResponse(
        id=convo.id, patient_id=convo.patient_id,
        title=convo.title, created_at=convo.created_at, messages=[],
    )


def send_message(conversation_id: int, data: AiChatRequest, user_id: int, db: Session) -> list[AiMessageResponse]:
    patient_id = _resolve_patient_id(user_id, db)

    # Verify conversation ownership
    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Save user message
    user_msg = AiMessage(conversation_id=conversation_id, sender="user", message_text=data.message)
    db.add(user_msg)
    db.flush()

    # Generate and save AI response
    ai_text = _generate_ai_response(data.message)
    ai_msg = AiMessage(conversation_id=conversation_id, sender="ai", message_text=ai_text)
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    return [AiMessageResponse.model_validate(user_msg), AiMessageResponse.model_validate(ai_msg)]


def get_conversations(user_id: int, db: Session, skip: int = 0, limit: int = 20) -> list[AiConversationListItem]:
    patient_id = _resolve_patient_id(user_id, db)

    stmt = (
        select(
            AiConversation.id, AiConversation.title, AiConversation.created_at,
            func.count(AiMessage.id).label("message_count"),
        )
        .outerjoin(AiMessage, AiMessage.conversation_id == AiConversation.id)
        .where(AiConversation.patient_id == patient_id)
        .group_by(AiConversation.id)
        .order_by(AiConversation.created_at.desc())
        .offset(skip).limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        AiConversationListItem(id=r.id, title=r.title, created_at=r.created_at, message_count=r.message_count)
        for r in rows
    ]


def get_conversation_detail(conversation_id: int, user_id: int, db: Session) -> AiConversationResponse:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = (
        select(AiConversation)
        .options(selectinload(AiConversation.messages))
        .where(AiConversation.id == conversation_id, AiConversation.patient_id == patient_id)
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return AiConversationResponse.model_validate(convo)
