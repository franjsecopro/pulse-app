import logging
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_real_user, require_admin
from app.models.user import User
from app.services import class_calendar_service
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
from app.schemas.auth import UserResponse
from app.services.auth_service import AuthService
from app.services import demo_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=REFRESH_MAX_AGE,
        path="/api/auth/refresh",
    )


def _clear_demo_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Re-emit tokens without acting_as to exit demo mode."""
    _set_auth_cookies(response, access_token, refresh_token)


# ── Users ────────────────────────────────────────────────────────────────────

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
        if not u.is_demo  # hide the internal demo account from the user list
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

    # Collect client IDs first — Contract and PaymentIdentifier have no user_id column
    client_ids_result = await db.execute(
        select(Client.id).where(Client.user_id == user_id)
    )
    client_ids = [row[0] for row in client_ids_result.all()]

    # Delete models that reference client_id (no user_id column)
    if client_ids:
        await db.execute(sql_delete(PaymentIdentifier).where(PaymentIdentifier.client_id.in_(client_ids)))
        await db.execute(sql_delete(Contract).where(Contract.client_id.in_(client_ids)))

    # Delete models with user_id directly, in dependency order
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

    classes_result = await db.execute(
        select(Class).where(
            Class.user_id == user_id,
            Class.class_date >= date.today(),
        )
    )
    classes = classes_result.scalars().all()

    synced = 0
    for cls in classes:
        if cls.google_calendar_id:
            background_tasks.add_task(class_calendar_service.sync_update, cls.id, user_id, cls.google_calendar_id)
        else:
            background_tasks.add_task(class_calendar_service.sync_create, cls.id, user_id)
        synced += 1

    return {"scheduled": synced, "user_id": user_id}


# ── Clients (cross-user hard delete) ─────────────────────────────────────────

@router.get("/clients")
async def list_all_clients(
    archived_only: bool = Query(False),
    demo_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List clients across all users.

    demo_only=true  → only demo user's clients
    demo_only=false → all real users' clients (default)
    archived_only   → further filter to archived only
    """
    demo_user = await demo_service.get_demo_user(db)

    if demo_only:
        query = (
            select(Client, User.email.label("owner_email"))
            .join(User, User.id == Client.user_id)
            .where(Client.user_id == demo_user.id)
        )
    else:
        query = (
            select(Client, User.email.label("owner_email"))
            .join(User, User.id == Client.user_id)
            .where(Client.user_id != demo_user.id)
        )

    if archived_only:
        query = query.where(Client.archived_at.isnot(None))

    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "id": r.Client.id,
            "name": r.Client.name,
            "owner_id": r.Client.user_id,
            "owner_email": r.owner_email,
            "is_active": r.Client.is_active,
            "archived_at": r.Client.archived_at,
        }
        for r in rows
    ]


@router.delete("/clients/{client_id}")
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Permanently delete a client and all their data (contracts, classes, payments, notifications).

    Admin can delete clients belonging to any user.
    """
    result = await db.execute(select(Client).where(Client.id == client_id))
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

    logger.info("Admin hard-deleted client %s (%s)", client_id, client.name)
    return {"deleted": client_id, "name": client.name}


@router.post("/clients/{client_id}/move-from-demo")
async def move_client_from_demo(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Reassign a demo client to the calling admin's account."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    demo_user = await demo_service.get_demo_user(db)
    if client.user_id != demo_user.id:
        raise HTTPException(status_code=400, detail="Client does not belong to the demo dataset")

    client.user_id = admin.id

    from sqlalchemy import update as sql_update
    await db.execute(
        sql_update(Class)
        .where(Class.client_id == client_id, Class.user_id == demo_user.id)
        .values(user_id=admin.id)
    )
    await db.execute(
        sql_update(Payment)
        .where(Payment.client_id == client_id, Payment.user_id == demo_user.id)
        .values(user_id=admin.id)
    )
    await db.commit()

    logger.info("Admin moved client %s (%s) from demo to admin %s", client_id, client.name, admin.id)
    return {"moved": client_id, "name": client.name, "target_user_id": admin.id}


@router.post("/clients/{client_id}/move-to-demo")
async def move_client_to_demo(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Reassign a client (and all their classes + payments) to the demo user.

    After this call the client will appear when anyone is in demo mode,
    and will no longer be visible under the original owner.
    """
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    demo_user = await demo_service.get_demo_user(db)
    if client.user_id == demo_user.id:
        raise HTTPException(status_code=400, detail="Client is already in the demo dataset")

    original_user_id = client.user_id
    client.user_id = demo_user.id

    # Update classes and payments that belong to this client
    from sqlalchemy import update as sql_update
    await db.execute(
        sql_update(Class)
        .where(Class.client_id == client_id, Class.user_id == original_user_id)
        .values(user_id=demo_user.id)
    )
    await db.execute(
        sql_update(Payment)
        .where(Payment.client_id == client_id, Payment.user_id == original_user_id)
        .values(user_id=demo_user.id)
    )
    await db.commit()

    logger.info("Admin moved client %s (%s) to demo user", client_id, client.name)
    return {"moved": client_id, "name": client.name, "demo_user_id": demo_user.id}


# ── Demo mode ─────────────────────────────────────────────────────────────────

@router.get("/demo/status")
async def demo_status(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return the demo user's id so the frontend can check demo state."""
    demo_user = await demo_service.get_demo_user(db)
    return {"demo_user_id": demo_user.id}


@router.post("/demo/enter", response_model=UserResponse)
async def demo_enter(
    response: Response,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Switch the admin's session to demo-impersonation mode.

    The response includes refreshed cookies with acting_as=demo_user.id.
    All subsequent domain requests will read/write demo data until /demo/exit.
    """
    demo_user = await demo_service.get_demo_user(db)
    auth_service = AuthService(db)
    access_token, refresh_token = await auth_service.build_demo_tokens(admin, demo_user)
    _set_auth_cookies(response, access_token, refresh_token)
    return UserResponse(
        id=demo_user.id,
        email=demo_user.email,
        role=admin.role,
        is_demo_active=True,
        real_email=admin.email,
    )


@router.post("/demo/exit", response_model=UserResponse)
async def demo_exit(
    response: Response,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Restore the admin's real session (drop acting_as from JWT)."""
    auth_service = AuthService(db)
    access_token, refresh_token = auth_service._build_tokens(admin.id)
    _set_auth_cookies(response, access_token, refresh_token)
    return UserResponse(
        id=admin.id,
        email=admin.email,
        role=admin.role,
        is_demo_active=False,
        real_email=None,
    )


@router.post("/demo/reset")
async def demo_reset(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Wipe and re-seed the demo user's data.

    Idempotent — safe to call multiple times.
    """
    result = await demo_service.reset_demo_data(db)
    logger.info("Admin reset demo data: %s", result)
    return result
