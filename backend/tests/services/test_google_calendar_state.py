"""Tests for the signed OAuth state parameter in google_calendar_service.

The state travels through Google's redirect as a URL parameter. Without a
signature, anyone can forge a state with a victim's user_id and link their own
Google account to that user (account-linking CSRF). These tests pin the
contract: only states signed by us, and recent, are accepted.
"""
import base64
import json
import time

import pytest

from app.services import google_calendar_service as gc_service


class TestEncodeDecodeState:
    def test_roundtrip_returns_user_id_and_code_verifier(self):
        state = gc_service._encode_state(42, "my-code-verifier")

        user_id, code_verifier = gc_service._decode_state(state)

        assert user_id == 42
        assert code_verifier == "my-code-verifier"

    def test_rejects_forged_unsigned_state(self):
        # The exact payload an attacker would craft (the pre-fix wire format):
        # plain base64 JSON with a victim's user_id, no signature.
        forged = base64.urlsafe_b64encode(
            json.dumps({"uid": 1, "cv": "attacker-verifier"}).encode()
        ).decode()

        with pytest.raises(ValueError):
            gc_service._decode_state(forged)

    def test_rejects_tampered_payload(self):
        state = gc_service._encode_state(42, "my-code-verifier")
        data, signature = state.rsplit(".", 1)
        tampered_payload = base64.urlsafe_b64encode(
            json.dumps({"uid": 1, "cv": "my-code-verifier", "ts": int(time.time())}).encode()
        ).decode().rstrip("=")

        with pytest.raises(ValueError):
            gc_service._decode_state(f"{tampered_payload}.{signature}")

    def test_rejects_expired_state(self, monkeypatch):
        state = gc_service._encode_state(42, "my-code-verifier")

        real_time = time.time()
        monkeypatch.setattr(
            gc_service.time, "time", lambda: real_time + gc_service.STATE_MAX_AGE_SECONDS + 1
        )

        with pytest.raises(ValueError):
            gc_service._decode_state(state)

    def test_rejects_garbage_state(self):
        with pytest.raises(ValueError):
            gc_service._decode_state("not-a-valid-state")
