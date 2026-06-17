"""Scheduled-job endpoints, triggered by an external cron (hosting-agnostic).

Authorized by a shared secret in the ``X-Job-Token`` header (NOT user auth — the
cron is not a user). Responses are minimal summaries — no client/invoice PII ever
leaves the backend through these endpoints.
"""
import hmac
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.invoice_service import InvoiceService
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/jobs", tags=["jobs"])


def require_job_token(x_job_token: Optional[str] = Header(None)) -> None:
    """Validate the shared cron secret (constant-time). 503 if jobs aren't configured."""
    if not settings.JOB_TOKEN:
        raise HTTPException(status_code=503, detail="Jobs are not configured")
    if not x_job_token or not hmac.compare_digest(x_job_token, settings.JOB_TOKEN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid job token")


def _business_today() -> date:
    return datetime.now(ZoneInfo(settings.BUSINESS_TIMEZONE)).date()


async def _all_user_ids(db: AsyncSession) -> list[int]:
    result = await db.execute(select(User.id))
    return [row[0] for row in result.all()]


@router.post("/auto-generate-invoices", dependencies=[Depends(require_job_token)])
async def auto_generate_invoices(
    db: AsyncSession = Depends(get_db),
    on_date: Optional[date] = Query(None, alias="date"),
):
    """For every user, create draft invoices for the day's billable, un-invoiced
    classes (one per client). Idempotent. Defaults to today in the business TZ."""
    day = on_date or _business_today()
    service = InvoiceService(db)
    users = await _all_user_ids(db)
    created = 0
    for user_id in users:
        created += await service.auto_generate_daily_drafts(user_id, day)
    return {"day": day.isoformat(), "usersProcessed": len(users), "invoicesCreated": created}


@router.post("/generate-notifications", dependencies=[Depends(require_job_token)])
async def generate_notifications(
    db: AsyncSession = Depends(get_db),
    on_date: Optional[date] = Query(None, alias="date"),
):
    """For every user, generate the daily class-reminder notifications (defaults to
    the notification service's own default day when no date is given)."""
    service = NotificationService(db)
    users = await _all_user_ids(db)
    generated = 0
    for user_id in users:
        notifications = await service.generate_daily(user_id, target_date=on_date)
        generated += len(notifications)
    return {"usersProcessed": len(users), "notificationsGenerated": generated}
