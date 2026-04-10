"""Tests for import_service — PDF bank statement import business logic."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.pdf_import import PDFImport
from app.schemas.import_ import ConfirmImportRequest, ConfirmPaymentItem
from app.services.import_service import confirm_import


def make_request(
    payments: list[dict],
    *,
    filename: str | None = "test.pdf",
    month: int | None = 4,
    year: int | None = 2024,
) -> ConfirmImportRequest:
    return ConfirmImportRequest(
        payments=[ConfirmPaymentItem(**p) for p in payments],
        filename=filename,
        month=month,
        year=year,
    )


# ─── confirm_import ──────────────────────────────────────────────────────────

class TestConfirmImport:
    async def test_creates_one_payment_per_item(self, db: AsyncSession):
        """Each item in the request becomes one Payment row."""
        request = make_request([
            {"date": "2024-04-01", "concept": "Transfer A", "amount": 100.0, "client_id": 1},
            {"date": "2024-04-05", "concept": "Transfer B", "amount": 200.0, "client_id": 2},
            {"date": "2024-04-10", "concept": "Transfer C", "amount": 50.0},
        ])

        result = await confirm_import(db, user_id=1, data=request)

        assert result == {"created": 3}
        payments = (await db.execute(select(Payment))).scalars().all()
        assert len(payments) == 3

    async def test_matched_payment_gets_confirmed_status(self, db: AsyncSession):
        """A payment item with a client_id gets status 'confirmed'."""
        request = make_request([
            {"date": "2024-04-01", "concept": "Transfer", "amount": 100.0, "client_id": 5},
        ])

        await confirm_import(db, user_id=1, data=request)

        payment = (await db.execute(select(Payment))).scalar_one()
        assert payment.status == "confirmed"
        assert payment.client_id == 5

    async def test_unmatched_payment_gets_unmatched_status(self, db: AsyncSession):
        """A payment item without a client_id gets status 'unmatched'."""
        request = make_request([
            {"date": "2024-04-01", "concept": "Unknown sender", "amount": 75.0},
        ])

        await confirm_import(db, user_id=1, data=request)

        payment = (await db.execute(select(Payment))).scalar_one()
        assert payment.status == "unmatched"
        assert payment.client_id is None

    async def test_payment_source_is_bank_import(self, db: AsyncSession):
        """All payments created from a PDF import have source='bank_import'."""
        request = make_request([
            {"date": "2024-04-01", "concept": "A", "amount": 10.0, "client_id": 1},
        ])

        await confirm_import(db, user_id=1, data=request)

        payment = (await db.execute(select(Payment))).scalar_one()
        assert payment.source == "bank_import"

    async def test_creates_pdf_import_record(self, db: AsyncSession):
        """One PDFImport history record is created per confirm_import call."""
        request = make_request(
            [
                {"date": "2024-04-01", "concept": "A", "amount": 100.0},
                {"date": "2024-04-02", "concept": "B", "amount": 200.0},
            ],
            filename="abril_2024.pdf",
            month=4,
            year=2024,
        )

        await confirm_import(db, user_id=1, data=request)

        record = (await db.execute(select(PDFImport))).scalar_one()
        assert record.filename == "abril_2024.pdf"
        assert record.month == 4
        assert record.year == 2024
        assert record.transaction_count == 2
        assert record.total_amount == 300.0

    async def test_total_amount_is_rounded_to_two_decimals(self, db: AsyncSession):
        """Floating point amounts are rounded to 2 decimal places in the PDF record."""
        request = make_request([
            {"date": "2024-04-01", "concept": "A", "amount": 10.005},
            {"date": "2024-04-02", "concept": "B", "amount": 20.004},
        ])

        await confirm_import(db, user_id=1, data=request)

        record = (await db.execute(select(PDFImport))).scalar_one()
        assert record.total_amount == round(10.005 + 20.004, 2)

    async def test_uses_default_filename_when_none_provided(self, db: AsyncSession):
        """filename=None in the request defaults to 'extracto.pdf'."""
        request = make_request(
            [{"date": "2024-04-01", "concept": "A", "amount": 50.0}],
            filename=None,
        )

        await confirm_import(db, user_id=1, data=request)

        record = (await db.execute(select(PDFImport))).scalar_one()
        assert record.filename == "extracto.pdf"

    async def test_payment_date_is_parsed_correctly(self, db: AsyncSession):
        """ISO date strings are parsed to Python date objects."""
        from datetime import date

        request = make_request([
            {"date": "2024-06-15", "concept": "Payment", "amount": 100.0},
        ])

        await confirm_import(db, user_id=1, data=request)

        payment = (await db.execute(select(Payment))).scalar_one()
        assert payment.payment_date == date(2024, 6, 15)
