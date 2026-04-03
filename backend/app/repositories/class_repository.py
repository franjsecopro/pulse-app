from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.class_ import Class
from app.models.contract import Contract
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest


class ClassRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_all(
        self,
        user_id: int,
        client_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> list[Class]:
        query = (
            select(Class)
            .options(joinedload(Class.client), joinedload(Class.contract))
            .where(Class.user_id == user_id)
        )
        if client_id:
            query = query.where(Class.client_id == client_id)
        if month and year:
            query = query.where(
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
            )
        query = query.order_by(Class.class_date.desc(), Class.class_time.desc())
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

    async def get_monthly_totals(self, user_id: int, year: int, month: int) -> dict[int, float]:
        """Returns a mapping of client_id -> total amount owed for the given month."""
        result = await self._db.execute(
            select(Class.client_id, func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
            )
            .group_by(Class.client_id)
        )
        return {row[0]: row[1] for row in result.all()}

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
