"""Router-level tests for /api/imports.

Three endpoints:
  POST /imports/statement          — upload & parse a bank statement (CSV)
  POST /imports/statement/confirm  — persist parsed payments as DB records
  GET  /imports/history            — list previous imports for the current user

Strategy for the parse endpoint:
  - File validation (wrong extension, empty file) requires no mocking.
  - Parse failure / empty-transactions paths patch `parse_statement` so tests
    never depend on a real file.
  - The success path also patches the parser to return predictable data; the
    real `match_transaction` runs against an empty clients table (no seed
    needed) and returns match_type="none" for every transaction.
"""
import hashlib
from datetime import date
from unittest.mock import patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.statement_import import StatementImport
from app.services.statement_parser import ParsedTransaction
from tests.conftest import FAKE_USER, FAKE_ADMIN

# A minimal CSV body — enough to pass the "not empty" guard.
SAMPLE_CSV = b"Date;Date de valeur;Debit;Credit;Libelle\r\n"


def _fake_transaction(
    date: str = "2026-04-10",
    concept: str = "VIR RECIBIDO",
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


# ─── POST /api/imports/statement — file validation ───────────────────────────

class TestParseStatementValidation:
    async def test_rejects_non_csv_file(self, app_client: AsyncClient):
        response = await app_client.post(
            "/api/imports/statement",
            files={"file": ("statement.pdf", b"%PDF fake", "application/pdf")},
        )

        assert response.status_code == 400
        assert ".csv" in response.json()["detail"]

    async def test_rejects_empty_file(self, app_client: AsyncClient):
        response = await app_client.post(
            "/api/imports/statement",
            files={"file": ("statement.csv", b"", "text/csv")},
        )

        assert response.status_code == 400
        assert "vacío" in response.json()["detail"]

    async def test_returns_422_when_statement_cannot_be_parsed(self, app_client: AsyncClient):
        """A parser exception is wrapped as 422."""
        with patch("app.routers.imports.parse_statement", side_effect=ValueError("boom")):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.status_code == 422
        assert "parsear" in response.json()["detail"]


# ─── POST /api/imports/statement — parser results ────────────────────────────

class TestParseStatementResults:
    async def test_returns_422_when_no_transactions_found(self, app_client: AsyncClient):
        with patch("app.routers.imports.parse_statement", return_value=[]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.status_code == 422
        assert "transacciones" in response.json()["detail"]

    async def test_returns_parsed_transactions_on_success(self, app_client: AsyncClient):
        transactions = [
            _fake_transaction(date="2026-04-10", concept="PAGO RECIBIDO", amount=100.0),
            _fake_transaction(date="2026-04-15", concept="TRANSFERENCIA", amount=200.0),
        ]
        with patch("app.routers.imports.parse_statement", return_value=transactions):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.status_code == 200
        body = response.json()["transactions"]
        assert len(body) == 2
        assert body[0]["amount"] == 100.0
        assert body[1]["amount"] == 200.0

    async def test_response_includes_all_required_fields(self, app_client: AsyncClient):
        with patch("app.routers.imports.parse_statement", return_value=[_fake_transaction()]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.status_code == 200
        tx = response.json()["transactions"][0]
        assert "date" in tx
        assert "concept" in tx
        assert "amount" in tx
        assert "suggested_client_id" in tx
        assert "match_type" in tx
        assert "confidence" in tx

    async def test_unmatched_transaction_has_none_client(self, app_client: AsyncClient):
        """With no clients seeded, match_transaction returns match_type='none'."""
        with patch("app.routers.imports.parse_statement", return_value=[_fake_transaction()]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.status_code == 200
        tx = response.json()["transactions"][0]
        assert tx["suggested_client_id"] is None
        assert tx["match_type"] == "none"


# ─── POST /api/imports/statement — deduplication ─────────────────────────────

class TestParseStatementDeduplication:
    async def test_flags_already_imported_transaction(self, db: AsyncSession, app_client: AsyncClient):
        """A parsed tx matching an existing bank_import payment is flagged."""
        await _seed(db, Payment(
            user_id=FAKE_USER.id,
            client_id=None,
            amount=150.0,
            payment_date=date(2026, 4, 10),
            concept="VIR RECIBIDO",
            source="bank_import",
            status="unmatched",
        ))
        tx = _fake_transaction(date="2026-04-10", concept="VIR RECIBIDO", amount=150.0)
        with patch("app.routers.imports.parse_statement", return_value=[tx]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        body = response.json()
        assert body["transactions"][0]["already_imported"] is True
        assert body["duplicate_count"] == 1

    async def test_new_transaction_is_not_flagged(self, db: AsyncSession, app_client: AsyncClient):
        tx = _fake_transaction(date="2026-04-10", concept="MOVIMIENTO NUEVO", amount=99.0)
        with patch("app.routers.imports.parse_statement", return_value=[tx]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        body = response.json()
        assert body["transactions"][0]["already_imported"] is False
        assert body["duplicate_count"] == 0

    async def test_detects_already_imported_file_by_hash(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, StatementImport(
            user_id=FAKE_USER.id,
            filename="previo.csv",
            month=4,
            year=2026,
            transaction_count=1,
            total_amount=10.0,
            file_hash=hashlib.sha256(SAMPLE_CSV).hexdigest(),
        ))
        with patch("app.routers.imports.parse_statement", return_value=[_fake_transaction()]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.json()["file_already_imported_at"] is not None

    async def test_returns_file_hash(self, db: AsyncSession, app_client: AsyncClient):
        with patch("app.routers.imports.parse_statement", return_value=[_fake_transaction()]):
            response = await app_client.post(
                "/api/imports/statement",
                files={"file": ("statement.csv", SAMPLE_CSV, "text/csv")},
            )

        assert response.json()["file_hash"] == hashlib.sha256(SAMPLE_CSV).hexdigest()


# ─── POST /api/imports/statement/confirm ─────────────────────────────────────

class TestConfirmStatementImport:
    async def test_returns_201_with_created_count(self, app_client: AsyncClient):
        response = await app_client.post("/api/imports/statement/confirm", json={
            "payments": [
                {"date": "2026-04-10", "concept": "PAGO A", "amount": 100.0, "client_id": None},
                {"date": "2026-04-15", "concept": "PAGO B", "amount": 50.0,  "client_id": None},
            ],
            "filename": "extracto_abril.csv",
            "month": 4,
            "year": 2026,
        })

        assert response.status_code == 201
        assert response.json()["created"] == 2

    async def test_confirm_with_empty_payments_creates_zero(self, app_client: AsyncClient):
        response = await app_client.post("/api/imports/statement/confirm", json={
            "payments": [],
            "filename": "extracto.csv",
        })

        assert response.status_code == 201
        assert response.json()["created"] == 0

    async def test_confirm_stores_statement_import_record(self, app_client: AsyncClient):
        await app_client.post("/api/imports/statement/confirm", json={
            "payments": [
                {"date": "2026-04-10", "concept": "PAGO", "amount": 75.0, "client_id": None},
            ],
            "filename": "extracto.csv",
            "month": 4,
            "year": 2026,
        })

        # History endpoint should now return the import
        history = await app_client.get("/api/imports/history")
        assert history.status_code == 200
        assert len(history.json()) == 1
        assert history.json()[0]["filename"] == "extracto.csv"

    async def test_confirm_missing_payments_field_returns_422(self, app_client: AsyncClient):
        response = await app_client.post("/api/imports/statement/confirm", json={
            "filename": "extracto.csv",
        })

        assert response.status_code == 422

    async def test_confirm_stores_file_hash(self, db: AsyncSession, app_client: AsyncClient):
        await app_client.post("/api/imports/statement/confirm", json={
            "payments": [
                {"date": "2026-04-10", "concept": "PAGO", "amount": 10.0, "client_id": None},
            ],
            "filename": "extracto.csv",
            "month": 4,
            "year": 2026,
            "file_hash": "deadbeef",
        })

        record = (await db.execute(select(StatementImport))).scalar_one()
        assert record.file_hash == "deadbeef"


# ─── GET /api/imports/history ────────────────────────────────────────────────

class TestGetStatementHistory:
    async def test_returns_empty_list_when_no_imports(self, app_client: AsyncClient):
        response = await app_client.get("/api/imports/history")

        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_seeded_import_records(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(
            db,
            StatementImport(
                user_id=FAKE_USER.id,
                filename="abril.csv",
                month=4,
                year=2026,
                transaction_count=5,
                total_amount=500.0,
            ),
            StatementImport(
                user_id=FAKE_USER.id,
                filename="marzo.csv",
                month=3,
                year=2026,
                transaction_count=3,
                total_amount=300.0,
            ),
        )

        response = await app_client.get("/api/imports/history")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_history_response_includes_all_required_fields(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, StatementImport(
            user_id=FAKE_USER.id,
            filename="test.csv",
            month=4,
            year=2026,
            transaction_count=2,
            total_amount=200.0,
        ))

        response = await app_client.get("/api/imports/history")

        assert response.status_code == 200
        record = response.json()[0]
        assert record["filename"] == "test.csv"
        assert record["month"] == 4
        assert record["year"] == 2026
        assert record["transaction_count"] == 2
        assert record["total_amount"] == 200.0

    async def test_does_not_return_other_users_imports(self, db: AsyncSession, app_client: AsyncClient):
        """Imports from a different user_id must not appear."""
        await _seed(db, StatementImport(
            user_id=FAKE_USER.id + 999,
            filename="otro_usuario.csv",
            month=4,
            year=2026,
            transaction_count=1,
            total_amount=100.0,
        ))

        response = await app_client.get("/api/imports/history")

        assert response.status_code == 200
        assert response.json() == []


# ─── DELETE /api/imports/{import_id} — admin-only undo ────────────────────────

class TestDeleteStatementImport:
    async def _seed_import_with_payments(self, db: AsyncSession) -> StatementImport:
        (record,) = await _seed(db, StatementImport(
            user_id=FAKE_ADMIN.id,
            filename="duplicado.csv",
            month=4,
            year=2026,
            transaction_count=2,
            total_amount=50.0,
        ))
        await _seed(
            db,
            Payment(
                user_id=FAKE_ADMIN.id, client_id=None, statement_import_id=record.id,
                amount=30.0, payment_date=date(2026, 4, 1), concept="A",
                source="bank_import", status="unmatched",
            ),
            Payment(
                user_id=FAKE_ADMIN.id, client_id=None, statement_import_id=record.id,
                amount=20.0, payment_date=date(2026, 4, 2), concept="B",
                source="bank_import", status="unmatched",
            ),
        )
        return record

    async def test_deletes_import_and_its_payments(self, db: AsyncSession, admin_client: AsyncClient):
        record = await self._seed_import_with_payments(db)

        response = await admin_client.delete(f"/api/imports/{record.id}")

        assert response.status_code == 200
        assert response.json()["payments_deleted"] == 2
        assert (await db.execute(select(StatementImport))).scalar_one_or_none() is None
        assert (await db.execute(select(Payment))).scalars().all() == []

    async def test_keeps_unrelated_payments(self, db: AsyncSession, admin_client: AsyncClient):
        record = await self._seed_import_with_payments(db)
        await _seed(db, Payment(
            user_id=FAKE_ADMIN.id, client_id=None, statement_import_id=None,
            amount=99.0, payment_date=date(2026, 4, 9), concept="MANUAL",
            source="manual", status="confirmed",
        ))

        await admin_client.delete(f"/api/imports/{record.id}")

        remaining = (await db.execute(select(Payment))).scalars().all()
        assert len(remaining) == 1
        assert remaining[0].concept == "MANUAL"

    async def test_returns_404_for_missing_import(self, admin_client: AsyncClient):
        response = await admin_client.delete("/api/imports/999999")

        assert response.status_code == 404

    async def test_non_admin_is_blocked(self, db: AsyncSession, app_client: AsyncClient):
        """A non-admin client (require_admin not overridden) cannot delete."""
        record = await self._seed_import_with_payments(db)

        response = await app_client.delete(f"/api/imports/{record.id}")

        assert response.status_code != 200
        assert (await db.execute(select(StatementImport))).scalar_one_or_none() is not None
