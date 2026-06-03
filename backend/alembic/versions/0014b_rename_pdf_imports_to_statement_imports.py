"""rename pdf_imports table to statement_imports

The bank-import feature no longer parses only PDFs (CSV is the primary format),
so the table is renamed to the format-agnostic ``statement_imports``.

This is a pure RENAME: data, primary key, foreign key, indexes and the RLS
enable/force flags are all preserved by Postgres. No drop+create, no data loss.

Revision ID: 0014b
Revises: 0014
Create Date: 2026-06-01

Note: this revision originally shared id '0014' with ``0014_add_is_demo_user``,
which created a duplicate-head collision in the alembic graph. Both were already
applied to the database; this file was re-id'd to '0014b' (chained after '0014')
to linearize the history without re-running either DDL.
"""
from alembic import op

revision = '0014b'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table('pdf_imports', 'statement_imports')


def downgrade() -> None:
    op.rename_table('statement_imports', 'pdf_imports')
