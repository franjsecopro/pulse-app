"""Router-level tests for /api/payments.

Payment.client_id is nullable, so most tests create payments without a client.
For client_name-related assertions we seed a Client explicitly.
"""
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.payment import Payment
from tests.conftest import FAKE_USER


# ─── Helpers ────────────────────────────────────────────────────────────────

def _payment(
    *,
    amount: float = 100.0,
    payment_date: str = "2026-04-10",
    client_id: int | None = None,
    status: str = "confirmed",
) -> Payment:
    return Payment(
        user_id=FAKE_USER.id,
        amount=amount,
        payment_date=date.fromisoformat(payment_date),
        client_id=client_id,
        status=status,
    )


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


# ─── GET /api/payments ───────────────────────────────────────────────────────

class TestListPayments:
    async def test_returns_200_with_empty_list(self, app_client: AsyncClient):
        response = await app_client.get("/api/payments")

        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_payments_for_current_user(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _payment(amount=50.0), _payment(amount=75.0))

        response = await app_client.get("/api/payments")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_filters_by_status(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(
            db,
            _payment(status="confirmed"),
            _payment(status="pending"),
            _payment(status="pending"),
        )

        response = await app_client.get("/api/payments", params={"status": "pending"})

        assert response.status_code == 200
        assert len(response.json()) == 2
        assert all(p["status"] == "pending" for p in response.json())

    async def test_filters_by_month_and_year(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(
            db,
            _payment(payment_date="2026-04-10"),  # April — match
            _payment(payment_date="2026-05-01"),  # May — no match
        )

        response = await app_client.get("/api/payments", params={"month": 4, "year": 2026})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["payment_date"] == "2026-04-10"

    async def test_filters_by_client_id(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, Client(user_id=FAKE_USER.id, name="Test Client", is_active=True))
        await _seed(
            db,
            _payment(client_id=client.id),
            _payment(client_id=None),
        )

        response = await app_client.get("/api/payments", params={"client_id": client.id})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["client_id"] == client.id

    async def test_client_name_populated_when_client_exists(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, Client(user_id=FAKE_USER.id, name="Carlos Ruiz", is_active=True))
        await _seed(db, _payment(client_id=client.id))

        response = await app_client.get("/api/payments")

        assert response.status_code == 200
        assert response.json()[0]["client_name"] == "Carlos Ruiz"

    async def test_client_name_is_none_for_unmatched_payment(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _payment(client_id=None))

        response = await app_client.get("/api/payments")

        assert response.status_code == 200
        assert response.json()[0]["client_name"] is None


# ─── POST /api/payments ──────────────────────────────────────────────────────

class TestCreatePayment:
    async def test_creates_payment_and_returns_201(self, app_client: AsyncClient):
        response = await app_client.post("/api/payments", json={
            "amount": 150.0,
            "payment_date": "2026-04-10",
        })

        assert response.status_code == 201
        body = response.json()
        assert body["id"] is not None
        assert body["amount"] == 150.0

    async def test_creates_payment_without_client(self, app_client: AsyncClient):
        response = await app_client.post("/api/payments", json={
            "amount": 75.0,
            "payment_date": "2026-04-10",
        })

        assert response.status_code == 201
        assert response.json()["client_id"] is None

    async def test_default_status_is_confirmed(self, app_client: AsyncClient):
        response = await app_client.post("/api/payments", json={
            "amount": 100.0,
            "payment_date": "2026-04-10",
        })

        assert response.status_code == 201
        assert response.json()["status"] == "confirmed"

    async def test_missing_amount_returns_422(self, app_client: AsyncClient):
        response = await app_client.post("/api/payments", json={"payment_date": "2026-04-10"})

        assert response.status_code == 422

    async def test_missing_payment_date_returns_422(self, app_client: AsyncClient):
        response = await app_client.post("/api/payments", json={"amount": 100.0})

        assert response.status_code == 422

    async def test_created_payment_appears_in_list(self, app_client: AsyncClient):
        await app_client.post("/api/payments", json={"amount": 99.0, "payment_date": "2026-04-10"})

        response = await app_client.get("/api/payments")

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["amount"] == 99.0


# ─── GET /api/payments/{id} ──────────────────────────────────────────────────

class TestGetPayment:
    async def test_returns_payment_by_id(self, db: AsyncSession, app_client: AsyncClient):
        [payment] = await _seed(db, _payment())

        response = await app_client.get(f"/api/payments/{payment.id}")

        assert response.status_code == 200
        assert response.json()["id"] == payment.id

    async def test_returns_404_for_unknown_id(self, app_client: AsyncClient):
        response = await app_client.get("/api/payments/99999")

        assert response.status_code == 404


# ─── PUT /api/payments/{id} ──────────────────────────────────────────────────

class TestUpdatePayment:
    async def test_update_returns_200_with_new_amount(self, db: AsyncSession, app_client: AsyncClient):
        [payment] = await _seed(db, _payment(amount=100.0))

        response = await app_client.put(f"/api/payments/{payment.id}", json={"amount": 200.0})

        assert response.status_code == 200
        assert response.json()["amount"] == 200.0

    async def test_update_status(self, db: AsyncSession, app_client: AsyncClient):
        [payment] = await _seed(db, _payment(status="pending"))

        response = await app_client.put(f"/api/payments/{payment.id}", json={"status": "confirmed"})

        assert response.status_code == 200
        assert response.json()["status"] == "confirmed"

    async def test_update_404_for_unknown_payment(self, app_client: AsyncClient):
        response = await app_client.put("/api/payments/99999", json={"amount": 50.0})

        assert response.status_code == 404


# ─── DELETE /api/payments/{id} ───────────────────────────────────────────────

class TestDeletePayment:
    async def test_delete_returns_204(self, db: AsyncSession, app_client: AsyncClient):
        [payment] = await _seed(db, _payment())

        response = await app_client.delete(f"/api/payments/{payment.id}")

        assert response.status_code == 204

    async def test_deleted_payment_not_in_list(self, db: AsyncSession, app_client: AsyncClient):
        [payment] = await _seed(db, _payment())

        await app_client.delete(f"/api/payments/{payment.id}")
        response = await app_client.get("/api/payments")

        assert response.json() == []

    async def test_delete_404_for_unknown_payment(self, app_client: AsyncClient):
        response = await app_client.delete("/api/payments/99999")

        assert response.status_code == 404
