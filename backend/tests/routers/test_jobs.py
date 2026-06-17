"""Router tests for /api/jobs — the external-cron automation engine.

Auth is a shared X-Job-Token (not user auth). Responses are minimal summaries.
"""
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.client import Client
from app.models.contract import Contract
from app.models.class_ import Class

USER_ID = 1


async def _seed(db: AsyncSession, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def _seed_user_with_class(db: AsyncSession, when: date) -> None:
    await _seed(db, User(id=USER_ID, email="t@x.dev", role="user", password_hash="x", locale="es-ES"))
    (client,) = await _seed(db, Client(user_id=USER_ID, name="A"))
    (contract,) = await _seed(db, Contract(
        client_id=client.id, description="Cours", start_date=date(2026, 1, 1), hourly_rate=40.0,
    ))
    await _seed(db, Class(
        user_id=USER_ID, client_id=client.id, contract_id=contract.id,
        class_date=when, duration_hours=1.0, hourly_rate=40.0, status="normal",
    ))


class TestAutoGenerateInvoicesJob:
    async def test_requires_a_token(self, app_client: AsyncClient, monkeypatch):
        monkeypatch.setattr(settings, "JOB_TOKEN", "secret")
        response = await app_client.post("/api/jobs/auto-generate-invoices")
        assert response.status_code == 401

    async def test_503_when_jobs_not_configured(self, app_client: AsyncClient, monkeypatch):
        monkeypatch.setattr(settings, "JOB_TOKEN", "")
        response = await app_client.post(
            "/api/jobs/auto-generate-invoices", headers={"X-Job-Token": "x"}
        )
        assert response.status_code == 503

    async def test_generates_drafts_with_a_valid_token(
        self, db: AsyncSession, app_client: AsyncClient, monkeypatch
    ):
        monkeypatch.setattr(settings, "JOB_TOKEN", "secret")
        await _seed_user_with_class(db, date(2026, 4, 7))

        response = await app_client.post(
            "/api/jobs/auto-generate-invoices?date=2026-04-07",
            headers={"X-Job-Token": "secret"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["invoicesCreated"] == 1
        assert body["usersProcessed"] >= 1

    async def test_is_idempotent_across_runs(
        self, db: AsyncSession, app_client: AsyncClient, monkeypatch
    ):
        monkeypatch.setattr(settings, "JOB_TOKEN", "secret")
        await _seed_user_with_class(db, date(2026, 4, 7))
        url = "/api/jobs/auto-generate-invoices?date=2026-04-07"
        headers = {"X-Job-Token": "secret"}

        first = (await app_client.post(url, headers=headers)).json()
        second = (await app_client.post(url, headers=headers)).json()

        assert first["invoicesCreated"] == 1
        assert second["invoicesCreated"] == 0


class TestGenerateNotificationsJob:
    async def test_requires_a_token(self, app_client: AsyncClient, monkeypatch):
        monkeypatch.setattr(settings, "JOB_TOKEN", "secret")
        response = await app_client.post("/api/jobs/generate-notifications")
        assert response.status_code == 401

    async def test_runs_with_a_valid_token(
        self, db: AsyncSession, app_client: AsyncClient, monkeypatch
    ):
        monkeypatch.setattr(settings, "JOB_TOKEN", "secret")
        await _seed(db, User(id=USER_ID, email="t@x.dev", role="user", password_hash="x", locale="es-ES"))

        response = await app_client.post(
            "/api/jobs/generate-notifications", headers={"X-Job-Token": "secret"}
        )

        assert response.status_code == 200
        assert "notificationsGenerated" in response.json()
