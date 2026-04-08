"""rename clients.deleted_at to archived_at

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-08
"""
from alembic import op

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('clients', 'deleted_at', new_column_name='archived_at')


def downgrade() -> None:
    op.alter_column('clients', 'archived_at', new_column_name='deleted_at')
