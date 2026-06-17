"""Tests for invoice numbering — the legal heart of French invoicing.

French law (Art. 242 nonies A, CGI) requires a continuous, gapless chronological
sequence. The number is produced from a persistent per-user counter (NOT a
COUNT(*) of invoices, which would create gaps when a draft is discarded), and is
assigned only at issuance.

Default series scope is MONTHLY: each month is its own series that restarts at 1
(the client uses 2026-01-10 -> 2026-02-01). The reset between months is not a gap;
gaplessness is required *within* a series.
"""
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.invoice_numbering import next_invoice_number

USER_ID = 1


class TestInvoiceNumbering:
    async def test_first_number_of_a_month_is_one(self, db: AsyncSession):
        number = await next_invoice_number(db, user_id=USER_ID, issue_date=date(2026, 1, 15))
        assert number == "2026-01-01"

    async def test_increments_sequentially_within_the_same_month(self, db: AsyncSession):
        first = await next_invoice_number(db, user_id=USER_ID, issue_date=date(2026, 1, 5))
        second = await next_invoice_number(db, user_id=USER_ID, issue_date=date(2026, 1, 20))
        assert (first, second) == ("2026-01-01", "2026-01-02")

    async def test_resets_to_one_in_a_new_month(self, db: AsyncSession):
        await next_invoice_number(db, user_id=USER_ID, issue_date=date(2026, 1, 5))
        february = await next_invoice_number(db, user_id=USER_ID, issue_date=date(2026, 2, 1))
        assert february == "2026-02-01"

    async def test_sequences_are_isolated_per_user(self, db: AsyncSession):
        user_one = await next_invoice_number(db, user_id=1, issue_date=date(2026, 1, 5))
        user_two = await next_invoice_number(db, user_id=2, issue_date=date(2026, 1, 5))
        assert user_one == "2026-01-01"
        assert user_two == "2026-01-01"

    async def test_annual_scope_does_not_reset_between_months(self, db: AsyncSession):
        first = await next_invoice_number(
            db, user_id=USER_ID, issue_date=date(2026, 1, 5),
            scope="annual", number_format="YYYY-NNNN",
        )
        second = await next_invoice_number(
            db, user_id=USER_ID, issue_date=date(2026, 2, 5),
            scope="annual", number_format="YYYY-NNNN",
        )
        assert (first, second) == ("2026-0001", "2026-0002")

    async def test_counter_width_follows_the_N_run_and_never_truncates(self, db: AsyncSession):
        # 12 issued; "NN" is a minimum width of 2, not a maximum.
        last = None
        for _ in range(12):
            last = await next_invoice_number(db, user_id=USER_ID, issue_date=date(2026, 3, 1))
        assert last == "2026-03-12"
