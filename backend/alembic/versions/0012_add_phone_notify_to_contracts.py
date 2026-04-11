"""add phone and notify fields to contracts

phone stores the student's contact number (may differ from the payer/client).
notify is a per-contract flag that enables reminders/notifications.

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('contracts', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('contracts', sa.Column('notify', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('contracts', 'notify')
    op.drop_column('contracts', 'phone')
