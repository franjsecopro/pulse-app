"""Tests for AuthService — register, login, refresh and demo-mode claims.

These pin the core authentication contract: who gets tokens, what the tokens
carry, and which failures map to which HTTP errors.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token, hash_password
from app.models.user import User
from app.schemas.auth import UserLoginRequest, UserRegisterRequest
from app.services.auth_service import AuthService

EMAIL = "ana@pulse.dev"
PASSWORD = "Sup3rSecreta"


def _register_request(email: str = EMAIL, password: str = PASSWORD) -> UserRegisterRequest:
    return UserRegisterRequest(email=email, password=password)


def _login_request(email: str = EMAIL, password: str = PASSWORD) -> UserLoginRequest:
    return UserLoginRequest(email=email, password=password)


async def _seed_user(db: AsyncSession, email: str = EMAIL, password: str = PASSWORD) -> User:
    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ─── register ────────────────────────────────────────────────────────────────

class TestRegister:
    async def test_creates_user_and_returns_tokens(self, db: AsyncSession):
        user, access_token, refresh_token = await AuthService(db).register(_register_request())

        assert user.id is not None
        assert user.email == EMAIL
        assert decode_token(access_token)["sub"] == str(user.id)
        assert decode_token(refresh_token)["type"] == "refresh"

    async def test_password_is_stored_hashed_not_plaintext(self, db: AsyncSession):
        user, _, _ = await AuthService(db).register(_register_request())

        assert user.password_hash != PASSWORD
        assert user.password_hash.startswith("$2")  # bcrypt prefix

    async def test_duplicate_email_raises_409(self, db: AsyncSession):
        await AuthService(db).register(_register_request())

        with pytest.raises(HTTPException) as exc_info:
            await AuthService(db).register(_register_request())

        assert exc_info.value.status_code == 409

    @pytest.mark.parametrize(
        "weak_password",
        ["corta1A", "sinmayuscula1", "SINDIGITOS"],
        ids=["too-short", "no-uppercase", "no-digit"],
    )
    def test_weak_password_rejected_at_schema(self, weak_password: str):
        with pytest.raises(ValidationError):
            UserRegisterRequest(email=EMAIL, password=weak_password)


# ─── login ───────────────────────────────────────────────────────────────────

class TestLogin:
    async def test_valid_credentials_return_user_and_tokens(self, db: AsyncSession):
        seeded = await _seed_user(db)

        user, access_token, _ = await AuthService(db).login(_login_request())

        assert user.id == seeded.id
        assert decode_token(access_token)["sub"] == str(seeded.id)

    async def test_wrong_password_raises_401(self, db: AsyncSession):
        await _seed_user(db)

        with pytest.raises(HTTPException) as exc_info:
            await AuthService(db).login(_login_request(password="OtraClave9"))

        assert exc_info.value.status_code == 401

    async def test_unknown_email_raises_401_with_same_detail_as_wrong_password(
        self, db: AsyncSession
    ):
        """Same message for both failures — no user enumeration via error text."""
        await _seed_user(db)

        with pytest.raises(HTTPException) as unknown_email:
            await AuthService(db).login(_login_request(email="nadie@pulse.dev"))
        with pytest.raises(HTTPException) as wrong_password:
            await AuthService(db).login(_login_request(password="OtraClave9"))

        assert unknown_email.value.status_code == 401
        assert unknown_email.value.detail == wrong_password.value.detail


# ─── refresh ─────────────────────────────────────────────────────────────────

def _make_token(claims: dict, *, expires_in_minutes: int = 5) -> str:
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes),
        **claims,
    }
    return jwt.encode(payload, settings.SECRET_KEY, settings.ALGORITHM)


class TestRefresh:
    async def test_valid_refresh_token_returns_new_tokens(self, db: AsyncSession):
        seeded = await _seed_user(db)
        _, _, refresh_token = await AuthService(db).login(_login_request())

        user, new_access, new_refresh = await AuthService(db).refresh(refresh_token)

        assert user.id == seeded.id
        assert decode_token(new_access)["sub"] == str(seeded.id)
        assert decode_token(new_refresh)["type"] == "refresh"

    async def test_access_token_rejected_as_refresh_with_401(self, db: AsyncSession):
        await _seed_user(db)
        _, access_token, _ = await AuthService(db).login(_login_request())

        with pytest.raises(HTTPException) as exc_info:
            await AuthService(db).refresh(access_token)

        assert exc_info.value.status_code == 401

    async def test_expired_refresh_token_raises_401(self, db: AsyncSession):
        seeded = await _seed_user(db)
        expired = _make_token(
            {"sub": str(seeded.id), "type": "refresh"}, expires_in_minutes=-1
        )

        with pytest.raises(HTTPException) as exc_info:
            await AuthService(db).refresh(expired)

        assert exc_info.value.status_code == 401

    async def test_garbage_token_raises_401(self, db: AsyncSession):
        with pytest.raises(HTTPException) as exc_info:
            await AuthService(db).refresh("not-a-jwt")

        assert exc_info.value.status_code == 401

    async def test_refresh_for_deleted_user_raises_401(self, db: AsyncSession):
        token = _make_token({"sub": "99999", "type": "refresh"})

        with pytest.raises(HTTPException) as exc_info:
            await AuthService(db).refresh(token)

        assert exc_info.value.status_code == 401

    async def test_acting_as_survives_refresh(self, db: AsyncSession):
        """Demo mode must survive token rotation — acting_as is re-emitted."""
        admin = await _seed_user(db, email="admin@pulse.dev")
        demo = await _seed_user(db, email="demo@pulse.dev")
        refresh_token = _make_token(
            {"sub": str(admin.id), "type": "refresh", "acting_as": str(demo.id)}
        )

        user, new_access, new_refresh = await AuthService(db).refresh(refresh_token)

        assert user.id == admin.id
        assert decode_token(new_access)["acting_as"] == str(demo.id)
        assert decode_token(new_refresh)["acting_as"] == str(demo.id)


# ─── demo claims ─────────────────────────────────────────────────────────────

class TestDecodeDemoClaims:
    def test_token_with_acting_as_reports_demo_active(self):
        token = _make_token(
            {"sub": "1", "acting_as": "2", "real_email": "admin@pulse.dev"}
        )

        is_demo, real_email = AuthService.decode_demo_claims(token)

        assert is_demo is True
        assert real_email == "admin@pulse.dev"

    def test_plain_token_reports_no_demo(self):
        token = _make_token({"sub": "1"})

        is_demo, real_email = AuthService.decode_demo_claims(token)

        assert is_demo is False
        assert real_email is None

    def test_garbage_token_reports_no_demo_without_raising(self):
        is_demo, real_email = AuthService.decode_demo_claims("garbage")

        assert is_demo is False
        assert real_email is None
