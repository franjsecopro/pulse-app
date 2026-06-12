"""Tests for class_calendar_service — the Google Calendar background sync.

The contract under test: sync functions are NON-THROWING (a Calendar failure
must never break class CRUD), they skip silently when the user has no Google
connection, and a successful create persists the event id on the class.

google_calendar_service calls are monkeypatched — no network. The service
opens its own session (background task), so AsyncSessionLocal is patched to
hand back the shared test session.
"""
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.google_auth import UserGoogleAuth
from app.services import class_calendar_service as ccs

USER_ID = 1


class _SharedSessionCtx:
    """Async context manager that yields the test session without closing it."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *exc_info) -> bool:
        return False


@pytest.fixture
def shared_session(db: AsyncSession, monkeypatch) -> AsyncSession:
    monkeypatch.setattr(ccs, "AsyncSessionLocal", lambda: _SharedSessionCtx(db))
    return db


@pytest.fixture
def fast_retries(monkeypatch):
    """Zero out the backoff delays so failure-path tests stay fast."""
    monkeypatch.setattr(ccs, "RETRY_DELAYS", (0.0, 0.0))


def _class(**overrides) -> Class:
    defaults = dict(
        user_id=USER_ID,
        client_id=42,
        contract_id=1,
        class_date=date(2026, 4, 10),
        duration_hours=1.0,
        hourly_rate=20.0,
    )
    return Class(**{**defaults, **overrides})


def _google_auth() -> UserGoogleAuth:
    return UserGoogleAuth(
        user_id=USER_ID,
        google_email="user@gmail.com",
        access_token="encrypted-access",
        refresh_token="encrypted-refresh",
        calendar_id="primary",
    )


async def _seed(db: AsyncSession, *objects) -> list:
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return list(objects)


# ─── sync_create ─────────────────────────────────────────────────────────────

class TestSyncCreate:
    async def test_persists_event_id_on_success(self, shared_session, monkeypatch):
        [cls, _] = await _seed(shared_session, _class(), _google_auth())

        async def fake_create_event(**kwargs):
            return "evt-123"

        monkeypatch.setattr(ccs.gc_service, "create_event", fake_create_event)

        await ccs.sync_create(cls.id, USER_ID)

        await shared_session.refresh(cls)
        assert cls.google_calendar_id == "evt-123"

    async def test_skips_when_user_has_no_google_connection(self, shared_session, monkeypatch):
        [cls] = await _seed(shared_session, _class())
        calls = []

        async def fake_create_event(**kwargs):
            calls.append(kwargs)
            return "evt-123"

        monkeypatch.setattr(ccs.gc_service, "create_event", fake_create_event)

        await ccs.sync_create(cls.id, USER_ID)

        assert calls == []
        await shared_session.refresh(cls)
        assert cls.google_calendar_id is None

    async def test_skips_when_class_does_not_exist(self, shared_session, monkeypatch):
        await _seed(shared_session, _google_auth())
        calls = []

        async def fake_create_event(**kwargs):
            calls.append(kwargs)
            return "evt-123"

        monkeypatch.setattr(ccs.gc_service, "create_event", fake_create_event)

        await ccs.sync_create(99999, USER_ID)

        assert calls == []

    async def test_google_api_failure_does_not_propagate(
        self, shared_session, monkeypatch, fast_retries
    ):
        [cls, _] = await _seed(shared_session, _class(), _google_auth())

        async def failing_create_event(**kwargs):
            raise RuntimeError("Google API down")

        monkeypatch.setattr(ccs.gc_service, "create_event", failing_create_event)

        await ccs.sync_create(cls.id, USER_ID)  # must not raise

        await shared_session.refresh(cls)
        assert cls.google_calendar_id is None


# ─── sync_update ─────────────────────────────────────────────────────────────

class TestSyncUpdate:
    async def test_updates_existing_event(self, shared_session, monkeypatch):
        [cls, _] = await _seed(
            shared_session, _class(google_calendar_id="evt-old"), _google_auth()
        )
        updated = []

        async def fake_update_event(**kwargs):
            updated.append(kwargs["google_event_id"])

        monkeypatch.setattr(ccs.gc_service, "update_event", fake_update_event)

        await ccs.sync_update(cls.id, USER_ID, "evt-old")

        assert updated == ["evt-old"]

    async def test_creates_event_when_class_has_none_yet(self, shared_session, monkeypatch):
        [cls, _] = await _seed(shared_session, _class(), _google_auth())

        async def fake_create_event(**kwargs):
            return "evt-new"

        monkeypatch.setattr(ccs.gc_service, "create_event", fake_create_event)

        await ccs.sync_update(cls.id, USER_ID, None)

        await shared_session.refresh(cls)
        assert cls.google_calendar_id == "evt-new"

    async def test_google_api_failure_does_not_propagate(
        self, shared_session, monkeypatch, fast_retries
    ):
        [cls, _] = await _seed(
            shared_session, _class(google_calendar_id="evt-old"), _google_auth()
        )

        async def failing_update_event(**kwargs):
            raise RuntimeError("Google API down")

        monkeypatch.setattr(ccs.gc_service, "update_event", failing_update_event)

        await ccs.sync_update(cls.id, USER_ID, "evt-old")  # must not raise


# ─── sync_delete ─────────────────────────────────────────────────────────────

class TestSyncDelete:
    async def test_deletes_event(self, shared_session, monkeypatch):
        await _seed(shared_session, _google_auth())
        deleted = []

        async def fake_delete_event(**kwargs):
            deleted.append(kwargs["google_event_id"])

        monkeypatch.setattr(ccs.gc_service, "delete_event", fake_delete_event)

        await ccs.sync_delete("evt-123", USER_ID)

        assert deleted == ["evt-123"]

    async def test_skips_when_user_has_no_google_connection(self, shared_session, monkeypatch):
        deleted = []

        async def fake_delete_event(**kwargs):
            deleted.append(kwargs["google_event_id"])

        monkeypatch.setattr(ccs.gc_service, "delete_event", fake_delete_event)

        await ccs.sync_delete("evt-123", USER_ID)

        assert deleted == []

    async def test_google_api_failure_does_not_propagate(
        self, shared_session, monkeypatch, fast_retries
    ):
        await _seed(shared_session, _google_auth())

        async def failing_delete_event(**kwargs):
            raise RuntimeError("Google API down")

        monkeypatch.setattr(ccs.gc_service, "delete_event", failing_delete_event)

        await ccs.sync_delete("evt-123", USER_ID)  # must not raise


# ─── sync status persistence + retries ───────────────────────────────────────

class TestSyncStatusAndRetries:
    async def test_success_marks_class_synced(self, shared_session, monkeypatch):
        [cls, _] = await _seed(shared_session, _class(), _google_auth())

        async def fake_create_event(**kwargs):
            return "evt-123"

        monkeypatch.setattr(ccs.gc_service, "create_event", fake_create_event)

        await ccs.sync_create(cls.id, USER_ID)

        await shared_session.refresh(cls)
        assert cls.gcal_sync_status == "synced"
        assert cls.gcal_synced_at is not None

    async def test_exhausted_retries_mark_class_failed(
        self, shared_session, monkeypatch, fast_retries
    ):
        [cls, _] = await _seed(shared_session, _class(), _google_auth())
        calls = []

        async def failing_create_event(**kwargs):
            calls.append(1)
            raise RuntimeError("Google API down")

        monkeypatch.setattr(ccs.gc_service, "create_event", failing_create_event)

        await ccs.sync_create(cls.id, USER_ID)

        assert len(calls) == 3  # 1 attempt + 2 retries
        await shared_session.refresh(cls)
        assert cls.gcal_sync_status == "failed"
        assert cls.google_calendar_id is None

    async def test_transient_failure_recovers_on_retry(
        self, shared_session, monkeypatch, fast_retries
    ):
        [cls, _] = await _seed(shared_session, _class(), _google_auth())
        calls = []

        async def flaky_create_event(**kwargs):
            calls.append(1)
            if len(calls) < 3:
                raise RuntimeError("transient")
            return "evt-recovered"

        monkeypatch.setattr(ccs.gc_service, "create_event", flaky_create_event)

        await ccs.sync_create(cls.id, USER_ID)

        assert len(calls) == 3
        await shared_session.refresh(cls)
        assert cls.google_calendar_id == "evt-recovered"
        assert cls.gcal_sync_status == "synced"

    async def test_update_failure_marks_class_failed(
        self, shared_session, monkeypatch, fast_retries
    ):
        [cls, _] = await _seed(
            shared_session, _class(google_calendar_id="evt-old"), _google_auth()
        )

        async def failing_update_event(**kwargs):
            raise RuntimeError("Google API down")

        monkeypatch.setattr(ccs.gc_service, "update_event", failing_update_event)

        await ccs.sync_update(cls.id, USER_ID, "evt-old")

        await shared_session.refresh(cls)
        assert cls.gcal_sync_status == "failed"
