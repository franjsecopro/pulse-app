"""Tests for the Resend email service.

The HTTP call is delegated to an injectable transport so these tests never hit
the network: they verify the Resend payload shape (base64 attachments, sender,
recipients) and the not-configured guard.
"""
import base64

import pytest

from app.services.email_service import ResendEmailService, EmailNotConfiguredError


class TestResendEmailService:
    async def test_raises_when_not_configured(self):
        service = ResendEmailService(api_key="", sender="")
        with pytest.raises(EmailNotConfiguredError):
            await service.send(to="a@b.com", subject="x", html="<p>hi</p>")

    async def test_builds_resend_payload_with_base64_attachment(self):
        captured = {}

        async def fake_transport(url, headers, json):
            captured.update(url=url, headers=headers, json=json)
            return {"id": "email_1"}

        service = ResendEmailService(
            api_key="re_test", sender="Facturas <facturas@pulse.app>", transport=fake_transport,
        )

        result = await service.send(
            to="client@example.com",
            subject="Votre facture",
            html="<p>Bonjour</p>",
            attachments=[{"filename": "facture.pdf", "content": b"%PDF-1.7 data"}],
        )

        assert result == {"id": "email_1"}
        assert captured["url"] == "https://api.resend.com/emails"
        assert captured["headers"]["Authorization"] == "Bearer re_test"
        body = captured["json"]
        assert body["from"] == "Facturas <facturas@pulse.app>"
        assert body["to"] == ["client@example.com"]
        assert body["subject"] == "Votre facture"
        assert body["html"] == "<p>Bonjour</p>"
        attachment = body["attachments"][0]
        assert attachment["filename"] == "facture.pdf"
        assert base64.b64decode(attachment["content"]) == b"%PDF-1.7 data"

    async def test_omits_attachments_key_when_none(self):
        captured = {}

        async def fake_transport(url, headers, json):
            captured.update(json=json)
            return {"id": "email_2"}

        service = ResendEmailService(
            api_key="re_test", sender="facturas@pulse.app", transport=fake_transport,
        )
        await service.send(to="c@example.com", subject="s", html="<p>x</p>")

        assert "attachments" not in captured["json"]
