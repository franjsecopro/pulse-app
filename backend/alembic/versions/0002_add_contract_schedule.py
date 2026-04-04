"""add contract schedule_days

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('contracts', sa.Column('schedule_days', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('contracts', 'schedule_days')
