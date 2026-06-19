"""Router tests for /api/analytics."""
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business_profile import BusinessProfile
from app.models.class_ import Class
from app.models.client import Client
from app.models.contract import Contract
from app.models.payment import Payment
from app.services.analytics_service import AnalyticsService
from tests.conftest import FAKE_USER


async def _seed(db: AsyncSession, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


async def _client_with_contract(
    db: AsyncSession, *, name: str = "Ana", hourly_rate: float = 20.0
) -> tuple[Client, Contract]:
    (client,) = await _seed(db, Client(user_id=FAKE_USER.id, name=name))
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
    class_date: str,
    *,
    duration_hours: float = 1.0,
    hourly_rate: float = 20.0,
    status: str = "normal",
) -> Class:
    return Class(
        user_id=FAKE_USER.id,
        client_id=client_id,
        contract_id=contract_id,
        class_date=date.fromisoformat(class_date),
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
        status=status,
    )


def _payment_on(client_id: int, payment_date: str, amount: float) -> Payment:
    return Payment(
        user_id=FAKE_USER.id,
        client_id=client_id,
        amount=amount,
        payment_date=date.fromisoformat(payment_date),
        source="manual",
        status="confirmed",
    )


class TestRevenueTimeseries:
    async def test_returns_one_point_per_month_in_range(self, app_client: AsyncClient):
        response = await app_client.get(
            "/api/analytics/revenue-timeseries", params={"from": "2026-03", "to": "2026-05"}
        )

        assert response.status_code == 200
        assert [p["period"] for p in response.json()] == ["2026-03", "2026-04", "2026-05"]

    async def test_range_spanning_year_boundary(self, app_client: AsyncClient):
        response = await app_client.get(
            "/api/analytics/revenue-timeseries", params={"from": "2025-11", "to": "2026-02"}
        )

        assert [p["period"] for p in response.json()] == [
            "2025-11",
            "2025-12",
            "2026-01",
            "2026-02",
        ]

    async def test_expected_paid_pending_for_a_month(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=2.0, hourly_rate=20.0),
            _payment_on(client.id, "2026-04-12", 30.0),
        )

        response = await app_client.get(
            "/api/analytics/revenue-timeseries", params={"from": "2026-04", "to": "2026-04"}
        )

        point = response.json()[0]
        assert point["expected"] == 40.0
        assert point["paid"] == 30.0
        assert point["pending"] == 10.0

    async def test_net_is_null_without_charge_config(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, _ = await _client_with_contract(db)
        await _seed(db, _payment_on(client.id, "2026-04-12", 100.0))

        response = await app_client.get(
            "/api/analytics/revenue-timeseries", params={"from": "2026-04", "to": "2026-04"}
        )

        assert response.json()[0]["net"] is None

    async def test_net_uses_configured_charge_rate(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, _ = await _client_with_contract(db)
        await _seed(db, _payment_on(client.id, "2026-04-12", 100.0))
        await app_client.put("/api/business-profile", json={"socialChargeRate": 20.0})

        response = await app_client.get(
            "/api/analytics/revenue-timeseries", params={"from": "2026-04", "to": "2026-04"}
        )

        # 100 collected − 20% social charge = 80
        assert response.json()[0]["net"] == 80.0

    async def test_invalid_period_returns_422(self, app_client: AsyncClient):
        response = await app_client.get(
            "/api/analytics/revenue-timeseries", params={"from": "nope", "to": "2026-04"}
        )

        assert response.status_code == 422


class TestOverview:
    async def test_totals_summed_over_range(self, db: AsyncSession, app_client: AsyncClient):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=2.0, hourly_rate=20.0),
            _payment_on(client.id, "2026-04-12", 30.0),
            _payment_on(client.id, "2026-05-03", 20.0),
        )

        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "2026-05"}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["expected"] == 40.0
        assert body["paid"] == 50.0
        assert body["pending"] == 0.0

    async def test_collection_rate_is_paid_over_expected(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=2.0, hourly_rate=20.0),
            _payment_on(client.id, "2026-04-12", 30.0),
        )

        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "2026-04"}
        )

        # 30 / 40 = 75%
        assert response.json()["collectionRate"] == 75.0

    async def test_collection_rate_null_when_nothing_expected(self, app_client: AsyncClient):
        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "2026-04"}
        )

        assert response.json()["collectionRate"] is None

    async def test_paid_change_pct_vs_previous_period(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, _ = await _client_with_contract(db)
        await _seed(
            db,
            _payment_on(client.id, "2026-03-10", 50.0),  # previous month
            _payment_on(client.id, "2026-04-10", 100.0),  # current month
        )

        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "2026-04"}
        )

        # current 100 vs previous (March) 50 → +100%
        assert response.json()["paidChangePct"] == 100.0

    async def test_change_pct_null_when_previous_is_zero(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, _ = await _client_with_contract(db)
        await _seed(db, _payment_on(client.id, "2026-04-10", 100.0))

        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "2026-04"}
        )

        assert response.json()["paidChangePct"] is None

    async def test_net_uses_configured_charge_rate(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, _ = await _client_with_contract(db)
        await _seed(db, _payment_on(client.id, "2026-04-10", 100.0))
        await app_client.put("/api/business-profile", json={"socialChargeRate": 20.0})

        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "2026-04"}
        )

        assert response.json()["net"] == 80.0

    async def test_invalid_period_returns_422(self, app_client: AsyncClient):
        response = await app_client.get(
            "/api/analytics/overview", params={"from": "2026-04", "to": "bad"}
        )

        assert response.status_code == 422


class TestReceivables:
    async def test_returns_empty_when_no_clients(self, app_client: AsyncClient):
        response = await app_client.get("/api/analytics/receivables")

        assert response.status_code == 200
        assert response.json() == []

    async def test_excludes_clients_with_positive_balance(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=1.0, hourly_rate=20.0),
            _payment_on(client.id, "2026-04-12", 50.0),  # paid more than expected
        )

        response = await app_client.get("/api/analytics/receivables")

        assert response.json() == []

    async def test_includes_clients_with_negative_balance(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=2.0, hourly_rate=20.0),
            _payment_on(client.id, "2026-04-12", 10.0),  # paid less than expected
        )

        response = await app_client.get("/api/analytics/receivables")

        body = response.json()
        assert len(body) == 1
        assert body[0]["clientName"] == "Ana"
        assert body[0]["expected"] == 40.0
        assert body[0]["paid"] == 10.0
        assert body[0]["balance"] == -30.0

    async def test_ranks_by_balance_descending_debt(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client_a, contract_a = await _client_with_contract(db, name="Analía")
        client_b, contract_b = await _client_with_contract(db, name="Bruno")
        await _seed(
            db,
            _class_on(client_a.id, contract_a.id, "2026-04-10", hourly_rate=20.0),
            _payment_on(client_a.id, "2026-04-12", 5.0),
            _class_on(client_b.id, contract_b.id, "2026-04-10", hourly_rate=50.0),
            _payment_on(client_b.id, "2026-04-12", 20.0),
        )

        response = await app_client.get("/api/analytics/receivables")

        body = response.json()
        assert len(body) == 2
        # Bruno owes more (−30) than Analía (−15) → Bruno first
        assert body[0]["clientName"] == "Bruno"
        assert body[0]["balance"] == -30.0
        assert body[1]["clientName"] == "Analía"
        assert body[1]["balance"] == -15.0


class TestProjection:
    """Projection sums billable revenue of classes scheduled in the chosen CALENDAR
    period. With today = 2026-06-18: this_month = June, this_year = 2026,
    rest_of_year = 18 Jun–31 Dec 2026, next_month = July, next_quarter = Q3 (Jul-Sep),
    next_year = 2027."""

    _TODAY = date(2026, 6, 18)

    async def _project(self, db: AsyncSession, horizon: str):
        return await AnalyticsService(db).projection(FAKE_USER.id, horizon, today=self._TODAY)

    async def test_zero_when_nothing_scheduled(self, db: AsyncSession):
        result = await self._project(db, "next_year")

        assert result.projected_revenue == 0.0
        assert result.projected_net is None
        assert result.period_start == "2027-01-01"
        assert result.period_end == "2027-12-31"

    async def test_next_month_is_next_calendar_month(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-07-10", duration_hours=2.0, hourly_rate=20.0),
            _class_on(client.id, contract.id, "2026-06-25", duration_hours=2.0, hourly_rate=20.0),
        )

        result = await self._project(db, "next_month")

        assert result.projected_revenue == 40.0
        assert result.period_start == "2026-07-01"
        assert result.period_end == "2026-07-31"

    async def test_next_year_zero_when_only_this_year_scheduled(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-07-10", duration_hours=2.0, hourly_rate=20.0),
        )

        result = await self._project(db, "next_year")

        # Nothing in 2027 → 0 (does NOT borrow from July 2026)
        assert result.projected_revenue == 0.0

    async def test_next_year_counts_next_calendar_year(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2027-03-10", duration_hours=1.0, hourly_rate=20.0),
        )

        result = await self._project(db, "next_year")

        assert result.projected_revenue == 20.0

    async def test_next_quarter_is_next_fiscal_quarter(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-08-10", duration_hours=2.0, hourly_rate=20.0),
            _class_on(client.id, contract.id, "2026-11-10", duration_hours=2.0, hourly_rate=20.0),
        )

        result = await self._project(db, "next_quarter")

        assert result.projected_revenue == 40.0
        assert result.period_start == "2026-07-01"
        assert result.period_end == "2026-09-30"

    async def test_this_month_is_current_calendar_month(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-06-10", duration_hours=2.0, hourly_rate=20.0),
            _class_on(client.id, contract.id, "2026-07-05", duration_hours=2.0, hourly_rate=20.0),
        )

        result = await self._project(db, "this_month")

        assert result.projected_revenue == 40.0
        assert result.period_start == "2026-06-01"
        assert result.period_end == "2026-06-30"

    async def test_this_year_is_current_calendar_year(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-02-10", duration_hours=1.0, hourly_rate=20.0),
            _class_on(client.id, contract.id, "2026-11-10", duration_hours=1.0, hourly_rate=20.0),
            _class_on(client.id, contract.id, "2027-01-10", duration_hours=1.0, hourly_rate=20.0),
        )

        result = await self._project(db, "this_year")

        assert result.projected_revenue == 40.0  # both 2026 classes, not the 2027 one
        assert result.period_start == "2026-01-01"
        assert result.period_end == "2026-12-31"

    async def test_rest_of_year_starts_today(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            # before today → excluded
            _class_on(client.id, contract.id, "2026-06-10", duration_hours=1.0, hourly_rate=20.0),
            # today onward → included
            _class_on(client.id, contract.id, "2026-06-25", duration_hours=2.0, hourly_rate=20.0),
        )

        result = await self._project(db, "rest_of_year")

        assert result.projected_revenue == 40.0
        assert result.period_start == "2026-06-18"
        assert result.period_end == "2026-12-31"

    async def test_excludes_cancelled_without_payment(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(
                client.id,
                contract.id,
                "2026-07-10",
                duration_hours=2.0,
                hourly_rate=20.0,
                status="cancelledWithoutPayment",
            ),
        )

        result = await self._project(db, "next_month")

        assert result.projected_revenue == 0.0

    async def test_applies_charge_rates(self, db: AsyncSession):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-07-10", duration_hours=5.0, hourly_rate=20.0),
            BusinessProfile(user_id=FAKE_USER.id, social_charge_rate=20.0),
        )

        result = await self._project(db, "next_month")

        assert result.projected_revenue == 100.0
        assert result.projected_net == 80.0


class TestClientContribution:
    async def test_returns_empty_when_no_classes(self, app_client: AsyncClient):
        response = await app_client.get(
            "/api/analytics/client-contribution", params={"from": "2026-04", "to": "2026-04"}
        )

        assert response.status_code == 200
        assert response.json() == []

    async def test_billed_and_counts_for_held_class(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=2.0, hourly_rate=20.0),
        )

        response = await app_client.get(
            "/api/analytics/client-contribution", params={"from": "2026-04", "to": "2026-04"}
        )

        body = response.json()
        assert len(body) == 1
        assert body[0]["clientName"] == "Ana"
        assert body[0]["billed"] == 40.0
        assert body[0]["heldCount"] == 1
        assert body[0]["cancelledUnpaidCount"] == 0
        assert body[0]["lostRevenue"] == 0.0

    async def test_cancelled_with_payment_counts_separately_but_bills(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(
                client.id,
                contract.id,
                "2026-04-10",
                duration_hours=1.0,
                hourly_rate=20.0,
                status="cancelledWithPayment",
            ),
        )

        response = await app_client.get(
            "/api/analytics/client-contribution", params={"from": "2026-04", "to": "2026-04"}
        )

        body = response.json()[0]
        # paid cancellation still bills (counts toward contribution) but is no loss
        assert body["billed"] == 20.0
        assert body["cancelledPaidCount"] == 1
        assert body["heldCount"] == 0
        assert body["lostRevenue"] == 0.0

    async def test_cancelled_without_payment_is_lost_revenue(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-04-10", duration_hours=2.0, hourly_rate=20.0),
            _class_on(
                client.id,
                contract.id,
                "2026-04-12",
                duration_hours=1.0,
                hourly_rate=20.0,
                status="cancelledWithoutPayment",
            ),
        )

        response = await app_client.get(
            "/api/analytics/client-contribution", params={"from": "2026-04", "to": "2026-04"}
        )

        body = response.json()[0]
        assert body["billed"] == 40.0  # only the held class
        assert body["lostRevenue"] == 20.0  # the unpaid cancellation
        assert body["cancelledUnpaidCount"] == 1

    async def test_share_pct_and_ranking_across_clients(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client_a, contract_a = await _client_with_contract(db, name="Analía")
        client_b, contract_b = await _client_with_contract(db, name="Bruno")
        await _seed(
            db,
            # Analía bills 75, Bruno 25 → 75% / 25%
            _class_on(client_a.id, contract_a.id, "2026-04-10", duration_hours=3.0, hourly_rate=25.0),
            _class_on(client_b.id, contract_b.id, "2026-04-10", duration_hours=1.0, hourly_rate=25.0),
        )

        response = await app_client.get(
            "/api/analytics/client-contribution", params={"from": "2026-04", "to": "2026-04"}
        )

        body = response.json()
        assert [c["clientName"] for c in body] == ["Analía", "Bruno"]
        assert body[0]["billed"] == 75.0
        assert body[0]["sharePct"] == 75.0
        assert body[1]["sharePct"] == 25.0

    async def test_spans_multiple_months_in_range(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        client, contract = await _client_with_contract(db)
        await _seed(
            db,
            _class_on(client.id, contract.id, "2026-03-10", duration_hours=1.0, hourly_rate=20.0),
            _class_on(client.id, contract.id, "2026-05-20", duration_hours=1.0, hourly_rate=20.0),
        )

        response = await app_client.get(
            "/api/analytics/client-contribution", params={"from": "2026-03", "to": "2026-05"}
        )

        body = response.json()[0]
        # Both months counted (the old per-month bug undercounted this).
        assert body["heldCount"] == 2
        assert body["billed"] == 40.0
