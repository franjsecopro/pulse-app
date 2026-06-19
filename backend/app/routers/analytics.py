"""Analytics endpoints for the finance analytics tab."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsOverview,
    ClientContributionItem,
    ProjectionResponse,
    ReceivableItem,
    RevenueTimeseriesPoint,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
async def overview(
    period_from: str = Query(..., alias="from", description="Inclusive start, YYYY-MM"),
    period_to: str = Query(..., alias="to", description="Inclusive end, YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await AnalyticsService(db).overview(current_user.id, period_from, period_to)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/revenue-timeseries", response_model=list[RevenueTimeseriesPoint])
async def revenue_timeseries(
    period_from: str = Query(..., alias="from", description="Inclusive start, YYYY-MM"),
    period_to: str = Query(..., alias="to", description="Inclusive end, YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await AnalyticsService(db).revenue_timeseries(
            current_user.id, period_from, period_to
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/receivables", response_model=list[ReceivableItem])
async def receivables(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AnalyticsService(db).receivables(current_user.id)


@router.get("/projection", response_model=ProjectionResponse)
async def projection(
    horizon: str = Query("month", description="month|quarter|year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AnalyticsService(db).projection(current_user.id, horizon)


@router.get("/client-contribution", response_model=list[ClientContributionItem])
async def client_contribution(
    period_from: str = Query(..., alias="from", description="Inclusive start, YYYY-MM"),
    period_to: str = Query(..., alias="to", description="Inclusive end, YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await AnalyticsService(db).client_contribution(
            current_user.id, period_from, period_to
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
