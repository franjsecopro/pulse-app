"""add is_demo to users and seed demo user

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-11
"""
import secrets
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None

DEMO_EMAIL = 'demo@pulse.app'


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index('ix_users_is_demo', 'users', ['is_demo'], unique=False,
                    postgresql_where=sa.text('is_demo = true'))

    # Insert demo user if absent. Password hash is random — login via
    # credentials is intentionally broken for this account; access is
    # only possible through admin impersonation (acting_as claim in JWT).
    op.execute(
        text("""
            INSERT INTO users (email, password_hash, role, is_demo, created_at)
            VALUES (:email, :pw, 'user', true, NOW())
            ON CONFLICT (email) DO NOTHING
        """).bindparams(email=DEMO_EMAIL, pw=secrets.token_hex(32))
    )


def downgrade() -> None:
    op.execute(text("DELETE FROM users WHERE email = :email").bindparams(email=DEMO_EMAIL))
    op.drop_index('ix_users_is_demo', table_name='users')
    op.drop_column('users', 'is_demo')
