"""make classes.contract_id NOT NULL

Every class must belong to a contract — this enforces the business rule
at the database level.  Any orphaned rows (contract_id IS NULL) are
removed before the constraint is applied; in practice these should not
exist because the creation form always requires a contract selection.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-10
"""
from alembic import op

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove any classes that have no contract — these violate the business rule.
    op.execute("DELETE FROM classes WHERE contract_id IS NULL")

    # Enforce the constraint at the database level.
    op.alter_column('classes', 'contract_id', nullable=False)


def downgrade() -> None:
    op.alter_column('classes', 'contract_id', nullable=True)
