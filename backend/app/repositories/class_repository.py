from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.class_ import Class
from app.models.contract import Contract
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest
from app.services.class_revenue import (
    EXCLUDED_FROM_REVENUE,
    EXCLUDED_FROM_WORKED_HOURS,
    class_has_ended,
)


class ClassRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    def _base_filter(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ):
        q = select(Class).where(Class.user_id == user_id)
        if client_id:
            q = q.where(Class.client_id == client_id)
        if month and year:
            q = q.where(
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
            )
        return q

    async def count_all(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> int:
        base = self._base_filter(user_id, client_id=client_id, month=month, year=year)
        result = await self._db.execute(select(func.count()).select_from(base.subquery()))
        return result.scalar_one()

    async def get_all(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[Class]:
        query = (
            self._base_filter(user_id, client_id=client_id, month=month, year=year)
            .options(joinedload(Class.client), joinedload(Class.contract))
            .order_by(Class.class_date.desc(), Class.class_time.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, class_id: int, user_id: int) -> Optional[Class]:
        result = await self._db.execute(
            select(Class)
            .options(joinedload(Class.client), joinedload(Class.contract))
            .where(Class.id == class_id, Class.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: int, data: ClassCreateRequest) -> Class:
        class_ = Class(user_id=user_id, **data.model_dump())
        self._db.add(class_)
        await self._db.commit()
        await self._db.refresh(class_)
        return class_

    async def update(self, class_: Class, data: ClassUpdateRequest) -> Class:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(class_, field, value)
        class_.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(class_)
        return class_

    async def delete(self, class_: Class) -> None:
        await self._db.delete(class_)
        await self._db.commit()

    async def get_by_dates(self, user_id: int, dates: list[date]) -> list[Class]:
        query = (
            select(Class)
            .options(joinedload(Class.client), joinedload(Class.contract))
            .where(Class.user_id == user_id, Class.class_date.in_(dates))
            .order_by(Class.class_date.asc(), Class.class_time.asc())
        )
        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def get_in_date_range(
        self, user_id: int, start: date, end: date
    ) -> list[Class]:
        """Return the user's classes with class_date in [start, end] (inclusive)."""
        query = (
            select(Class)
            .options(joinedload(Class.client), joinedload(Class.contract))
            .where(
                Class.user_id == user_id,
                Class.class_date >= start,
                Class.class_date <= end,
            )
            .order_by(Class.class_date.asc(), Class.class_time.asc())
        )
        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def get_monthly_totals(self, user_id: int, year: int, month: int) -> dict[int, float]:
        """Returns a mapping of client_id -> total billable amount for the given month.
        Excludes statuses in `EXCLUDED_FROM_REVENUE` (see app.services.class_revenue)."""
        result = await self._db.execute(
            select(Class.client_id, func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
                Class.status.notin_(EXCLUDED_FROM_REVENUE),
            )
            .group_by(Class.client_id)
        )
        return {row[0]: row[1] for row in result.all()}

    async def get_stats(
        self,
        user_id: int,
        year: int,
        month: int,
        client_id: Optional[int] = None,
        now: Optional[datetime] = None,
    ) -> dict[str, float | int]:
        count_result = await self._db.execute(
            select(func.count())
            .select_from(
                self._base_filter(user_id, client_id=client_id, month=month, year=year).subquery()
            )
        )
        count = count_result.scalar_one()

        revenue_result = await self._db.execute(
            select(func.coalesce(func.sum(Class.duration_hours * Class.hourly_rate), 0.0))
            .where(
                Class.user_id == user_id,
                Class.status.notin_(EXCLUDED_FROM_REVENUE),
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
                *([Class.client_id == client_id] if client_id else []),
            )
        )
        total_revenue = round(float(revenue_result.scalar_one()), 2)

        hours_result = await self._db.execute(
            select(func.coalesce(func.sum(Class.duration_hours), 0.0))
            .where(
                Class.user_id == user_id,
                Class.status.notin_(EXCLUDED_FROM_WORKED_HOURS),
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
                *([Class.client_id == client_id] if client_id else []),
            )
        )
        total_hours = round(float(hours_result.scalar_one()), 2)

        # Worked hours = the same worked-eligible (normal) classes that have
        # already ended. Computed in Python so the end-time rule (date + time +
        # duration, or whole-day for untimed classes) stays portable and matches
        # the single source of truth in `class_revenue.class_has_ended`.
        reference_now = now or datetime.now()
        worked_result = await self._db.execute(
            select(Class).where(
                Class.user_id == user_id,
                Class.status.notin_(EXCLUDED_FROM_WORKED_HOURS),
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
                *([Class.client_id == client_id] if client_id else []),
            )
        )
        worked_hours = round(
            sum(
                cls.duration_hours
                for cls in worked_result.scalars().all()
                if class_has_ended(cls, reference_now)
            ),
            2,
        )

        return {
            "count": count,
            "total_revenue": total_revenue,
            "total_hours": total_hours,
            "worked_hours": worked_hours,
        }

    async def count_current_month(self, user_id: int) -> int:
        now = datetime.now(timezone.utc)
        result = await self._db.execute(
            select(func.count()).where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == now.month,
                extract("year", Class.class_date) == now.year,
            )
        )
        return result.scalar_one()
