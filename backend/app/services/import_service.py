"""Business logic for PDF bank statement imports."""
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.pdf_import import PDFImport
from app.schemas.import_ import ConfirmImportRequest


async def confirm_import(
    db: AsyncSession,
    user_id: int,
    data: ConfirmImportRequest,
) -> dict:
    """Persist payments from a confirmed PDF import and record the import history.

    Returns the number of payments created.
    """
    created = 0
    total_amount = 0.0

    for item in data.payments:
        db.add(Payment(
            user_id=user_id,
            client_id=item.client_id,
            amount=item.amount,
            payment_date=date.fromisoformat(item.date),
            concept=item.concept,
            source="bank_import",
            status="confirmed" if item.client_id else "unmatched",
        ))
        created += 1
        total_amount += item.amount

    db.add(PDFImport(
        user_id=user_id,
        filename=data.filename or "extracto.pdf",
        imported_at=datetime.now(timezone.utc),
        month=data.month,
        year=data.year,
        transaction_count=created,
        total_amount=round(total_amount, 2),
    ))

    await db.commit()
    return {"created": created}
