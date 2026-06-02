"""add file_hash column to statement_imports

Stores the SHA-256 of an imported statement file so a re-upload of the same file
can be detected (Nivel 1 deduplication).

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('statement_imports', sa.Column('file_hash', sa.String(64), nullable=True))
    op.create_index('ix_statement_imports_file_hash', 'statement_imports', ['file_hash'])


def downgrade() -> None:
    op.drop_index('ix_statement_imports_file_hash', table_name='statement_imports')
    op.drop_column('statement_imports', 'file_hash')
