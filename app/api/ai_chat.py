"""AI Chat router — conversation management, streaming, search, export, feedback."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient, get_current_doctor, get_current_patient_or_doctor
from app.models.database import get_db
from app.models.user import User
from app.schemas.ai_schemas import (
    AiChatRequest, AiConversationCreate, AiConversationListItem,
    AiConversationResponse, AiMessageResponse, AiFeedbackRequest,
    AiSearchRequest, AiSearchResult, AiExportRequest,
)
from app.services.ai_service import (
    create_conversation, get_conversation_detail, get_conversations, send_message,
    stream_send_message, submit_feedback, search_conversations, export_conversation,
    send_message_with_image, get_patient_conversations_for_doctor, delete_conversation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Chat"])


class _DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def _json_dumps(obj) -> str:
    return json.dumps(obj, cls=_DateTimeEncoder, ensure_ascii=False)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


# ── Conversation CRUD ──────────────────────────

@router.post("/conversations", response_model=AiConversationResponse, status_code=201, summary="Start a conversation")
def start_conversation(
    data: AiConversationCreate,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> AiConversationResponse:
    return create_conversation(data, current_user.id, db)


@router.get("/conversations", response_model=list[AiConversationListItem], summary="List conversations")
def list_conversations(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db),
) -> list[AiConversationListItem]:
    return get_conversations(current_user.id, db, skip, limit)


@router.get("/conversations/{conversation_id}", response_model=AiConversationResponse, summary="Get conversation detail")
def conversation_detail(
    conversation_id: int,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> AiConversationResponse:
    return get_conversation_detail(conversation_id, current_user.id, db)


@router.delete("/conversations/{conversation_id}", summary="Delete a conversation")
def remove_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> dict:
    return delete_conversation(conversation_id, current_user.id, db)


# ── Send message (non-streaming) ───────────────

@router.post("/conversations/{conversation_id}/messages", response_model=list[AiMessageResponse], summary="Send a message")
def chat(
    conversation_id: int,
    data: AiChatRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> list[AiMessageResponse]:
    return send_message(conversation_id, data, current_user.id, db)


# ── Send message with image upload ─────────────

@router.post("/conversations/{conversation_id}/messages-with-image", response_model=list[AiMessageResponse], summary="Send a message with an image")
async def chat_with_image(
    conversation_id: int,
    message: str = Form(""),
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> list[AiMessageResponse]:
    image_bytes = None
    mime_type = "image/jpeg"
    if file:
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image type: {file.content_type}. Allowed: JPEG, PNG, WebP.",
            )
        image_bytes = await file.read()
        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image too large. Max {MAX_IMAGE_SIZE // (1024*1024)}MB.",
            )
        mime_type = file.content_type

    return send_message_with_image(
        conversation_id, message, image_bytes, mime_type, current_user.id, db,
    )


# ── Streaming endpoint ─────────────────────────

@router.post("/conversations/{conversation_id}/messages/stream", summary="Send a message with SSE streaming")
async def chat_stream(
    conversation_id: int,
    data: AiChatRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    def event_generator():
        for event in stream_send_message(conversation_id, data, current_user.id, db):
            if isinstance(event, str):
                yield event  # SSE token
            elif isinstance(event, dict):
                if event["type"] == "error":
                    yield f"data: {_json_dumps({'type': 'error', 'detail': event['detail']})}\n\n"
                    yield "data: [DONE]\n\n"
                elif event["type"] == "user_message":
                    yield f"data: {_json_dumps({'type': 'user_message', 'data': event['data']})}\n\n"
                elif event["type"] == "ai_message":
                    yield f"data: {_json_dumps({'type': 'ai_message', 'data': event['data']})}\n\n"
                elif event["type"] == "alerts":
                    yield f"data: {_json_dumps({'type': 'alerts', 'data': event['data']})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Feedback ───────────────────────────────────

@router.post("/messages/{message_id}/feedback", summary="Submit feedback on a message")
def feedback(
    message_id: int,
    data: AiFeedbackRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> dict:
    return submit_feedback(message_id, data, current_user.id, db)


# ── Search ─────────────────────────────────────

@router.post("/search", response_model=list[AiSearchResult], summary="Search conversations")
def search(
    data: AiSearchRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> list[AiSearchResult]:
    return search_conversations(data, current_user.id, db)


# ── Export ─────────────────────────────────────

@router.post("/conversations/{conversation_id}/export", summary="Export conversation")
def export(
    conversation_id: int,
    export_request: AiExportRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    content = export_conversation(conversation_id, export_request, current_user.id, db)
    media_type = "text/markdown" if export_request.format == "markdown" else "text/plain"
    filename = f"conversation_{conversation_id}.{'md' if export_request.format == 'markdown' else 'txt'}"
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Doctor endpoints ──────────────────────────

@router.get("/doctor/patients/{patient_id}/conversations", summary="[Doctor] View patient conversations")
def doctor_view_patient_conversations(
    patient_id: int,
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return get_patient_conversations_for_doctor(current_user.id, patient_id, db)
