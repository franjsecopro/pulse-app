"""Google Calendar integration — read-only MVP."""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.class_ import Class
from app.models.client import Client
from app.models.user import User
from app.models.user_settings import UserSettings
from app.services import google_calendar_service as gcal
from app.services.payment_matcher import match_transaction

router = APIRouter(prefix="/google", tags=["google"])

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _make_state_token(user_id: int) -> str:
    """Sign a short-lived JWT to use as OAuth state (CSRF protection)."""
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "purpose": "google_oauth",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_state_token(state: str) -> int:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "google_oauth":
            raise ValueError
        return int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=400, detail="Estado OAuth inválido o expirado")


async def _get_or_create_settings(user_id: int, db: AsyncSession) -> UserSettings:
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings_row = result.scalar_one_or_none()
    if not settings_row:
        settings_row = UserSettings(user_id=user_id)
        db.add(settings_row)
        await db.commit()
        await db.refresh(settings_row)
    return settings_row


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.get("/auth-url")
async def get_auth_url(
    current_user: User = Depends(get_current_user),
):
    """Return the Google OAuth URL for this user to authorize access."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Calendar no está configurado en el servidor")
    state = _make_state_token(current_user.id)
    url = gcal.get_auth_url(state)
    return {"url": url}


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Receive OAuth callback from Google, save tokens, redirect to frontend."""
    user_id = _decode_state_token(state)

    try:
        tokens = gcal.exchange_code_for_tokens(code)
    except Exception:
        return RedirectResponse(f"{settings.FRONTEND_URL}/classes?google=error")

    user_settings = await _get_or_create_settings(user_id, db)
    user_settings.google_access_token = tokens["access_token"]
    user_settings.google_refresh_token = tokens["refresh_token"] or user_settings.google_refresh_token
    user_settings.google_token_expiry = tokens["expiry"]
    user_settings.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return RedirectResponse(f"{settings.FRONTEND_URL}/classes?google=connected")


@router.get("/status")
async def get_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    user_settings = result.scalar_one_or_none()
    connected = bool(user_settings and user_settings.google_access_token)
    return {"connected": connected}


@router.delete("/disconnect")
async def disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    user_settings = result.scalar_one_or_none()
    if user_settings:
        user_settings.google_access_token = None
        user_settings.google_refresh_token = None
        user_settings.google_token_expiry = None
        await db.commit()
    return {"disconnected": True}


class EventPreview(BaseModel):
    google_event_id: str
    summary: str
    class_date: str
    class_time: Optional[str]
    duration_hours: float
    suggested_client_id: Optional[int]
    suggested_client_name: Optional[str]
    match_type: str
    confidence: float
    already_imported: bool


@router.get("/sync", response_model=list[EventPreview])
async def preview_sync(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch Google Calendar events and return a preview with client matching."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    user_settings = result.scalar_one_or_none()
    if not user_settings or not user_settings.google_access_token:
        raise HTTPException(status_code=400, detail="Google Calendar no está conectado")

    # Load all active clients with their payers for matching
    clients_result = await db.execute(
        select(Client)
        .options(selectinload(Client.payers))
        .where(Client.user_id == current_user.id, Client.deleted_at.is_(None))
    )
    clients = list(clients_result.scalars().all())

    # Load already-imported event IDs this month to avoid duplicates
    classes_result = await db.execute(
        select(Class.google_calendar_id)
        .where(
            Class.user_id == current_user.id,
            Class.google_calendar_id.is_not(None),
        )
    )
    imported_ids = {row[0] for row in classes_result.all()}

    try:
        events = gcal.fetch_events(
            access_token=user_settings.google_access_token,
            refresh_token=user_settings.google_refresh_token,
            token_expiry=user_settings.google_token_expiry,
            calendar_id=user_settings.google_calendar_id or "primary",
            month=month,
            year=year,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al conectar con Google Calendar: {str(e)}")

    previews = []
    for event in events:
        match = match_transaction(event["summary"], clients)
        previews.append(EventPreview(
            google_event_id=event["google_event_id"],
            summary=event["summary"],
            class_date=event["class_date"],
            class_time=event["class_time"],
            duration_hours=event["duration_hours"],
            suggested_client_id=match.client_id,
            suggested_client_name=match.client_name,
            match_type=match.match_type,
            confidence=match.confidence,
            already_imported=event["google_event_id"] in imported_ids,
        ))

    return previews


class ConfirmEventItem(BaseModel):
    google_event_id: str
    class_date: str
    class_time: Optional[str]
    duration_hours: float
    client_id: int
    hourly_rate: float
    notes: Optional[str] = None


class ConfirmSyncRequest(BaseModel):
    events: list[ConfirmEventItem]


@router.post("/sync/confirm")
async def confirm_sync(
    data: ConfirmSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create class sessions from confirmed Google Calendar events."""
    created = 0
    for event in data.events:
        class_session = Class(
            user_id=current_user.id,
            client_id=event.client_id,
            class_date=event.class_date,
            class_time=event.class_time,
            duration_hours=event.duration_hours,
            hourly_rate=event.hourly_rate,
            notes=event.notes,
            google_calendar_id=event.google_event_id,
        )
        db.add(class_session)
        created += 1

    await db.commit()
    return {"created": created}
