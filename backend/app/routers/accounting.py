from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.accounting_service import AccountingService, MONTH_NAMES
from app.services.report_service import build_monthly_report_xlsx

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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


@router.get("/report")
async def get_monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    client_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates the monthly accounting report as a downloadable Excel (.xlsx)."""
    summary = await AccountingService(db).get_monthly_summary(current_user.id, month, year)
    if client_id is not None:
        summary = [entry for entry in summary if entry.client_id == client_id]

    xlsx_bytes = build_monthly_report_xlsx(summary, month, year)
    filename = f"contabilidad_{MONTH_NAMES[month - 1].lower()}_{year}.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
