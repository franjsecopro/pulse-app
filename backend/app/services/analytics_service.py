"""Analytics module service.

Composes the existing aggregation building blocks (class/payment monthly totals,
business-profile charge rates) into time-series and KPIs for the analytics tab.
It must NOT re-derive revenue or net rules — those live in `class_revenue` and
`analytics_net`.
"""
from datetime import date, timedelta
from typing import Iterator, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business_profile import BusinessProfile
from app.repositories.class_repository import ClassRepository
from app.repositories.client_repository import ClientRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.analytics import (
    AnalyticsOverview,
    ClientContributionItem,
    ProjectionResponse,
    ReceivableItem,
    RevenueTimeseriesPoint,
)
from app.schemas.class_ import (
    STATUS_CANCELLED_WITH_PAYMENT,
    STATUS_CANCELLED_WITHOUT_PAYMENT,
    STATUS_NORMAL,
)
from app.services.accounting_service import AccountingService
from app.services.analytics_net import estimate_net
from app.services.class_revenue import effective_revenue

# Hard cap so a malformed/huge range can never trigger an unbounded query loop.
MAX_MONTHS = 36


def _parse_period(value: str) -> tuple[int, int]:
    """Parse a "YYYY-MM" string into (year, month). Raises ValueError if invalid."""
    try:
        year_str, month_str = value.split("-")
        year, month = int(year_str), int(month_str)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Invalid period '{value}', expected YYYY-MM") from exc
    if not 1 <= month <= 12:
        raise ValueError(f"Invalid month in period '{value}'")
    return year, month


def _iter_months(start: tuple[int, int], end: tuple[int, int]) -> Iterator[tuple[int, int]]:
    """Yield (year, month) from start to end inclusive. Empty if start > end."""
    year, month = start
    while (year, month) <= end:
        yield year, month
        month += 1
        if month > 12:
            month = 1
            year += 1


def _shift_month(period: tuple[int, int], delta: int) -> tuple[int, int]:
    """Return the period `delta` months away (delta may be negative)."""
    year, month = period
    total = year * 12 + (month - 1) + delta
    return total // 12, total % 12 + 1


def _count_months(start: tuple[int, int], end: tuple[int, int]) -> int:
    """Number of months in the inclusive range (0 if start > end)."""
    delta = (end[0] * 12 + end[1]) - (start[0] * 12 + start[1]) + 1
    return max(0, delta)


def _pct_change(current: float, previous: float) -> Optional[float]:
    """Percentage change vs previous; None when there's no baseline to compare to."""
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 2)


def _last_day_of_month(period: tuple[int, int]) -> date:
    """Last calendar day of (year, month)."""
    first_of_next = _shift_month(period, 1)
    return date(first_of_next[0], first_of_next[1], 1) - timedelta(days=1)


def _horizon_range(today: date, horizon: str) -> tuple[date, date]:
    """Calendar range for a projection horizon, relative to `today`.

    Periods are CALENDAR-based, not rolling windows. Supported horizons:
    this_month, this_year, rest_of_year, next_month, next_quarter (fiscal),
    next_year. So "next_year" with nothing scheduled that year yields 0 — it never
    borrows from the coming weeks.
    """
    year, month = today.year, today.month

    if horizon == "this_month":
        return date(year, month, 1), _last_day_of_month((year, month))
    if horizon == "this_year":
        return date(year, 1, 1), date(year, 12, 31)
    if horizon == "rest_of_year":
        return today, date(year, 12, 31)
    if horizon == "next_year":
        return date(year + 1, 1, 1), date(year + 1, 12, 31)
    if horizon == "next_quarter":
        # Quarters are 0-indexed: Q1=Jan-Mar … Q4=Oct-Dec. Move to the next one.
        next_quarter_index = (month - 1) // 3 + 1
        quarter_year = year + next_quarter_index // 4
        quarter = next_quarter_index % 4
        start_month = quarter * 3 + 1
        return date(quarter_year, start_month, 1), _last_day_of_month(
            (quarter_year, start_month + 2)
        )
    # Default / "next_month": the next calendar month.
    start_period = _shift_month((year, month), 1)
    return date(start_period[0], start_period[1], 1), _last_day_of_month(start_period)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._class_repo = ClassRepository(db)
        self._payment_repo = PaymentRepository(db)
        self._client_repo = ClientRepository(db)
        self._accounting = AccountingService(db)

    async def _charge_rates(self, user_id: int) -> tuple[Optional[float], Optional[float]]:
        result = await self._db.execute(
            select(BusinessProfile).where(BusinessProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            return None, None
        return profile.social_charge_rate, profile.income_tax_rate

    async def _month_expected_paid(
        self, user_id: int, year: int, month: int
    ) -> tuple[float, float]:
        """Expected (billable classes) and paid (cash collected) for one month."""
        class_totals = await self._class_repo.get_monthly_totals(user_id, year, month)
        payment_totals = await self._payment_repo.get_monthly_totals(user_id, year, month)
        return sum(class_totals.values()), sum(payment_totals.values())

    async def _sum_range(
        self, user_id: int, start: tuple[int, int], end: tuple[int, int]
    ) -> tuple[float, float]:
        """Total expected and paid across the inclusive month range (capped at MAX_MONTHS)."""
        expected_total = 0.0
        paid_total = 0.0
        for index, (year, month) in enumerate(_iter_months(start, end)):
            if index >= MAX_MONTHS:
                break
            expected, paid = await self._month_expected_paid(user_id, year, month)
            expected_total += expected
            paid_total += paid
        return round(expected_total, 2), round(paid_total, 2)

    async def revenue_timeseries(
        self, user_id: int, period_from: str, period_to: str
    ) -> list[RevenueTimeseriesPoint]:
        """Monthly expected / paid / pending / net across the inclusive range.

        `paid` is attributed by payment_date month (cash collected that month).
        `net` applies the user's configured charge rates to `paid`; None if unset.
        """
        start = _parse_period(period_from)
        end = _parse_period(period_to)
        social_rate, income_rate = await self._charge_rates(user_id)

        points: list[RevenueTimeseriesPoint] = []
        for index, (year, month) in enumerate(_iter_months(start, end)):
            if index >= MAX_MONTHS:
                break
            expected_raw, paid_raw = await self._month_expected_paid(user_id, year, month)
            expected = round(expected_raw, 2)
            paid = round(paid_raw, 2)
            pending = round(max(0.0, expected - paid), 2)
            points.append(
                RevenueTimeseriesPoint(
                    period=f"{year:04d}-{month:02d}",
                    expected=expected,
                    paid=paid,
                    pending=pending,
                    net=estimate_net(paid, social_rate, income_rate),
                )
            )
        return points

    async def overview(
        self, user_id: int, period_from: str, period_to: str
    ) -> AnalyticsOverview:
        """Range KPIs + comparison vs the immediately-preceding equal-length period."""
        start = _parse_period(period_from)
        end = _parse_period(period_to)
        social_rate, income_rate = await self._charge_rates(user_id)

        expected, paid = await self._sum_range(user_id, start, end)
        pending = round(max(0.0, expected - paid), 2)
        collection_rate = round(paid / expected * 100, 2) if expected > 0 else None

        months = _count_months(start, end)
        prev_end = _shift_month(start, -1)
        prev_start = _shift_month(prev_end, -(months - 1))
        prev_expected, prev_paid = await self._sum_range(user_id, prev_start, prev_end)

        return AnalyticsOverview(
            period_from=f"{start[0]:04d}-{start[1]:02d}",
            period_to=f"{end[0]:04d}-{end[1]:02d}",
            expected=expected,
            paid=paid,
            pending=pending,
            net=estimate_net(paid, social_rate, income_rate),
            collection_rate=collection_rate,
            expected_change_pct=_pct_change(expected, prev_expected),
            paid_change_pct=_pct_change(paid, prev_paid),
        )

    async def receivables(self, user_id: int) -> list[ReceivableItem]:
        """Clients with negative balance ranked by debt (most owed first)."""
        clients = await self._client_repo.get_all(user_id)
        items: list[ReceivableItem] = []
        for client in clients:
            balance_data = await self._accounting.get_client_balance(user_id, client.id)
            balance = balance_data["balance"]
            if balance < 0:
                items.append(
                    ReceivableItem(
                        client_id=client.id,
                        client_name=client.name,
                        expected=balance_data["total_expected"],
                        paid=balance_data["total_paid"],
                        balance=balance,
                    )
                )
        items.sort(key=lambda x: x.balance)
        return items

    async def projection(
        self, user_id: int, horizon: str, today: Optional[date] = None
    ) -> ProjectionResponse:
        """Project upcoming revenue + net from classes ALREADY scheduled.

        Works on reality: sums the billable revenue of classes that exist in the
        database within the chosen CALENDAR period (next month / next fiscal quarter
        / next year). It does NOT extrapolate contracts — selecting "next year" when
        nothing is scheduled for that year yields 0.
        """
        reference_today = today or date.today()
        range_start, range_end = _horizon_range(reference_today, horizon)

        social_rate, income_rate = await self._charge_rates(user_id)

        classes = await self._class_repo.get_in_date_range(user_id, range_start, range_end)
        total_revenue = round(sum(effective_revenue(c) for c in classes), 2)

        return ProjectionResponse(
            horizon=horizon,
            period_start=range_start.isoformat(),
            period_end=range_end.isoformat(),
            projected_revenue=total_revenue,
            projected_net=estimate_net(total_revenue, social_rate, income_rate),
        )

    async def client_contribution(
        self, user_id: int, period_from: str, period_to: str
    ) -> list[ClientContributionItem]:
        """Per-client contribution to income + reliability, within a range.

        - `billed`: billable revenue (normal + cancelledWithPayment) — what the
          student contributes. `share_pct` is their slice of the total billed.
        - `held_count` / `cancelled_paid_count` / `cancelled_unpaid_count`: class
          counts, for the cancelled/held ratio.
        - `lost_revenue`: planned − billed = the gross value of classes cancelled
          WITHOUT payment (what those cancellations cost).
        """
        start = _parse_period(period_from)
        end = _parse_period(period_to)
        range_start = date(start[0], start[1], 1)
        # Last day of the end month: first day of the next month minus one day.
        next_month = _shift_month(end, 1)
        range_end = date(next_month[0], next_month[1], 1) - timedelta(days=1)

        classes = await self._class_repo.get_in_date_range(user_id, range_start, range_end)

        # Aggregate per client_id.
        acc: dict[int, dict] = {}
        for cls in classes:
            entry = acc.setdefault(
                cls.client_id,
                {
                    "name": cls.client.name if cls.client else "?",
                    "billed": 0.0,
                    "planned": 0.0,
                    "held": 0,
                    "cancelled_paid": 0,
                    "cancelled_unpaid": 0,
                },
            )
            entry["billed"] += effective_revenue(cls)
            entry["planned"] += (cls.duration_hours or 0) * (cls.hourly_rate or 0)
            if cls.status == STATUS_NORMAL:
                entry["held"] += 1
            elif cls.status == STATUS_CANCELLED_WITH_PAYMENT:
                entry["cancelled_paid"] += 1
            elif cls.status == STATUS_CANCELLED_WITHOUT_PAYMENT:
                entry["cancelled_unpaid"] += 1

        total_billed = sum(e["billed"] for e in acc.values())

        items = [
            ClientContributionItem(
                client_id=client_id,
                client_name=entry["name"],
                billed=round(entry["billed"], 2),
                share_pct=(
                    round(entry["billed"] / total_billed * 100, 2) if total_billed > 0 else None
                ),
                held_count=entry["held"],
                cancelled_paid_count=entry["cancelled_paid"],
                cancelled_unpaid_count=entry["cancelled_unpaid"],
                lost_revenue=round(entry["planned"] - entry["billed"], 2),
            )
            for client_id, entry in acc.items()
        ]
        items.sort(key=lambda x: x.billed, reverse=True)
        return items
