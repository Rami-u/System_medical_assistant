"""Add feedback column to ai_messages

Revision ID: b2c3d4e5f6a7
Revises: a327a01a8de9
Create Date: 2026-06-13 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a327a01a8de9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ai_messages', sa.Column('feedback', sa.Enum('positive', 'negative'), nullable=True))


def downgrade() -> None:
    op.drop_column('ai_messages', 'feedback')
