from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreateRequest, PaymentUpdateRequest, PaymentResponse

router = APIRouter(prefix="/payments", tags=["payments"])


def _build_response(payment: object) -> PaymentResponse:
    data = PaymentResponse.model_validate(payment)
    data.client_name = payment.client.name if payment.client else None
    return data


@router.get("", response_model=list[PaymentResponse])
async def list_payments(
    response: Response,
    client_id: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = PaymentRepository(db)
    total = await repo.count_all(current_user.id, client_id=client_id, month=month, year=year, status=status)
    payments = await repo.get_all(
        current_user.id, client_id=client_id, month=month, year=year, status=status, limit=limit, offset=offset
    )
    response.headers["X-Total-Count"] = str(total)
    return [_build_response(p) for p in payments]


@router.post("", response_model=PaymentResponse, status_code=201)
async def create_payment(
    data: PaymentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = PaymentRepository(db)
    payment = await repo.create(current_user.id, data)
    payment = await repo.get_by_id(payment.id, current_user.id)
    return _build_response(payment)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = await PaymentRepository(db).get_by_id(payment_id, current_user.id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return _build_response(payment)


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    data: PaymentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = PaymentRepository(db)
    payment = await repo.get_by_id(payment_id, current_user.id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = await repo.update(payment, data)
    payment = await repo.get_by_id(payment.id, current_user.id)
    return _build_response(payment)


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = PaymentRepository(db)
    payment = await repo.get_by_id(payment_id, current_user.id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    await repo.delete(payment)
