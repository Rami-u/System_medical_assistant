from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ── many-to-many association table ──────────────────────────
user_roles_table = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        Integer,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "assigned_at",
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    ),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    users: Mapped[list["User"]] = relationship(
        secondary=user_roles_table, back_populates="roles"
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # relationships — roles eagerly loaded to prevent N+1
    roles: Mapped[list["Role"]] = relationship(
        secondary=user_roles_table, back_populates="users", lazy="selectin"
    )
    patient: Mapped["Patient"] = relationship(back_populates="user", uselist=False)
    doctor: Mapped["Doctor"] = relationship(back_populates="user", uselist=False)
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")
