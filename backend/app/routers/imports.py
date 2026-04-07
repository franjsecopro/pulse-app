import io
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.client import Client
from app.models.payment import Payment
from app.models.pdf_import import PDFImport
from app.models.user import User
from app.services.pdf_parser import parse_hello_bank_pdf
from app.services.payment_matcher import match_transaction

router = APIRouter(prefix="/imports", tags=["imports"])


class ParsedTransactionResponse(BaseModel):
    date: str
    concept: str
    amount: float
    suggested_client_id: Optional[int]
    suggested_client_name: Optional[str]
    match_type: str
    confidence: float


class ConfirmPaymentItem(BaseModel):
    date: str
    concept: str
    amount: float
    client_id: Optional[int] = None


class ConfirmImportRequest(BaseModel):
    payments: list[ConfirmPaymentItem]
    filename: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None


class PDFImportResponse(BaseModel):
    id: int
    filename: str
    imported_at: datetime
    month: Optional[int]
    year: Optional[int]
    transaction_count: int
    total_amount: float

    model_config = {"from_attributes": True}


@router.post("/pdf", response_model=list[ParsedTransactionResponse])
async def parse_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse a Hello Bank / BNP Paribas PDF statement and return matched transactions."""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Load clients with payers for matching
    result = await db.execute(
        select(Client)
        .options(selectinload(Client.payers))
        .where(Client.user_id == current_user.id, Client.deleted_at.is_(None), Client.is_active.is_(True))
    )
    clients = list(result.scalars().all())

    try:
        transactions = parse_hello_bank_pdf(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"No se pudo parsear el PDF: {str(e)}")

    if not transactions:
        raise HTTPException(status_code=422, detail="No se encontraron transacciones en el PDF. Verifica que sea un extracto de Hello Bank.")

    response = []
    for tx in transactions:
        match = match_transaction(tx.concept, clients)
        response.append(ParsedTransactionResponse(
            date=tx.date,
            concept=tx.concept,
            amount=tx.amount,
            suggested_client_id=match.client_id,
            suggested_client_name=match.client_name,
            match_type=match.match_type,
            confidence=match.confidence,
        ))

    return response


@router.post("/pdf/confirm", status_code=201)
async def confirm_import(
    data: ConfirmImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create payments from the confirmed import list and register the PDF import."""
    created = 0
    total_amount = 0.0
    for item in data.payments:
        payment = Payment(
            user_id=current_user.id,
            client_id=item.client_id,
            amount=item.amount,
            payment_date=date.fromisoformat(item.date),
            concept=item.concept,
            source="bank_import",
            status="confirmed" if item.client_id else "unmatched",
        )
        db.add(payment)
        created += 1
        total_amount += item.amount

    # Register the PDF import in history
    pdf_record = PDFImport(
        user_id=current_user.id,
        filename=data.filename or "extracto.pdf",
        imported_at=datetime.now(timezone.utc),
        month=data.month,
        year=data.year,
        transaction_count=created,
        total_amount=round(total_amount, 2),
    )
    db.add(pdf_record)

    await db.commit()
    return {"created": created}


@router.get("/pdf-history", response_model=list[PDFImportResponse])
async def get_pdf_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the list of PDF bank statements imported by the current user."""
    result = await db.execute(
        select(PDFImport)
        .where(PDFImport.user_id == current_user.id)
        .order_by(PDFImport.imported_at.desc())
    )
    return list(result.scalars().all())
