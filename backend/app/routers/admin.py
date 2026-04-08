import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.models.user import User
from app.models.class_ import Class
from app.models.client import Client
from app.models.payment import Payment
from app.models.pdf_import import PDFImport
from app.models.contract import Contract
from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings
from app.models.payment_identifier import PaymentIdentifier
from app.models.google_auth import UserGoogleAuth
from app.repositories.google_auth_repository import GoogleAuthRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all users with their role."""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [
        {"id": u.id, "email": u.email, "role": u.role, "created_at": u.created_at}
        for u in users
    ]


@router.put("/users/{user_id}/role")
async def set_user_role(
    user_id: int,
    role: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Change a user's role (admin / user)."""
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and role != "admin":
        raise HTTPException(status_code=400, detail="Cannot remove your own admin role")
    user.role = role
    await db.commit()
    return {"id": user.id, "email": user.email, "role": user.role}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Permanently delete a user and all their data."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Delete in dependency order to avoid FK violations
    for model in (
        Notification,
        NotificationSettings,
        PDFImport,
        Payment,
        Class,
        Client,
        UserGoogleAuth,
    ):
        await db.execute(sql_delete(model).where(model.user_id == user_id))

    await db.execute(sql_delete(User).where(User.id == user_id))
    await db.commit()
    logger.info("Admin deleted user %s (%s)", user_id, user.email)
    return {"deleted": user_id, "email": user.email}


@router.delete("/clients/{client_id}")
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Permanently delete a client and all their data (contracts, classes, payments, notifications)."""
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.user_id == admin.id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Delete in dependency order to avoid FK violations
    await db.execute(sql_delete(Notification).where(Notification.client_id == client_id))
    await db.execute(sql_delete(Payment).where(Payment.client_id == client_id))
    await db.execute(sql_delete(Class).where(Class.client_id == client_id))
    await db.execute(sql_delete(PaymentIdentifier).where(PaymentIdentifier.client_id == client_id))
    await db.execute(sql_delete(Contract).where(Contract.client_id == client_id))
    await db.execute(sql_delete(Client).where(Client.id == client_id))
    await db.commit()

    logger.info("Admin deleted client %s (%s)", client_id, client.name)
    return {"deleted": client_id, "name": client.name}


@router.post("/users/{user_id}/sync-gcal")
async def force_gcal_sync(
    user_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Force re-sync of all future classes to Google Calendar for a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
    if not google_auth:
        raise HTTPException(status_code=400, detail="User has no Google Calendar connected")

    from datetime import date
    classes_result = await db.execute(
        select(Class).where(
            Class.user_id == user_id,
            Class.class_date >= date.today(),
        )
    )
    classes = classes_result.scalars().all()

    from app.routers.classes import _sync_create, _sync_update
    synced = 0
    for cls in classes:
        if cls.google_calendar_id:
            background_tasks.add_task(_sync_update, cls.id, user_id, cls.google_calendar_id)
        else:
            background_tasks.add_task(_sync_create, cls.id, user_id)
        synced += 1

    return {"scheduled": synced, "user_id": user_id}
