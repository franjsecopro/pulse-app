"""Tests for PaymentRepository — filtering, user isolation, aggregations."""
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreateRequest, PaymentUpdateRequest

USER_A = 1
USER_B = 2


# ─── Helpers ────────────────────────────────────────────────────────────────

def _payment(
    *,
    user_id: int = USER_A,
    amount: float = 100.0,
    payment_date: str = "2026-04-10",
    client_id: int | None = None,
    status: str = "confirmed",
) -> Payment:
    return Payment(
        user_id=user_id,
        amount=amount,
        payment_date=date.fromisoformat(payment_date),
        client_id=client_id,
        status=status,
    )


async def _seed(db: AsyncSession, *payments: Payment) -> list[Payment]:
    for p in payments:
        db.add(p)
    await db.commit()
    for p in payments:
        await db.refresh(p)
    return list(payments)


# ─── get_all — user isolation ────────────────────────────────────────────────

class TestGetAllUserIsolation:
    async def test_only_returns_own_payments(self, db: AsyncSession):
        await _seed(
            db,
            _payment(user_id=USER_A),
            _payment(user_id=USER_B),
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A)

        assert len(results) == 1
        assert results[0].user_id == USER_A

    async def test_returns_empty_for_user_with_no_payments(self, db: AsyncSession):
        await _seed(db, _payment(user_id=USER_B))
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A)

        assert results == []


# ─── get_all — status filter ─────────────────────────────────────────────────

class TestGetAllStatusFilter:
    async def test_filters_by_confirmed(self, db: AsyncSession):
        await _seed(
            db,
            _payment(status="confirmed"),
            _payment(status="pending"),
            _payment(status="unmatched"),
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A, status="confirmed")

        assert len(results) == 1
        assert results[0].status == "confirmed"

    async def test_filters_by_pending(self, db: AsyncSession):
        await _seed(
            db,
            _payment(status="confirmed"),
            _payment(status="pending"),
            _payment(status="pending"),
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A, status="pending")

        assert len(results) == 2

    async def test_no_status_returns_all(self, db: AsyncSession):
        await _seed(
            db,
            _payment(status="confirmed"),
            _payment(status="pending"),
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A)

        assert len(results) == 2


# ─── get_all — month/year filter ────────────────────────────────────────────

class TestGetAllMonthYearFilter:
    async def test_filters_by_month_and_year(self, db: AsyncSession):
        await _seed(
            db,
            _payment(payment_date="2026-04-10"),   # April — match
            _payment(payment_date="2026-04-22"),   # April — match
            _payment(payment_date="2026-05-01"),   # May — no match
            _payment(payment_date="2025-04-10"),   # April different year — no match
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A, month=4, year=2026)

        assert len(results) == 2
        for p in results:
            assert p.payment_date.month == 4
            assert p.payment_date.year == 2026

    async def test_month_without_year_returns_all(self, db: AsyncSession):
        """Both month AND year required; partial filter → no filtering applied."""
        await _seed(
            db,
            _payment(payment_date="2026-04-10"),
            _payment(payment_date="2025-04-15"),
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A, month=4)

        assert len(results) == 2


# ─── get_all — client_id filter ─────────────────────────────────────────────

class TestGetAllClientIdFilter:
    async def test_filters_by_client_id(self, db: AsyncSession):
        await _seed(
            db,
            _payment(client_id=10),
            _payment(client_id=20),
            _payment(client_id=10),
        )
        repo = PaymentRepository(db)

        results = await repo.get_all(USER_A, client_id=10)

        assert len(results) == 2
        assert all(p.client_id == 10 for p in results)


# ─── get_by_id ───────────────────────────────────────────────────────────────

class TestGetById:
    async def test_returns_payment_by_id(self, db: AsyncSession):
        [payment] = await _seed(db, _payment())
        repo = PaymentRepository(db)

        found = await repo.get_by_id(payment.id, USER_A)

        assert found is not None
        assert found.id == payment.id

    async def test_returns_none_for_wrong_user(self, db: AsyncSession):
        [payment] = await _seed(db, _payment(user_id=USER_A))
        repo = PaymentRepository(db)

        found = await repo.get_by_id(payment.id, USER_B)

        assert found is None

    async def test_returns_none_for_unknown_id(self, db: AsyncSession):
        repo = PaymentRepository(db)

        found = await repo.get_by_id(99999, USER_A)

        assert found is None


# ─── create ──────────────────────────────────────────────────────────────────

class TestCreate:
    async def test_create_persists_payment(self, db: AsyncSession):
        repo = PaymentRepository(db)
        data = PaymentCreateRequest(
            amount=250.0,
            payment_date=date(2026, 4, 10),
            status="confirmed",
        )

        payment = await repo.create(USER_A, data)

        assert payment.id is not None
        assert payment.user_id == USER_A
        assert payment.amount == 250.0

    async def test_create_without_client_is_allowed(self, db: AsyncSession):
        repo = PaymentRepository(db)
        data = PaymentCreateRequest(
            amount=50.0,
            payment_date=date(2026, 4, 10),
        )

        payment = await repo.create(USER_A, data)

        assert payment.client_id is None


# ─── update ──────────────────────────────────────────────────────────────────

class TestUpdate:
    async def test_update_changes_amount(self, db: AsyncSession):
        [payment] = await _seed(db, _payment(amount=100.0))
        repo = PaymentRepository(db)

        updated = await repo.update(payment, PaymentUpdateRequest(amount=200.0))

        assert updated.amount == 200.0

    async def test_update_changes_status(self, db: AsyncSession):
        [payment] = await _seed(db, _payment(status="pending"))
        repo = PaymentRepository(db)

        updated = await repo.update(payment, PaymentUpdateRequest(status="confirmed"))

        assert updated.status == "confirmed"


# ─── delete ──────────────────────────────────────────────────────────────────

class TestDelete:
    async def test_delete_removes_payment(self, db: AsyncSession):
        [payment] = await _seed(db, _payment())
        repo = PaymentRepository(db)

        await repo.delete(payment)
        found = await repo.get_by_id(payment.id, USER_A)

        assert found is None


# ─── get_monthly_totals ──────────────────────────────────────────────────────

class TestGetMonthlyTotals:
    async def test_returns_total_per_client(self, db: AsyncSession):
        await _seed(
            db,
            _payment(client_id=10, amount=100.0, payment_date="2026-04-01", status="confirmed"),
            _payment(client_id=10, amount=50.0,  payment_date="2026-04-15", status="confirmed"),
            _payment(client_id=20, amount=75.0,  payment_date="2026-04-20", status="confirmed"),
        )
        repo = PaymentRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals[10] == 150.0
        assert totals[20] == 75.0

    async def test_only_counts_confirmed_payments(self, db: AsyncSession):
        await _seed(
            db,
            _payment(client_id=10, amount=100.0, payment_date="2026-04-01", status="confirmed"),
            _payment(client_id=10, amount=50.0,  payment_date="2026-04-15", status="pending"),
            _payment(client_id=10, amount=30.0,  payment_date="2026-04-20", status="unmatched"),
        )
        repo = PaymentRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals[10] == 100.0

    async def test_excludes_payments_without_client(self, db: AsyncSession):
        """Unmatched payments (client_id=None) should not appear in totals."""
        await _seed(
            db,
            _payment(client_id=None, amount=200.0, payment_date="2026-04-01", status="confirmed"),
        )
        repo = PaymentRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals == {}

    async def test_returns_empty_for_different_month(self, db: AsyncSession):
        await _seed(db, _payment(client_id=10, payment_date="2026-05-01", status="confirmed"))
        repo = PaymentRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals == {}


# ─── sum_current_month ───────────────────────────────────────────────────────

class TestSumCurrentMonth:
    async def test_sums_confirmed_payments_this_month(self, db: AsyncSession):
        today = date.today()
        other_month = today.replace(month=1) if today.month != 1 else today.replace(month=2)

        await _seed(
            db,
            _payment(amount=100.0, payment_date=today.isoformat(), status="confirmed"),
            _payment(amount=50.0,  payment_date=today.isoformat(), status="confirmed"),
            _payment(amount=200.0, payment_date=other_month.isoformat(), status="confirmed"),  # wrong month
            _payment(amount=75.0,  payment_date=today.isoformat(), status="pending"),  # not confirmed
        )
        repo = PaymentRepository(db)

        total = await repo.sum_current_month(USER_A)

        assert total == 150.0

    async def test_returns_zero_when_no_confirmed_payments(self, db: AsyncSession):
        repo = PaymentRepository(db)

        total = await repo.sum_current_month(USER_A)

        assert total == 0.0
