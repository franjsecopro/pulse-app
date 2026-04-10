"""Router-level tests for /api/dashboard.

Both endpoints delegate entirely to DashboardService, which computes
aggregates for the current month using datetime.now().  We seed data
with date.today() so it falls in the right period.

SQLite FK constraints are off, so client_id=42 in Class/Payment rows
is fine without a real Client record.  When the alert response needs a
client_name we rely on the service fallback ("Desconocido") — seeding
a real Client isn't required for correctness assertions.
"""
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.client import Client
from app.models.payment import Payment
from tests.conftest import FAKE_USER

CLIENT_ID = 42


# ─── Helpers ────────────────────────────────────────────────────────────────

def _class(
    *,
    client_id: int = CLIENT_ID,
    class_date: date | None = None,
    duration_hours: float = 2.0,
    hourly_rate: float = 20.0,
    status: str = "normal",
) -> Class:
    return Class(
        user_id=FAKE_USER.id,
        client_id=client_id,
        class_date=class_date or date.today(),
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
        status=status,
    )


def _payment(
    *,
    client_id: int | None = CLIENT_ID,
    payment_date: date | None = None,
    amount: float = 30.0,
    status: str = "confirmed",
) -> Payment:
    return Payment(
        user_id=FAKE_USER.id,
        client_id=client_id,
        payment_date=payment_date or date.today(),
        amount=amount,
        status=status,
    )


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


# ─── GET /api/dashboard/summary ─────────────────────────────────────────────

class TestGetSummary:
    async def test_returns_200(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/summary")

        assert response.status_code == 200

    async def test_empty_db_returns_all_zeros(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/summary")

        body = response.json()
        assert body["total_expected"] == 0
        assert body["total_paid"] == 0
        assert body["total_pending"] == 0
        assert body["active_clients"] == 0
        assert body["monthly_classes"] == 0
        assert body["monthly_payments"] == 0

    async def test_response_has_all_required_fields(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/summary")

        body = response.json()
        for field in ("total_expected", "total_paid", "total_pending",
                      "active_clients", "monthly_classes", "monthly_payments",
                      "month", "year"):
            assert field in body

    async def test_total_expected_reflects_classes_this_month(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """2h × €20 = €40 expected."""
        await _seed(db, _class(duration_hours=2.0, hourly_rate=20.0))

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["total_expected"] == 40.0

    async def test_total_paid_only_counts_confirmed_payments(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """Only confirmed payments with a client_id contribute to total_paid."""
        await _seed(
            db,
            _payment(amount=30.0, status="confirmed"),
            _payment(amount=20.0, status="pending"),   # excluded
        )

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["total_paid"] == 30.0

    async def test_total_pending_is_expected_minus_paid(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """expected=40, paid=30 → pending=10."""
        await _seed(
            db,
            _class(duration_hours=2.0, hourly_rate=20.0),  # €40
            _payment(amount=30.0, status="confirmed"),       # €30
        )

        response = await app_client.get("/api/dashboard/summary")

        body = response.json()
        assert body["total_expected"] == 40.0
        assert body["total_paid"] == 30.0
        assert body["total_pending"] == 10.0

    async def test_active_clients_excludes_archived(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        await _seed(
            db,
            Client(user_id=FAKE_USER.id, name="Ana",      is_active=True),
            Client(user_id=FAKE_USER.id, name="Luis",     is_active=True),
            Client(user_id=FAKE_USER.id, name="Archivado", is_active=False),
        )

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["active_clients"] == 2

    async def test_monthly_classes_counts_current_month(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        await _seed(db, _class(), _class())

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["monthly_classes"] == 2

    async def test_cancelled_without_payment_not_counted(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """cancelled_without_payment classes don't appear in total_expected."""
        await _seed(
            db,
            _class(duration_hours=2.0, hourly_rate=20.0, status="normal"),              # €40
            _class(duration_hours=1.0, hourly_rate=20.0, status="cancelled_without_payment"),  # excluded
        )

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["total_expected"] == 40.0


# ─── GET /api/dashboard/alerts ───────────────────────────────────────────────

class TestGetAlerts:
    async def test_returns_200(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/alerts")

        assert response.status_code == 200

    async def test_empty_db_returns_empty_list(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/alerts")

        assert response.json() == []

    async def test_debt_alert_when_classes_exceed_payments(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """Client owes: expected=40, paid=0 → debt alert with diff=-40."""
        await _seed(db, _class(client_id=CLIENT_ID, duration_hours=2.0, hourly_rate=20.0))

        response = await app_client.get("/api/dashboard/alerts")

        alerts = response.json()
        assert len(alerts) == 1
        alert = alerts[0]
        assert alert["type"] == "debt"
        assert alert["client_id"] == CLIENT_ID
        assert alert["expected"] == 40.0
        assert alert["paid"] == 0.0
        assert alert["diff"] == -40.0

    async def test_credit_alert_when_payments_exceed_classes(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """Client overpaid: expected=20, paid=50 → credit alert with diff=30."""
        await _seed(
            db,
            _class(client_id=CLIENT_ID, duration_hours=1.0, hourly_rate=20.0),  # €20
            _payment(client_id=CLIENT_ID, amount=50.0, status="confirmed"),      # €50
        )

        response = await app_client.get("/api/dashboard/alerts")

        alerts = response.json()
        credit = next((a for a in alerts if a["type"] == "credit"), None)
        assert credit is not None
        assert credit["diff"] == 30.0

    async def test_no_alert_when_paid_equals_expected(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """Perfect balance → no alert generated."""
        await _seed(
            db,
            _class(client_id=CLIENT_ID, duration_hours=1.0, hourly_rate=20.0),  # €20
            _payment(client_id=CLIENT_ID, amount=20.0, status="confirmed"),      # €20
        )

        response = await app_client.get("/api/dashboard/alerts")

        assert response.json() == []

    async def test_alert_includes_all_required_fields(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        await _seed(db, _class(client_id=CLIENT_ID))

        response = await app_client.get("/api/dashboard/alerts")

        alert = response.json()[0]
        for field in ("client_id", "client_name", "type", "message",
                      "expected", "paid", "diff", "month", "year"):
            assert field in alert

    async def test_multiple_clients_each_get_own_alert(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        """Two clients with debt → two alerts."""
        await _seed(
            db,
            _class(client_id=10, duration_hours=1.0, hourly_rate=20.0),  # client 10, €20
            _class(client_id=20, duration_hours=2.0, hourly_rate=15.0),  # client 20, €30
        )

        response = await app_client.get("/api/dashboard/alerts")

        client_ids = {a["client_id"] for a in response.json()}
        assert 10 in client_ids
        assert 20 in client_ids
