import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.google_auth_repository import GoogleAuthRepository
from app.services import google_calendar_service as gc_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/google-calendar", tags=["google-calendar"])


@router.get("/status")
async def get_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the Google Calendar connection status for the current user."""
    google_auth = await GoogleAuthRepository(db).get_by_user_id(current_user.id)
    if not google_auth:
        return {"connected": False}
    return {
        "connected": True,
        "email": google_auth.google_email,
        "calendar_id": google_auth.calendar_id,
    }


@router.get("/connect")
async def connect(
    current_user: User = Depends(get_current_user),
):
    """Returns the Google OAuth authorization URL to redirect the user to."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Calendar integration is not configured")
    url = gc_service.get_oauth_url(current_user.id)
    return {"url": url}


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """Handles the OAuth redirect from Google. Exchanges the code for tokens,
    saves them, then redirects the browser back to the frontend settings page."""
    try:
        await gc_service.exchange_code(code=code, state=state, db=db)
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?google_connected=true")
    except Exception as exc:
        logger.error("Google OAuth callback failed: %s", exc)
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?google_error=true")


@router.delete("/disconnect", status_code=204)
async def disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Removes the stored Google OAuth tokens for the current user."""
    await GoogleAuthRepository(db).delete_by_user_id(current_user.id)
