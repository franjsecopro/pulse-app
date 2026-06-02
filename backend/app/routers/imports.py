import hashlib

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.client import Client
from app.models.statement_import import StatementImport
from app.models.user import User
from app.schemas.import_ import (
    ParsedTransactionResponse,
    ParseStatementResponse,
    ConfirmImportRequest,
    StatementImportResponse,
)
from app.services.import_service import (
    confirm_import,
    get_imported_fingerprints,
    find_imported_file,
    fingerprint,
)
from app.services.statement_parser import parse_statement, SUPPORTED_EXTENSIONS
from app.services.payment_matcher import match_transaction

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/statement", response_model=ParseStatementResponse)
async def parse_statement_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse a bank statement (CSV), match clients and flag already-imported rows."""
    if not file.filename or not file.filename.lower().endswith(SUPPORTED_EXTENSIONS):
        allowed = ', '.join(SUPPORTED_EXTENSIONS)
        raise HTTPException(status_code=400, detail=f"El archivo debe ser {allowed}")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    file_hash = hashlib.sha256(content).hexdigest()

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
        transactions = parse_statement(file.filename, content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"No se pudo parsear el extracto: {str(e)}")

    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="No se encontraron transacciones en el extracto. Verifica que sea un extracto de Hello Bank.",
        )

    # Deduplication: known transaction fingerprints (Nivel 2) and prior file (Nivel 1).
    existing_fingerprints = await get_imported_fingerprints(db, current_user.id)
    file_already_imported_at = await find_imported_file(db, current_user.id, file_hash)

    items: list[ParsedTransactionResponse] = []
    duplicate_count = 0
    for tx in transactions:
        match = match_transaction(tx.concept, clients)
        already_imported = fingerprint(tx.date, tx.amount, tx.concept) in existing_fingerprints
        if already_imported:
            duplicate_count += 1
        items.append(ParsedTransactionResponse(
            date=tx.date,
            concept=tx.concept,
            amount=tx.amount,
            suggested_client_id=match.client_id,
            suggested_client_name=match.client_name,
            match_type=match.match_type,
            confidence=match.confidence,
            already_imported=already_imported,
        ))

    return ParseStatementResponse(
        transactions=items,
        file_hash=file_hash,
        file_already_imported_at=file_already_imported_at,
        duplicate_count=duplicate_count,
    )


@router.post("/statement/confirm", status_code=201)
async def confirm_statement_import(
    data: ConfirmImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create payments from the confirmed import list and register the import."""
    return await confirm_import(db, current_user.id, data)


@router.get("/history", response_model=list[StatementImportResponse])
async def get_statement_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the list of bank statements imported by the current user."""
    result = await db.execute(
        select(StatementImport)
        .where(StatementImport.user_id == current_user.id)
        .order_by(StatementImport.imported_at.desc())
    )
    return list(result.scalars().all())
