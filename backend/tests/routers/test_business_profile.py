"""Router tests for /api/business-profile and client tax_id groundwork."""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestBusinessProfile:
    async def test_get_returns_empty_when_not_set(self, app_client: AsyncClient):
        response = await app_client.get("/api/business-profile")

        assert response.status_code == 200
        body = response.json()
        assert body["businessName"] is None
        assert body["taxId"] is None
        assert body["fiscalAddress"] is None

    async def test_put_creates_profile(self, app_client: AsyncClient):
        response = await app_client.put("/api/business-profile", json={
            "businessName": "Profe Pulse SL",
            "taxId": "B12345678",
            "fiscalAddress": "Calle Falsa 123",
        })

        assert response.status_code == 200
        assert response.json()["businessName"] == "Profe Pulse SL"
        assert response.json()["taxId"] == "B12345678"

    async def test_put_then_get_persists(self, app_client: AsyncClient):
        await app_client.put("/api/business-profile", json={"taxId": "X9999"})

        response = await app_client.get("/api/business-profile")

        assert response.json()["taxId"] == "X9999"

    async def test_put_updates_existing_profile(self, app_client: AsyncClient):
        await app_client.put("/api/business-profile", json={"businessName": "Antes"})
        await app_client.put("/api/business-profile", json={"businessName": "Después"})

        response = await app_client.get("/api/business-profile")

        assert response.json()["businessName"] == "Después"

    async def test_put_persists_french_invoicing_fields(self, app_client: AsyncClient):
        await app_client.put(
            "/api/business-profile",
            json={
                "businessName": "Jean Dupont",
                "siret": "12345678900012",
                "phone": "+33612345678",
                "email": "facturas@dupont.fr",
                "iban": "FR7612345",
                "bic": "ABCDEFGH",
                "rcsDispense": True,
                "vatExempt": False,
                "paymentConditions": "Virement bancaire",
                "invoiceNumberFormat": "YYYY-NNNN",
                "invoiceSequenceScope": "annual",
            },
        )

        body = (await app_client.get("/api/business-profile")).json()

        assert body["siret"] == "12345678900012"
        assert body["iban"] == "FR7612345"
        assert body["rcsDispense"] is True
        assert body["vatExempt"] is False
        assert body["invoiceNumberFormat"] == "YYYY-NNNN"
        assert body["invoiceSequenceScope"] == "annual"

    async def test_get_returns_invoicing_defaults_when_not_set(self, app_client: AsyncClient):
        body = (await app_client.get("/api/business-profile")).json()

        assert body["vatExempt"] is True
        assert body["rcsDispense"] is False
        assert body["invoiceSequenceScope"] == "monthly"

    async def test_put_persists_analytics_config_fields(self, app_client: AsyncClient):
        await app_client.put(
            "/api/business-profile",
            json={
                "socialChargeRate": 22.0,
                "incomeTaxRate": 2.2,
                "monthlyIncomeGoal": 3000.0,
            },
        )

        body = (await app_client.get("/api/business-profile")).json()

        assert body["socialChargeRate"] == 22.0
        assert body["incomeTaxRate"] == 2.2
        assert body["monthlyIncomeGoal"] == 3000.0

    async def test_get_returns_null_analytics_config_when_not_set(self, app_client: AsyncClient):
        body = (await app_client.get("/api/business-profile")).json()

        assert body["socialChargeRate"] is None
        assert body["incomeTaxRate"] is None
        assert body["monthlyIncomeGoal"] is None


class TestClientTaxId:
    async def test_create_client_with_tax_id(self, db: AsyncSession, app_client: AsyncClient):
        response = await app_client.post("/api/clients", json={
            "name": "Cliente con NIF",
            "taxId": "12345678Z",
        })

        assert response.status_code == 201
        assert response.json()["taxId"] == "12345678Z"
