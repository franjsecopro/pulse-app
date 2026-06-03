"""Router tests for /api/business-profile and client tax_id groundwork."""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestBusinessProfile:
    async def test_get_returns_empty_when_not_set(self, app_client: AsyncClient):
        response = await app_client.get("/api/business-profile")

        assert response.status_code == 200
        body = response.json()
        assert body["business_name"] is None
        assert body["tax_id"] is None
        assert body["fiscal_address"] is None

    async def test_put_creates_profile(self, app_client: AsyncClient):
        response = await app_client.put("/api/business-profile", json={
            "business_name": "Profe Pulse SL",
            "tax_id": "B12345678",
            "fiscal_address": "Calle Falsa 123",
        })

        assert response.status_code == 200
        assert response.json()["business_name"] == "Profe Pulse SL"
        assert response.json()["tax_id"] == "B12345678"

    async def test_put_then_get_persists(self, app_client: AsyncClient):
        await app_client.put("/api/business-profile", json={"tax_id": "X9999"})

        response = await app_client.get("/api/business-profile")

        assert response.json()["tax_id"] == "X9999"

    async def test_put_updates_existing_profile(self, app_client: AsyncClient):
        await app_client.put("/api/business-profile", json={"business_name": "Antes"})
        await app_client.put("/api/business-profile", json={"business_name": "Después"})

        response = await app_client.get("/api/business-profile")

        assert response.json()["business_name"] == "Después"


class TestClientTaxId:
    async def test_create_client_with_tax_id(self, db: AsyncSession, app_client: AsyncClient):
        response = await app_client.post("/api/clients", json={
            "name": "Cliente con NIF",
            "tax_id": "12345678Z",
        })

        assert response.status_code == 201
        assert response.json()["tax_id"] == "12345678Z"
