"""Background tasks for syncing classes with Google Calendar.

Each function opens its own DB session because background tasks run
outside the request lifecycle and cannot reuse the request-scoped session.
"""
import logging
from typing import Optional

from app.core.database import AsyncSessionLocal
from app.repositories.class_repository import ClassRepository
from app.repositories.google_auth_repository import GoogleAuthRepository
from app.services import google_calendar_service as gc_service

logger = logging.getLogger(__name__)


async def sync_create(class_id: int, user_id: int) -> None:
    """Create a Google Calendar event for a newly created class."""
    async with AsyncSessionLocal() as db:
        try:
            class_ = await ClassRepository(db).get_by_id(class_id, user_id)
            if not class_:
                return
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return
            event_id = await gc_service.create_event(
                class_=class_,
                client=class_.client,
                contract=class_.contract,
                google_auth=google_auth,
                db=db,
            )
            if event_id:
                class_.google_calendar_id = event_id
                await db.commit()
        except Exception as exc:
            logger.warning("sync_create failed for class %s: %s", class_id, exc)


async def sync_update(class_id: int, user_id: int, google_event_id: Optional[str]) -> None:
    """Update an existing Google Calendar event, or create one if it doesn't exist yet."""
    async with AsyncSessionLocal() as db:
        try:
            class_ = await ClassRepository(db).get_by_id(class_id, user_id)
            if not class_:
                return
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return
            if google_event_id:
                await gc_service.update_event(
                    google_event_id=google_event_id,
                    class_=class_,
                    client=class_.client,
                    contract=class_.contract,
                    google_auth=google_auth,
                    db=db,
                )
            else:
                event_id = await gc_service.create_event(
                    class_=class_,
                    client=class_.client,
                    contract=class_.contract,
                    google_auth=google_auth,
                    db=db,
                )
                if event_id:
                    class_.google_calendar_id = event_id
                    await db.commit()
        except Exception as exc:
            logger.warning("sync_update failed for class %s: %s", class_id, exc)


async def sync_delete(google_event_id: str, user_id: int) -> None:
    """Delete a Google Calendar event when a class is deleted."""
    async with AsyncSessionLocal() as db:
        try:
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return
            await gc_service.delete_event(
                google_event_id=google_event_id,
                google_auth=google_auth,
                db=db,
            )
        except Exception as exc:
            logger.warning("sync_delete failed for event %s: %s", google_event_id, exc)
