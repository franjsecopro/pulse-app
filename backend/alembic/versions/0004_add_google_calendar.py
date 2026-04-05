"""add google calendar support: user_google_auth table + contract calendar fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Nueva tabla para credenciales OAuth de Google por usuario
    op.create_table(
        'user_google_auth',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('google_email', sa.String(255), nullable=False),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=False),
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('calendar_id', sa.String(255), nullable=False, server_default='primary'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', name='uq_user_google_auth_user_id'),
    )

    # 2. Campos de calendario en la tabla de contratos
    op.add_column('contracts', sa.Column('calendar_description', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('calendar_reminders', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('contracts', 'calendar_reminders')
    op.drop_column('contracts', 'calendar_description')
    op.drop_table('user_google_auth')
