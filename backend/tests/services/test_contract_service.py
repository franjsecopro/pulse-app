"""Tests for contract_service — business logic for generating and deleting contract classes."""
from datetime import date

import pytest
from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.contract import Contract
from app.services import contract_service


# ─── Helpers ────────────────────────────────────────────────────────────────

def make_contract(
    db: AsyncSession,
    *,
    client_id: int = 1,
    start_date: date,
    end_date: date | None,
    schedule_days: dict,
    hourly_rate: float = 30.0,
) -> Contract:
    """Build and add a Contract row. FK constraints are not enforced in SQLite."""
    contract = Contract(
        client_id=client_id,
        description="Test contract",
        start_date=start_date,
        end_date=end_date,
        hourly_rate=hourly_rate,
        is_active=True,
        schedule_days=schedule_days,
    )
    db.add(contract)
    return contract


async def count_classes(db: AsyncSession, contract_id: int) -> int:
    result = await db.execute(select(Class).where(Class.contract_id == contract_id))
    return len(result.scalars().all())


# ─── generate_contract_classes ──────────────────────────────────────────────

class TestGenerateContractClasses:
    async def test_creates_one_class_per_scheduled_weekday(self, db: AsyncSession):
        """A Mon+Wed schedule over exactly 2 weeks should create 4 classes."""
        # 2024-01-01 is Monday → 2 weeks: Mon 1, Wed 3, Mon 8, Wed 10
        contract = make_contract(
            db,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 14),
            schedule_days={
                "0": {"start": "09:00", "end": "10:00"},  # Monday
                "2": {"start": "11:00", "end": "12:00"},  # Wednesday
            },
        )
        await db.commit()
        await db.refresh(contract)

        result = await contract_service.generate_contract_classes(
            db, contract, user_id=1, background_tasks=BackgroundTasks()
        )

        assert result == {"created": 4}
        assert await count_classes(db, contract.id) == 4

    async def test_skips_dates_with_existing_class(self, db: AsyncSession):
        """Dates that already have a class for this contract are not duplicated."""
        contract = make_contract(
            db,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 7),
            schedule_days={"0": {"start": "09:00", "end": "10:00"}},  # Monday only
        )
        await db.commit()
        await db.refresh(contract)

        # Pre-create the Monday class
        db.add(Class(
            user_id=1,
            client_id=contract.client_id,
            contract_id=contract.id,
            class_date=date(2024, 1, 1),
            class_time=None,
            duration_hours=1.0,
            hourly_rate=30.0,
        ))
        await db.commit()

        result = await contract_service.generate_contract_classes(
            db, contract, user_id=1, background_tasks=BackgroundTasks()
        )

        assert result == {"created": 0}
        assert await count_classes(db, contract.id) == 1  # still just the pre-existing one

    async def test_computes_duration_from_schedule_times(self, db: AsyncSession):
        """Class duration_hours is derived from the schedule start/end times."""
        contract = make_contract(
            db,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            schedule_days={"0": {"start": "09:00", "end": "10:30"}},  # 1.5 hours
        )
        await db.commit()
        await db.refresh(contract)

        await contract_service.generate_contract_classes(
            db, contract, user_id=1, background_tasks=BackgroundTasks()
        )

        result = await db.execute(select(Class).where(Class.contract_id == contract.id))
        cls = result.scalar_one()
        assert cls.duration_hours == 1.5

    async def test_snapshots_hourly_rate_from_contract(self, db: AsyncSession):
        """Each class captures the contract's hourly_rate at generation time."""
        contract = make_contract(
            db,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            schedule_days={"0": {"start": "09:00", "end": "10:00"}},
            hourly_rate=45.0,
        )
        await db.commit()
        await db.refresh(contract)

        await contract_service.generate_contract_classes(
            db, contract, user_id=1, background_tasks=BackgroundTasks()
        )

        result = await db.execute(select(Class).where(Class.contract_id == contract.id))
        cls = result.scalar_one()
        assert cls.hourly_rate == 45.0

    async def test_no_end_date_generates_up_to_365_days(self, db: AsyncSession):
        """Contracts without end_date generate classes for 365 days from start."""
        contract = make_contract(
            db,
            start_date=date(2024, 1, 1),
            end_date=None,
            schedule_days={"0": {"start": "09:00", "end": "10:00"}},  # every Monday
        )
        await db.commit()
        await db.refresh(contract)

        result = await contract_service.generate_contract_classes(
            db, contract, user_id=1, background_tasks=BackgroundTasks()
        )

        # 365 days from 2024-01-01 = 2024-12-31 — count Mondays in that range
        mondays = sum(
            1 for d in range(365)
            if (date(2024, 1, 1) + __import__("datetime").timedelta(days=d)).weekday() == 0
        )
        assert result == {"created": mondays}

    async def test_schedules_calendar_sync_background_tasks(self, db: AsyncSession):
        """A background task is queued for each generated class."""
        contract = make_contract(
            db,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 7),
            schedule_days={
                "0": {"start": "09:00", "end": "10:00"},  # Mon
                "2": {"start": "09:00", "end": "10:00"},  # Wed
            },
        )
        await db.commit()
        await db.refresh(contract)

        tasks = BackgroundTasks()
        await contract_service.generate_contract_classes(db, contract, user_id=1, background_tasks=tasks)

        assert len(tasks.tasks) == 2  # Mon Jan 1 + Wed Jan 3


# ─── delete_future_contract_classes ─────────────────────────────────────────

class TestDeleteFutureContractClasses:
    async def test_deletes_only_future_classes(self, db: AsyncSession):
        """Past classes are left untouched; only future classes are removed."""
        contract = make_contract(
            db,
            start_date=date(2020, 1, 1),
            end_date=None,
            schedule_days={},
        )
        await db.commit()
        await db.refresh(contract)

        past_class = Class(
            user_id=1, client_id=1, contract_id=contract.id,
            class_date=date(2020, 6, 1),   # clearly in the past
            class_time=None, duration_hours=1.0, hourly_rate=30.0,
        )
        future_class_1 = Class(
            user_id=1, client_id=1, contract_id=contract.id,
            class_date=date(2099, 6, 1),   # clearly in the future
            class_time=None, duration_hours=1.0, hourly_rate=30.0,
        )
        future_class_2 = Class(
            user_id=1, client_id=1, contract_id=contract.id,
            class_date=date(2099, 7, 1),
            class_time=None, duration_hours=1.0, hourly_rate=30.0,
        )
        db.add_all([past_class, future_class_1, future_class_2])
        await db.commit()

        result = await contract_service.delete_future_contract_classes(
            db, contract.id, user_id=1, background_tasks=BackgroundTasks()
        )

        assert result == {"deleted": 2}
        assert await count_classes(db, contract.id) == 1  # only the past class remains

    async def test_returns_zero_when_no_future_classes(self, db: AsyncSession):
        """Returns 0 deleted when contract has no future classes."""
        contract = make_contract(
            db,
            start_date=date(2020, 1, 1),
            end_date=None,
            schedule_days={},
        )
        await db.commit()
        await db.refresh(contract)

        db.add(Class(
            user_id=1, client_id=1, contract_id=contract.id,
            class_date=date(2020, 1, 1),  # past
            class_time=None, duration_hours=1.0, hourly_rate=30.0,
        ))
        await db.commit()

        result = await contract_service.delete_future_contract_classes(
            db, contract.id, user_id=1, background_tasks=BackgroundTasks()
        )

        assert result == {"deleted": 0}

    async def test_schedules_gcal_sync_for_events_with_calendar_id(self, db: AsyncSession):
        """Background tasks are queued only for classes that have a google_calendar_id."""
        contract = make_contract(
            db, start_date=date(2020, 1, 1), end_date=None, schedule_days={}
        )
        await db.commit()
        await db.refresh(contract)

        db.add_all([
            Class(
                user_id=1, client_id=1, contract_id=contract.id,
                class_date=date(2099, 1, 1), class_time=None,
                duration_hours=1.0, hourly_rate=30.0,
                google_calendar_id="gcal-event-abc",
            ),
            Class(
                user_id=1, client_id=1, contract_id=contract.id,
                class_date=date(2099, 2, 1), class_time=None,
                duration_hours=1.0, hourly_rate=30.0,
                google_calendar_id=None,  # no sync needed
            ),
        ])
        await db.commit()

        tasks = BackgroundTasks()
        await contract_service.delete_future_contract_classes(
            db, contract.id, user_id=1, background_tasks=tasks
        )

        # Only the class WITH a google_calendar_id triggers a sync task
        assert len(tasks.tasks) == 1
