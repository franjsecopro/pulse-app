"""Router-level tests for /api/imports.

Three endpoints:
  POST /imports/pdf          — upload & parse a PDF bank statement
  POST /imports/pdf/confirm  — persist parsed payments as DB records
  GET  /imports/pdf-history  — list previous imports for the current user

Strategy for the PDF parse endpoint:
  - File validation (wrong extension, empty file) requires no mocking.
  - Parse failure / empty-transactions paths patch `parse_hello_bank_pdf` so
    tests never depend on a real PDF file.
  - The success path also patches the parser to return predictable data; the
    real `match_transaction` runs against an empty clients table (no seed
    needed) and returns match_type="none" for every transaction.
"""
from unittest.mock import patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pdf_import import PDFImport
from app.services.pdf_parser import ParsedTransaction
from tests.conftest import FAKE_USER

# ---------------------------------------------------------------------------
# Minimal fake PDF bytes — enough to pass the "not empty" guard.
# pdfplumber will fail to open it, but the parse-error test expects that.
GARBAGE_PDF = b"%PDF fake content"


def _fake_transaction(
    date: str = "2026-04-10",
    concept: str = "TRANSFERENCIA RECIBIDA",
    amount: float = 150.0,
) -> ParsedTransaction:
    return ParsedTransaction(date=date, concept=concept, amount=amount, raw_text="")


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


# ─── POST /api/imports/pdf — file validation ─────────────────────────────────

class TestParsePdfValidation:
    async def test_rejects_non_pdf_file(self, app_client: AsyncClient):
        response = await app_client.post(
            "/api/imports/pdf",
            files={"file": ("statement.csv", b"col1,col2", "text/csv")},
        )

        assert response.status_code == 400
        assert "PDF" in response.json()["detail"]

    async def test_rejects_empty_file(self, app_client: AsyncClient):
        response = await app_client.post(
            "/api/imports/pdf",
            files={"file": ("statement.pdf", b"", "application/pdf")},
        )

        assert response.status_code == 400
        assert "vacío" in response.json()["detail"]

    async def test_returns_422_when_pdf_cannot_be_parsed(self, app_client: AsyncClient):
        """Garbage bytes cause pdfplumber to raise → 422."""
        response = await app_client.post(
            "/api/imports/pdf",
            files={"file": ("statement.pdf", GARBAGE_PDF, "application/pdf")},
        )

        assert response.status_code == 422
        assert "parsear" in response.json()["detail"]


# ─── POST /api/imports/pdf — parser results ──────────────────────────────────

class TestParsePdfResults:
    async def test_returns_422_when_no_transactions_found(self, app_client: AsyncClient):
        with patch("app.routers.imports.parse_hello_bank_pdf", return_value=[]):
            response = await app_client.post(
                "/api/imports/pdf",
                files={"file": ("statement.pdf", GARBAGE_PDF, "application/pdf")},
            )

        assert response.status_code == 422
        assert "transacciones" in response.json()["detail"]

    async def test_returns_parsed_transactions_on_success(self, app_client: AsyncClient):
        transactions = [
            _fake_transaction(date="2026-04-10", concept="PAGO RECIBIDO", amount=100.0),
            _fake_transaction(date="2026-04-15", concept="TRANSFERENCIA", amount=200.0),
        ]
        with patch("app.routers.imports.parse_hello_bank_pdf", return_value=transactions):
            response = await app_client.post(
                "/api/imports/pdf",
                files={"file": ("statement.pdf", GARBAGE_PDF, "application/pdf")},
            )

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 2
        assert body[0]["amount"] == 100.0
        assert body[1]["amount"] == 200.0

    async def test_response_includes_all_required_fields(self, app_client: AsyncClient):
        with patch("app.routers.imports.parse_hello_bank_pdf", return_value=[_fake_transaction()]):
            response = await app_client.post(
                "/api/imports/pdf",
                files={"file": ("statement.pdf", GARBAGE_PDF, "application/pdf")},
            )

        assert response.status_code == 200
        tx = response.json()[0]
        assert "date" in tx
        assert "concept" in tx
        assert "amount" in tx
        assert "suggested_client_id" in tx
        assert "match_type" in tx
        assert "confidence" in tx

    async def test_unmatched_transaction_has_none_client(self, app_client: AsyncClient):
        """With no clients seeded, match_transaction returns match_type='none'."""
        with patch("app.routers.imports.parse_hello_bank_pdf", return_value=[_fake_transaction()]):
            response = await app_client.post(
                "/api/imports/pdf",
                files={"file": ("statement.pdf", GARBAGE_PDF, "application/pdf")},
            )

        assert response.status_code == 200
        tx = response.json()[0]
        assert tx["suggested_client_id"] is None
        assert tx["match_type"] == "none"


# ─── POST /api/imports/pdf/confirm ───────────────────────────────────────────

class TestConfirmPdfImport:
    async def test_returns_201_with_created_count(self, app_client: AsyncClient):
        response = await app_client.post("/api/imports/pdf/confirm", json={
            "payments": [
                {"date": "2026-04-10", "concept": "PAGO A", "amount": 100.0, "client_id": None},
                {"date": "2026-04-15", "concept": "PAGO B", "amount": 50.0,  "client_id": None},
            ],
            "filename": "extracto_abril.pdf",
            "month": 4,
            "year": 2026,
        })

        assert response.status_code == 201
        assert response.json()["created"] == 2

    async def test_confirm_with_empty_payments_creates_zero(self, app_client: AsyncClient):
        response = await app_client.post("/api/imports/pdf/confirm", json={
            "payments": [],
            "filename": "extracto.pdf",
        })

        assert response.status_code == 201
        assert response.json()["created"] == 0

    async def test_confirm_stores_pdf_import_record(self, app_client: AsyncClient):
        await app_client.post("/api/imports/pdf/confirm", json={
            "payments": [
                {"date": "2026-04-10", "concept": "PAGO", "amount": 75.0, "client_id": None},
            ],
            "filename": "extracto.pdf",
            "month": 4,
            "year": 2026,
        })

        # History endpoint should now return the import
        history = await app_client.get("/api/imports/pdf-history")
        assert history.status_code == 200
        assert len(history.json()) == 1
        assert history.json()[0]["filename"] == "extracto.pdf"

    async def test_confirm_missing_payments_field_returns_422(self, app_client: AsyncClient):
        response = await app_client.post("/api/imports/pdf/confirm", json={
            "filename": "extracto.pdf",
        })

        assert response.status_code == 422


# ─── GET /api/imports/pdf-history ────────────────────────────────────────────

class TestGetPdfHistory:
    async def test_returns_empty_list_when_no_imports(self, app_client: AsyncClient):
        response = await app_client.get("/api/imports/pdf-history")

        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_seeded_import_records(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(
            db,
            PDFImport(
                user_id=FAKE_USER.id,
                filename="abril.pdf",
                month=4,
                year=2026,
                transaction_count=5,
                total_amount=500.0,
            ),
            PDFImport(
                user_id=FAKE_USER.id,
                filename="marzo.pdf",
                month=3,
                year=2026,
                transaction_count=3,
                total_amount=300.0,
            ),
        )

        response = await app_client.get("/api/imports/pdf-history")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_history_response_includes_all_required_fields(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, PDFImport(
            user_id=FAKE_USER.id,
            filename="test.pdf",
            month=4,
            year=2026,
            transaction_count=2,
            total_amount=200.0,
        ))

        response = await app_client.get("/api/imports/pdf-history")

        assert response.status_code == 200
        record = response.json()[0]
        assert record["filename"] == "test.pdf"
        assert record["month"] == 4
        assert record["year"] == 2026
        assert record["transaction_count"] == 2
        assert record["total_amount"] == 200.0

    async def test_does_not_return_other_users_imports(self, db: AsyncSession, app_client: AsyncClient):
        """Imports from a different user_id must not appear."""
        await _seed(db, PDFImport(
            user_id=FAKE_USER.id + 999,
            filename="otro_usuario.pdf",
            month=4,
            year=2026,
            transaction_count=1,
            total_amount=100.0,
        ))

        response = await app_client.get("/api/imports/pdf-history")

        assert response.status_code == 200
        assert response.json() == []
