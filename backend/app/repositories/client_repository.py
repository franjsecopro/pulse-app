from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.schemas.client import ClientCreateRequest, ClientUpdateRequest


class ClientRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_all(
        self,
        user_id: int,
        include_deleted: bool = False,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[Client]:
        query = (
            select(Client)
            .options(selectinload(Client.contracts))
            .where(Client.user_id == user_id)
        )
        if not include_deleted:
            query = query.where(Client.deleted_at.is_(None))
        if is_active is not None:
            query = query.where(Client.is_active == is_active)
        if search:
            query = query.where(Client.name.ilike(f"%{search}%"))
        query = query.order_by(Client.name)
        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, client_id: int, user_id: int) -> Optional[Client]:
        result = await self._db.execute(
            select(Client)
            .options(selectinload(Client.contracts))
            .where(Client.id == client_id, Client.user_id == user_id, Client.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: int, data: ClientCreateRequest) -> Client:
        client = Client(user_id=user_id, **data.model_dump())
        self._db.add(client)
        await self._db.commit()
        await self._db.refresh(client)
        return client

    async def update(self, client: Client, data: ClientUpdateRequest) -> Client:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(client, field, value)
        client.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(client)
        return client

    async def soft_delete(self, client: Client) -> Client:
        client.deleted_at = datetime.now(timezone.utc)
        client.is_active = False
        await self._db.commit()
        return client

    async def count_active(self, user_id: int) -> int:
        result = await self._db.execute(
            select(func.count())
            .where(Client.user_id == user_id, Client.is_active.is_(True), Client.deleted_at.is_(None))
        )
        return result.scalar_one()
