"""invoice_pdfs: cached PDF bytes for issued invoices (1-1 with invoices)

The immutable PDF artifact behind the shareable signed link, generated lazily on
first access. Kept in its own table so listing invoices never loads the blob.

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'invoice_pdfs',
        sa.Column(
            'invoice_id', sa.Integer(),
            sa.ForeignKey('invoices.id', ondelete='CASCADE'), primary_key=True,
        ),
        sa.Column('content', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.execute(text("ALTER TABLE invoice_pdfs ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE invoice_pdfs FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    op.drop_table('invoice_pdfs')
