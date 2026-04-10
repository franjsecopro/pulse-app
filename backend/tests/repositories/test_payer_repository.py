"""Tests for PayerRepository — client isolation, CRUD."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_identifier import PaymentIdentifier
from app.repositories.payer_repository import PayerRepository
from app.schemas.payment_identifier import PayerCreateRequest, PayerUpdateRequest

CLIENT_A = 10
CLIENT_B = 20


# ─── Helpers ────────────────────────────────────────────────────────────────

def _payer(*, client_id: int = CLIENT_A, name: str = "Transferencia", info: str | None = None) -> PaymentIdentifier:
    return PaymentIdentifier(client_id=client_id, name=name, info=info)


async def _seed(db: AsyncSession, *payers: PaymentIdentifier) -> list[PaymentIdentifier]:
    for p in payers:
        db.add(p)
    await db.commit()
    for p in payers:
        await db.refresh(p)
    return list(payers)


# ─── get_by_client ───────────────────────────────────────────────────────────

class TestGetByClient:
    async def test_returns_payers_for_client(self, db: AsyncSession):
        await _seed(db, _payer(client_id=CLIENT_A), _payer(client_id=CLIENT_A))
        repo = PayerRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 2
        assert all(p.client_id == CLIENT_A for p in results)

    async def test_does_not_return_other_clients_payers(self, db: AsyncSession):
        await _seed(db, _payer(client_id=CLIENT_A), _payer(client_id=CLIENT_B))
        repo = PayerRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 1
        assert results[0].client_id == CLIENT_A

    async def test_returns_empty_for_client_with_no_payers(self, db: AsyncSession):
        repo = PayerRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert results == []


# ─── get_by_id ───────────────────────────────────────────────────────────────

class TestGetById:
    async def test_returns_payer_by_id(self, db: AsyncSession):
        [payer] = await _seed(db, _payer())
        repo = PayerRepository(db)

        found = await repo.get_by_id(payer.id, CLIENT_A)

        assert found is not None
        assert found.id == payer.id

    async def test_returns_none_for_wrong_client(self, db: AsyncSession):
        [payer] = await _seed(db, _payer(client_id=CLIENT_A))
        repo = PayerRepository(db)

        found = await repo.get_by_id(payer.id, CLIENT_B)

        assert found is None

    async def test_returns_none_for_unknown_id(self, db: AsyncSession):
        repo = PayerRepository(db)

        found = await repo.get_by_id(99999, CLIENT_A)

        assert found is None


# ─── create ──────────────────────────────────────────────────────────────────

class TestCreate:
    async def test_create_persists_payer(self, db: AsyncSession):
        repo = PayerRepository(db)
        data = PayerCreateRequest(name="Bizum", info="Referencia 123")

        payer = await repo.create(CLIENT_A, data)

        assert payer.id is not None
        assert payer.client_id == CLIENT_A
        assert payer.name == "Bizum"
        assert payer.info == "Referencia 123"

    async def test_create_without_info(self, db: AsyncSession):
        repo = PayerRepository(db)

        payer = await repo.create(CLIENT_A, PayerCreateRequest(name="Efectivo"))

        assert payer.info is None

    async def test_created_payer_visible_in_get_by_client(self, db: AsyncSession):
        repo = PayerRepository(db)
        await repo.create(CLIENT_A, PayerCreateRequest(name="Transferencia"))

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 1
        assert results[0].name == "Transferencia"


# ─── update ──────────────────────────────────────────────────────────────────

class TestUpdate:
    async def test_update_changes_name(self, db: AsyncSession):
        [payer] = await _seed(db, _payer(name="Viejo"))
        repo = PayerRepository(db)

        updated = await repo.update(payer, PayerUpdateRequest(name="Nuevo"))

        assert updated.name == "Nuevo"

    async def test_update_changes_info(self, db: AsyncSession):
        [payer] = await _seed(db, _payer())
        repo = PayerRepository(db)

        updated = await repo.update(payer, PayerUpdateRequest(info="Nueva info"))

        assert updated.info == "Nueva info"

    async def test_update_ignores_none_fields(self, db: AsyncSession):
        [payer] = await _seed(db, _payer(name="Original", info="Dato"))
        repo = PayerRepository(db)

        updated = await repo.update(payer, PayerUpdateRequest(info="Solo info"))

        assert updated.name == "Original"
        assert updated.info == "Solo info"


# ─── delete ──────────────────────────────────────────────────────────────────

class TestDelete:
    async def test_delete_removes_payer(self, db: AsyncSession):
        [payer] = await _seed(db, _payer())
        repo = PayerRepository(db)

        await repo.delete(payer)
        found = await repo.get_by_id(payer.id, CLIENT_A)

        assert found is None

    async def test_delete_does_not_affect_other_payers(self, db: AsyncSession):
        payer_a, payer_b = await _seed(db, _payer(name="A"), _payer(name="B"))
        repo = PayerRepository(db)

        await repo.delete(payer_a)
        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 1
        assert results[0].name == "B"
