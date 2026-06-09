from datetime import datetime, date, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.client_repository import ClientRepository
from app.repositories.class_repository import ClassRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    UpcomingClassItem,
    UpcomingClassesResponse,
)
from app.services.class_revenue import effective_revenue


class DashboardService:
    def __init__(self, db: AsyncSession):
        self._client_repo = ClientRepository(db)
        self._class_repo = ClassRepository(db)
        self._payment_repo = PaymentRepository(db)

    async def get_summary(
        self, user_id: int, month: int | None = None, year: int | None = None
    ) -> DashboardSummaryResponse:
        now = datetime.now(timezone.utc)
        year = year or now.year
        month = month or now.month

        class_totals = await self._class_repo.get_monthly_totals(user_id, year, month)
        payment_totals = await self._payment_repo.get_monthly_totals(user_id, year, month)

        total_expected = sum(class_totals.values())
        total_paid = sum(payment_totals.values())
        total_pending = max(0.0, total_expected - total_paid)

        active_clients = await self._client_repo.count_active(user_id)
        monthly_classes = await self._class_repo.count_current_month(user_id)
        monthly_payments = await self._payment_repo.sum_current_month(user_id)

        return DashboardSummaryResponse(
            total_expected=round(total_expected, 2),
            total_paid=round(total_paid, 2),
            total_pending=round(total_pending, 2),
            active_clients=active_clients,
            monthly_classes=monthly_classes,
            monthly_payments=round(monthly_payments, 2),
            month=month,
            year=year,
        )

    async def get_upcoming(self, user_id: int) -> UpcomingClassesResponse:
        today = date.today()
        tomorrow = today + timedelta(days=1)
        classes = await self._class_repo.get_by_dates(user_id, [today, tomorrow])

        def _build(c) -> UpcomingClassItem:
            return UpcomingClassItem(
                id=c.id,
                client_name=c.client.name if c.client else None,
                contract_description=c.contract.description if c.contract else None,
                class_date=c.class_date.isoformat(),
                class_time=c.class_time.isoformat() if c.class_time else None,
                duration_hours=c.duration_hours,
                effective_revenue=effective_revenue(c),
                status=c.status,
            )

        return UpcomingClassesResponse(
            today=[_build(c) for c in classes if c.class_date == today],
            tomorrow=[_build(c) for c in classes if c.class_date == tomorrow],
        )
