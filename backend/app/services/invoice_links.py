"""Short-lived signed links for sharing an invoice PDF.

The link is authorized by a JWT (signed with the app SECRET_KEY) rather than the
auth cookie, so a client can open it without logging in. The token carries the
invoice id and a fixed ``purpose`` claim, and expires after ``ttl_seconds``.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

from jose import jwt, JWTError

from app.core.config import settings

_PURPOSE = "invoice_file"
DEFAULT_TTL_SECONDS = 7 * 24 * 3600  # a week — enough for the client to fetch it


class InvalidInvoiceTokenError(Exception):
    """Raised when an invoice file token is missing, tampered, wrong, or expired."""


def create_invoice_file_token(invoice_id: int, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> str:
    payload = {
        "invoice_id": invoice_id,
        "purpose": _PURPOSE,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_invoice_file_token(token: str) -> int:
    """Return the invoice id encoded in a valid token, or raise."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise InvalidInvoiceTokenError(str(exc)) from exc

    if payload.get("purpose") != _PURPOSE:
        raise InvalidInvoiceTokenError("wrong token purpose")
    return int(payload["invoice_id"])


def build_invoice_whatsapp_url(
    phone: str, share_url: str, client_name: Optional[str] = None
) -> str:
    """Build a wa.me deep link carrying the invoice text + signed share link.

    WhatsApp can't attach a PDF via a link, so the message carries the URL.
    """
    greeting = f"Bonjour {client_name}, " if client_name else "Bonjour, "
    message = f"{greeting}voici votre facture : {share_url}"
    digits = "".join(ch for ch in phone if ch.isdigit())
    return f"https://wa.me/{digits}?text={quote(message)}"
