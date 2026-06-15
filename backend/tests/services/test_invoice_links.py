"""Tests for invoice file-link tokens.

A shareable invoice link is authorized by a short-lived signed JWT (not the auth
cookie), so the recipient can open it without logging in. The token carries the
invoice id and a purpose claim, and expires.
"""
from urllib.parse import unquote

import pytest

from app.services.invoice_links import (
    create_invoice_file_token,
    verify_invoice_file_token,
    InvalidInvoiceTokenError,
    build_invoice_whatsapp_url,
)


class TestInvoiceFileToken:
    def test_round_trips_the_invoice_id(self):
        token = create_invoice_file_token(42)
        assert verify_invoice_file_token(token) == 42

    def test_rejects_a_tampered_token(self):
        token = create_invoice_file_token(42)
        with pytest.raises(InvalidInvoiceTokenError):
            verify_invoice_file_token(token + "tampered")

    def test_rejects_a_token_with_the_wrong_purpose(self):
        from jose import jwt
        from app.core.config import settings

        forged = jwt.encode(
            {"invoice_id": 1, "purpose": "something_else"},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        with pytest.raises(InvalidInvoiceTokenError):
            verify_invoice_file_token(forged)

    def test_rejects_an_expired_token(self):
        token = create_invoice_file_token(42, ttl_seconds=-1)
        with pytest.raises(InvalidInvoiceTokenError):
            verify_invoice_file_token(token)


class TestWhatsappUrl:
    def test_includes_phone_digits_and_link(self):
        url = build_invoice_whatsapp_url(
            "+33 6 12 34 56 78",
            "https://host/api/invoices/1/file?token=abc",
            client_name="Marie",
        )
        assert url.startswith("https://wa.me/33612345678?text=")
        decoded = unquote(url)
        assert "Marie" in decoded
        assert "https://host/api/invoices/1/file?token=abc" in decoded

    def test_works_without_client_name(self):
        url = build_invoice_whatsapp_url("0612345678", "https://host/file?token=z")
        assert url.startswith("https://wa.me/0612345678?text=")
