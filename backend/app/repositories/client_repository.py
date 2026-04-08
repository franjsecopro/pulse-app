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
        deleted_filter: str = "exclude",  # 'exclude', 'include', 'only'
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[Client]:
        query = (
            select(Client)
            .options(selectinload(Client.contracts), selectinload(Client.payers))
            .where(Client.user_id == user_id)
        )

        # Handle archived_at filtering
        if deleted_filter == "exclude":
            # Show ONLY non-deleted clients
            query = query.where(Client.archived_at.is_(None))
        elif deleted_filter == "only":
            # Show ONLY deleted clients
            query = query.where(Client.archived_at.is_not(None))
        # elif deleted_filter == "include": no filter, show all

        # Handle is_active filtering (only when not filtering by deleted_filter='only')
        if is_active is not None and deleted_filter != "only":
            query = query.where(Client.is_active == is_active)

        if search:
            query = query.where(Client.name.ilike(f"%{search}%"))
        query = query.order_by(Client.name)
        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, client_id: int, user_id: int, include_deleted: bool = False) -> Optional[Client]:
        query = (
            select(Client)
            .options(selectinload(Client.contracts), selectinload(Client.payers))
            .where(Client.id == client_id, Client.user_id == user_id)
        )
        if not include_deleted:
            query = query.where(Client.archived_at.is_(None))
        result = await self._db.execute(query)
        return result.scalar_one_or_none()

    async def _get_with_relations(self, client_id: int, user_id: int) -> Client:
        """Fetch a client with all relations loaded (avoids async lazy-load errors)."""
        result = await self._db.execute(
            select(Client)
            .options(selectinload(Client.contracts), selectinload(Client.payers))
            .where(Client.id == client_id, Client.user_id == user_id)
        )
        return result.scalar_one()

    async def create(self, user_id: int, data: ClientCreateRequest) -> Client:
        client = Client(user_id=user_id, **data.model_dump())
        self._db.add(client)
        await self._db.commit()
        return await self._get_with_relations(client.id, user_id)

    async def update(self, client: Client, data: ClientUpdateRequest) -> Client:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(client, field, value)
        # Clear archived_at when explicitly reactivating
        if data.is_active is True:
            client.archived_at = None
        client.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        return await self._get_with_relations(client.id, client.user_id)

    async def archive(self, client: Client) -> Client:
        client.archived_at = datetime.now(timezone.utc)
        client.is_active = False
        await self._db.commit()
        return await self._get_with_relations(client.id, client.user_id)

    async def activate(self, client: Client) -> Client:
        client.archived_at = None
        client.is_active = True
        client.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        return await self._get_with_relations(client.id, client.user_id)

    async def count_active(self, user_id: int) -> int:
        result = await self._db.execute(
            select(func.count())
            .where(Client.user_id == user_id, Client.is_active.is_(True), Client.archived_at.is_(None))
        )
        return result.scalar_one()
