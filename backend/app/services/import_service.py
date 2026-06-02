"""Business logic for bank statement imports."""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.statement_import import StatementImport
from app.schemas.import_ import ConfirmImportRequest


Fingerprint = tuple[str, float, str]


def fingerprint(date_str: str, amount: float, concept: Optional[str]) -> Fingerprint:
    """Stable identity of a bank transaction, used for duplicate detection.

    A bank concept carries the bank's reference number, so (date, amount, concept)
    is a strong key with virtually no false positives.
    """
    return (date_str, round(amount, 2), (concept or "").strip())


async def get_imported_fingerprints(db: AsyncSession, user_id: int) -> set[Fingerprint]:
    """Fingerprints of every bank-imported payment already on record for the user."""
    result = await db.execute(
        select(Payment.payment_date, Payment.amount, Payment.concept).where(
            Payment.user_id == user_id,
            Payment.source == "bank_import",
        )
    )
    return {
        fingerprint(pay_date.isoformat(), amount, concept)
        for pay_date, amount, concept in result.all()
    }


async def find_imported_file(
    db: AsyncSession, user_id: int, file_hash: str
) -> Optional[datetime]:
    """Return the import date of a previous statement with the same file hash, if any."""
    result = await db.execute(
        select(StatementImport.imported_at)
        .where(
            StatementImport.user_id == user_id,
            StatementImport.file_hash == file_hash,
        )
        .order_by(StatementImport.imported_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def confirm_import(
    db: AsyncSession,
    user_id: int,
    data: ConfirmImportRequest,
) -> dict:
    """Persist payments from a confirmed statement import and record the history.

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

    db.add(StatementImport(
        user_id=user_id,
        filename=data.filename or "extracto.csv",
        imported_at=datetime.now(timezone.utc),
        month=data.month,
        year=data.year,
        transaction_count=created,
        total_amount=round(total_amount, 2),
        file_hash=data.file_hash,
    ))

    await db.commit()
    return {"created": created}
