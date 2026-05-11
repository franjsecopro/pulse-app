from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> str:
    token = request.cookies.get("access_token")
    if not token and credentials:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return token


async def get_real_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Always returns the user identified by the 'sub' claim (the actual logged-in user).

    Used by require_admin and /admin/* endpoints so that admin powers are
    never lost when the session is in demo-impersonation mode.
    """
    token = _extract_token(request, credentials)
    return await AuthService(db).get_current_user(token)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Returns the *effective* user for domain operations.

    When the admin has entered demo mode the JWT contains an 'acting_as'
    claim with the demo user's id — this dependency returns that user so
    all domain routers (clients, classes, payments …) operate on demo data
    transparently, with zero changes on their end.

    Falls back to the 'sub' user (normal behaviour) when acting_as is absent.
    """
    token = _extract_token(request, credentials)
    return await AuthService(db).get_effective_user(token)


async def require_admin(real_user: User = Depends(get_real_user)) -> User:
    if real_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return real_user
