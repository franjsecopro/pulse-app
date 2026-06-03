"""fiscal groundwork: clients.tax_id + business_profiles table

Groundwork for invoicing: a fiscal id on clients and a 1-1 issuer fiscal profile.

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('tax_id', sa.String(50), nullable=True))

    op.create_table(
        'business_profiles',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('business_name', sa.String(255), nullable=True),
        sa.Column('tax_id', sa.String(50), nullable=True),
        sa.Column('fiscal_address', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_unique_constraint('uq_business_profiles_user_id', 'business_profiles', ['user_id'])

    # Match the security posture of the other tables (backend uses service_role,
    # which bypasses RLS; this blocks direct PostgREST access for other roles).
    op.execute(text("ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE business_profiles FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    op.drop_table('business_profiles')
    op.drop_column('clients', 'tax_id')
