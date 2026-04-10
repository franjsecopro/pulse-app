"""Router-level tests for /api/classes.

Key design decisions:
- SQLite FK-off means Class rows can be inserted with a client_id that has no
  matching Client row.  _build_response handles client=None gracefully, so most
  tests do NOT need a seeded Client.
- For tests that assert client_name is populated we seed a Client explicitly.
- background_tasks (GCal sync) are queued but never executed in the test
  environment — we only assert on status codes and JSON payloads.
"""
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.class_ import Class
from tests.conftest import FAKE_USER


# ─── Helpers ────────────────────────────────────────────────────────────────

CLIENT_ID = 42  # arbitrary — FK constraints are off in SQLite


def _class(
    *,
    client_id: int = CLIENT_ID,
    class_date: str = "2026-04-10",
    duration_hours: float = 1.0,
    hourly_rate: float = 20.0,
) -> Class:
    return Class(
        user_id=FAKE_USER.id,
        client_id=client_id,
        class_date=date.fromisoformat(class_date),
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
    )


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


# ─── GET /api/classes ────────────────────────────────────────────────────────

class TestListClasses:
    async def test_returns_200_with_empty_list(self, app_client: AsyncClient):
        response = await app_client.get("/api/classes")

        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_classes_for_current_user(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _class(), _class(class_date="2026-04-11"))

        response = await app_client.get("/api/classes")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_filters_by_month_and_year(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(
            db,
            _class(class_date="2026-04-10"),  # April — should match
            _class(class_date="2026-05-01"),  # May — should not match
        )

        response = await app_client.get("/api/classes", params={"month": 4, "year": 2026})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["class_date"] == "2026-04-10"

    async def test_filters_by_client_id(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(
            db,
            _class(client_id=10),
            _class(client_id=20),
        )

        response = await app_client.get("/api/classes", params={"client_id": 10})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["client_id"] == 10

    async def test_client_name_populated_when_client_exists(self, db: AsyncSession, app_client: AsyncClient):
        """When the Client row exists, client_name is populated via joinedload."""
        [client] = await _seed(db, Client(user_id=FAKE_USER.id, name="María García", is_active=True))
        await _seed(db, _class(client_id=client.id))

        response = await app_client.get("/api/classes")

        assert response.status_code == 200
        assert response.json()[0]["client_name"] == "María García"


# ─── POST /api/classes ───────────────────────────────────────────────────────

class TestCreateClass:
    async def test_creates_class_and_returns_201(self, app_client: AsyncClient):
        response = await app_client.post("/api/classes", json={
            "client_id": CLIENT_ID,
            "class_date": "2026-04-10",
            "duration_hours": 1.5,
            "hourly_rate": 30.0,
        })

        assert response.status_code == 201
        body = response.json()
        assert body["id"] is not None
        assert body["client_id"] == CLIENT_ID

    async def test_total_amount_is_computed_correctly(self, app_client: AsyncClient):
        response = await app_client.post("/api/classes", json={
            "client_id": CLIENT_ID,
            "class_date": "2026-04-10",
            "duration_hours": 2.0,
            "hourly_rate": 25.0,
        })

        assert response.status_code == 201
        assert response.json()["total_amount"] == 50.0

    async def test_created_class_appears_in_list(self, app_client: AsyncClient):
        await app_client.post("/api/classes", json={
            "client_id": CLIENT_ID,
            "class_date": "2026-04-10",
            "duration_hours": 1.0,
            "hourly_rate": 20.0,
        })

        response = await app_client.get("/api/classes")

        assert response.status_code == 200
        assert len(response.json()) == 1

    async def test_missing_required_fields_returns_422(self, app_client: AsyncClient):
        # Missing client_id and hourly_rate
        response = await app_client.post("/api/classes", json={"class_date": "2026-04-10"})

        assert response.status_code == 422

    async def test_default_status_is_normal(self, app_client: AsyncClient):
        response = await app_client.post("/api/classes", json={
            "client_id": CLIENT_ID,
            "class_date": "2026-04-10",
            "duration_hours": 1.0,
            "hourly_rate": 20.0,
        })

        assert response.status_code == 201
        assert response.json()["status"] == "normal"


# ─── GET /api/classes/{id} ───────────────────────────────────────────────────

class TestGetClass:
    async def test_returns_class_by_id(self, db: AsyncSession, app_client: AsyncClient):
        [cls] = await _seed(db, _class())

        response = await app_client.get(f"/api/classes/{cls.id}")

        assert response.status_code == 200
        assert response.json()["id"] == cls.id

    async def test_returns_404_for_unknown_id(self, app_client: AsyncClient):
        response = await app_client.get("/api/classes/99999")

        assert response.status_code == 404


# ─── PUT /api/classes/{id} ───────────────────────────────────────────────────

class TestUpdateClass:
    async def test_update_returns_200_with_new_values(self, db: AsyncSession, app_client: AsyncClient):
        [cls] = await _seed(db, _class(hourly_rate=20.0))

        response = await app_client.put(f"/api/classes/{cls.id}", json={"hourly_rate": 30.0})

        assert response.status_code == 200
        assert response.json()["hourly_rate"] == 30.0

    async def test_update_recomputes_total_amount(self, db: AsyncSession, app_client: AsyncClient):
        [cls] = await _seed(db, _class(duration_hours=2.0, hourly_rate=20.0))

        response = await app_client.put(f"/api/classes/{cls.id}", json={"hourly_rate": 30.0})

        assert response.status_code == 200
        assert response.json()["total_amount"] == 60.0

    async def test_update_404_for_unknown_class(self, app_client: AsyncClient):
        response = await app_client.put("/api/classes/99999", json={"hourly_rate": 30.0})

        assert response.status_code == 404


# ─── DELETE /api/classes/{id} ────────────────────────────────────────────────

class TestDeleteClass:
    async def test_delete_returns_204(self, db: AsyncSession, app_client: AsyncClient):
        [cls] = await _seed(db, _class())

        response = await app_client.delete(f"/api/classes/{cls.id}")

        assert response.status_code == 204

    async def test_deleted_class_not_in_list(self, db: AsyncSession, app_client: AsyncClient):
        [cls] = await _seed(db, _class())

        await app_client.delete(f"/api/classes/{cls.id}")
        response = await app_client.get("/api/classes")

        assert response.json() == []

    async def test_delete_404_for_unknown_class(self, app_client: AsyncClient):
        response = await app_client.delete("/api/classes/99999")

        assert response.status_code == 404
