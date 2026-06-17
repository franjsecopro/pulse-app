"""invoices.contract_label: display-only contract label for the invoices list

The contract description when an invoice covers a single contract (NULL when it
spans several). Display-only — NOT shown on the PDF.

Revision ID: 0024
Revises: 0023
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('contract_label', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'contract_label')
