"""migrate schedule_days from duration float to start/end time strings

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-04
"""
import json
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Convert schedule_days from {"weekday": hours_float} to {"weekday": {"start": "HH:MM", "end": "HH:MM"}}.

    Existing records are migrated with a default start time of 09:00.
    Records already in the new format (value is a dict) are left unchanged.
    """
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, schedule_days FROM contracts WHERE schedule_days IS NOT NULL")
    ).fetchall()

    for row in rows:
        raw = row[1]
        # Depending on the DB driver, raw may be a dict or a JSON string
        if isinstance(raw, str):
            old = json.loads(raw)
        else:
            old = raw

        if not old:
            continue

        # Already in new format if first value is a dict
        sample = next(iter(old.values()), None)
        if isinstance(sample, dict):
            continue

        new = {}
        for day, hours in old.items():
            sh, sm = 9, 0  # default start: 09:00
            total_min = round(hours * 60)
            eh = sh + (sm + total_min) // 60
            em = (sm + total_min) % 60
            new[day] = {"start": f"{sh:02d}:{sm:02d}", "end": f"{eh:02d}:{em:02d}"}

        conn.execute(
            sa.text("UPDATE contracts SET schedule_days = :val WHERE id = :id"),
            {"val": json.dumps(new), "id": row[0]},
        )


def downgrade() -> None:
    pass  # Non-reversible data migration
