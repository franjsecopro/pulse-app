"""enable Row-Level Security on all tables

Blocks direct Supabase REST API (PostgREST) access for anon/authenticated roles.
The FastAPI backend connects via service_role which bypasses RLS automatically,
so no application changes are needed.

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-09
"""
from alembic import op
from sqlalchemy import text

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None

TABLES = [
    "users",
    "clients",
    "contracts",
    "classes",
    "payments",
    "pdf_imports",
    "notification_settings",
    "notifications",
    "user_google_auth",
    "payment_identifiers",
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        # Force RLS even for table owners (extra safety)
        op.execute(text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    for table in TABLES:
        op.execute(text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"))
        op.execute(text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
