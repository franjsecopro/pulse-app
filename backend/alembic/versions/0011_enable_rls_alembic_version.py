"""enable RLS on alembic_version table

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-09
"""
from alembic import op
from sqlalchemy import text

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE alembic_version FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    op.execute(text("ALTER TABLE alembic_version NO FORCE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY"))
