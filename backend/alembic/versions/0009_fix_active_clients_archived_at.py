"""clear archived_at for clients that are active (data inconsistency fix)

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-08
"""
from alembic import op
from sqlalchemy import text

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(text(
        "UPDATE clients SET archived_at = NULL WHERE is_active = true AND archived_at IS NOT NULL"
    ))


def downgrade() -> None:
    pass
