from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import (
    NotificationLogPage,
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/pending")
async def get_pending(
    date: Optional[date] = Query(
        None,
        description="Day the user wants to send notifications for. Internally we look at class_date = date + 1 (reminders go out the day before the class). Defaults to no filter (all pending/skipped).",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns pending and skipped notifications for the given send date."""
    return await NotificationService(db).get_pending(current_user.id, date)


@router.post("/generate")
async def generate_daily(
    target_date: Optional[date] = Query(
        None,
        description="Date to generate for (defaults to tomorrow).",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates pending notification records for the target date's classes.

    Returns the resulting pending notifications for the same target_date (so
    the caller sees what was just generated, not every pending record of the
    user across all days).
    """
    service = NotificationService(db)
    await service.generate_daily(current_user.id, target_date)
    return await service.get_pending(current_user.id, target_date)


@router.post("/{notification_id}/mark-sent")
async def mark_sent(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks a notification as sent."""
    notification = await NotificationService(db).mark_sent(notification_id, current_user.id)
    return {"id": notification.id, "status": notification.status, "sent_at": notification.sent_at}


@router.get("/log", response_model=NotificationLogPage)
async def get_log(
    mode: Optional[str] = Query(
        None,
        description="Time window granularity: 'day' (24h), 'week' (Mon-Sun) or 'month' (calendar month). Anchored at 'date'.",
    ),
    date: Optional[date] = Query(
        None,
        description="Anchor day for the time window. The window starts at 00:00 UTC of this day and extends per 'mode'.",
    ),
    status: Optional[str] = Query(None, description="pending|sent|skipped"),
    client_id: Optional[int] = Query(None, ge=1),
    channel: Optional[str] = Query(None, description="whatsapp|email"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns paginated notification history filtered by ``created_at``.

    ``mode`` and ``date`` must be provided together (or both omitted). The
    ``created_at`` range is half-open and UTC. Other filters compose with AND.
    Page size is capped at 100.
    """
    return await NotificationService(db).get_log(
        current_user.id,
        mode=mode,
        date=date,
        status=status,
        client_id=client_id,
        channel=channel,
        page=page,
        page_size=page_size,
    )


@router.get("/settings", response_model=NotificationSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns notification settings for the current user."""
    return await NotificationService(db).get_settings(current_user.id)


@router.put("/settings", response_model=NotificationSettingsResponse)
async def update_settings(
    data: NotificationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates notification settings."""
    return await NotificationService(db).update_settings(current_user.id, data)
