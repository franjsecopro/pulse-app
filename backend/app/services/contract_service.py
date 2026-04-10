"""Business logic for contract-driven class generation and calendar management."""
from datetime import date, time as dt_time, timedelta

from fastapi import BackgroundTasks
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.contract import Contract
from app.services import class_calendar_service


async def generate_contract_classes(
    db: AsyncSession,
    contract: Contract,
    user_id: int,
    background_tasks: BackgroundTasks,
) -> dict:
    """Generate calendar classes for every scheduled day in the contract range.

    Skips dates where a class already exists for this contract.
    Returns the number of classes created.
    """
    range_start: date = contract.start_date
    range_end: date = contract.end_date if contract.end_date else range_start + timedelta(days=365)

    existing_result = await db.execute(
        select(Class.class_date).where(Class.contract_id == contract.id)
    )
    existing_dates: set[date] = {row[0] for row in existing_result.fetchall()}

    # schedule_days: {"0": {"start": "09:00", "end": "10:30"}, ...} — weekday (0=Mon…6=Sun)
    schedule: dict[int, dict] = {int(k): v for k, v in contract.schedule_days.items()}

    created_count = 0
    current = range_start
    while current <= range_end:
        weekday = current.weekday()
        if weekday in schedule and current not in existing_dates:
            day = schedule[weekday]
            sh, sm = map(int, day["start"].split(":"))
            eh, em = map(int, day["end"].split(":"))
            db.add(Class(
                user_id=user_id,
                client_id=contract.client_id,
                contract_id=contract.id,
                class_date=current,
                class_time=dt_time(sh, sm),
                duration_hours=(eh * 60 + em - sh * 60 - sm) / 60,
                hourly_rate=contract.hourly_rate,
                notes=None,
            ))
            created_count += 1
        current += timedelta(days=1)

    await db.commit()

    if created_count > 0:
        new_ids_result = await db.execute(
            select(Class.id)
            .where(Class.contract_id == contract.id)
            .where(Class.class_date.notin_(list(existing_dates)))
        )
        for (class_id,) in new_ids_result.fetchall():
            background_tasks.add_task(class_calendar_service.sync_create, class_id, user_id)

    return {"created": created_count}


async def delete_future_contract_classes(
    db: AsyncSession,
    contract_id: int,
    user_id: int,
    background_tasks: BackgroundTasks,
) -> dict:
    """Delete all future classes (from today inclusive) for a contract.

    Past classes are left untouched. Google Calendar events for deleted
    classes are removed asynchronously.
    Returns the number of classes deleted.
    """
    gcal_result = await db.execute(
        select(Class.google_calendar_id).where(
            Class.contract_id == contract_id,
            Class.class_date >= date.today(),
            Class.google_calendar_id.isnot(None),
        )
    )
    google_event_ids = [row[0] for row in gcal_result.fetchall()]

    result = await db.execute(
        sql_delete(Class)
        .where(
            Class.contract_id == contract_id,
            Class.class_date >= date.today(),
        )
        .returning(Class.id)
    )
    deleted_count = len(result.fetchall())
    await db.commit()

    for event_id in google_event_ids:
        background_tasks.add_task(class_calendar_service.sync_delete, event_id, user_id)

    return {"deleted": deleted_count}
