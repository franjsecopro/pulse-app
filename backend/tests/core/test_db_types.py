from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from tests.conftest import FAKE_USER


class TestClientEmailEncryption:
    async def test_email_attribute_returns_plaintext_after_commit(
        self, db: AsyncSession
    ):
        plain = "cliente@example.com"
        c = Client(user_id=FAKE_USER.id, name="Test", email=plain)
        db.add(c)
        await db.commit()
        await db.refresh(c)

        assert c.email == plain

    async def test_raw_db_row_holds_ciphertext_not_plaintext(
        self, db: AsyncSession
    ):
        plain = "cliente@example.com"
        c = Client(user_id=FAKE_USER.id, name="Test", email=plain)
        db.add(c)
        await db.commit()
        await db.refresh(c)

        raw = (
            await db.execute(
                text("SELECT email FROM clients WHERE id = :id"),
                {"id": c.id},
            )
        ).scalar()

        assert raw is not None
        assert raw != plain
        assert raw.startswith("gAAAAA")

    async def test_none_email_persists_as_null(self, db: AsyncSession):
        c = Client(user_id=FAKE_USER.id, name="Test", email=None)
        db.add(c)
        await db.commit()
        await db.refresh(c)

        assert c.email is None
        raw = (
            await db.execute(
                text("SELECT email FROM clients WHERE id = :id"),
                {"id": c.id},
            )
        ).scalar()
        assert raw is None


class TestLongPiiValues:
    async def test_500_char_address_round_trips_through_orm(self, db: AsyncSession):
        long_address = "Calle Falsa 123, Piso 4, Depto B, Barrio Centro, " * 8
        c = Client(user_id=FAKE_USER.id, name="Test", address=long_address)
        db.add(c)
        await db.commit()
        await db.refresh(c)

        assert c.address == long_address

        raw = (
            await db.execute(
                text("SELECT address FROM clients WHERE id = :id"),
                {"id": c.id},
            )
        ).scalar()
        assert raw is not None
        assert raw.startswith("gAAAAA")
        assert len(raw) > len(long_address)


class TestCiphertextRandomizedPerRow:
    async def test_same_plaintext_in_two_rows_yields_different_ciphertext(
        self, db: AsyncSession
    ):
        plain = "duplicate@example.com"
        c1 = Client(user_id=FAKE_USER.id, name="A", email=plain)
        c2 = Client(user_id=FAKE_USER.id, name="B", email=plain)
        db.add_all([c1, c2])
        await db.commit()
        await db.refresh(c1)
        await db.refresh(c2)

        assert c1.email == c2.email == plain

        rows = (
            await db.execute(
                text(
                    "SELECT id, email FROM clients WHERE id IN (:a, :b) "
                    "ORDER BY id"
                ),
                {"a": c1.id, "b": c2.id},
            )
        ).all()
        ciphertexts = {row[0]: row[1] for row in rows}
        assert ciphertexts[c1.id] != ciphertexts[c2.id]
        assert ciphertexts[c1.id].startswith("gAAAAA")
        assert ciphertexts[c2.id].startswith("gAAAAA")
