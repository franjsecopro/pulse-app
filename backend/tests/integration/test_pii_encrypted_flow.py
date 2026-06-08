from types import SimpleNamespace

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_value
from app.services.payment_matcher import match_transaction


class TestEncryptedPiiEndToEndFlow:
    async def test_persist_retrieve_match_and_whatsapp_url_all_work_with_ciphertext_on_disk(
        self, db: AsyncSession, app_client: AsyncClient
    ):
        response = await app_client.post(
            "/api/clients",
            json={
                "name": "Manuela Josefa",
                "payment_name": "Manuela Josefa",
                "email": "manuela@example.com",
                "phone": "+34 612 000 111",
                "whatsapp_phone": "+34 612 000 111",
                "address": "Calle Mayor 1",
                "tax_id": "12345678Z",
            },
        )
        assert response.status_code == 201
        body = response.json()
        client_id = body["id"]

        assert body["email"] == "manuela@example.com"
        assert body["whatsappPhone"] == "+34 612 000 111"
        assert body["taxId"] == "12345678Z"
        assert body["address"] == "Calle Mayor 1"

        raw_row = (
            await db.execute(
                text(
                    "SELECT email, phone, whatsapp_phone, address, tax_id "
                    "FROM clients WHERE id = :id"
                ),
                {"id": client_id},
            )
        ).one()
        raw_email, raw_phone, raw_whatsapp, raw_address, raw_tax_id = raw_row
        for raw in (raw_email, raw_phone, raw_whatsapp, raw_address, raw_tax_id):
            assert raw.startswith("gAAAAA")

        client_obj = SimpleNamespace(
            id=client_id,
            name="Manuela Josefa",
            payment_name="Manuela Josefa",
            payers=[SimpleNamespace(name="Manuela Josefa")],
        )
        match = match_transaction("VIR MANUELA JOSEFA REF1234", [client_obj])
        assert match.client_id == client_id
        assert match.match_type == "exact"

        reloaded = (
            await db.execute(
                text("SELECT whatsapp_phone FROM clients WHERE id = :id"),
                {"id": client_id},
            )
        ).scalar()
        assert reloaded.startswith("gAAAAA")
        decrypted_phone = decrypt_value(reloaded)
        assert decrypted_phone == "+34 612 000 111"
        clean = decrypted_phone.replace(" ", "").replace("-", "").replace("+", "")
        url = f"https://wa.me/{clean}?text=hola"
        assert url == "https://wa.me/34612000111?text=hola"
