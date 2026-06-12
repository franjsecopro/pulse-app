"""class gcal sync status: surface Google Calendar sync failures to the user

Adds classes.gcal_sync_status ('synced' | 'failed' | NULL = never attempted)
and classes.gcal_synced_at (timestamp of the last attempt) so the UI can show
a failed-sync badge with a retry button instead of failing silently.

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'classes',
        sa.Column('gcal_sync_status', sa.String(10), nullable=True),
    )
    op.add_column(
        'classes',
        sa.Column('gcal_synced_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('classes', 'gcal_synced_at')
    op.drop_column('classes', 'gcal_sync_status')
