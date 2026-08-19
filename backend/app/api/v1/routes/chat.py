"""Chat conversation history API routes."""

from datetime import datetime, timezone, timedelta
import json

from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas import (
    ConversationSyncRequest,
    ConversationListItem,
    ConversationDetail,
    ConversationListResponse,
    ChatMessage,
)
from app.services.database import get_db_session
from app.services.auth import get_current_user_from_credentials
from app.models import ChatConversation
from app.services.react_loop import clear_session_checkpoint

router = APIRouter(prefix="/conversations", tags=["Chat History"])

# Rows not updated within this period are considered expired
RETENTION_DAYS = 90


def _derive_title(messages: list[dict]) -> str:
    """Extract the first user message > 5 chars as the conversation title."""
    for msg in messages:
        if msg.get("role") == "user":
            content = (msg.get("content") or "").strip()
            if len(content) > 5:
                return content[:100]
    # Fallback: use any user message, even short ones
    for msg in messages:
        if msg.get("role") == "user":
            return (msg.get("content") or "New Chat")[:100]
    return "New Chat"


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    current_user: dict = Depends(get_current_user_from_credentials),
):
    """Return paginated sidebar entries — lightweight (no messages payload)."""
    customer_id = current_user.get("user_id")
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)

    with get_db_session() as db:
        q = (
            db.query(ChatConversation)
            .filter(
                ChatConversation.customer_id == customer_id,
                ChatConversation.updated_at >= cutoff,
            )
            .order_by(ChatConversation.created_at.desc())
        )
        total = q.count()
        rows = q.offset((page - 1) * limit).limit(limit).all()

    items = [
        ConversationListItem(
            id=r.id,
            title=r.title,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]
    return ConversationListResponse(
        conversations=items,
        has_more=(page * limit) < total,
        total=total,
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user_from_credentials),
):
    """Return the full message array for a single conversation (lazy loaded)."""
    customer_id = current_user.get("user_id")

    with get_db_session() as db:
        row = (
            db.query(ChatConversation)
            .filter(
                ChatConversation.id == conversation_id,
                ChatConversation.customer_id == customer_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail={"message": "Conversation nahi mili."})

        messages_raw = row.get_messages()

    messages = [ChatMessage(**m) for m in messages_raw]
    return ConversationDetail(
        id=row.id,
        title=row.title,
        messages=messages,
        booking_session_id=row.booking_session_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.post("/{conversation_id}/sync", status_code=200)
async def sync_conversation(
    conversation_id: str,
    payload: ConversationSyncRequest,
    current_user: dict = Depends(get_current_user_from_credentials),
):
    """Upsert the full message array for a conversation.

    Called by the frontend after the agent finishes responding (isThinking → false),
    on page/tab close (sendBeacon), and before a hard reset.
    Creates the row if it doesn't exist; updates it if it does.
    Messages are capped at 100 (oldest silently truncated by the model helper).
    """
    customer_id = current_user.get("user_id")
    now = datetime.now(timezone.utc)

    # Serialize messages to plain dicts for JSON storage
    messages_dicts = [m.model_dump(exclude_none=True) for m in payload.messages]

    with get_db_session() as db:
        row = (
            db.query(ChatConversation)
            .filter(
                ChatConversation.id == conversation_id,
                ChatConversation.customer_id == customer_id,
            )
            .first()
        )
        if row:
            # Derive title only if it's still the placeholder
            if row.title == "New Chat" and len(messages_dicts) > 0:
                row.title = _derive_title(messages_dicts)
            elif not row.title:
                row.title = payload.title or _derive_title(messages_dicts)
            row.set_messages(messages_dicts)
            row.updated_at = now
            if payload.booking_session_id:
                row.booking_session_id = payload.booking_session_id
        else:
            title = payload.title or _derive_title(messages_dicts) or "New Chat"
            new_row = ChatConversation(
                id=conversation_id,
                customer_id=customer_id,
                title=title,
                booking_session_id=payload.booking_session_id,
                created_at=now,
                updated_at=now,
            )
            new_row.set_messages(messages_dicts)
            db.add(new_row)
        db.commit()

    return {"ok": True}


@router.delete("/{conversation_id}", status_code=200)
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user_from_credentials),
):
    """Permanently delete a conversation (user-initiated)."""
    customer_id = current_user.get("user_id")

    with get_db_session() as db:
        row = (
            db.query(ChatConversation)
            .filter(
                ChatConversation.id == conversation_id,
                ChatConversation.customer_id == customer_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail={"message": "Conversation nahi mili."})
        db.delete(row)
        db.commit()

    # Also wipe the LangGraph checkpoint so the AI context is gone too
    await clear_session_checkpoint(conversation_id)

    return {"ok": True}
