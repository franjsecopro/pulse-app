"""user locale: add users.locale for i18n preference

Stores the UI language preference (BCP 47, e.g. es-ES / fr-FR) per user.

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('locale', sa.String(5), nullable=False, server_default='es-ES'),
    )


def downgrade() -> None:
    op.drop_column('users', 'locale')
