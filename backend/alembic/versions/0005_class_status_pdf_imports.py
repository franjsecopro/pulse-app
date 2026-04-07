"""add class status field and pdf_imports table

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Campo status en clases (normal por defecto)
    op.add_column(
        'classes',
        sa.Column('status', sa.String(30), nullable=False, server_default='normal'),
    )

    # 2. Tabla de historial de PDFs importados
    op.create_table(
        'pdf_imports',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('imported_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('month', sa.Integer(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('pdf_imports')
    op.drop_column('classes', 'status')
