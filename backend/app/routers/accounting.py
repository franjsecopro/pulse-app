from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.accounting_service import AccountingService

router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/summary")
async def get_monthly_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns per-client billing summary for the selected month, including credit carry-over."""
    return await AccountingService(db).get_monthly_summary(current_user.id, month, year)


@router.get("/client/{client_id}")
async def get_client_balance(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the all-time accumulated balance for a client."""
    return await AccountingService(db).get_client_balance(current_user.id, client_id)
