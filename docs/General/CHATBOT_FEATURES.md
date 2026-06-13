# Chatbot Feature Additions

## Overview

This document catalogs all new features added to the DiaCheck AI chatbot, covering backend (Python/FastAPI), frontend (React/TypeScript), database, and infrastructure changes.

---

## 1. True SSE Streaming

Real server-sent events streaming from OpenRouter, replacing the client-side word reveal simulation.

### Backend
- **`app/services/ai_service.py`**
  - `_stream_openrouter()` — new function that calls OpenRouter with `stream: true` and yields tokens via SSE
  - `_generate_ai_response_stream()` — wraps `_stream_openrouter` with system prompt + patient context + history
  - `stream_send_message()` — end-to-end streaming flow: saves user message, builds context, yields tokens, saves AI response, checks proactive alerts
  - `resp.encoding = 'utf-8'` — forces UTF-8 encoding on all `requests` calls to fix Arabic/Hebrew/Farsi character corruption

- **`app/api/ai_chat.py`**
  - `POST /ai/conversations/{id}/messages/stream` — new endpoint returning `StreamingResponse` with `text/event-stream; charset=utf-8`
  - `_DateTimeEncoder` — custom `json.JSONEncoder` that serializes `datetime` to ISO string for SSE events
  - `_json_dumps()` — helper using `ensure_ascii=False` for proper Unicode in SSE

### Frontend
- **`frontend/src/api/chatApi.ts`**
  - `fetchSSEStream()` — async generator using `fetch` + `ReadableStream` reader, parsing SSE lines and yielding tokens
  - Handles `[DONE]`, error events, and structured event types (`user_message`, `ai_message`, `alerts`)

- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - `sendMessageStreaming()` — new function using `fetchSSEStream` for real-time token display
  - Auto-updates message ID from server response after stream completes

---

## 2. Image Upload in Chat

Upload food/medical images directly within a conversation for AI analysis.

### Backend
- **`app/services/ai_service.py`**
  - `send_message_with_image()` — accepts text + image bytes; runs NVIDIA NIM Vision API to identify food items; appends vision results to the AI prompt

- **`app/api/ai_chat.py`**
  - `POST /ai/conversations/{id}/messages-with-image` — multipart/form-data endpoint accepting `message` + `file`
  - Validates file type (JPEG/PNG/WebP) and size (max 10MB)

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - Image icon button next to the textarea
  - Hidden `<input type="file">` with `accept="image/jpeg,image/png,image/webp"`
  - Selected file shown as a removable chip in the input area
  - Sends via `chatApi.sendMessageWithImage()` using `FormData`
  - Disables streaming when image is attached (falls back to non-streaming)

---

## 3. Conversation Search

Full-text search across all messages and conversation titles.

### Backend
- **`app/schemas/ai_schemas.py`**
  - `AiSearchRequest` — schema with `query` field
  - `AiSearchResult` — schema with `conversation_id`, `conversation_title`, `message_id`, `sender`, `snippet`, `created_at`

- **`app/services/ai_service.py`**
  - `search_conversations()` — performs `ILIKE` search on `ai_messages.message_text` and `ai_conversations.title`, returns context-aware snippets

- **`app/api/ai_chat.py`**
  - `POST /ai/search` — search endpoint

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - `SearchPanel` component — dropdown showing search results with sender label, snippet preview, and conversation name
  - Search input in the sidebar with Enter-to-search
- **`frontend/src/api/chatApi.ts`**
  - `chatApi.searchConversations(query)`

---

## 4. Chat Export

Export any conversation as Markdown or plain text.

### Backend
- **`app/schemas/ai_schemas.py`**
  - `AiExportRequest` — schema with `format` field (`"markdown"` or `"text"`)

- **`app/services/ai_service.py`**
  - `export_conversation()` — renders conversation as formatted markdown or text with headers, timestamps, and speaker labels

- **`app/api/ai_chat.py`**
  - `POST /ai/conversations/{id}/export` — returns `PlainTextResponse` with `Content-Disposition: attachment` for file download

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - Export button in the top bar (visible when a conversation with messages is active)
  - Downloads as `conversation_{id}.md` via blob URL
- **`frontend/src/api/chatApi.ts`**
  - `chatApi.exportConversation(id, format)` — requests blob response type

---

## 5. Message Feedback

Thumbs up / thumbs down feedback on individual AI messages.

### Backend
- **`app/models/ai_conversation.py`**
  - Added `feedback` column (`Enum("positive", "negative")`, nullable) to `AiMessage`

- **`app/schemas/ai_schemas.py`**
  - `AiFeedbackRequest` — schema with `feedback` field (`"positive"` or `"negative"`)
  - `AiMessageResponse.feedback` — new optional field exposing feedback status

- **`app/services/ai_service.py`**
  - `submit_feedback()` — updates the `feedback` column on the message, with ownership verification

- **`app/api/ai_chat.py`**
  - `POST /ai/messages/{id}/feedback` — feedback endpoint

- **`migrations/versions/b2c3d4e5f6a7_add_feedback_to_ai_messages.py`**
  - Alembic migration to add `feedback` column to `ai_messages` table

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - Thumbs up / thumbs down buttons appear on hover of each AI message
  - Selected feedback state is persisted (green for positive, red for negative)
  - Calls `chatApi.submitFeedback(messageId, feedback)`
- **`frontend/src/api/chatApi.ts`**
  - `chatApi.submitFeedback(messageId, feedback)`

---

## 6. Multi-Turn Context with Data Summaries

The AI now sees conversation history and enhanced health trend summaries.

### Backend
- **`app/services/ai_service.py`**
  - `send_message()` and `stream_send_message()` — load the last 6 messages as conversation history before generating a response
  - `_build_patient_context()` enhanced with:
    - **30-day glucose trend** — compares 7-day average vs 30-day average, reports rising/falling direction
    - **Average carb intake** per meal from recent logs
    - **Active alerts** — includes unread alerts in the context

---

## 7. Function Calling (Structured Actions)

The AI can set reminders, log medications, and book appointments via structured JSON blocks in responses.

### Backend
- **`app/schemas/ai_schemas.py`**
  - `AiFunctionCall` — schema with `function` + `parameters` dict

- **`app/services/ai_service.py`**
  - `_FUNCTION_SCHEMA` — instructions injected into the system prompt, telling the AI how to format action blocks
  - `_parse_function_calls()` — regex extraction of `---ACTION--- {...} ---END ACTION---` blocks from AI text
  - `_execute_function_call()` — executes parsed actions:
    - `create_reminder` — logs reminder details
    - `log_medication` — logs medication name + dosage
    - `book_appointment` — logs appointment request
  - Action results appended to the AI response text for user visibility

---

## 8. Proactive Health Alerts

The system detects dangerous glucose patterns after each chat exchange and surfaces them as alerts.

### Backend
- **`app/services/ai_service.py`**
  - `_check_proactive_alerts()` — checks last 24h of glucose readings for:
    - High trend: 3+ readings ≥180 mg/dL → "glucose_trend_high" warning
    - Low trend: 2+ readings <70 mg/dL → "glucose_trend_low" warning
  - Called at the end of `stream_send_message()`, yielded as `{"type": "alerts"}` SSE event

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - `AlertBanner` component — amber warning banner with icon, message, and dismiss button
  - Rendered at the top of the message area when alerts arrive

---

## 9. Doctor-Side Chatbot Access

Doctors can view their patients' AI conversations through a dedicated interface.

### Backend
- **`app/services/ai_service.py`**
  - `_resolve_doctor_id()` — resolves user ID to Doctor profile ID
  - `_verify_doctor_patient_relationship()` — ensures the doctor is assigned to the patient
  - `get_patient_conversations_for_doctor()` — returns conversations with message previews for a given patient

- **`app/api/ai_chat.py`**
  - `GET /ai/doctor/patients/{patient_id}/conversations` — doctor-only endpoint

### Frontend
- **`frontend/src/app/pages/DoctorAIAssistantPage.tsx`**
  - New page with three-panel layout:
    - **Left panel** — searchable patient list
    - **Middle panel** — patient conversation list with timestamps and message counts
    - **Right panel** — read-only conversation viewer with RTL support
  - RTL detection and direction applied to all messages

- **`frontend/src/app/routes.tsx`**
  - Added `/dashboard/doctor/ai-chat` route pointing to `DoctorAIAssistantPage`

- **`frontend/src/app/pages/DoctorDashboard.tsx`**
  - Added "AI Chat" entry to the doctor sidebar navigation
  - Changed sidebar nav to use dynamic `useLocation()` for active state detection

- **`frontend/src/api/chatApi.ts`**
  - `chatApi.getPatientConversations(patientId)`

---

## 10. RTL Support for Arabic

Automatic right-to-left text direction for Arabic-language messages.

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - `isRTL()` helper — detects Arabic Unicode range (`\u0600-\u06FF` + extended blocks)
  - **User message bubbles** — `dir="rtl"`, `text-right` alignment when Arabic detected
  - **AI message bubbles** — `dir="rtl"` on content container
  - **Textarea** — switches to `dir="rtl"` + `text-right` when user types Arabic characters

- **`frontend/src/app/pages/DoctorAIAssistantPage.tsx`**
  - Same RTL detection and direction applied to all messages
  - Timestamps flip to left side for Arabic messages

---

## 11. Delete Conversation

Remove unwanted conversations from the chat history sidebar.

### Backend
- **`app/services/ai_service.py`**
  - `delete_conversation()` — deletes conversation by ID with patient ownership check

- **`app/api/ai_chat.py`**
  - `DELETE /ai/conversations/{id}` — delete endpoint with cascade (removes all messages)

### Frontend
- **`frontend/src/app/pages/AIAssistantPage.tsx`**
  - X button on each conversation item in the sidebar (visible on hover)
  - Confirmation dialog via `window.confirm()`
  - Resets active conversation if the deleted one was currently open
  - Refreshes the conversation list after deletion
- **`frontend/src/api/chatApi.ts`**
  - `chatApi.deleteConversation(id)`

---

## Files Changed

### Backend (Python)

| File | Change |
|---|---|
| `app/models/ai_conversation.py` | Added `feedback` column to `AiMessage` |
| `app/schemas/ai_schemas.py` | Added `AiFeedbackRequest`, `AiSearchRequest`, `AiSearchResult`, `AiExportRequest`, `AiFunctionCall` |
| `app/services/ai_service.py` | ~500 lines added: SSE streaming, vision chat, search, export, feedback, function calling, proactive alerts, doctor access, delete, multi-turn context, encoding fixes |
| `app/api/ai_chat.py` | Added 7 new endpoints (stream, image, feedback, search, export, delete, doctor) |
| `migrations/versions/b2c3d4e5f6a7_add_feedback_to_ai_messages.py` | New migration for `feedback` column |
| `migrations/env.py` | Fixed model imports to use current codebase structure |

### Frontend (TypeScript/React)

| File | Change |
|---|---|
| `frontend/src/api/chatApi.ts` | Added 7 new methods + `fetchSSEStream()` helper |
| `frontend/src/app/pages/AIAssistantPage.tsx` | Complete rewrite (~1050 lines): SSE streaming, image upload, search, export, feedback, alerts, RTL, delete |
| `frontend/src/app/pages/DoctorAIAssistantPage.tsx` | New file: doctor chat viewer with patient/conversation/message panels |
| `frontend/src/app/pages/DoctorDashboard.tsx` | Added AI Chat to sidebar, dynamic `useLocation()` active state |
| `frontend/src/app/routes.tsx` | Added doctor AI chat route |

### Misc

| File | Change |
|---|---|
| `CHATBOT_FEATURES.md` | This document |
