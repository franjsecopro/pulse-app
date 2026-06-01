"""Router-level tests for /api/admin/demo/* endpoints.

Uses admin_client fixture (require_admin overridden to FAKE_ADMIN).
A real demo User is seeded in the DB for each test that needs it.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.client import Client
from tests.conftest import FAKE_ADMIN


DEMO_EMAIL = "demo@pulse.app"


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


def _demo_user() -> User:
    return User(id=999, email=DEMO_EMAIL, role="user", is_demo=True, password_hash="x")


# ── GET /api/admin/demo/status ───────────────────────────────────────────────

class TestDemoStatus:
    async def test_returns_demo_user_id(self, db: AsyncSession, admin_client: AsyncClient):
        [demo] = await _seed(db, _demo_user())

        response = await admin_client.get("/api/admin/demo/status")

        assert response.status_code == 200
        assert response.json()["demo_user_id"] == demo.id

    async def test_returns_500_when_no_demo_user(self, admin_client: AsyncClient):
        # No demo user seeded — should 500
        response = await admin_client.get("/api/admin/demo/status")

        assert response.status_code == 500


# ── POST /api/admin/demo/enter ───────────────────────────────────────────────

class TestDemoEnter:
    async def test_returns_200_with_demo_flags(self, db: AsyncSession, admin_client: AsyncClient):
        await _seed(db, _demo_user())

        response = await admin_client.post("/api/admin/demo/enter")

        assert response.status_code == 200
        body = response.json()
        assert body["is_demo_active"] is True
        assert body["real_email"] == FAKE_ADMIN.email

    async def test_sets_auth_cookies(self, db: AsyncSession, admin_client: AsyncClient):
        await _seed(db, _demo_user())

        response = await admin_client.post("/api/admin/demo/enter")

        assert "access_token" in response.cookies

    async def test_returns_500_when_no_demo_user(self, admin_client: AsyncClient):
        response = await admin_client.post("/api/admin/demo/enter")

        assert response.status_code == 500


# ── POST /api/admin/demo/exit ────────────────────────────────────────────────

class TestDemoExit:
    async def test_returns_200_with_real_user(self, admin_client: AsyncClient):
        response = await admin_client.post("/api/admin/demo/exit")

        assert response.status_code == 200
        body = response.json()
        assert body["is_demo_active"] is False
        assert body["real_email"] is None
        assert body["email"] == FAKE_ADMIN.email

    async def test_sets_auth_cookies(self, admin_client: AsyncClient):
        response = await admin_client.post("/api/admin/demo/exit")

        assert "access_token" in response.cookies


# ── POST /api/admin/demo/reset ───────────────────────────────────────────────

class TestDemoReset:
    async def test_returns_200_with_counts(self, db: AsyncSession, admin_client: AsyncClient):
        await _seed(db, _demo_user())

        response = await admin_client.post("/api/admin/demo/reset")

        assert response.status_code == 200
        body = response.json()
        assert "clients_count" in body
        assert "classes_count" in body
        assert "reseed_at" in body

    async def test_seeds_clients_for_demo_user(self, db: AsyncSession, admin_client: AsyncClient):
        [demo] = await _seed(db, _demo_user())

        await admin_client.post("/api/admin/demo/reset")

        result = await db.execute(
            __import__("sqlalchemy", fromlist=["select"]).select(Client).where(Client.user_id == demo.id)
        )
        clients = result.scalars().all()
        assert len(clients) > 0

    async def test_reset_is_idempotent(self, db: AsyncSession, admin_client: AsyncClient):
        """Two resets produce the same client count."""
        [demo] = await _seed(db, _demo_user())

        await admin_client.post("/api/admin/demo/reset")
        r1 = (await admin_client.post("/api/admin/demo/reset")).json()
        r2 = (await admin_client.post("/api/admin/demo/reset")).json()

        assert r1["clients_count"] == r2["clients_count"]

    async def test_returns_500_when_no_demo_user(self, admin_client: AsyncClient):
        response = await admin_client.post("/api/admin/demo/reset")

        assert response.status_code == 500


# ── GET /api/admin/clients ───────────────────────────────────────────────────

class TestListAllClients:
    async def test_returns_clients_from_all_users(self, db: AsyncSession, admin_client: AsyncClient):
        await _seed(db, User(id=FAKE_ADMIN.id, email=FAKE_ADMIN.email, role="admin", password_hash="x", is_demo=False))
        [demo] = await _seed(db, _demo_user())
        await _seed(db, User(id=99, email="other@test.dev", role="user", password_hash="x", is_demo=False))
        await _seed(db, Client(user_id=FAKE_ADMIN.id, name="Mine", is_active=True))
        await _seed(db, Client(user_id=99, name="Theirs", is_active=True))

        response = await admin_client.get("/api/admin/clients")

        assert response.status_code == 200
        names = [c["name"] for c in response.json()]
        assert "Mine" in names
        assert "Theirs" in names

    async def test_excludes_demo_user_clients(self, db: AsyncSession, admin_client: AsyncClient):
        [demo] = await _seed(db, _demo_user())
        await _seed(db, Client(user_id=demo.id, name="Demo Client", is_active=True))

        response = await admin_client.get("/api/admin/clients")

        names = [c["name"] for c in response.json()]
        assert "Demo Client" not in names
