import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Text, text

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


_JOBS = [
    ("clients", ["email", "phone", "whatsapp_phone", "address", "tax_id"]),
    ("business_profiles", ["tax_id", "fiscal_address"]),
    ("payment_identifiers", ["info"]),
]


def _bind_keys() -> None:
    raw = os.environ.get("FIELD_ENCRYPTION_KEYS", "").strip()
    if not raw:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEYS is empty — cannot run migration 0020. "
            "Set the env var (comma-separated Fernet keys) before "
            "running 'alembic upgrade'."
        )
    from app.core.crypto import _set_keys
    _set_keys([k.strip() for k in raw.split(",") if k.strip()])


def upgrade() -> None:
    _bind_keys()
    from app.core.crypto import encrypt_value, is_already_encrypted

    bind = op.get_bind()

    for table, columns in _JOBS:
        for column in columns:
            op.alter_column(
                table, column,
                type_=Text(),
                existing_type=sa.String(),
                existing_nullable=True,
            )

        quoted_cols = ", ".join(f'"{c}"' for c in columns)
        rows = bind.execute(
            text(f'SELECT id, {quoted_cols} FROM "{table}"')
        ).all()

        for row in rows:
            updates = {}
            for column in columns:
                value = getattr(row, column)
                if value is None or is_already_encrypted(value):
                    continue
                updates[column] = encrypt_value(value)
            if not updates:
                continue
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            params = {**updates, "id": row.id}
            bind.execute(
                text(f'UPDATE "{table}" SET {set_clause} WHERE id = :id'),
                params,
            )


def downgrade() -> None:
    _bind_keys()
    from app.core.crypto import decrypt_value, is_already_encrypted

    bind = op.get_bind()

    for table, columns in _JOBS:
        quoted_cols = ", ".join(f'"{c}"' for c in columns)
        rows = bind.execute(
            text(f'SELECT id, {quoted_cols} FROM "{table}"')
        ).all()

        for row in rows:
            updates = {}
            for column in columns:
                value = getattr(row, column)
                if value is None or not is_already_encrypted(value):
                    continue
                updates[column] = decrypt_value(value)
            if not updates:
                continue
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            params = {**updates, "id": row.id}
            bind.execute(
                text(f'UPDATE "{table}" SET {set_clause} WHERE id = :id'),
                params,
            )

        for column in columns:
            op.alter_column(
                table, column,
                existing_type=Text(),
                type_=sa.String(255),
                existing_nullable=True,
            )
