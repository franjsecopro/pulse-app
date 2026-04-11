from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.payment import Payment
from app.schemas.payment import PaymentCreateRequest, PaymentUpdateRequest


class PaymentRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    def _base_filter(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        status: Optional[str] = None,
    ):
        q = select(Payment).where(Payment.user_id == user_id)
        if client_id:
            q = q.where(Payment.client_id == client_id)
        if status:
            q = q.where(Payment.status == status)
        if month and year:
            q = q.where(
                extract("month", Payment.payment_date) == month,
                extract("year", Payment.payment_date) == year,
            )
        return q

    async def count_all(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        status: Optional[str] = None,
    ) -> int:
        base = self._base_filter(user_id, client_id=client_id, month=month, year=year, status=status)
        result = await self._db.execute(select(func.count()).select_from(base.subquery()))
        return result.scalar_one()

    async def get_all(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[Payment]:
        query = (
            self._base_filter(user_id, client_id=client_id, month=month, year=year, status=status)
            .options(joinedload(Payment.client))
            .order_by(Payment.payment_date.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, payment_id: int, user_id: int) -> Optional[Payment]:
        result = await self._db.execute(
            select(Payment)
            .options(joinedload(Payment.client))
            .where(Payment.id == payment_id, Payment.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: int, data: PaymentCreateRequest) -> Payment:
        payment = Payment(user_id=user_id, **data.model_dump())
        self._db.add(payment)
        await self._db.commit()
        await self._db.refresh(payment)
        return payment

    async def update(self, payment: Payment, data: PaymentUpdateRequest) -> Payment:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(payment, field, value)
        payment.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(payment)
        return payment

    async def delete(self, payment: Payment) -> None:
        await self._db.delete(payment)
        await self._db.commit()

    async def get_monthly_totals(self, user_id: int, year: int, month: int) -> dict[int, float]:
        """Returns a mapping of client_id -> total confirmed paid for the given month."""
        result = await self._db.execute(
            select(Payment.client_id, func.sum(Payment.amount))
            .where(
                Payment.user_id == user_id,
                Payment.client_id.is_not(None),
                Payment.status == "confirmed",
                extract("month", Payment.payment_date) == month,
                extract("year", Payment.payment_date) == year,
            )
            .group_by(Payment.client_id)
        )
        return {row[0]: row[1] for row in result.all()}

    async def sum_current_month(self, user_id: int) -> float:
        now = datetime.now(timezone.utc)
        result = await self._db.execute(
            select(func.sum(Payment.amount)).where(
                Payment.user_id == user_id,
                Payment.status == "confirmed",
                extract("month", Payment.payment_date) == now.month,
                extract("year", Payment.payment_date) == now.year,
            )
        )
        return result.scalar_one() or 0.0
