from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest


class AuthService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def register(self, data: UserRegisterRequest) -> tuple[User, str, str]:
        """Returns (user, access_token, refresh_token)."""
        existing = await self._db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(email=data.email, password_hash=hash_password(data.password))
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)

        return user, *self._build_tokens(user.id)

    async def login(self, data: UserLoginRequest) -> tuple[User, str, str]:
        """Returns (user, access_token, refresh_token)."""
        result = await self._db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        return user, *self._build_tokens(user.id)

    async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
        """Validates refresh token and returns (user, new_access_token, new_refresh_token)."""
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise ValueError("Not a refresh token")
            user_id: int = int(payload["sub"])
        except (JWTError, KeyError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        result = await self._db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        return user, *self._build_tokens(user.id)

    async def get_current_user(self, token: str) -> User:
        try:
            payload = decode_token(token)
            user_id = int(payload["sub"])
        except (JWTError, KeyError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        result = await self._db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

    def _build_tokens(self, user_id: int) -> tuple[str, str]:
        token_data = {"sub": str(user_id)}
        return (
            create_access_token(token_data),
            create_refresh_token(token_data),
        )
