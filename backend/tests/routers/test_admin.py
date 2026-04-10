"""Router-level tests for /api/admin.

All admin endpoints are protected by `require_admin`.  Tests use the
`admin_client` fixture (defined in conftest.py) which overrides that
dependency directly — no JWT token needed.

FAKE_ADMIN.id = 1.  The self-referential guards (demotion, self-delete)
are exercised by seeding a User with that same id and sending requests
that target it.

delete_client filters by Client.user_id == admin.id, so client fixtures
are seeded with user_id=FAKE_ADMIN.id.
"""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.user import User
from app.models.google_auth import UserGoogleAuth
from tests.conftest import FAKE_ADMIN


# ─── Helpers ────────────────────────────────────────────────────────────────

async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


def _user(id: int = 2, role: str = "user") -> User:
    return User(id=id, email=f"user{id}@test.dev", role=role, password_hash="x")


def _client(name: str = "Test Client") -> Client:
    return Client(user_id=FAKE_ADMIN.id, name=name, is_active=True)


def _google_auth(user_id: int) -> UserGoogleAuth:
    return UserGoogleAuth(
        user_id=user_id,
        google_email="gcal@gmail.com",
        access_token="tok",
        refresh_token="ref",
        calendar_id="primary",
    )


# ─── GET /api/admin/users ────────────────────────────────────────────────────

class TestListUsers:
    async def test_returns_200_with_list(self, admin_client: AsyncClient):
        response = await admin_client.get("/api/admin/users")

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_returns_seeded_users(self, db: AsyncSession, admin_client: AsyncClient):
        await _seed(db, _user(id=2), _user(id=3))

        response = await admin_client.get("/api/admin/users")

        assert len(response.json()) == 2

    async def test_response_includes_required_fields(self, db: AsyncSession, admin_client: AsyncClient):
        await _seed(db, _user(id=2))

        response = await admin_client.get("/api/admin/users")

        user = response.json()[0]
        assert "id" in user
        assert "email" in user
        assert "role" in user

    async def test_empty_db_returns_empty_list(self, admin_client: AsyncClient):
        response = await admin_client.get("/api/admin/users")

        assert response.json() == []


# ─── PUT /api/admin/users/{id}/role ─────────────────────────────────────────

class TestSetUserRole:
    async def test_returns_400_for_invalid_role(self, db: AsyncSession, admin_client: AsyncClient):
        [user] = await _seed(db, _user(id=2))

        response = await admin_client.put(
            f"/api/admin/users/{user.id}/role", params={"role": "superadmin"}
        )

        assert response.status_code == 400

    async def test_returns_404_for_unknown_user(self, admin_client: AsyncClient):
        response = await admin_client.put(
            "/api/admin/users/99999/role", params={"role": "user"}
        )

        assert response.status_code == 404

    async def test_returns_400_when_demoting_self(self, db: AsyncSession, admin_client: AsyncClient):
        """Admin cannot demote themselves — guard uses admin.id == user.id."""
        # Seed the admin's own User record so the lookup doesn't return 404 first
        await _seed(db, User(id=FAKE_ADMIN.id, email=FAKE_ADMIN.email, role="admin", password_hash="x"))

        response = await admin_client.put(
            f"/api/admin/users/{FAKE_ADMIN.id}/role", params={"role": "user"}
        )

        assert response.status_code == 400
        assert "admin" in response.json()["detail"].lower()

    async def test_changes_role_to_admin_successfully(self, db: AsyncSession, admin_client: AsyncClient):
        [user] = await _seed(db, _user(id=2, role="user"))

        response = await admin_client.put(
            f"/api/admin/users/{user.id}/role", params={"role": "admin"}
        )

        assert response.status_code == 200
        assert response.json()["role"] == "admin"

    async def test_changes_role_to_user_successfully(self, db: AsyncSession, admin_client: AsyncClient):
        [user] = await _seed(db, _user(id=2, role="admin"))

        response = await admin_client.put(
            f"/api/admin/users/{user.id}/role", params={"role": "user"}
        )

        assert response.status_code == 200
        assert response.json()["role"] == "user"


# ─── DELETE /api/admin/users/{id} ───────────────────────────────────────────

class TestDeleteUser:
    async def test_returns_404_for_unknown_user(self, admin_client: AsyncClient):
        response = await admin_client.delete("/api/admin/users/99999")

        assert response.status_code == 404

    async def test_returns_400_when_deleting_self(self, db: AsyncSession, admin_client: AsyncClient):
        """Admin cannot delete their own account."""
        await _seed(db, User(id=FAKE_ADMIN.id, email=FAKE_ADMIN.email, role="admin", password_hash="x"))

        response = await admin_client.delete(f"/api/admin/users/{FAKE_ADMIN.id}")

        assert response.status_code == 400

    async def test_deletes_user_and_returns_200(self, db: AsyncSession, admin_client: AsyncClient):
        [user] = await _seed(db, _user(id=2))

        response = await admin_client.delete(f"/api/admin/users/{user.id}")

        assert response.status_code == 200
        body = response.json()
        assert body["deleted"] == user.id
        assert "email" in body

    async def test_deleted_user_absent_from_list(self, db: AsyncSession, admin_client: AsyncClient):
        [user] = await _seed(db, _user(id=2))

        await admin_client.delete(f"/api/admin/users/{user.id}")
        response = await admin_client.get("/api/admin/users")

        assert not any(u["id"] == user.id for u in response.json())


# ─── DELETE /api/admin/clients/{id} ─────────────────────────────────────────

class TestDeleteClient:
    async def test_returns_404_for_unknown_client(self, admin_client: AsyncClient):
        response = await admin_client.delete("/api/admin/clients/99999")

        assert response.status_code == 404

    async def test_deletes_client_and_returns_200(self, db: AsyncSession, admin_client: AsyncClient):
        [client] = await _seed(db, _client(name="Carlos"))

        response = await admin_client.delete(f"/api/admin/clients/{client.id}")

        assert response.status_code == 200
        body = response.json()
        assert body["deleted"] == client.id
        assert body["name"] == "Carlos"

    async def test_second_delete_returns_404(self, db: AsyncSession, admin_client: AsyncClient):
        """Hard-delete: the client is gone after the first request."""
        [client] = await _seed(db, _client())

        await admin_client.delete(f"/api/admin/clients/{client.id}")
        response = await admin_client.delete(f"/api/admin/clients/{client.id}")

        assert response.status_code == 404

    async def test_returns_404_for_other_users_client(self, db: AsyncSession, admin_client: AsyncClient):
        """Client belonging to a different user_id must not be deleted."""
        [client] = await _seed(db, Client(user_id=FAKE_ADMIN.id + 999, name="Ajeno", is_active=True))

        response = await admin_client.delete(f"/api/admin/clients/{client.id}")

        assert response.status_code == 404


# ─── POST /api/admin/users/{id}/sync-gcal ───────────────────────────────────

class TestForceSyncGCal:
    async def test_returns_404_for_unknown_user(self, admin_client: AsyncClient):
        response = await admin_client.post("/api/admin/users/99999/sync-gcal")

        assert response.status_code == 404

    async def test_returns_400_when_user_has_no_google_auth(
        self, db: AsyncSession, admin_client: AsyncClient
    ):
        [user] = await _seed(db, _user(id=2))

        response = await admin_client.post(f"/api/admin/users/{user.id}/sync-gcal")

        assert response.status_code == 400
        assert "Google Calendar" in response.json()["detail"]

    async def test_returns_200_with_scheduled_count_when_no_future_classes(
        self, db: AsyncSession, admin_client: AsyncClient
    ):
        """User has Google auth but no future classes → scheduled=0."""
        [user] = await _seed(db, _user(id=2))
        await _seed(db, _google_auth(user_id=user.id))

        response = await admin_client.post(f"/api/admin/users/{user.id}/sync-gcal")

        assert response.status_code == 200
        body = response.json()
        assert "scheduled" in body
        assert body["scheduled"] == 0
        assert body["user_id"] == user.id
