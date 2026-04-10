"""Tests for ContractRepository — soft-delete, client isolation, ordering."""
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.repositories.contract_repository import ContractRepository
from app.schemas.contract import ContractCreateRequest, ContractUpdateRequest

CLIENT_A = 10
CLIENT_B = 20


# ─── Helpers ────────────────────────────────────────────────────────────────

def _contract(
    *,
    client_id: int = CLIENT_A,
    description: str = "Contrato test",
    start_date: str = "2026-01-01",
    hourly_rate: float = 20.0,
    is_active: bool = True,
) -> Contract:
    return Contract(
        client_id=client_id,
        description=description,
        start_date=date.fromisoformat(start_date),
        hourly_rate=hourly_rate,
        is_active=is_active,
    )


async def _seed(db: AsyncSession, *contracts: Contract) -> list[Contract]:
    for c in contracts:
        db.add(c)
    await db.commit()
    for c in contracts:
        await db.refresh(c)
    return list(contracts)


# ─── get_by_client ───────────────────────────────────────────────────────────

class TestGetByClient:
    async def test_returns_contracts_for_client(self, db: AsyncSession):
        await _seed(db, _contract(client_id=CLIENT_A), _contract(client_id=CLIENT_A))
        repo = ContractRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 2
        assert all(c.client_id == CLIENT_A for c in results)

    async def test_does_not_return_other_clients_contracts(self, db: AsyncSession):
        await _seed(
            db,
            _contract(client_id=CLIENT_A),
            _contract(client_id=CLIENT_B),
        )
        repo = ContractRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 1

    async def test_excludes_soft_deleted_contracts(self, db: AsyncSession):
        active, deleted = await _seed(
            db,
            _contract(description="Activo"),
            _contract(description="Eliminado"),
        )
        repo = ContractRepository(db)
        await repo.soft_delete(deleted)

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 1
        assert results[0].description == "Activo"

    async def test_returns_empty_when_all_contracts_deleted(self, db: AsyncSession):
        [contract] = await _seed(db, _contract())
        repo = ContractRepository(db)
        await repo.soft_delete(contract)

        results = await repo.get_by_client(CLIENT_A)

        assert results == []

    async def test_orders_by_start_date_descending(self, db: AsyncSession):
        await _seed(
            db,
            _contract(start_date="2025-01-01", description="Primero"),
            _contract(start_date="2026-06-01", description="Tercero"),
            _contract(start_date="2026-01-01", description="Segundo"),
        )
        repo = ContractRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert results[0].description == "Tercero"
        assert results[1].description == "Segundo"
        assert results[2].description == "Primero"

    async def test_returns_empty_for_client_with_no_contracts(self, db: AsyncSession):
        repo = ContractRepository(db)

        results = await repo.get_by_client(CLIENT_A)

        assert results == []


# ─── get_by_id ───────────────────────────────────────────────────────────────

class TestGetById:
    async def test_returns_contract_by_id(self, db: AsyncSession):
        [contract] = await _seed(db, _contract())
        repo = ContractRepository(db)

        found = await repo.get_by_id(contract.id, CLIENT_A)

        assert found is not None
        assert found.id == contract.id

    async def test_returns_none_for_wrong_client(self, db: AsyncSession):
        [contract] = await _seed(db, _contract(client_id=CLIENT_A))
        repo = ContractRepository(db)

        found = await repo.get_by_id(contract.id, CLIENT_B)

        assert found is None

    async def test_returns_none_for_soft_deleted_contract(self, db: AsyncSession):
        [contract] = await _seed(db, _contract())
        repo = ContractRepository(db)
        await repo.soft_delete(contract)

        found = await repo.get_by_id(contract.id, CLIENT_A)

        assert found is None

    async def test_returns_none_for_unknown_id(self, db: AsyncSession):
        repo = ContractRepository(db)

        found = await repo.get_by_id(99999, CLIENT_A)

        assert found is None


# ─── create ──────────────────────────────────────────────────────────────────

class TestCreate:
    async def test_create_persists_contract(self, db: AsyncSession):
        repo = ContractRepository(db)
        data = ContractCreateRequest(
            description="Inglés avanzado",
            start_date=date(2026, 1, 1),
            hourly_rate=25.0,
        )

        contract = await repo.create(CLIENT_A, data)

        assert contract.id is not None
        assert contract.client_id == CLIENT_A
        assert contract.description == "Inglés avanzado"
        assert contract.hourly_rate == 25.0

    async def test_created_contract_visible_in_get_by_client(self, db: AsyncSession):
        repo = ContractRepository(db)
        await repo.create(CLIENT_A, ContractCreateRequest(
            description="Francés",
            start_date=date(2026, 1, 1),
            hourly_rate=30.0,
        ))

        results = await repo.get_by_client(CLIENT_A)

        assert len(results) == 1
        assert results[0].description == "Francés"

    async def test_deleted_at_is_none_on_creation(self, db: AsyncSession):
        repo = ContractRepository(db)
        contract = await repo.create(CLIENT_A, ContractCreateRequest(
            description="Test",
            start_date=date(2026, 1, 1),
            hourly_rate=20.0,
        ))

        assert contract.deleted_at is None


# ─── update ──────────────────────────────────────────────────────────────────

class TestUpdate:
    async def test_update_changes_hourly_rate(self, db: AsyncSession):
        [contract] = await _seed(db, _contract(hourly_rate=20.0))
        repo = ContractRepository(db)

        updated = await repo.update(contract, ContractUpdateRequest(hourly_rate=35.0))

        assert updated.hourly_rate == 35.0

    async def test_update_changes_description(self, db: AsyncSession):
        [contract] = await _seed(db, _contract(description="Original"))
        repo = ContractRepository(db)

        updated = await repo.update(contract, ContractUpdateRequest(description="Actualizado"))

        assert updated.description == "Actualizado"

    async def test_update_can_deactivate_contract(self, db: AsyncSession):
        [contract] = await _seed(db, _contract(is_active=True))
        repo = ContractRepository(db)

        updated = await repo.update(contract, ContractUpdateRequest(is_active=False))

        assert updated.is_active is False


# ─── soft_delete ─────────────────────────────────────────────────────────────

class TestSoftDelete:
    async def test_soft_delete_sets_deleted_at(self, db: AsyncSession):
        [contract] = await _seed(db, _contract())
        repo = ContractRepository(db)

        await repo.soft_delete(contract)

        assert contract.deleted_at is not None

    async def test_soft_delete_deactivates_contract(self, db: AsyncSession):
        [contract] = await _seed(db, _contract(is_active=True))
        repo = ContractRepository(db)

        await repo.soft_delete(contract)

        assert contract.is_active is False

    async def test_soft_deleted_contract_hidden_from_get_by_client(self, db: AsyncSession):
        [contract] = await _seed(db, _contract())
        repo = ContractRepository(db)

        await repo.soft_delete(contract)
        results = await repo.get_by_client(CLIENT_A)

        assert results == []

    async def test_soft_deleted_contract_hidden_from_get_by_id(self, db: AsyncSession):
        [contract] = await _seed(db, _contract())
        repo = ContractRepository(db)

        await repo.soft_delete(contract)
        found = await repo.get_by_id(contract.id, CLIENT_A)

        assert found is None
