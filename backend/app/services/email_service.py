"""Email delivery via Resend.

The actual HTTP POST is delegated to an injectable ``transport`` callable so the
service is testable without the network. In production the default transport
uses httpx. Configure RESEND_API_KEY and RESEND_FROM in the environment.
"""
import base64
from typing import Awaitable, Callable, Optional

import httpx

from app.core.config import settings

RESEND_ENDPOINT = "https://api.resend.com/emails"

Transport = Callable[[str, dict, dict], Awaitable[dict]]


class EmailNotConfiguredError(Exception):
    """Raised when RESEND_API_KEY / RESEND_FROM are not set."""


async def _httpx_post(url: str, headers: dict, json: dict) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, headers=headers, json=json)
        response.raise_for_status()
        return response.json()


class ResendEmailService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        sender: Optional[str] = None,
        transport: Optional[Transport] = None,
    ):
        self.api_key = settings.RESEND_API_KEY if api_key is None else api_key
        self.sender = settings.RESEND_FROM if sender is None else sender
        self._transport: Transport = transport or _httpx_post

    async def send(
        self,
        to: str,
        subject: str,
        html: str,
        attachments: Optional[list[dict]] = None,
    ) -> dict:
        """Send an email. ``attachments`` is a list of {filename, content(bytes)}."""
        if not self.api_key or not self.sender:
            raise EmailNotConfiguredError("RESEND_API_KEY / RESEND_FROM are not set")

        payload: dict = {
            "from": self.sender,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if attachments:
            payload["attachments"] = [
                {
                    "filename": item["filename"],
                    "content": base64.b64encode(item["content"]).decode("ascii"),
                }
                for item in attachments
            ]

        headers = {"Authorization": f"Bearer {self.api_key}"}
        return await self._transport(RESEND_ENDPOINT, headers, payload)
