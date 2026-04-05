from datetime import datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.google_auth import UserGoogleAuth


class GoogleAuthRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_user_id(self, user_id: int) -> Optional[UserGoogleAuth]:
        result = await self._db.execute(
            select(UserGoogleAuth).where(UserGoogleAuth.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        user_id: int,
        google_email: str,
        access_token: str,
        refresh_token: str,
        token_expires_at: Optional[datetime],
        calendar_id: str = "primary",
    ) -> UserGoogleAuth:
        existing = await self.get_by_user_id(user_id)
        if existing:
            existing.google_email = google_email
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = token_expires_at
            existing.calendar_id = calendar_id
            await self._db.commit()
            await self._db.refresh(existing)
            return existing

        record = UserGoogleAuth(
            user_id=user_id,
            google_email=google_email,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            calendar_id=calendar_id,
        )
        self._db.add(record)
        await self._db.commit()
        await self._db.refresh(record)
        return record

    async def update_tokens(
        self,
        google_auth: UserGoogleAuth,
        access_token: str,
        token_expires_at: Optional[datetime],
    ) -> UserGoogleAuth:
        google_auth.access_token = access_token
        google_auth.token_expires_at = token_expires_at
        await self._db.commit()
        await self._db.refresh(google_auth)
        return google_auth

    async def delete_by_user_id(self, user_id: int) -> None:
        record = await self.get_by_user_id(user_id)
        if record:
            await self._db.delete(record)
            await self._db.commit()
