"""Tests for JWT creation/validation in app.core.security."""
import time

from app.core.security import create_access_token, create_refresh_token, decode_token


class TestTokenClaims:
    def test_access_token_includes_issued_at_claim(self):
        before = int(time.time())

        payload = decode_token(create_access_token({"sub": "1"}))

        after = int(time.time())
        assert "iat" in payload
        assert before <= payload["iat"] <= after

    def test_refresh_token_includes_issued_at_claim(self):
        before = int(time.time())

        payload = decode_token(create_refresh_token({"sub": "1"}))

        after = int(time.time())
        assert payload["type"] == "refresh"
        assert before <= payload["iat"] <= after

    def test_custom_claims_are_preserved(self):
        payload = decode_token(create_access_token({"sub": "7", "acting_as": "3"}))

        assert payload["sub"] == "7"
        assert payload["acting_as"] == "3"
