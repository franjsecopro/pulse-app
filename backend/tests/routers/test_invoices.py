"""Router tests for /api/invoices — the HTTP surface used by Swagger and the UI.

Covers the testable flow end-to-end: build a draft from a class or a client+
period, list/get drafts, and issue (which assigns a gapless number and rejects
re-issuing with 409).
"""
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.contract import Contract
from app.models.class_ import Class

USER_ID = 1


async def _seed(db: AsyncSession, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def _seed_class(
    db: AsyncSession, when: date = date(2026, 4, 7), hours: float = 1.5, rate: float = 40.0,
) -> tuple[Class, Client]:
    (client,) = await _seed(db, Client(user_id=USER_ID, name="Dupont"))
    (contract,) = await _seed(db, Contract(
        client_id=client.id, description="Cours", start_date=date(2026, 1, 1), hourly_rate=rate,
    ))
    (cls,) = await _seed(db, Class(
        user_id=USER_ID, client_id=client.id, contract_id=contract.id,
        class_date=when, duration_hours=hours, hourly_rate=rate, status="normal",
    ))
    return cls, client


class TestCreateFromClass:
    async def test_creates_draft_invoice_from_a_class(self, db: AsyncSession, app_client: AsyncClient):
        cls, client = await _seed_class(db)

        response = await app_client.post(f"/api/invoices/from-class/{cls.id}")

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "draft"
        assert body["number"] is None
        assert body["clientId"] == client.id
        assert len(body["lines"]) == 1
        assert body["lines"][0]["designation"] == "Cours particuliers"
        assert body["totalHt"] == 60.0


class TestCreateFromPeriod:
    async def test_aggregates_a_clients_month(self, db: AsyncSession, app_client: AsyncClient):
        cls, client = await _seed_class(db, when=date(2026, 4, 7), hours=1.0, rate=40.0)
        # second class for the same client in April
        await _seed(db, Class(
            user_id=USER_ID, client_id=client.id, contract_id=cls.contract_id,
            class_date=date(2026, 4, 21), duration_hours=1.0, hourly_rate=40.0, status="normal",
        ))

        response = await app_client.post(
            "/api/invoices/from-period",
            json={"clientId": client.id, "month": 4, "year": 2026},
        )

        assert response.status_code == 201
        body = response.json()
        assert len(body["lines"]) == 2
        assert body["totalHt"] == 80.0

    async def test_invoices_a_single_day_via_date_range(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        cls, client = await _seed_class(db, when=date(2026, 4, 7), hours=1.0, rate=40.0)
        # another class same client, different day — must be excluded
        await _seed(db, Class(
            user_id=USER_ID, client_id=client.id, contract_id=cls.contract_id,
            class_date=date(2026, 4, 8), duration_hours=1.0, hourly_rate=40.0, status="normal",
        ))

        response = await app_client.post(
            "/api/invoices/from-period",
            json={"clientId": client.id, "periodStart": "2026-04-07", "periodEnd": "2026-04-07"},
        )

        assert response.status_code == 201
        body = response.json()
        assert len(body["lines"]) == 1
        assert body["periodStart"] == "2026-04-07"
        assert body["periodEnd"] == "2026-04-07"


class TestListAndGet:
    async def test_list_returns_created_invoices_with_total_count(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        cls, _ = await _seed_class(db)
        await app_client.post(f"/api/invoices/from-class/{cls.id}")

        response = await app_client.get("/api/invoices")

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.headers["X-Total-Count"] == "1"

    async def test_get_by_id(self, db: AsyncSession, app_client: AsyncClient):
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()

        response = await app_client.get(f"/api/invoices/{created['id']}")

        assert response.status_code == 200
        assert response.json()["id"] == created["id"]


class TestIssue:
    async def test_issue_assigns_a_number_and_marks_issued(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()

        response = await app_client.post(f"/api/invoices/{created['id']}/issue")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "issued"
        assert body["number"] is not None
        assert body["number"].endswith("-01")

    async def test_issuing_twice_returns_409(self, db: AsyncSession, app_client: AsyncClient):
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        await app_client.post(f"/api/invoices/{created['id']}/issue")

        response = await app_client.post(f"/api/invoices/{created['id']}/issue")

        assert response.status_code == 409


class TestPreview:
    async def test_preview_returns_html_with_invoice_content(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        issued = (await app_client.post(f"/api/invoices/{created['id']}/issue")).json()

        response = await app_client.get(f"/api/invoices/{created['id']}/preview")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "Cours particuliers" in response.text
        assert issued["number"] in response.text

    async def test_preview_returns_404_when_missing(self, app_client: AsyncClient):
        response = await app_client.get("/api/invoices/999999/preview")

        assert response.status_code == 404


class TestPdf:
    async def test_pdf_returns_application_pdf_bytes(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        try:
            import weasyprint  # noqa: F401
        except Exception as exc:  # ImportError or OSError (missing native GTK libs)
            pytest.skip(f"WeasyPrint native libraries unavailable: {exc}")
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        await app_client.post(f"/api/invoices/{created['id']}/issue")

        response = await app_client.get(f"/api/invoices/{created['id']}/pdf")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content[:4] == b"%PDF"

    async def test_pdf_returns_503_when_engine_unavailable(
        self, db: AsyncSession, app_client: AsyncClient, monkeypatch
    ):
        from app.services import invoice_service as svc
        from app.services.invoice_pdf_service import PdfGenerationError

        def boom(*args, **kwargs):
            raise PdfGenerationError("WeasyPrint native libraries (GTK) are not installed.")

        monkeypatch.setattr(svc, "invoice_to_pdf", boom)
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        await app_client.post(f"/api/invoices/{created['id']}/issue")

        response = await app_client.get(f"/api/invoices/{created['id']}/pdf")

        assert response.status_code == 503


class TestShareAndFile:
    async def test_share_returns_a_signed_file_url(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        await app_client.post(f"/api/invoices/{created['id']}/issue")

        response = await app_client.post(f"/api/invoices/{created['id']}/share")

        assert response.status_code == 200
        assert f"/api/invoices/{created['id']}/file?token=" in response.json()["url"]

    async def test_file_serves_cached_pdf_with_a_valid_token(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        from app.models.invoice_pdf import InvoicePdf
        from app.services.invoice_links import create_invoice_file_token

        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        await app_client.post(f"/api/invoices/{created['id']}/issue")
        # Seed a cached PDF so the endpoint serves it without invoking WeasyPrint.
        await _seed(db, InvoicePdf(invoice_id=created["id"], content=b"%PDF-1.7 fake"))
        token = create_invoice_file_token(created["id"])

        response = await app_client.get(f"/api/invoices/{created['id']}/file?token={token}")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content == b"%PDF-1.7 fake"

    async def test_file_rejects_an_invalid_token(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()

        response = await app_client.get(f"/api/invoices/{created['id']}/file?token=garbage")

        assert response.status_code == 403

    async def test_file_rejects_a_token_for_a_different_invoice(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        from app.services.invoice_links import create_invoice_file_token

        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        token_for_other = create_invoice_file_token(999999)

        response = await app_client.get(
            f"/api/invoices/{created['id']}/file?token={token_for_other}"
        )

        assert response.status_code == 403


class _FakeEmailService:
    def __init__(self):
        self.calls = []

    async def send(self, to, subject, html, attachments=None):
        self.calls.append({"to": to, "subject": subject, "attachments": attachments})
        return {"id": "fake_email"}


class TestSend:
    async def test_send_returns_links_and_emails_via_injected_service(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        from main import app
        from app.models.invoice_pdf import InvoicePdf
        from app.routers.invoices import get_email_service

        fake = _FakeEmailService()
        app.dependency_overrides[get_email_service] = lambda: fake
        try:
            cls, _ = await _seed_class(db)
            created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
            await app_client.post(f"/api/invoices/{created['id']}/issue")
            await _seed(db, InvoicePdf(invoice_id=created["id"], content=b"%PDF fake"))

            response = await app_client.post(
                f"/api/invoices/{created['id']}/send",
                json={"email": "client@example.com", "phone": "+33612345678"},
            )

            assert response.status_code == 200
            body = response.json()
            assert "/file?token=" in body["shareUrl"]
            assert body["whatsappUrl"].startswith("https://wa.me/33612345678")
            assert body["email"]["sent"] is True
            assert len(fake.calls) == 1
            assert fake.calls[0]["to"] == "client@example.com"
            assert fake.calls[0]["attachments"][0]["filename"] == "facture.pdf"
        finally:
            app.dependency_overrides.pop(get_email_service, None)

    async def test_send_reports_not_configured_when_resend_unset(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        from app.models.invoice_pdf import InvoicePdf

        cls, _ = await _seed_class(db)
        created = (await app_client.post(f"/api/invoices/from-class/{cls.id}")).json()
        await app_client.post(f"/api/invoices/{created['id']}/issue")
        await _seed(db, InvoicePdf(invoice_id=created["id"], content=b"%PDF fake"))

        response = await app_client.post(
            f"/api/invoices/{created['id']}/send",
            json={"email": "client@example.com"},
        )

        assert response.status_code == 200
        assert response.json()["email"] == {"sent": False, "reason": "not_configured"}


class TestAdminDelete:
    async def test_admin_can_delete_an_invoice(self, db: AsyncSession, admin_client: AsyncClient):
        from sqlalchemy import select
        from app.models.invoice import Invoice
        from app.models.invoice_line import InvoiceLine

        (client,) = await _seed(db, Client(user_id=USER_ID, name="X"))
        (invoice,) = await _seed(db, Invoice(
            user_id=USER_ID, client_id=client.id, status="issued", number="2026-06-01",
            total_ht=40.0, currency="EUR",
            lines=[InvoiceLine(designation="Cours particuliers", quantity=1.0,
                               unit_price_ht=40.0, total_ht=40.0)],
        ))

        response = await admin_client.delete(f"/api/invoices/{invoice.id}")

        assert response.status_code == 200
        remaining = await db.execute(select(Invoice).where(Invoice.id == invoice.id))
        assert remaining.scalar_one_or_none() is None

    async def test_regular_user_cannot_delete(self, db: AsyncSession, app_client: AsyncClient):
        from main import app
        from app.core.dependencies import get_real_user
        from app.models.user import User
        from app.models.invoice import Invoice

        (client,) = await _seed(db, Client(user_id=USER_ID, name="X"))
        (invoice,) = await _seed(db, Invoice(
            user_id=USER_ID, client_id=client.id, status="draft", total_ht=0.0, currency="EUR",
        ))
        app.dependency_overrides[get_real_user] = lambda: User(
            id=1, email="u@x.dev", role="user", password_hash="x", locale="es-ES"
        )
        try:
            response = await app_client.delete(f"/api/invoices/{invoice.id}")
            assert response.status_code == 403
        finally:
            app.dependency_overrides.pop(get_real_user, None)
