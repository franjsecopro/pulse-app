"""Background tasks for syncing classes with Google Calendar.

Each function opens its own DB session because background tasks run
outside the request lifecycle and cannot reuse the request-scoped session.

Sync functions are NON-THROWING: a Calendar failure must never block class
CRUD. Transient failures are retried with backoff; the final result is
persisted on the class (gcal_sync_status) so the UI can surface failures
and offer a manual retry.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional, TypeVar

from app.core.database import AsyncSessionLocal
from app.models.class_ import Class
from app.repositories.class_repository import ClassRepository
from app.repositories.google_auth_repository import GoogleAuthRepository
from app.services import google_calendar_service as gc_service

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Seconds to wait between attempts → total attempts = len(RETRY_DELAYS) + 1.
# Patched to zeros in tests.
RETRY_DELAYS: tuple[float, ...] = (0.5, 2.0)

SYNC_OK = "synced"
SYNC_FAILED = "failed"


async def _with_retries(operation: Callable[[], Awaitable[T]]) -> T:
    """Run an async operation, retrying transient failures with backoff."""
    for delay in RETRY_DELAYS:
        try:
            return await operation()
        except Exception:
            await asyncio.sleep(delay)
    # Last attempt — let the exception propagate to the caller's handler.
    return await operation()


async def _persist_sync_result(
    db, class_: Class, status: str, event_id: Optional[str] = None
) -> None:
    """Record the sync outcome on the class, surviving a dirty session."""
    try:
        # A failed Google call may leave the session in a failed transaction.
        await db.rollback()
        class_.gcal_sync_status = status
        class_.gcal_synced_at = datetime.now(timezone.utc)
        if event_id:
            class_.google_calendar_id = event_id
        db.add(class_)
        await db.commit()
    except Exception as exc:
        logger.warning("could not persist sync status for class %s: %s", class_.id, exc)


async def sync_create(class_id: int, user_id: int) -> None:
    """Create a Google Calendar event for a newly created class."""
    async with AsyncSessionLocal() as db:
        class_ = await ClassRepository(db).get_by_id(class_id, user_id)
        if not class_:
            return
        google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
        if not google_auth:
            return
        try:
            event_id = await _with_retries(
                lambda: gc_service.create_event(
                    class_=class_,
                    client=class_.client,
                    contract=class_.contract,
                    google_auth=google_auth,
                    db=db,
                )
            )
        except Exception as exc:
            logger.warning("sync_create failed for class %s: %s", class_id, exc)
            await _persist_sync_result(db, class_, SYNC_FAILED)
            return
        await _persist_sync_result(db, class_, SYNC_OK, event_id=event_id)


async def sync_update(class_id: int, user_id: int, google_event_id: Optional[str]) -> None:
    """Update an existing Google Calendar event, or create one if it doesn't exist yet."""
    async with AsyncSessionLocal() as db:
        class_ = await ClassRepository(db).get_by_id(class_id, user_id)
        if not class_:
            return
        google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
        if not google_auth:
            return
        try:
            if google_event_id:
                await _with_retries(
                    lambda: gc_service.update_event(
                        google_event_id=google_event_id,
                        class_=class_,
                        client=class_.client,
                        contract=class_.contract,
                        google_auth=google_auth,
                        db=db,
                    )
                )
                event_id = None
            else:
                event_id = await _with_retries(
                    lambda: gc_service.create_event(
                        class_=class_,
                        client=class_.client,
                        contract=class_.contract,
                        google_auth=google_auth,
                        db=db,
                    )
                )
        except Exception as exc:
            logger.warning("sync_update failed for class %s: %s", class_id, exc)
            await _persist_sync_result(db, class_, SYNC_FAILED)
            return
        await _persist_sync_result(db, class_, SYNC_OK, event_id=event_id)


async def sync_delete(google_event_id: str, user_id: int) -> None:
    """Delete a Google Calendar event when a class is deleted."""
    async with AsyncSessionLocal() as db:
        try:
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return
            await _with_retries(
                lambda: gc_service.delete_event(
                    google_event_id=google_event_id,
                    google_auth=google_auth,
                    db=db,
                )
            )
        except Exception as exc:
            logger.warning("sync_delete failed for event %s: %s", google_event_id, exc)
