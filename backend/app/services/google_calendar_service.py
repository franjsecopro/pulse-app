"""Google Calendar OAuth2 + event fetching service (read-only MVP)."""
from datetime import datetime, timezone
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def build_oauth_flow() -> Flow:
    return Flow.from_client_config(
        client_config={
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


def get_auth_url(state: str) -> str:
    """Generate Google OAuth authorization URL."""
    flow = build_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    """Exchange OAuth code for access + refresh tokens."""
    flow = build_oauth_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry,
    }


def _build_credentials(access_token: str, refresh_token: Optional[str], expiry: Optional[datetime]) -> Credentials:
    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
        expiry=expiry,
    )


def fetch_events(
    access_token: str,
    refresh_token: Optional[str],
    token_expiry: Optional[datetime],
    calendar_id: str,
    month: int,
    year: int,
) -> list[dict]:
    """Fetch calendar events for a given month/year."""
    creds = _build_credentials(access_token, refresh_token, token_expiry)

    # Refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    service = build("calendar", "v3", credentials=creds)

    time_min = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    # Last day of month
    if month == 12:
        time_max = datetime(year + 1, 1, 1, tzinfo=timezone.utc).isoformat()
    else:
        time_max = datetime(year, month + 1, 1, tzinfo=timezone.utc).isoformat()

    result = service.events().list(
        calendarId=calendar_id,
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
        maxResults=250,
    ).execute()

    events = []
    for event in result.get("items", []):
        start = event.get("start", {})
        end = event.get("end", {})

        # Skip all-day events with no time
        start_str = start.get("dateTime") or start.get("date")
        end_str = end.get("dateTime") or end.get("date")
        if not start_str:
            continue

        # Parse duration in hours
        duration_hours = 1.0
        try:
            if "dateTime" in start and "dateTime" in end:
                t_start = datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
                t_end = datetime.fromisoformat(end["dateTime"].replace("Z", "+00:00"))
                duration_hours = round((t_end - t_start).total_seconds() / 3600, 2)
        except Exception:
            pass

        # Parse date and time
        class_date = start_str[:10]  # YYYY-MM-DD
        class_time = None
        if "dateTime" in start:
            class_time = start["dateTime"][11:16]  # HH:MM

        events.append({
            "google_event_id": event["id"],
            "summary": event.get("summary", "Sin título"),
            "class_date": class_date,
            "class_time": class_time,
            "duration_hours": duration_hours,
        })

    return events


def refresh_tokens_if_needed(
    access_token: str,
    refresh_token: Optional[str],
    token_expiry: Optional[datetime],
) -> Optional[dict]:
    """Refresh tokens if expired. Returns new token data or None if not needed."""
    creds = _build_credentials(access_token, refresh_token, token_expiry)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        return {
            "access_token": creds.token,
            "expiry": creds.expiry,
        }
    return None
