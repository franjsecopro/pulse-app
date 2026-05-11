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

        # Preserve acting_as through refresh so demo mode survives token rotation
        acting_as = payload.get("acting_as")
        if acting_as:
            return user, *self._build_tokens(user.id, acting_as_id=int(acting_as))
        return user, *self._build_tokens(user.id)

    async def get_current_user(self, token: str) -> User:
        """Returns the user identified by the 'sub' claim (the real logged-in user)."""
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

    async def get_effective_user(self, token: str) -> User:
        """Returns the *effective* user for domain operations.

        When acting_as is present (demo mode), returns the demo user so
        all domain routers operate on demo data transparently.
        """
        try:
            payload = decode_token(token)
            acting_as = payload.get("acting_as")
            user_id = int(acting_as) if acting_as else int(payload["sub"])
        except (JWTError, KeyError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        result = await self._db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

    @staticmethod
    def decode_demo_claims(token: str) -> tuple[bool, str | None]:
        """Returns (is_demo_active, real_email_or_none) by reading JWT claims.

        Called by /auth/me to enrich UserResponse without an extra DB round-trip
        for the real user's email (it's already in the token claims).
        """
        try:
            payload = decode_token(token)
            acting_as = payload.get("acting_as")
            real_email = payload.get("real_email") if acting_as else None
            return bool(acting_as), real_email
        except (JWTError, KeyError, ValueError):
            return False, None

    def _build_tokens(self, user_id: int, acting_as_id: int | None = None) -> tuple[str, str]:
        token_data: dict = {"sub": str(user_id)}
        if acting_as_id is not None:
            token_data["acting_as"] = str(acting_as_id)
        return (
            create_access_token(token_data),
            create_refresh_token(token_data),
        )

    async def build_demo_tokens(self, real_user: User, demo_user: User) -> tuple[str, str]:
        """Emits tokens that impersonate demo_user while preserving real_user identity."""
        token_data = {
            "sub": str(real_user.id),
            "acting_as": str(demo_user.id),
            "real_email": real_user.email,
        }
        return (
            create_access_token(token_data),
            create_refresh_token(token_data),
        )
