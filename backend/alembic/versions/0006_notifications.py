"""add notifications system

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None

DEFAULT_TEMPLATE = 'Hola {nombre}, te recuerdo que mañana {dia} tienes clase a las {hora}. ¡Hasta mañana!'


def upgrade() -> None:
    # 1. Número WhatsApp en clientes (separado del teléfono de contacto)
    op.add_column(
        'clients',
        sa.Column('whatsapp_phone', sa.String(50), nullable=True),
    )

    # 2. Configuración de notificaciones por usuario
    op.create_table(
        'notification_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('default_channel', sa.String(20), nullable=False, server_default='whatsapp'),
        sa.Column('message_template', sa.Text(), nullable=False, server_default=DEFAULT_TEMPLATE),
    )

    # 3. Registro de notificaciones generadas
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('classes.id'), nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('channel', sa.String(20), nullable=False, server_default='whatsapp'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('class_date', sa.Date(), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('notification_settings')
    op.drop_column('clients', 'whatsapp_phone')
