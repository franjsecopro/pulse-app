import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.client import Client
from app.models.pdf_import import PDFImport
from app.models.user import User
from app.schemas.import_ import (
    ParsedTransactionResponse,
    ConfirmImportRequest,
    PDFImportResponse,
)
from app.services.import_service import confirm_import
from app.services.pdf_parser import parse_hello_bank_pdf
from app.services.payment_matcher import match_transaction

router = APIRouter(prefix="/imports", tags=["imports"])


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

    result = await db.execute(
        select(Client)
        .options(selectinload(Client.payers))
        .where(
            Client.user_id == current_user.id,
            Client.archived_at.is_(None),
            Client.is_active.is_(True),
        )
    )
    clients = list(result.scalars().all())

    try:
        transactions = parse_hello_bank_pdf(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"No se pudo parsear el PDF: {str(e)}")

    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="No se encontraron transacciones en el PDF. Verifica que sea un extracto de Hello Bank.",
        )

    return [
        ParsedTransactionResponse(
            date=tx.date,
            concept=tx.concept,
            amount=tx.amount,
            suggested_client_id=match.client_id,
            suggested_client_name=match.client_name,
            match_type=match.match_type,
            confidence=match.confidence,
        )
        for tx, match in ((tx, match_transaction(tx.concept, clients)) for tx in transactions)
    ]


@router.post("/pdf/confirm", status_code=201)
async def confirm_pdf_import(
    data: ConfirmImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create payments from the confirmed import list and register the PDF import."""
    return await confirm_import(db, current_user.id, data)


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
