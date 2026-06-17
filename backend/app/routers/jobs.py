"""Scheduled-job endpoints, triggered by an external cron (hosting-agnostic).

Authorized by a shared secret in the ``X-Job-Token`` header (NOT user auth — the
cron is not a user). Responses are minimal summaries — no client/invoice PII ever
leaves the backend through these endpoints.
"""
import hmac
import logging
from datetime import date, datetime
from typing import Awaitable, Callable, Optional
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
logger = logging.getLogger(__name__)


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


async def _generate_invoices(db: AsyncSession, users: list[int], day: date) -> dict:
    """Create draft invoices for the day's billable, un-invoiced classes (one per client)."""
    service = InvoiceService(db)
    created = 0
    for user_id in users:
        created += await service.auto_generate_daily_drafts(user_id, day)
    return {"invoicesCreated": created}


async def _generate_notifications(
    db: AsyncSession, users: list[int], target_date: Optional[date]
) -> dict:
    """Generate daily class-reminder notifications. When ``target_date`` is None the
    notification service uses its own default day (tomorrow)."""
    service = NotificationService(db)
    generated = 0
    for user_id in users:
        notifications = await service.generate_daily(user_id, target_date=target_date)
        generated += len(notifications)
    return {"notificationsGenerated": generated}


async def _isolated(
    db: AsyncSession, label: str, job: Callable[[], Awaitable[dict]]
) -> dict:
    """Run a job so a failure is contained: roll back the shared session and report a
    minimal flag (never leak error detail/PII through the response — log it instead)."""
    try:
        result = await job()
        return {"ok": True, **result}
    except Exception:
        await db.rollback()
        logger.exception("Daily job '%s' failed", label)
        return {"ok": False}


@router.post("/auto-generate-invoices", dependencies=[Depends(require_job_token)])
async def auto_generate_invoices(
    db: AsyncSession = Depends(get_db),
    on_date: Optional[date] = Query(None, alias="date"),
):
    """For every user, create draft invoices for the day's billable, un-invoiced
    classes (one per client). Idempotent. Defaults to today in the business TZ."""
    day = on_date or _business_today()
    users = await _all_user_ids(db)
    result = await _generate_invoices(db, users, day)
    return {"day": day.isoformat(), "usersProcessed": len(users), **result}


@router.post("/generate-notifications", dependencies=[Depends(require_job_token)])
async def generate_notifications(
    db: AsyncSession = Depends(get_db),
    on_date: Optional[date] = Query(None, alias="date"),
):
    """For every user, generate the daily class-reminder notifications (defaults to
    the notification service's own default day when no date is given)."""
    users = await _all_user_ids(db)
    result = await _generate_notifications(db, users, target_date=on_date)
    return {"usersProcessed": len(users), **result}


@router.post("/daily", dependencies=[Depends(require_job_token)])
async def daily(db: AsyncSession = Depends(get_db)):
    """Run the full daily automation in one cron call: draft invoices for today's
    billable classes AND class-reminder notifications for tomorrow's classes. Each job
    keeps its own date default and is isolated so a failure in one does not block the
    other. Always returns 200 with per-job ``ok`` flags — the scheduler should alert on
    any ``ok: false``."""
    users = await _all_user_ids(db)
    day = _business_today()
    invoices = await _isolated(db, "invoices", lambda: _generate_invoices(db, users, day))
    notifications = await _isolated(
        db, "notifications", lambda: _generate_notifications(db, users, target_date=None)
    )
    return {"usersProcessed": len(users), "invoices": invoices, "notifications": notifications}
