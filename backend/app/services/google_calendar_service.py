"""Google Calendar integration service.

Handles OAuth token management and Google Calendar event synchronization.
All sync methods are non-throwing — failures are logged and return None/False
so that class CRUD operations are never blocked by Google Calendar issues.
"""
import base64
import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.google_auth import UserGoogleAuth
from app.repositories.google_auth_repository import GoogleAuthRepository

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "openid",
    "email",
]
TIMEZONE = "Europe/Madrid"

# Default reminders used when the contract has no custom ones configured
DEFAULT_REMINDERS = [
    {"method": "email", "minutes": 1440},  # 24h antes
    {"method": "popup", "minutes": 60},    # 1h antes
]


def _is_configured() -> bool:
    """Returns True if Google OAuth credentials are set in config."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def _encrypt(plain: str) -> str:
    from cryptography.fernet import Fernet
    key = settings.GOOGLE_TOKEN_ENCRYPTION_KEY.encode()
    return Fernet(key).encrypt(plain.encode()).decode()


def _decrypt(cipher: str) -> str:
    from cryptography.fernet import Fernet
    key = settings.GOOGLE_TOKEN_ENCRYPTION_KEY.encode()
    return Fernet(key).decrypt(cipher.encode()).decode()


def _build_credentials(google_auth: UserGoogleAuth):
    """Build a Google OAuth2 credentials object from a UserGoogleAuth record."""
    from google.oauth2.credentials import Credentials
    return Credentials(
        token=_decrypt(google_auth.access_token),
        refresh_token=_decrypt(google_auth.refresh_token),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
        expiry=google_auth.token_expires_at.replace(tzinfo=None) if google_auth.token_expires_at else None,
    )


async def _refresh_if_needed(
    credentials,
    google_auth: UserGoogleAuth,
    db: AsyncSession,
) -> None:
    """Auto-refresh the access token if expired and persist the new token."""
    if credentials.expired and credentials.refresh_token:
        from google.auth.transport.requests import Request
        credentials.refresh(Request())
        await GoogleAuthRepository(db).update_tokens(
            google_auth,
            access_token=_encrypt(credentials.token),
            token_expires_at=credentials.expiry.replace(tzinfo=timezone.utc) if credentials.expiry else None,
        )


def _build_service(credentials):
    from googleapiclient.discovery import build
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def _build_event_body(class_, client, contract) -> dict:
    """Construct the Google Calendar event resource dict for a class."""
    from datetime import time as dt_time, date as dt_date

    class_time = class_.class_time or dt_time(9, 0)
    start_dt = datetime.combine(class_.class_date, class_time)
    end_dt = start_dt + timedelta(hours=class_.duration_hours)

    # Format as RFC3339 without timezone suffix (timezone passed separately)
    fmt = "%Y-%m-%dT%H:%M:%S"
    event: dict = {
        "summary": f"Clase · {client.name}",
        "description": (contract.calendar_description if contract and contract.calendar_description else ""),
        "start": {"dateTime": start_dt.strftime(fmt), "timeZone": TIMEZONE},
        "end":   {"dateTime": end_dt.strftime(fmt),   "timeZone": TIMEZONE},
        "reminders": {
            "useDefault": False,
            "overrides": (
                contract.calendar_reminders
                if contract and contract.calendar_reminders
                else DEFAULT_REMINDERS
            ),
        },
    }

    if client.email:
        event["attendees"] = [{"email": client.email}]

    return event


# ─────────────────────────────────────────────
# Public sync methods
# ─────────────────────────────────────────────

async def create_event(
    class_,
    client,
    contract,
    google_auth: UserGoogleAuth,
    db: AsyncSession,
) -> Optional[str]:
    """Create a Google Calendar event for a class. Returns the google event ID or None on failure."""
    if not _is_configured():
        return None
    try:
        credentials = _build_credentials(google_auth)
        await _refresh_if_needed(credentials, google_auth, db)
        service = _build_service(credentials)
        event = (
            service.events()
            .insert(
                calendarId=google_auth.calendar_id,
                body=_build_event_body(class_, client, contract),
                sendUpdates="all",
            )
            .execute()
        )
        return event["id"]
    except Exception as exc:
        logger.warning("Google Calendar create_event failed for class %s: %s", class_.id, exc)
        return None


async def update_event(
    google_event_id: str,
    class_,
    client,
    contract,
    google_auth: UserGoogleAuth,
    db: AsyncSession,
) -> bool:
    """Update an existing Google Calendar event. Returns True on success."""
    if not _is_configured():
        return False
    try:
        credentials = _build_credentials(google_auth)
        await _refresh_if_needed(credentials, google_auth, db)
        service = _build_service(credentials)
        service.events().update(
            calendarId=google_auth.calendar_id,
            eventId=google_event_id,
            body=_build_event_body(class_, client, contract),
            sendUpdates="all",
        ).execute()
        return True
    except Exception as exc:
        logger.warning("Google Calendar update_event failed for event %s: %s", google_event_id, exc)
        return False


async def delete_event(
    google_event_id: str,
    google_auth: UserGoogleAuth,
    db: AsyncSession,
) -> bool:
    """Delete a Google Calendar event. Returns True on success (including 404 = already gone)."""
    if not _is_configured():
        return False
    try:
        credentials = _build_credentials(google_auth)
        await _refresh_if_needed(credentials, google_auth, db)
        service = _build_service(credentials)
        service.events().delete(
            calendarId=google_auth.calendar_id,
            eventId=google_event_id,
            sendUpdates="all",
        ).execute()
        return True
    except Exception as exc:
        # 404 means the event was already deleted — not an error
        if "404" in str(exc) or "notFound" in str(exc):
            return True
        logger.warning("Google Calendar delete_event failed for event %s: %s", google_event_id, exc)
        return False


# ─────────────────────────────────────────────
# OAuth helpers
# ─────────────────────────────────────────────

def _build_flow():
    from google_auth_oauthlib.flow import Flow
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )


def _pkce_pair() -> tuple[str, str]:
    """Generate a PKCE (code_verifier, code_challenge) pair using S256."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


def _encode_state(user_id: int, code_verifier: str) -> str:
    """Encode user_id + PKCE code_verifier into the OAuth state parameter."""
    payload = json.dumps({"uid": user_id, "cv": code_verifier})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def _decode_state(state: str) -> tuple[int, str]:
    """Decode the OAuth state parameter into (user_id, code_verifier)."""
    # Add padding in case base64 string is missing it
    payload = json.loads(base64.urlsafe_b64decode(state + "=="))
    return int(payload["uid"]), payload["cv"]


def get_oauth_url(user_id: int) -> str:
    """Build the Google OAuth authorization URL for the given user."""
    flow = _build_flow()
    code_verifier, code_challenge = _pkce_pair()
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # force refresh_token on every connect
        state=_encode_state(user_id, code_verifier),
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    return url


async def exchange_code(code: str, state: str, db: AsyncSession) -> UserGoogleAuth:
    """Exchange an OAuth authorization code for tokens and persist them."""
    user_id, code_verifier = _decode_state(state)
    flow = _build_flow()
    flow.fetch_token(code=code, code_verifier=code_verifier)
    credentials = flow.credentials

    # Extract email from the ID token (included when openid+email scopes are requested)
    google_email = ""
    if credentials.id_token and isinstance(credentials.id_token, dict):
        google_email = credentials.id_token.get("email", "")
    if not google_email and hasattr(credentials, "_id_token"):
        # Fallback: decode the raw JWT payload (no signature verification needed — Google already validated it)
        raw = getattr(credentials, "_id_token", None) or ""
        if raw:
            padding = 4 - len(raw.split(".")[1]) % 4
            payload = json.loads(base64.urlsafe_b64decode(raw.split(".")[1] + "=" * padding))
            google_email = payload.get("email", "")

    expires_at = None
    if credentials.expiry:
        expires_at = credentials.expiry.replace(tzinfo=timezone.utc)

    return await GoogleAuthRepository(db).upsert(
        user_id=user_id,
        google_email=google_email,
        access_token=_encrypt(credentials.token),
        refresh_token=_encrypt(credentials.refresh_token) if credentials.refresh_token else _encrypt(""),
        token_expires_at=expires_at,
    )
