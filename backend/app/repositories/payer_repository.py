from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_identifier import PaymentIdentifier
from app.schemas.payment_identifier import PayerCreateRequest, PayerUpdateRequest


class PayerRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_client(self, client_id: int) -> list[PaymentIdentifier]:
        result = await self._db.execute(
            select(PaymentIdentifier)
            .where(PaymentIdentifier.client_id == client_id)
            .order_by(PaymentIdentifier.created_at)
        )
        return list(result.scalars().all())

    async def get_by_id(self, payer_id: int, client_id: int) -> Optional[PaymentIdentifier]:
        result = await self._db.execute(
            select(PaymentIdentifier).where(
                PaymentIdentifier.id == payer_id,
                PaymentIdentifier.client_id == client_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, client_id: int, data: PayerCreateRequest) -> PaymentIdentifier:
        payer = PaymentIdentifier(client_id=client_id, **data.model_dump())
        self._db.add(payer)
        await self._db.commit()
        await self._db.refresh(payer)
        return payer

    async def update(self, payer: PaymentIdentifier, data: PayerUpdateRequest) -> PaymentIdentifier:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(payer, field, value)
        await self._db.commit()
        await self._db.refresh(payer)
        return payer

    async def delete(self, payer: PaymentIdentifier) -> None:
        await self._db.delete(payer)
        await self._db.commit()
