from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.schemas.contract import ContractCreateRequest, ContractUpdateRequest


class ContractRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_client(self, client_id: int) -> list[Contract]:
        result = await self._db.execute(
            select(Contract)
            .where(Contract.client_id == client_id, Contract.deleted_at.is_(None))
            .order_by(Contract.start_date.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, contract_id: int, client_id: int) -> Optional[Contract]:
        result = await self._db.execute(
            select(Contract).where(
                Contract.id == contract_id,
                Contract.client_id == client_id,
                Contract.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, client_id: int, data: ContractCreateRequest) -> Contract:
        contract = Contract(client_id=client_id, **data.model_dump())
        self._db.add(contract)
        await self._db.commit()
        await self._db.refresh(contract)
        return contract

    async def update(self, contract: Contract, data: ContractUpdateRequest) -> Contract:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(contract, field, value)
        contract.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(contract)
        return contract

    async def soft_delete(self, contract: Contract) -> Contract:
        contract.deleted_at = datetime.now(timezone.utc)
        contract.is_active = False
        await self._db.commit()
        return contract
