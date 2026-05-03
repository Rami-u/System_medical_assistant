from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_id   = Column(Integer, ForeignKey("patients.id"), nullable=True)
    role_context = Column(String(20), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    user     = relationship("User", back_populates="ai_conversations")
    patient  = relationship("Patient", back_populates="ai_conversations")
    messages = relationship("AIMessage", back_populates="conversation")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id"), nullable=False)
    sender          = Column(String(10), nullable=False)  # 'user' or 'ai'
    message_text    = Column(Text, nullable=False)
    metadata_json   = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("AIConversation", back_populates="messages")