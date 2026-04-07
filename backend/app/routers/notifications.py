from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationSettingsResponse, NotificationSettingsUpdate
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/pending")
async def get_pending(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all pending and skipped notifications."""
    return await NotificationService(db).get_pending(current_user.id)


@router.post("/generate")
async def generate_daily(
    target_date: Optional[date] = Query(None, description="Date to generate for (defaults to tomorrow)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates pending notification records for tomorrow's classes."""
    service = NotificationService(db)
    created = await service.generate_daily(current_user.id, target_date)
    # Return serialized using get_pending to include whatsapp_url
    return await service.get_pending(current_user.id)


@router.post("/{notification_id}/mark-sent")
async def mark_sent(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks a notification as sent."""
    notification = await NotificationService(db).mark_sent(notification_id, current_user.id)
    return {"id": notification.id, "status": notification.status, "sent_at": notification.sent_at}


@router.get("/log")
async def get_log(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns notification history."""
    return await NotificationService(db).get_log(current_user.id, limit)


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
