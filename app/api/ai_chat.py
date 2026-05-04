"""AI Chat router — conversation management."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.ai_schemas import (
    AiChatRequest, AiConversationCreate, AiConversationListItem,
    AiConversationResponse, AiMessageResponse,
)
from app.services.ai_service import (
    create_conversation, get_conversation_detail, get_conversations, send_message,
)

router = APIRouter(prefix="/ai", tags=["AI Chat"])


@router.post("/conversations", response_model=AiConversationResponse, status_code=201, summary="Start a conversation")
def start_conversation(data: AiConversationCreate, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> AiConversationResponse:
    return create_conversation(data, current_user.id, db)


@router.post("/conversations/{conversation_id}/messages", response_model=list[AiMessageResponse], summary="Send a message")
def chat(conversation_id: int, data: AiChatRequest, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> list[AiMessageResponse]:
    return send_message(conversation_id, data, current_user.id, db)


@router.get("/conversations", response_model=list[AiConversationListItem], summary="List conversations")
def list_conversations(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db),
) -> list[AiConversationListItem]:
    return get_conversations(current_user.id, db, skip, limit)


@router.get("/conversations/{conversation_id}", response_model=AiConversationResponse, summary="Get conversation detail")
def conversation_detail(conversation_id: int, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> AiConversationResponse:
    return get_conversation_detail(conversation_id, current_user.id, db)
