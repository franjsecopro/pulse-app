"""Router-level tests for /api/clients.

These tests hit the full FastAPI request/response cycle — routing, serialization,
status codes, and error handling — without making real DB or auth calls.

Fixtures (from conftest):
  db          — in-memory SQLite session (schema created fresh per test)
  app_client  — httpx AsyncClient with get_db + get_current_user overridden
"""
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from tests.conftest import FAKE_USER


# ─── Helpers ────────────────────────────────────────────────────────────────

def _client(name: str, *, is_active: bool = True, archived: bool = False) -> Client:
    return Client(
        user_id=FAKE_USER.id,
        name=name,
        is_active=is_active,
        archived_at=datetime.now(timezone.utc) if archived else None,
    )


async def _seed(db: AsyncSession, *clients: Client) -> list[Client]:
    for c in clients:
        db.add(c)
    await db.commit()
    for c in clients:
        await db.refresh(c)
    return list(clients)


# ─── GET /api/clients ────────────────────────────────────────────────────────

class TestListClients:
    async def test_returns_200_with_empty_list(self, app_client: AsyncClient):
        response = await app_client.get("/api/clients")

        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_active_clients(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _client("Ana García"), _client("Luis Pérez"))

        response = await app_client.get("/api/clients")

        assert response.status_code == 200
        names = {c["name"] for c in response.json()}
        assert names == {"Ana García", "Luis Pérez"}

    async def test_excludes_archived_by_default(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _client("Active"), _client("Archived", archived=True))

        response = await app_client.get("/api/clients")

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Active"

    async def test_deleted_filter_only_returns_archived(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _client("Active"), _client("Archived", archived=True))

        response = await app_client.get("/api/clients", params={"deleted_filter": "only"})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Archived"

    async def test_deleted_filter_include_returns_all(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _client("Active"), _client("Archived", archived=True))

        response = await app_client.get("/api/clients", params={"deleted_filter": "include"})

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_search_filters_by_name(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _client("García López"), _client("Martínez Ruiz"))

        response = await app_client.get("/api/clients", params={"search": "garcía"})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "García López"

    async def test_is_active_filter(self, db: AsyncSession, app_client: AsyncClient):
        await _seed(db, _client("Active", is_active=True), _client("Inactive", is_active=False))

        response = await app_client.get("/api/clients", params={"is_active": "false"})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Inactive"


# ─── POST /api/clients ───────────────────────────────────────────────────────

class TestCreateClient:
    async def test_creates_client_and_returns_201(self, app_client: AsyncClient):
        response = await app_client.post("/api/clients", json={"name": "New Client", "is_active": True})

        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "New Client"
        assert body["id"] is not None

    async def test_created_client_appears_in_list(self, app_client: AsyncClient):
        await app_client.post("/api/clients", json={"name": "Persisted", "is_active": True})

        response = await app_client.get("/api/clients")

        assert response.status_code == 200
        assert any(c["name"] == "Persisted" for c in response.json())

    async def test_missing_name_returns_422(self, app_client: AsyncClient):
        response = await app_client.post("/api/clients", json={"is_active": True})

        assert response.status_code == 422


# ─── GET /api/clients/{id} ───────────────────────────────────────────────────

class TestGetClient:
    async def test_returns_client_by_id(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Target"))

        response = await app_client.get(f"/api/clients/{client.id}")

        assert response.status_code == 200
        assert response.json()["id"] == client.id

    async def test_returns_404_for_unknown_id(self, app_client: AsyncClient):
        response = await app_client.get("/api/clients/99999")

        assert response.status_code == 404

    async def test_returns_404_for_archived_client_by_default(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Archived", archived=True))

        response = await app_client.get(f"/api/clients/{client.id}")

        assert response.status_code == 404

    async def test_returns_archived_with_allow_deleted_flag(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Archived", archived=True))

        response = await app_client.get(f"/api/clients/{client.id}", params={"allow_deleted": "true"})

        assert response.status_code == 200
        assert response.json()["id"] == client.id


# ─── POST /api/clients/{id}/archive ─────────────────────────────────────────

class TestArchiveClient:
    async def test_archive_returns_204(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Client"))

        response = await app_client.post(f"/api/clients/{client.id}/archive")

        assert response.status_code == 204

    async def test_archived_client_no_longer_in_default_list(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Client"))

        await app_client.post(f"/api/clients/{client.id}/archive")
        response = await app_client.get("/api/clients")

        assert response.status_code == 200
        assert not any(c["id"] == client.id for c in response.json())

    async def test_archive_404_for_unknown_client(self, app_client: AsyncClient):
        response = await app_client.post("/api/clients/99999/archive")

        assert response.status_code == 404


# ─── POST /api/clients/{id}/activate ────────────────────────────────────────

class TestActivateClient:
    async def test_activate_returns_204(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Archived", is_active=False, archived=True))

        response = await app_client.post(f"/api/clients/{client.id}/activate")

        assert response.status_code == 204

    async def test_activated_client_appears_in_default_list(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Archived", is_active=False, archived=True))

        await app_client.post(f"/api/clients/{client.id}/activate")
        response = await app_client.get("/api/clients")

        assert response.status_code == 200
        assert any(c["id"] == client.id for c in response.json())

    async def test_activate_404_for_unknown_client(self, app_client: AsyncClient):
        response = await app_client.post("/api/clients/99999/activate")

        assert response.status_code == 404


# ─── PUT /api/clients/{id} ───────────────────────────────────────────────────

class TestUpdateClient:
    async def test_update_returns_200_with_new_values(self, db: AsyncSession, app_client: AsyncClient):
        [client] = await _seed(db, _client("Original"))

        response = await app_client.put(f"/api/clients/{client.id}", json={"name": "Updated"})

        assert response.status_code == 200
        assert response.json()["name"] == "Updated"

    async def test_update_404_for_unknown_client(self, app_client: AsyncClient):
        response = await app_client.put("/api/clients/99999", json={"name": "X"})

        assert response.status_code == 404
