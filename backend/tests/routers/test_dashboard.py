"""Router-level tests for /api/dashboard.

`/summary` and `/upcoming` delegate to DashboardService which computes
aggregates for the current month using datetime.now().

`/alerts` now delegates to AlertService. The new behavior:
- Balance comes from AccountingService (source of truth, applies arrears)
- Debt/credit only fires when the period is reconciled (statement imported
  OR day-5-of-next-month fallback passed)
- This requires real Client rows because the balance query joins Client
  to read `payment_timing` — see test_accounting_service.py for the pattern.

Tests use date.today() so data lands in the current period. SQLite FK
constraints are off in this fixture.
"""
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.client import Client
from app.models.contract import Contract
from app.models.payment import Payment
from app.models.statement_import import StatementImport
from tests.conftest import FAKE_USER


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


async def _seed_client_with_contract(
    db: AsyncSession,
    *,
    name: str = "Ana",
    payment_timing: str = "same_month",
    hourly_rate: float = 20.0,
) -> tuple[Client, Contract]:
    (client,) = await _seed(
        db, Client(user_id=FAKE_USER.id, name=name, payment_timing=payment_timing)
    )
    (contract,) = await _seed(
        db,
        Contract(
            client_id=client.id,
            description="Clases",
            start_date=date(2026, 1, 1),
            hourly_rate=hourly_rate,
        ),
    )
    return client, contract


def _class_on(
    client_id: int,
    contract_id: int,
    *,
    duration_hours: float = 1.0,
    hourly_rate: float = 20.0,
    status: str = "normal",
) -> Class:
    return Class(
        user_id=FAKE_USER.id,
        client_id=client_id,
        contract_id=contract_id,
        class_date=date.today(),
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
        status=status,
    )


def _payment(
    client_id: int,
    *,
    amount: float = 20.0,
    source: str = "bank_import",
    status: str = "confirmed",
) -> Payment:
    return Payment(
        user_id=FAKE_USER.id,
        client_id=client_id,
        amount=amount,
        payment_date=date.today(),
        source=source,
        status=status,
    )


def _statement() -> StatementImport:
    return StatementImport(
        user_id=FAKE_USER.id,
        filename="ext.csv",
        month=date.today().month,
        year=date.today().year,
        transaction_count=0,
        total_amount=0.0,
    )


class TestGetSummary:
    async def test_returns_200(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/summary")

        assert response.status_code == 200

    async def test_empty_db_returns_all_zeros(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/summary")

        body = response.json()
        assert body["totalExpected"] == 0
        assert body["totalPaid"] == 0
        assert body["totalPending"] == 0
        assert body["activeClients"] == 0
        assert body["monthlyClasses"] == 0
        assert body["monthlyPayments"] == 0

    async def test_response_has_all_required_fields(self, app_client: AsyncClient):
        response = await app_client.get("/api/dashboard/summary")

        body = response.json()
        for field in ("totalExpected", "totalPaid", "totalPending",
                      "activeClients", "monthlyClasses", "monthlyPayments",
                      "month", "year"):
            assert field in body

    async def test_total_expected_reflects_classes_this_month(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(db, _class_on(client.id, contract.id, duration_hours=2.0, hourly_rate=20.0))

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["totalExpected"] == 40.0

    async def test_total_paid_only_counts_confirmed_payments(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _payment(client.id, amount=30.0, status="confirmed"),
            _payment(client.id, amount=20.0, status="pending"),
        )

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["totalPaid"] == 30.0

    async def test_total_pending_is_expected_minus_paid(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, duration_hours=2.0, hourly_rate=20.0),
            _payment(client.id, amount=30.0),
        )

        response = await app_client.get("/api/dashboard/summary")

        body = response.json()
        assert body["totalExpected"] == 40.0
        assert body["totalPaid"] == 30.0
        assert body["totalPending"] == 10.0

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

        assert response.json()["activeClients"] == 2

    async def test_monthly_classes_counts_current_month(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(db, _class_on(client.id, contract.id), _class_on(client.id, contract.id))

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["monthlyClasses"] == 2

    async def test_cancelled_without_payment_not_counted(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, duration_hours=2.0, hourly_rate=20.0, status="normal"),
            _class_on(client.id, contract.id, duration_hours=1.0, hourly_rate=20.0, status="cancelledWithoutPayment"),
        )

        response = await app_client.get("/api/dashboard/summary")

        assert response.json()["totalExpected"] == 40.0


class TestGetAlerts:
    async def test_returns_200(self, app_client: AsyncClient):
        response = await app_client.get("/api/alerts")

        assert response.status_code == 200

    async def test_empty_db_returns_empty_list(self, app_client: AsyncClient):
        response = await app_client.get("/api/alerts")

        assert response.json() == []

    async def test_debt_alert_when_statement_imported(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, duration_hours=2.0, hourly_rate=20.0),
            _statement(),
        )

        response = await app_client.get("/api/alerts")

        debts = [a for a in response.json() if a["type"] == "debt"]
        assert len(debts) == 1
        assert debts[0]["clientId"] == client.id
        assert debts[0]["amount"] == 40.0

    async def test_credit_alert_when_payments_exceed_classes(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, duration_hours=1.0, hourly_rate=20.0),
            _payment(client.id, amount=50.0),
            _statement(),
        )

        response = await app_client.get("/api/alerts")

        credits = [a for a in response.json() if a["type"] == "credit"]
        assert len(credits) == 1
        assert credits[0]["clientId"] == client.id
        assert credits[0]["amount"] == 30.0

    async def test_no_alert_when_paid_equals_expected(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, duration_hours=1.0, hourly_rate=20.0),
            _payment(client.id, amount=20.0),
            _statement(),
        )

        response = await app_client.get("/api/alerts")

        balance_alerts = [a for a in response.json() if a["type"] in ("debt", "credit")]
        assert balance_alerts == []

    async def test_alert_includes_all_required_fields(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id),
            _statement(),
        )

        response = await app_client.get("/api/alerts")

        debt_alerts = [a for a in response.json() if a["type"] == "debt"]
        assert len(debt_alerts) == 1
        for field in ("clientId", "clientName", "type", "severity", "amount", "month", "year"):
            assert field in debt_alerts[0]

    async def test_multiple_clients_each_get_own_alert(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client_a, contract_a = await _seed_client_with_contract(db, name="A", hourly_rate=20.0)
        client_b, contract_b = await _seed_client_with_contract(db, name="B", hourly_rate=15.0)
        await _seed(
            db,
            _class_on(client_a.id, contract_a.id, duration_hours=1.0, hourly_rate=20.0),
            _class_on(client_b.id, contract_b.id, duration_hours=2.0, hourly_rate=15.0),
            _statement(),
        )

        response = await app_client.get("/api/alerts")

        client_ids = {a["clientId"] for a in response.json() if a["type"] == "debt"}
        assert client_a.id in client_ids
        assert client_b.id in client_ids

    async def test_filter_by_type_returns_subset(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _seed_client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id),
            _statement(),
        )

        response = await app_client.get("/api/alerts?types=debt")

        assert all(a["type"] == "debt" for a in response.json())
