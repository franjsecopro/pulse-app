"""Demo mode: seed / reset a dedicated demo user's data.

All data lives under demo_user.id so the normal user_id-based isolation
in every repository keeps it completely separate from real accounts.
"""
from datetime import date, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete as sql_delete

from app.models.class_ import Class
from app.models.client import Client
from app.models.contract import Contract
from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings
from app.models.payment import Payment
from app.models.payment_identifier import PaymentIdentifier
from app.models.user import User


async def get_demo_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.is_demo.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo user not found — run migrations (0014)",
        )
    return user


async def reset_demo_data(db: AsyncSession) -> dict:
    """Wipe and re-seed all data belonging to the demo user.

    Returns a summary dict with counts for the API response.
    """
    demo_user = await get_demo_user(db)
    uid = demo_user.id

    # ── Wipe in FK order ──────────────────────────────────────────────────────
    client_ids_result = await db.execute(select(Client.id).where(Client.user_id == uid))
    client_ids = [r[0] for r in client_ids_result.all()]

    if client_ids:
        await db.execute(sql_delete(Notification).where(Notification.client_id.in_(client_ids)))
        await db.execute(sql_delete(PaymentIdentifier).where(PaymentIdentifier.client_id.in_(client_ids)))

    await db.execute(sql_delete(Class).where(Class.user_id == uid))
    await db.execute(sql_delete(Payment).where(Payment.user_id == uid))

    if client_ids:
        await db.execute(sql_delete(Contract).where(Contract.client_id.in_(client_ids)))

    await db.execute(sql_delete(NotificationSettings).where(NotificationSettings.user_id == uid))
    await db.execute(sql_delete(Client).where(Client.user_id == uid))
    await db.flush()

    # ── Re-seed ───────────────────────────────────────────────────────────────
    today = date.today()
    seed = _build_seed(uid, today)

    for client_data in seed:
        client = Client(
            user_id=uid,
            name=client_data["name"],
            email=client_data.get("email"),
            phone=client_data.get("phone"),
            is_active=True,
        )
        db.add(client)
        await db.flush()  # populate client.id

        for contract_data in client_data["contracts"]:
            contract = Contract(
                client_id=client.id,
                description=contract_data["description"],
                start_date=contract_data["start_date"],
                hourly_rate=contract_data["hourly_rate"],
                schedule_days=contract_data.get("schedule_days"),
                is_active=True,
            )
            db.add(contract)
            await db.flush()

            for class_data in contract_data["classes"]:
                db.add(Class(
                    user_id=uid,
                    client_id=client.id,
                    contract_id=contract.id,
                    class_date=class_data["date"],
                    class_time=class_data.get("time"),
                    duration_hours=class_data.get("duration", 1.0),
                    hourly_rate=contract_data["hourly_rate"],
                    status=class_data.get("status", "normal"),
                ))

        for payment_data in client_data.get("payments", []):
            db.add(Payment(
                user_id=uid,
                client_id=client.id,
                amount=payment_data["amount"],
                payment_date=payment_data["date"],
                concept=payment_data.get("concept"),
                source="manual",
                status="confirmed",
            ))

    await db.commit()

    clients_count = len(seed)
    classes_count = sum(len(c["classes"]) for cd in seed for c in cd["contracts"])
    return {
        "clients_count": clients_count,
        "classes_count": classes_count,
        "reseed_at": today.isoformat(),
    }


def _build_seed(user_id: int, today: date) -> list[dict]:
    """Returns a deterministic list of client dicts to seed."""
    rate_a, rate_b = 15.0, 20.0
    return [
        {
            "name": "Ana García",
            "email": "ana.demo@example.com",
            "phone": "+34 612 000 001",
            "contracts": [
                {
                    "description": "Clases de inglés — nivel B2",
                    "start_date": today - timedelta(days=60),
                    "hourly_rate": rate_a,
                    "schedule_days": {"1": {"start": "10:00", "end": "11:00"}, "3": {"start": "10:00", "end": "11:00"}},
                    "classes": _past_and_future_classes(today, days_past=8, days_future=4, t=time(10, 0)),
                }
            ],
            "payments": [
                {"amount": rate_a * 8, "date": today - timedelta(days=30), "concept": "Clases abril"},
                {"amount": rate_a * 4, "date": today - timedelta(days=5), "concept": "Clases mayo (parcial)"},
            ],
        },
        {
            "name": "Carlos Méndez",
            "email": "carlos.demo@example.com",
            "phone": "+34 612 000 002",
            "contracts": [
                {
                    "description": "Matemáticas — preparación selectividad",
                    "start_date": today - timedelta(days=45),
                    "hourly_rate": rate_b,
                    "schedule_days": {"2": {"start": "16:00", "end": "17:30"}, "4": {"start": "16:00", "end": "17:30"}},
                    "classes": _past_and_future_classes(today, days_past=6, days_future=3, t=time(16, 0)),
                }
            ],
            "payments": [
                {"amount": rate_b * 6, "date": today - timedelta(days=20), "concept": "Clases pasadas"},
            ],
        },
        {
            "name": "María López",
            "email": "maria.demo@example.com",
            "contracts": [
                {
                    "description": "Piano — iniciación",
                    "start_date": today - timedelta(days=90),
                    "hourly_rate": rate_a,
                    "schedule_days": {"5": {"start": "11:00", "end": "12:00"}},
                    "classes": _past_and_future_classes(today, days_past=10, days_future=5, t=time(11, 0)),
                }
            ],
            "payments": [
                {"amount": rate_a * 10, "date": today - timedelta(days=60), "concept": "Clases trimestre 1"},
                {"amount": rate_a * 5, "date": today - timedelta(days=15), "concept": "Clases trimestre 2 (adelanto)"},
            ],
        },
        {
            "name": "Pedro Ruiz",
            "contracts": [
                {
                    "description": "Guitarra — nivel intermedio",
                    "start_date": today - timedelta(days=30),
                    "hourly_rate": 18.0,
                    "classes": _past_and_future_classes(today, days_past=4, days_future=4, t=time(18, 0)),
                }
            ],
            "payments": [],
        },
        {
            "name": "Sofía Torres",
            "contracts": [
                {
                    "description": "Francés — conversación",
                    "start_date": today - timedelta(days=20),
                    "hourly_rate": rate_a,
                    "schedule_days": {"0": {"start": "09:00", "end": "10:00"}, "2": {"start": "09:00", "end": "10:00"}},
                    "classes": _past_and_future_classes(today, days_past=3, days_future=6, t=time(9, 0)),
                }
            ],
            "payments": [
                {"amount": rate_a * 2, "date": today - timedelta(days=10), "concept": "Clases inicio"},
            ],
        },
    ]


def _past_and_future_classes(
    today: date,
    days_past: int,
    days_future: int,
    t: time,
    duration: float = 1.0,
) -> list[dict]:
    classes = []
    for i in range(days_past, 0, -1):
        classes.append({"date": today - timedelta(days=i * 7), "time": t, "duration": duration})
    for i in range(1, days_future + 1):
        classes.append({"date": today + timedelta(days=i * 7), "time": t, "duration": duration})
    return classes
