"""Tests for InvoiceService — draft creation from classes and issuance.

Key invariants:
- A draft has no number; the number is assigned only at issuance (gapless).
- Line amounts come from class_revenue.effective_revenue (the SSOT), so a
  cancelledWithoutPayment class contributes 0.
- Once issued, an invoice is immutable: re-issuing is rejected, and the client
  snapshot is frozen (later edits to the client must not change the invoice).
"""
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.contract import Contract
from app.models.class_ import Class
from app.models.business_profile import BusinessProfile
from app.services.invoice_service import InvoiceService, InvoiceAlreadyIssuedError

USER_ID = 1


async def _seed(db: AsyncSession, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def _seed_client_contract(db: AsyncSession, name: str = "Dupont") -> tuple[Client, Contract]:
    (client,) = await _seed(db, Client(user_id=USER_ID, name=name))
    (contract,) = await _seed(db, Contract(
        client_id=client.id, description="Cours", start_date=date(2026, 1, 1), hourly_rate=40.0,
    ))
    return client, contract


async def _seed_class(
    db: AsyncSession, client_id: int, contract_id: int, when: date,
    hours: float = 1.0, rate: float = 40.0, status: str = "normal",
) -> Class:
    (cls,) = await _seed(db, Class(
        user_id=USER_ID, client_id=client_id, contract_id=contract_id,
        class_date=when, duration_hours=hours, hourly_rate=rate, status=status,
    ))
    return cls


class TestCreateDraftFromClass:
    async def test_maps_class_to_a_single_cours_particuliers_line(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7), hours=1.5, rate=40.0)

        invoice = await InvoiceService(db).create_draft_from_class(USER_ID, cls.id)

        assert invoice.status == "draft"
        assert invoice.number is None
        assert invoice.client_id == client.id
        assert len(invoice.lines) == 1
        line = invoice.lines[0]
        assert line.designation == "Cours particuliers"
        assert line.quantity == 1.5
        assert line.unit_price_ht == 40.0
        assert line.total_ht == 60.0
        assert line.source_class_id == cls.id
        assert invoice.total_ht == 60.0

    async def test_sets_contract_label_from_the_class_contract(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)  # description="Cours"
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7))

        invoice = await InvoiceService(db).create_draft_from_class(USER_ID, cls.id)

        assert invoice.contract_label == "Cours"

    async def test_cancelled_without_payment_class_contributes_zero(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        cls = await _seed_class(
            db, client.id, contract.id, date(2026, 4, 7), status="cancelledWithoutPayment",
        )

        invoice = await InvoiceService(db).create_draft_from_class(USER_ID, cls.id)

        assert invoice.lines[0].total_ht == 0.0
        assert invoice.total_ht == 0.0


class TestIssue:
    async def test_assigns_gapless_number_and_marks_issued(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        service = InvoiceService(db)
        draft = await service.create_draft_from_class(USER_ID, cls.id)

        issued = await service.issue(USER_ID, draft.id, issue_date=date(2026, 5, 7))

        assert issued.status == "issued"
        assert issued.number == "2026-05-01"
        assert issued.issue_date == date(2026, 5, 7)

    async def test_issuing_an_already_issued_invoice_is_rejected(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        service = InvoiceService(db)
        draft = await service.create_draft_from_class(USER_ID, cls.id)
        await service.issue(USER_ID, draft.id, issue_date=date(2026, 5, 7))

        with pytest.raises(InvoiceAlreadyIssuedError):
            await service.issue(USER_ID, draft.id, issue_date=date(2026, 5, 7))

    async def test_client_snapshot_is_frozen_at_issue(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db, name="Dupont")
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        service = InvoiceService(db)
        draft = await service.create_draft_from_class(USER_ID, cls.id)
        issued = await service.issue(USER_ID, draft.id, issue_date=date(2026, 5, 7))

        # Edit the client AFTER issuance — the frozen snapshot must not change.
        client.name = "Changed Name"
        await db.commit()
        await db.refresh(issued)

        assert issued.client_name == "Dupont"


class TestCreateDraftFromClientPeriod:
    async def test_aggregates_billable_classes_of_the_month_into_lines(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        await _seed_class(db, client.id, contract.id, date(2026, 4, 7), hours=1.0, rate=40.0)
        await _seed_class(db, client.id, contract.id, date(2026, 4, 21), hours=1.5, rate=40.0)
        # A class in a different month must not be picked up.
        await _seed_class(db, client.id, contract.id, date(2026, 5, 2), hours=1.0, rate=40.0)

        invoice = await InvoiceService(db).create_draft_from_client_period(
            USER_ID, client.id, month=4, year=2026
        )

        assert invoice.status == "draft"
        assert invoice.number is None
        assert invoice.client_id == client.id
        assert len(invoice.lines) == 2
        assert invoice.total_ht == 100.0
        assert invoice.period_start == date(2026, 4, 1)
        assert invoice.period_end == date(2026, 4, 30)

    async def test_aggregates_a_multi_month_range(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        await _seed_class(db, client.id, contract.id, date(2026, 1, 10), hours=1.0, rate=40.0)
        await _seed_class(db, client.id, contract.id, date(2026, 2, 15), hours=1.0, rate=40.0)
        await _seed_class(db, client.id, contract.id, date(2026, 3, 20), hours=1.0, rate=40.0)
        # April is outside the Jan→Mar range.
        await _seed_class(db, client.id, contract.id, date(2026, 4, 1), hours=1.0, rate=40.0)

        invoice = await InvoiceService(db).create_draft_from_client_period(
            USER_ID, client.id, month=1, year=2026, end_month=3, end_year=2026
        )

        assert len(invoice.lines) == 3
        assert invoice.total_ht == 120.0
        assert invoice.period_start == date(2026, 1, 1)
        assert invoice.period_end == date(2026, 3, 31)

    async def test_period_single_contract_sets_contract_label(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)  # description="Cours"
        await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        await _seed_class(db, client.id, contract.id, date(2026, 4, 9))

        invoice = await InvoiceService(db).create_draft_from_client_period(
            USER_ID, client.id, month=4, year=2026
        )

        assert invoice.contract_label == "Cours"

    async def test_period_multiple_contracts_leaves_label_empty(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        (contract2,) = await _seed(db, Contract(
            client_id=client.id, description="Autre", start_date=date(2026, 1, 1), hourly_rate=30.0,
        ))
        await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        await _seed_class(db, client.id, contract2.id, date(2026, 4, 9))

        invoice = await InvoiceService(db).create_draft_from_client_period(
            USER_ID, client.id, month=4, year=2026
        )

        assert invoice.contract_label is None

    async def test_invoices_a_single_day(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        await _seed_class(db, client.id, contract.id, date(2026, 6, 10), hours=1.0, rate=40.0)
        await _seed_class(db, client.id, contract.id, date(2026, 6, 10), hours=1.5, rate=40.0)
        # A different day must not be picked up.
        await _seed_class(db, client.id, contract.id, date(2026, 6, 11), hours=1.0, rate=40.0)

        invoice = await InvoiceService(db).create_draft_from_client_dates(
            USER_ID, client.id, date(2026, 6, 10), date(2026, 6, 10)
        )

        assert len(invoice.lines) == 2
        assert invoice.total_ht == 100.0
        assert invoice.period_start == date(2026, 6, 10)
        assert invoice.period_end == date(2026, 6, 10)

    async def test_excludes_cancelled_without_payment_classes(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        await _seed_class(db, client.id, contract.id, date(2026, 4, 7), hours=1.0, rate=40.0)
        await _seed_class(
            db, client.id, contract.id, date(2026, 4, 8), status="cancelledWithoutPayment",
        )

        invoice = await InvoiceService(db).create_draft_from_client_period(
            USER_ID, client.id, month=4, year=2026
        )

        assert len(invoice.lines) == 1
        assert invoice.total_ht == 40.0


class TestAutoGenerateDailyDrafts:
    async def test_creates_one_draft_per_client_for_the_day(self, db: AsyncSession):
        c1, k1 = await _seed_client_contract(db, name="A")
        c2, k2 = await _seed_client_contract(db, name="B")
        await _seed_class(db, c1.id, k1.id, date(2026, 4, 7))
        await _seed_class(db, c1.id, k1.id, date(2026, 4, 7))
        await _seed_class(db, c2.id, k2.id, date(2026, 4, 7))
        await _seed_class(db, c1.id, k1.id, date(2026, 4, 8))  # other day — ignored

        created = await InvoiceService(db).auto_generate_daily_drafts(USER_ID, date(2026, 4, 7))

        assert created == 2  # one draft per client
        invoices, total = await InvoiceService(db).list_for_user(USER_ID)
        assert total == 2
        c1_invoice = next(i for i in invoices if i.client_id == c1.id)
        assert len(c1_invoice.lines) == 2  # both of c1's classes that day

    async def test_is_idempotent(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        service = InvoiceService(db)

        first = await service.auto_generate_daily_drafts(USER_ID, date(2026, 4, 7))
        second = await service.auto_generate_daily_drafts(USER_ID, date(2026, 4, 7))

        assert first == 1
        assert second == 0  # class already invoiced — nothing new

    async def test_skips_cancelled_without_payment(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        await _seed_class(
            db, client.id, contract.id, date(2026, 4, 7), status="cancelledWithoutPayment",
        )

        created = await InvoiceService(db).auto_generate_daily_drafts(USER_ID, date(2026, 4, 7))

        assert created == 0


class TestIssuerSnapshotAndNumberingConfig:
    async def test_issuer_snapshot_comes_from_business_profile(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        await _seed(db, BusinessProfile(
            user_id=USER_ID, business_name="Prof Particulier",
            siret="12345678900012", fiscal_address="1 rue de l'École",
        ))
        service = InvoiceService(db)
        draft = await service.create_draft_from_class(USER_ID, cls.id)

        issued = await service.issue(USER_ID, draft.id, issue_date=date(2026, 5, 7))

        assert issued.issuer_name == "Prof Particulier"
        assert issued.issuer_siret == "12345678900012"
        assert issued.issuer_address == "1 rue de l'École"

    async def test_issue_uses_numbering_config_from_profile(self, db: AsyncSession):
        client, contract = await _seed_client_contract(db)
        cls = await _seed_class(db, client.id, contract.id, date(2026, 4, 7))
        await _seed(db, BusinessProfile(
            user_id=USER_ID, business_name="P",
            invoice_sequence_scope="annual", invoice_number_format="YYYY-NNNN",
        ))
        service = InvoiceService(db)
        draft = await service.create_draft_from_class(USER_ID, cls.id)

        issued = await service.issue(USER_ID, draft.id, issue_date=date(2026, 5, 7))

        assert issued.number == "2026-0001"
