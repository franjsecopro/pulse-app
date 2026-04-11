from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await DashboardService(db).get_summary(current_user.id, month=month, year=year)


@router.get("/upcoming")
async def get_upcoming(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await DashboardService(db).get_upcoming(current_user.id)


@router.get("/alerts")
async def get_alerts(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await DashboardService(db).get_alerts(current_user.id, month=month, year=year)
