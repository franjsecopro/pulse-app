from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
import bcrypt as _bcrypt

from app.core.config import settings


def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")[:72]
    return _bcrypt.hashpw(password_bytes, _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    return _bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


def create_access_token(data: dict[str, Any]) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode({**data, "exp": expires}, settings.SECRET_KEY, settings.ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return jwt.encode(
        {**data, "exp": expires, "type": "refresh"}, settings.SECRET_KEY, settings.ALGORITHM
    )


def decode_token(token: str) -> dict[str, Any]:
    """
    Decodes and validates a JWT token.
    @raises JWTError if the token is invalid or expired.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
