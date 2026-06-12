from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, UserUpdateRequest
from app.services.auth_service import AuthService

def _token_from_request(request: Request) -> str | None:
    return request.cookies.get("access_token")

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=REFRESH_MAX_AGE,
        path="/api/auth/refresh",  # Scoped: browser only sends it to this endpoint
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/auth/refresh")


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, access_token, refresh_token = await AuthService(db).register(data)
    _set_auth_cookies(response, access_token, refresh_token)
    return user


@router.post("/login", response_model=UserResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, access_token, refresh_token = await AuthService(db).login(data)
    _set_auth_cookies(response, access_token, refresh_token)
    return user


@router.post("/refresh", response_model=UserResponse)
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    user, access_token, new_refresh_token = await AuthService(db).refresh(refresh_token)
    _set_auth_cookies(response, access_token, new_refresh_token)
    return user


@router.post("/logout", status_code=204)
async def logout(response: Response):
    _clear_auth_cookies(response)


@router.get("/me", response_model=UserResponse)
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    token = _token_from_request(request)
    is_demo_active, real_email = AuthService.decode_demo_claims(token) if token else (False, None)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        locale=current_user.locale,
        is_demo_active=is_demo_active,
        real_email=real_email,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    request: Request,
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's UI locale preference (BCP 47, e.g. es-ES / fr-FR)."""
    # Re-load into the active session: get_current_user may hand back an instance
    # that isn't attached to this request's session (e.g. demo impersonation),
    # so we fetch the row we are going to mutate.
    user = await db.get(User, current_user.id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.locale = data.locale
    await db.commit()
    await db.refresh(user)

    token = _token_from_request(request)
    is_demo_active, real_email = AuthService.decode_demo_claims(token) if token else (False, None)
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        locale=user.locale,
        is_demo_active=is_demo_active,
        real_email=real_email,
    )
