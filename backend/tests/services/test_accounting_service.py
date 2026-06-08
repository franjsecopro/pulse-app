"""Tests for AccountingService billing-period bucketing.

Focus: the per-client `payment_timing` offset. A "next_month" client pays in
arrears, so a payment received in May covers April's classes and must land in
April's summary — not May's.
"""
from datetime import date

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.contract import Contract
from app.models.class_ import Class
from app.models.payment import Payment
from app.schemas.accounting import AccountingSummaryEntryResponse
from app.services.accounting_service import AccountingService

USER_ID = 1


async def _seed(db: AsyncSession, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def _seed_client(db: AsyncSession, name: str, payment_timing: str) -> tuple[Client, Contract]:
    """Seed a client plus one contract (classes require a non-null contract_id)."""
    (client,) = await _seed(db, Client(user_id=USER_ID, name=name, payment_timing=payment_timing))
    (contract,) = await _seed(db, Contract(
        client_id=client.id, description="Clases", start_date=date(2026, 1, 1), hourly_rate=20.0,
    ))
    return client, contract


def _class_on(client_id: int, contract_id: int, when: date) -> Class:
    return Class(
        user_id=USER_ID,
        client_id=client_id,
        contract_id=contract_id,
        class_date=when,
        duration_hours=1.0,
        hourly_rate=20.0,
        status="normal",
    )


def _payment(client_id: int, when: date, amount: float = 20.0) -> Payment:
    return Payment(
        user_id=USER_ID,
        client_id=client_id,
        amount=amount,
        payment_date=when,
        concept="VIR",
        source="bank_import",
        status="confirmed",
    )


def _entry_for(
    summary: list[AccountingSummaryEntryResponse], client_id: int
) -> AccountingSummaryEntryResponse | None:
    return next((e for e in summary if e.client_id == client_id), None)


class TestPaymentTimingOffset:
    async def test_next_month_payment_counts_for_previous_month(self, db: AsyncSession):
        """A next_month client's May payment shows up as April's `paid`."""
        client, contract = await _seed_client(db, "Ana", "next_month")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)), _payment(client.id, date(2026, 5, 5)))

        summary = await AccountingService(db).get_monthly_summary(USER_ID, month=4, year=2026)

        entry = _entry_for(summary, client.id)
        assert entry is not None
        assert entry.expected == 20.0
        assert entry.paid == 20.0       # the May payment, attributed to April
        assert entry.balance == 0.0

    async def test_next_month_payment_absent_from_payment_month(self, db: AsyncSession):
        """That same May payment must NOT appear in May's summary."""
        client, contract = await _seed_client(db, "Ana", "next_month")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)), _payment(client.id, date(2026, 5, 5)))

        summary = await AccountingService(db).get_monthly_summary(USER_ID, month=5, year=2026)

        entry = _entry_for(summary, client.id)
        # May has no classes and (correctly) no paid amount for this client.
        assert entry is None or entry.paid == 0.0

    async def test_same_month_client_unchanged(self, db: AsyncSession):
        """Regression: a same_month client's April payment stays in April."""
        client, contract = await _seed_client(db, "Beto", "same_month")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)), _payment(client.id, date(2026, 4, 20)))

        summary = await AccountingService(db).get_monthly_summary(USER_ID, month=4, year=2026)

        entry = _entry_for(summary, client.id)
        assert entry is not None
        assert entry.paid == 20.0
        assert entry.balance == 0.0

    async def test_next_month_january_rolls_back_to_previous_december(self, db: AsyncSession):
        """Year boundary: a Jan 2027 payment covers Dec 2026 for a next_month client."""
        client, contract = await _seed_client(db, "Cata", "next_month")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 12, 10)),
            _payment(client.id, date(2027, 1, 8)),
        )

        summary = await AccountingService(db).get_monthly_summary(USER_ID, month=12, year=2026)

        entry = _entry_for(summary, client.id)
        assert entry is not None
        assert entry.paid == 20.0
        assert entry.balance == 0.0

    async def test_next_month_historical_credit_uses_offset(self, db: AsyncSession):
        """A next_month client who prepaid carries the surplus into the right month.

        March payment (covers Feb) with no Feb classes → surplus of 20 that should
        appear as previous_credit when viewing April.
        """
        client, contract = await _seed_client(db, "Dani", "next_month")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _payment(client.id, date(2026, 3, 5)),   # covers February (no Feb classes) → surplus
            _payment(client.id, date(2026, 5, 5)),   # covers April
        )

        summary = await AccountingService(db).get_monthly_summary(USER_ID, month=4, year=2026)

        entry = _entry_for(summary, client.id)
        assert entry is not None
        assert entry.expected == 20.0
        assert entry.paid == 20.0            # the May payment, applied to April
        assert entry.previous_credit == 20.0  # the March payment surplus
        assert entry.balance == 20.0
