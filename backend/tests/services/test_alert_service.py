from datetime import date, datetime, timezone

import pytest

from app.models.class_ import Class
from app.models.client import Client
from app.models.contract import Contract
from app.models.payment import Payment
from app.models.statement_import import StatementImport
from app.services.alert_service import AlertService

USER_ID = 1


async def _seed(db, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def _seed_client(db, *, name: str, payment_timing: str = "same_month") -> tuple[Client, Contract]:
    (client,) = await _seed(
        db, Client(user_id=USER_ID, name=name, payment_timing=payment_timing)
    )
    (contract,) = await _seed(
        db,
        Contract(
            client_id=client.id,
            description="Clases",
            start_date=date(2026, 1, 1),
            hourly_rate=20.0,
        ),
    )
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


def _payment(
    client_id: int,
    when: date,
    amount: float = 20.0,
    source: str = "bank_import",
) -> Payment:
    return Payment(
        user_id=USER_ID,
        client_id=client_id,
        amount=amount,
        payment_date=when,
        concept="VIR",
        source=source,
        status="confirmed",
    )


def _statement(month: int, year: int) -> StatementImport:
    return StatementImport(
        user_id=USER_ID,
        filename=f"ext_{year}_{month:02d}.csv",
        month=month,
        year=year,
        transaction_count=0,
        total_amount=0.0,
    )


class TestReconciliationGate:
    @pytest.mark.asyncio
    async def test_debt_blocked_before_day5_with_no_statement(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))

        now = datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        assert alerts == []

    @pytest.mark.asyncio
    async def test_debt_fires_after_day5_with_no_statement_fallback(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))

        now = datetime(2026, 5, 6, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        debts = [a for a in alerts if a.type == "debt"]
        assert len(debts) == 1
        assert debts[0].client_id == client.id
        assert debts[0].amount == 20.0

    @pytest.mark.asyncio
    async def test_debt_fires_when_statement_is_imported(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _statement(month=4, year=2026),
        )

        now = datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        debts = [a for a in alerts if a.type == "debt"]
        assert len(debts) == 1
        assert debts[0].client_id == client.id


class TestArrearsAsSourceOfTruth:
    @pytest.mark.asyncio
    async def test_next_month_payment_with_may_statement_no_april_debt(self, db):
        client, contract = await _seed_client(db, name="Ana", payment_timing="next_month")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _payment(client.id, date(2026, 5, 5)),
            _statement(month=5, year=2026),
        )

        now = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        debts = [a for a in alerts if a.type == "debt"]
        assert debts == [], f"Expected no April debt, got: {debts}"


class TestManualPayments:
    @pytest.mark.asyncio
    async def test_manual_payment_clears_debt_when_period_reconciled(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _payment(client.id, date(2026, 4, 15), source="manual"),
            _statement(month=4, year=2026),
        )

        now = datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        debts = [a for a in alerts if a.type == "debt"]
        assert debts == []


class TestCredit:
    @pytest.mark.asyncio
    async def test_credit_alert_when_balance_positive(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _payment(client.id, date(2026, 4, 20), amount=50.0),
            _statement(month=4, year=2026),
        )

        now = datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        credits = [a for a in alerts if a.type == "credit"]
        assert len(credits) == 1
        assert credits[0].client_id == client.id
        assert credits[0].amount == 30.0


class TestStatementMissing:
    @pytest.mark.asyncio
    async def test_fires_after_day5_with_activity_no_statement(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))

        now = datetime(2026, 5, 6, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        missing = [a for a in alerts if a.type == "statement_missing"]
        assert len(missing) == 1
        assert missing[0].client_id is None

    @pytest.mark.asyncio
    async def test_does_not_fire_before_day5(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))

        now = datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        missing = [a for a in alerts if a.type == "statement_missing"]
        assert missing == []

    @pytest.mark.asyncio
    async def test_does_not_fire_when_statement_was_imported(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _statement(month=4, year=2026),
        )

        now = datetime(2026, 5, 6, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        missing = [a for a in alerts if a.type == "statement_missing"]
        assert missing == []

    @pytest.mark.asyncio
    async def test_does_not_fire_when_there_was_no_activity(self, db):
        now = datetime(2026, 5, 6, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        missing = [a for a in alerts if a.type == "statement_missing"]
        assert missing == []


class TestNoData:
    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_list(self, db):
        now = datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        assert alerts == []

    @pytest.mark.asyncio
    async def test_balanced_period_returns_no_alerts(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _payment(client.id, date(2026, 4, 15), amount=20.0),
            _statement(month=4, year=2026),
        )

        now = datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        alerts = await service.get_alerts(USER_ID, month=4, year=2026)

        assert alerts == []


class TestTypeFilter:
    @pytest.mark.asyncio
    async def test_filter_by_type_returns_subset(self, db):
        client, contract = await _seed_client(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _statement(month=4, year=2026),
        )

        now = datetime(2026, 5, 6, 12, 0, tzinfo=timezone.utc)
        service = AlertService(db, now=now)

        debts_only = await service.get_alerts(
            USER_ID, month=4, year=2026, types=["debt"]
        )
        assert all(a.type == "debt" for a in debts_only)
        assert len(debts_only) == 1

        all_alerts = await service.get_alerts(USER_ID, month=4, year=2026)
        assert len(all_alerts) >= 1
