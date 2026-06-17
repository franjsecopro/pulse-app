"""Gapless invoice numbering — assigned atomically, only at issuance.

French law (Art. 242 nonies A, CGI) requires a continuous chronological sequence
with no gaps. We guarantee that by keeping a persistent counter row
(`InvoiceSequence`) per user and per legal series, and incrementing it under a
row lock (`SELECT ... FOR UPDATE`). We never derive the number from a COUNT(*) of
invoices — that would re-use or skip numbers when drafts are deleted.

Series scope:
- ``monthly`` (default): each calendar month is its own series, restarting at 1.
  The reset between months is not a gap — it opens a new series. The client uses
  this (``2026-01-10`` then ``2026-02-01``).
- ``annual``: one series per year; the month is informational only.
"""
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice_sequence import InvoiceSequence

DEFAULT_NUMBER_FORMAT = "YYYY-MM-NN"
DEFAULT_SCOPE = "monthly"


def _series_key(year: int, month: int, scope: str) -> str:
    if scope == "annual":
        return f"{year:04d}"
    return f"{year:04d}-{month:02d}"


def _format_number(number_format: str, year: int, month: int, counter: int) -> str:
    out = number_format.replace("YYYY", f"{year:04d}").replace("MM", f"{month:02d}")
    # Any remaining run of N's is the counter, zero-padded to a MINIMUM width
    # equal to the run length (never truncated when the counter grows past it).
    return re.sub(r"N+", lambda m: str(counter).zfill(len(m.group(0))), out)


async def next_invoice_number(
    db: AsyncSession,
    user_id: int,
    issue_date,
    scope: str = DEFAULT_SCOPE,
    number_format: str = DEFAULT_NUMBER_FORMAT,
) -> str:
    """Reserve and return the next invoice number for ``user_id``.

    Increments the persistent counter for the relevant series under a row lock
    and returns the formatted number. Call this once, at issuance, inside the
    same transaction that persists the issued invoice.
    """
    series_key = _series_key(issue_date.year, issue_date.month, scope)

    result = await db.execute(
        select(InvoiceSequence)
        .where(InvoiceSequence.user_id == user_id, InvoiceSequence.series_key == series_key)
        .with_for_update()
    )
    sequence = result.scalar_one_or_none()

    if sequence is None:
        sequence = InvoiceSequence(user_id=user_id, series_key=series_key, last_number=0)
        db.add(sequence)
        await db.flush()

    sequence.last_number += 1
    await db.flush()

    return _format_number(number_format, issue_date.year, issue_date.month, sequence.last_number)
