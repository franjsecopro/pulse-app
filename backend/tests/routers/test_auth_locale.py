"""Router tests for the i18n locale preference on /api/auth/me."""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class TestAuthLocale:
    async def test_me_includes_locale(self, app_client: AsyncClient):
        response = await app_client.get("/api/auth/me")

        assert response.status_code == 200
        assert response.json()["locale"] == "es-ES"

    async def test_patch_updates_locale(self, db: AsyncSession, app_client: AsyncClient):
        db.add(User(id=1, email="test@pulse.dev", role="user", password_hash="x", locale="es-ES"))
        await db.commit()

        response = await app_client.patch("/api/auth/me", json={"locale": "fr-FR"})

        assert response.status_code == 200
        assert response.json()["locale"] == "fr-FR"

    async def test_patch_persists_locale(self, db: AsyncSession, app_client: AsyncClient):
        db.add(User(id=1, email="test@pulse.dev", role="user", password_hash="x", locale="es-ES"))
        await db.commit()

        await app_client.patch("/api/auth/me", json={"locale": "fr-FR"})
        persisted = await db.get(User, 1)

        assert persisted.locale == "fr-FR"

    async def test_patch_rejects_invalid_locale(self, db: AsyncSession, app_client: AsyncClient):
        db.add(User(id=1, email="test@pulse.dev", role="user", password_hash="x", locale="es-ES"))
        await db.commit()

        response = await app_client.patch("/api/auth/me", json={"locale": "de-DE"})

        assert response.status_code == 422

    async def test_patch_returns_404_when_user_row_missing(self, app_client: AsyncClient):
        # No user row seeded: the authenticated identity has no persisted row
        # (e.g. deleted between token issuance and the request).
        response = await app_client.patch("/api/auth/me", json={"locale": "fr-FR"})

        assert response.status_code == 404
