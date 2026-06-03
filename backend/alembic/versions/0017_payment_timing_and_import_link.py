"""client payment timing + payment→statement_import link

Two changes that ship together:
  1. clients.payment_timing — "same_month" (default) | "next_month" (pays in arrears).
     Drives the billing-period offset in AccountingService.
  2. payments.statement_import_id — links each bank-imported payment to the import
     that created it, so deleting an import can also remove its payments.

Backfill: payments created before this column existed have no link. We reconstruct
it best-effort by insertion order (payments are created sequentially per import),
and ONLY when the counts line up exactly — otherwise we leave them unlinked.

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'clients',
        sa.Column('payment_timing', sa.String(20), nullable=False, server_default='same_month'),
    )
    op.add_column('payments', sa.Column('statement_import_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_payments_statement_import_id',
        'payments', 'statement_imports',
        ['statement_import_id'], ['id'],
        ondelete='SET NULL',
    )

    _backfill_statement_import_links()


def _backfill_statement_import_links() -> None:
    """Link existing bank_import payments to their statement imports by insertion order.

    Conservative: for each user, only backfill when the total transaction_count of
    their imports equals the number of their unlinked bank_import payments. If they
    don't match (e.g. payments were deleted manually), skip that user untouched.
    """
    bind = op.get_bind()

    user_ids = bind.execute(
        sa.text("SELECT DISTINCT user_id FROM payments WHERE source = 'bank_import'")
    ).scalars().all()

    for user_id in user_ids:
        payment_ids = bind.execute(
            sa.text(
                "SELECT id FROM payments "
                "WHERE user_id = :uid AND source = 'bank_import' "
                "AND statement_import_id IS NULL "
                "ORDER BY id"
            ),
            {"uid": user_id},
        ).scalars().all()

        imports = bind.execute(
            sa.text(
                "SELECT id, transaction_count FROM statement_imports "
                "WHERE user_id = :uid "
                "ORDER BY imported_at, id"
            ),
            {"uid": user_id},
        ).all()

        total_tx = sum(row[1] or 0 for row in imports)
        if total_tx != len(payment_ids):
            # Counts don't line up — can't attribute reliably. Leave unlinked.
            continue

        cursor = 0
        update_stmt = sa.text(
            "UPDATE payments SET statement_import_id = :iid WHERE id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True))

        for import_id, tx_count in imports:
            chunk = payment_ids[cursor:cursor + (tx_count or 0)]
            cursor += tx_count or 0
            if chunk:
                bind.execute(update_stmt, {"iid": import_id, "ids": list(chunk)})


def downgrade() -> None:
    op.drop_constraint('fk_payments_statement_import_id', 'payments', type_='foreignkey')
    op.drop_column('payments', 'statement_import_id')
    op.drop_column('clients', 'payment_timing')
