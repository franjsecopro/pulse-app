"""rename pdf_imports table to statement_imports

The bank-import feature no longer parses only PDFs (CSV is the primary format),
so the table is renamed to the format-agnostic ``statement_imports``.

This is a pure RENAME: data, primary key, foreign key, indexes and the RLS
enable/force flags are all preserved by Postgres. No drop+create, no data loss.

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-01
"""
from alembic import op

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table('pdf_imports', 'statement_imports')


def downgrade() -> None:
    op.rename_table('statement_imports', 'pdf_imports')
