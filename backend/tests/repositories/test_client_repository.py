"""Tests for ClientRepository — ownership isolation, filtering, and state transitions."""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.repositories.client_repository import ClientRepository
from app.schemas.client import ClientCreateRequest, ClientUpdateRequest

USER_A = 1
USER_B = 2


# ─── Helpers ────────────────────────────────────────────────────────────────

def _client(name: str, *, user_id: int = USER_A, is_active: bool = True, archived: bool = False) -> Client:
    c = Client(
        user_id=user_id,
        name=name,
        is_active=is_active,
        archived_at=datetime.now(timezone.utc) if archived else None,
    )
    return c


async def _seed(db: AsyncSession, *clients: Client) -> list[Client]:
    for c in clients:
        db.add(c)
    await db.commit()
    for c in clients:
        await db.refresh(c)
    return list(clients)


# ─── get_all — deleted_filter ────────────────────────────────────────────────

class TestGetAllDeletedFilter:
    async def test_exclude_hides_archived_clients(self, db: AsyncSession):
        """deleted_filter='exclude' (default) should not return archived clients."""
        active, archived = await _seed(
            db,
            _client("Active"),
            _client("Archived", archived=True),
        )
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, deleted_filter="exclude")

        names = {c.name for c in results}
        assert "Active" in names
        assert "Archived" not in names

    async def test_only_returns_only_archived_clients(self, db: AsyncSession):
        """deleted_filter='only' returns archived clients and nothing else."""
        await _seed(db, _client("Active"), _client("Archived", archived=True))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, deleted_filter="only")

        assert len(results) == 1
        assert results[0].name == "Archived"

    async def test_include_returns_all_clients(self, db: AsyncSession):
        """deleted_filter='include' returns both active and archived clients."""
        await _seed(db, _client("Active"), _client("Archived", archived=True))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, deleted_filter="include")

        assert len(results) == 2

    async def test_exclude_is_the_default_behaviour(self, db: AsyncSession):
        """Calling get_all without deleted_filter should behave like 'exclude'."""
        await _seed(db, _client("Active"), _client("Archived", archived=True))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A)

        assert len(results) == 1
        assert results[0].name == "Active"


# ─── get_all — is_active filter ─────────────────────────────────────────────

class TestGetAllIsActiveFilter:
    async def test_filters_by_active_true(self, db: AsyncSession):
        """is_active=True returns only active clients."""
        await _seed(
            db,
            _client("Active", is_active=True),
            _client("Inactive", is_active=False),
        )
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, is_active=True)

        assert all(c.is_active for c in results)
        assert len(results) == 1

    async def test_filters_by_active_false(self, db: AsyncSession):
        """is_active=False returns only inactive clients."""
        await _seed(
            db,
            _client("Active", is_active=True),
            _client("Inactive", is_active=False),
        )
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, is_active=False)

        assert not any(c.is_active for c in results)
        assert len(results) == 1

    async def test_is_active_filter_ignored_when_deleted_filter_is_only(self, db: AsyncSession):
        """When deleted_filter='only', is_active filter is not applied (archived clients
        are inactive by definition, so filtering would always return empty)."""
        archived_inactive = _client("ArchivedInactive", is_active=False, archived=True)
        await _seed(db, archived_inactive)
        repo = ClientRepository(db)

        # Requesting active=True with deleted_filter='only' — without this exception,
        # the result would be empty even though there IS an archived client.
        results = await repo.get_all(USER_A, deleted_filter="only", is_active=True)

        assert len(results) == 1
        assert results[0].name == "ArchivedInactive"


# ─── get_all — search ───────────────────────────────────────────────────────

class TestGetAllSearch:
    async def test_search_is_case_insensitive(self, db: AsyncSession):
        """Search matches regardless of case."""
        await _seed(db, _client("García López"), _client("Martínez Ruiz"))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, search="garcía")

        assert len(results) == 1
        assert results[0].name == "García López"

    async def test_search_matches_partial_name(self, db: AsyncSession):
        """Search matches a substring anywhere in the name."""
        await _seed(db, _client("Juan García"), _client("María López"))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, search="García")

        assert len(results) == 1

    async def test_search_returns_empty_for_no_match(self, db: AsyncSession):
        """Search returns an empty list when no client matches."""
        await _seed(db, _client("Ana Pérez"))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A, search="nonexistent")

        assert results == []


# ─── get_all — user isolation ────────────────────────────────────────────────

class TestGetAllUserIsolation:
    async def test_only_returns_own_clients(self, db: AsyncSession):
        """A user cannot see another user's clients."""
        await _seed(
            db,
            _client("User A client", user_id=USER_A),
            _client("User B client", user_id=USER_B),
        )
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A)

        assert len(results) == 1
        assert results[0].name == "User A client"

    async def test_returns_empty_for_user_with_no_clients(self, db: AsyncSession):
        """Returns an empty list when the user has no clients at all."""
        await _seed(db, _client("User B client", user_id=USER_B))
        repo = ClientRepository(db)

        results = await repo.get_all(USER_A)

        assert results == []


# ─── get_by_id ───────────────────────────────────────────────────────────────

class TestGetById:
    async def test_returns_client_by_id(self, db: AsyncSession):
        [client] = await _seed(db, _client("Test"))
        repo = ClientRepository(db)

        found = await repo.get_by_id(client.id, USER_A)

        assert found is not None
        assert found.id == client.id

    async def test_returns_none_for_wrong_user(self, db: AsyncSession):
        """Cannot fetch another user's client by ID."""
        [client] = await _seed(db, _client("User A", user_id=USER_A))
        repo = ClientRepository(db)

        found = await repo.get_by_id(client.id, USER_B)

        assert found is None

    async def test_returns_none_for_archived_by_default(self, db: AsyncSession):
        [client] = await _seed(db, _client("Archived", archived=True))
        repo = ClientRepository(db)

        found = await repo.get_by_id(client.id, USER_A)

        assert found is None

    async def test_returns_archived_when_include_deleted_true(self, db: AsyncSession):
        [client] = await _seed(db, _client("Archived", archived=True))
        repo = ClientRepository(db)

        found = await repo.get_by_id(client.id, USER_A, include_deleted=True)

        assert found is not None


# ─── archive / activate ──────────────────────────────────────────────────────

class TestArchiveAndActivate:
    async def test_archive_sets_archived_at_and_deactivates(self, db: AsyncSession):
        [client] = await _seed(db, _client("Client"))
        repo = ClientRepository(db)

        await repo.archive(client)

        assert client.archived_at is not None
        assert client.is_active is False

    async def test_activate_clears_archived_at_and_reactivates(self, db: AsyncSession):
        [client] = await _seed(db, _client("Client", is_active=False, archived=True))
        repo = ClientRepository(db)

        await repo.activate(client)

        assert client.archived_at is None
        assert client.is_active is True

    async def test_archived_client_hidden_after_archive(self, db: AsyncSession):
        """After archiving, get_all(deleted_filter='exclude') no longer returns the client."""
        [client] = await _seed(db, _client("Client"))
        repo = ClientRepository(db)

        await repo.archive(client)
        results = await repo.get_all(USER_A)

        assert results == []


# ─── create ──────────────────────────────────────────────────────────────────

class TestCreate:
    async def test_create_persists_client(self, db: AsyncSession):
        repo = ClientRepository(db)
        data = ClientCreateRequest(name="New Client", is_active=True)

        client = await repo.create(USER_A, data)

        assert client.id is not None
        assert client.name == "New Client"
        assert client.user_id == USER_A

    async def test_created_client_visible_in_get_all(self, db: AsyncSession):
        repo = ClientRepository(db)
        await repo.create(USER_A, ClientCreateRequest(name="New Client", is_active=True))

        results = await repo.get_all(USER_A)

        assert len(results) == 1
        assert results[0].name == "New Client"


# ─── count_active ────────────────────────────────────────────────────────────

class TestCountActive:
    async def test_counts_only_active_non_archived_clients(self, db: AsyncSession):
        await _seed(
            db,
            _client("Active 1"),
            _client("Active 2"),
            _client("Inactive", is_active=False),
            _client("Archived", archived=True),
        )
        repo = ClientRepository(db)

        count = await repo.count_active(USER_A)

        assert count == 2

    async def test_count_is_zero_for_new_user(self, db: AsyncSession):
        repo = ClientRepository(db)

        count = await repo.count_active(USER_A)

        assert count == 0
