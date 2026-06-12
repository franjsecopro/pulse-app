"""Tests for DashboardService — the monthly summary and upcoming-classes feed.

Pins the dashboard contract: expected = billable classes of the month
(cancelledWithoutPayment excluded), paid = confirmed payments dated in the
month (calendar month — no payment_timing shift here, that belongs to
accounting), pending clamps at zero.
"""
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.client import Client
from app.models.payment import Payment
from app.services.dashboard_service import DashboardService

USER_ID = 1
MONTH, YEAR = 4, 2026


def _class(
    *,
    client_id: int = 10,
    class_date: date = date(YEAR, MONTH, 10),
    duration_hours: float = 1.0,
    hourly_rate: float = 20.0,
    status: str = "normal",
) -> Class:
    return Class(
        user_id=USER_ID,
        client_id=client_id,
        contract_id=1,
        class_date=class_date,
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
        status=status,
    )


def _payment(
    *,
    client_id: int = 10,
    amount: float = 20.0,
    payment_date: date = date(YEAR, MONTH, 15),
    status: str = "confirmed",
) -> Payment:
    return Payment(
        user_id=USER_ID,
        client_id=client_id,
        amount=amount,
        payment_date=payment_date,
        concept="VIR",
        source="manual",
        status=status,
    )


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


# ─── get_summary ─────────────────────────────────────────────────────────────

class TestGetSummary:
    async def test_empty_user_returns_zeros(self, db: AsyncSession):
        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.total_expected == 0.0
        assert summary.total_paid == 0.0
        assert summary.total_pending == 0.0
        assert summary.active_clients == 0
        assert summary.month == MONTH
        assert summary.year == YEAR

    async def test_defaults_to_current_month_and_year(self, db: AsyncSession):
        today = date.today()

        summary = await DashboardService(db).get_summary(USER_ID)

        assert summary.month == today.month
        assert summary.year == today.year

    async def test_aggregates_expected_and_paid_across_clients(self, db: AsyncSession):
        await _seed(
            db,
            _class(client_id=10, duration_hours=2.0, hourly_rate=20.0),  # 40
            _class(client_id=20, duration_hours=1.0, hourly_rate=30.0),  # 30
            _payment(client_id=10, amount=40.0),
            _payment(client_id=20, amount=10.0),
        )

        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.total_expected == 70.0
        assert summary.total_paid == 50.0
        assert summary.total_pending == 20.0

    async def test_cancelled_without_payment_excluded_from_expected(self, db: AsyncSession):
        await _seed(
            db,
            _class(duration_hours=1.0, hourly_rate=50.0),
            _class(duration_hours=1.0, hourly_rate=100.0, status="cancelledWithoutPayment"),
        )

        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.total_expected == 50.0

    async def test_pending_payments_not_counted_as_paid(self, db: AsyncSession):
        await _seed(
            db,
            _class(duration_hours=1.0, hourly_rate=50.0),
            _payment(amount=50.0, status="pending"),
        )

        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.total_paid == 0.0
        assert summary.total_pending == 50.0

    async def test_pending_clamps_to_zero_when_overpaid(self, db: AsyncSession):
        await _seed(
            db,
            _class(duration_hours=1.0, hourly_rate=20.0),
            _payment(amount=100.0),
        )

        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.total_pending == 0.0

    async def test_other_months_are_excluded(self, db: AsyncSession):
        await _seed(
            db,
            _class(class_date=date(YEAR, MONTH, 10)),
            _class(class_date=date(YEAR, MONTH + 1, 1)),   # next month
            _class(class_date=date(YEAR - 1, MONTH, 10)),  # same month, previous year
            _payment(payment_date=date(YEAR, MONTH + 1, 1), amount=99.0),
        )

        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.total_expected == 20.0
        assert summary.total_paid == 0.0

    async def test_counts_only_active_unarchived_clients(self, db: AsyncSession):
        await _seed(
            db,
            Client(user_id=USER_ID, name="Activa", is_active=True),
            Client(user_id=USER_ID, name="Inactiva", is_active=False),
        )

        summary = await DashboardService(db).get_summary(USER_ID, month=MONTH, year=YEAR)

        assert summary.active_clients == 1


# ─── get_upcoming ────────────────────────────────────────────────────────────

class TestGetUpcoming:
    async def test_splits_today_and_tomorrow(self, db: AsyncSession):
        today = date.today()
        tomorrow = today + timedelta(days=1)
        await _seed(
            db,
            _class(class_date=today),
            _class(class_date=tomorrow),
            _class(class_date=tomorrow + timedelta(days=1)),  # not upcoming
        )

        upcoming = await DashboardService(db).get_upcoming(USER_ID)

        assert len(upcoming.today) == 1
        assert len(upcoming.tomorrow) == 1
        assert upcoming.today[0].class_date == today.isoformat()
        assert upcoming.tomorrow[0].class_date == tomorrow.isoformat()

    async def test_effective_revenue_zero_for_cancelled_without_payment(self, db: AsyncSession):
        await _seed(
            db,
            _class(
                class_date=date.today(),
                duration_hours=2.0,
                hourly_rate=25.0,
                status="cancelledWithoutPayment",
            ),
        )

        upcoming = await DashboardService(db).get_upcoming(USER_ID)

        assert upcoming.today[0].effective_revenue == 0.0
