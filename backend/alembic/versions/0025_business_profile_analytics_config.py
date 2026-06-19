"""business_profiles: analytics config (social charge rate, income tax rate, income goal)

Nullable numeric config consumed by the analytics module. NULL = not configured,
so the net-estimate and goal cards render an empty state instead of fake numbers.
Rates are percentages of collected revenue (e.g. 22.0 = 22%); goal is in currency.

Revision ID: 0025
Revises: 0024
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = '0025'
down_revision = '0024'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('business_profiles', sa.Column('social_charge_rate', sa.Float(), nullable=True))
    op.add_column('business_profiles', sa.Column('income_tax_rate', sa.Float(), nullable=True))
    op.add_column('business_profiles', sa.Column('monthly_income_goal', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('business_profiles', 'monthly_income_goal')
    op.drop_column('business_profiles', 'income_tax_rate')
    op.drop_column('business_profiles', 'social_charge_rate')
