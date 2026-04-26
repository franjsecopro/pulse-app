# P0 Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three P0 security vulnerabilities: migrate auth tokens from localStorage to httpOnly cookies, restrict OAUTHLIB_INSECURE_TRANSPORT to development only, and complete the admin user-deletion cascade.

**Architecture:** The cookie migration replaces localStorage-based token management with server-set httpOnly cookies. The backend sets/clears cookies on auth endpoints; the frontend removes all manual token handling and relies on the browser's automatic cookie transport with `credentials: 'include'`. The other two fixes are surgical changes with no architectural impact.

**Tech Stack:** FastAPI (backend), React + TypeScript (frontend), Vite proxy (same-origin for cookies in dev), Pydantic, SQLAlchemy async

---

## File Map

**Backend — modified:**
- `backend/app/core/config.py` — add `COOKIE_SECURE`, `APP_ENV`
- `backend/app/core/dependencies.py` — read token from cookie OR Authorization header
- `backend/app/schemas/auth.py` — add `LoginResponse` (user info only); remove `TokenResponse` and `RefreshTokenRequest` from router use
- `backend/app/routers/auth.py` — set/clear httpOnly cookies on login/register/refresh; add logout endpoint; read refresh token from cookie
- `backend/app/services/auth_service.py` — split `_build_token_response` into token generation + user response; add `build_tokens` helper
- `backend/main.py` — guard `OAUTHLIB_INSECURE_TRANSPORT` with APP_ENV check

**Backend — untouched:** all repositories, models, other routers, alembic migrations

**Frontend — modified:**
- `frontend/src/services/api.ts` — add `credentials: 'include'`, remove localStorage, simplify refresh flow
- `frontend/src/services/auth.service.ts` — login/register return `User`; logout calls POST `/auth/logout`
- `frontend/src/context/AuthContext.tsx` — remove all `api.storeTokens()` / `api.clearTokens()` calls; load user by calling `/auth/me` unconditionally
- `frontend/src/types/index.ts` — remove `TokenResponse` interface

**Frontend — untouched:** all pages, components, other services, hooks

---

## Task 1: Fix admin user-deletion cascade

**Files:**
- Modify: `backend/app/routers/admin.py:78-91`

This is a bug: when deleting a user, `Contract` and `PaymentIdentifier` rows with that user's clients are not deleted. Because clients are deleted, the FK cascade in the DB should handle contract/payer rows IF foreign keys are configured with CASCADE — but since this is explicit ORM deletion, we need to be explicit.

Actually the safest fix here is to delete Contract and PaymentIdentifier rows by joining through Client (since these models don't have `user_id` directly, they reference `client_id`). We need to use a subquery or load client IDs first.

- [ ] **Step 1: Fix the delete cascade in admin.py**

Open `backend/app/routers/admin.py`. Replace the delete block (lines 78-91):

```python
# BEFORE (missing Contract and PaymentIdentifier)
    for model in (
        Notification,
        NotificationSettings,
        PDFImport,
        Payment,
        Class,
        Client,
        UserGoogleAuth,
    ):
        await db.execute(sql_delete(model).where(model.user_id == user_id))

    await db.execute(sql_delete(User).where(User.id == user_id))
```

Replace with:

```python
    # First get all client IDs belonging to this user (needed for models without user_id)
    client_ids_result = await db.execute(
        select(Client.id).where(Client.user_id == user_id)
    )
    client_ids = [row[0] for row in client_ids_result.all()]

    # Delete models that reference client_id (no user_id column)
    if client_ids:
        await db.execute(sql_delete(PaymentIdentifier).where(PaymentIdentifier.client_id.in_(client_ids)))
        await db.execute(sql_delete(Contract).where(Contract.client_id.in_(client_ids)))

    # Delete models with user_id directly
    for model in (
        Notification,
        NotificationSettings,
        PDFImport,
        Payment,
        Class,
        Client,
        UserGoogleAuth,
    ):
        await db.execute(sql_delete(model).where(model.user_id == user_id))

    await db.execute(sql_delete(User).where(User.id == user_id))
```

Also update the imports at the top of the file to include the missing models:

```python
from app.models.contract import Contract
from app.models.payment_identifier import PaymentIdentifier
```

These imports are already present at lines 18-19. Confirm they are there before saving.

- [ ] **Step 2: Verify the models have the right column names**

Check `backend/app/models/contract.py` and `backend/app/models/payment_identifier.py` to confirm the FK column is named `client_id` in both. If different, update the `where` clauses accordingly.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/admin.py
git commit -m "fix: complete user deletion cascade to include Contract and PaymentIdentifier"
```

---

## Task 2: Guard OAUTHLIB_INSECURE_TRANSPORT to dev only

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/main.py:18-20`

- [ ] **Step 1: Add APP_ENV to config**

Open `backend/app/core/config.py`. Add two fields to `Settings`:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    APP_ENV: str = "development"           # "development" | "production"
    COOKIE_SECURE: bool = False            # True in production (HTTPS only)

    # Google Calendar OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8001/api/google-calendar/callback"
    GOOGLE_TOKEN_ENCRYPTION_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
```

- [ ] **Step 2: Guard the env var in main.py**

Open `backend/main.py`. Replace lines 17-20:

```python
# BEFORE
# Required for OAuth2 flow over HTTP in local development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
# Google returns full scope URLs
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
```

```python
# AFTER
if settings.APP_ENV == "development":
    # Allow OAuth2 flow over HTTP in local development only
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

# Google returns full scope URLs (e.g. userinfo.email) instead of short aliases
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py backend/main.py
git commit -m "fix: restrict OAUTHLIB_INSECURE_TRANSPORT to development environment only"
```

---

## Task 3: Migrate auth tokens from localStorage to httpOnly cookies

This is the largest change. It touches the auth flow on both backend and frontend. The Vite proxy makes frontend (`:5173`) and backend (`:8001`) share the same origin from the browser's perspective, so cookies set by the proxied responses are correctly associated with `localhost:5173`.

**Cookie attributes used:**
- `httponly=True` — not accessible by JavaScript
- `secure=settings.COOKIE_SECURE` — only sent over HTTPS (False in dev)
- `samesite="strict"` — not sent on cross-site requests (CSRF protection)
- `max_age` — access: 30 min, refresh: 7 days

### 3a: Backend — auth service refactor

**Files:**
- Modify: `backend/app/services/auth_service.py`

- [ ] **Step 1: Extract token building from response building**

Replace the entire `auth_service.py` content:

```python
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
```

Note: `email` removed from JWT payload — `sub` (user_id) is sufficient and avoids stale email in token.

### 3b: Backend — auth router with cookie responses

**Files:**
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/schemas/auth.py`

- [ ] **Step 2: Add LoginResponse schema to auth.py schemas**

Open `backend/app/schemas/auth.py`. Add `LoginResponse` (returned by login/register/refresh instead of `TokenResponse`). Keep `TokenResponse` for now only if referenced elsewhere; the router will no longer use it.

Full file replacement:

```python
from pydantic import BaseModel, EmailStr, field_validator
import re


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        errors = []
        if len(password) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", password):
            errors.append("one uppercase letter")
        if not re.search(r"[0-9]", password):
            errors.append("one digit")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return password


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str = "user"

    model_config = {"from_attributes": True}
```

`TokenResponse` and `RefreshTokenRequest` are deleted — they're no longer needed.

- [ ] **Step 3: Rewrite auth router to use cookies**

Replace the entire `backend/app/routers/auth.py`:

```python
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse
from app.services.auth_service import AuthService

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
        path="/api/auth/refresh",  # Scoped: only sent to the refresh endpoint
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/auth/refresh")


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, access_token, refresh_token = await AuthService(db).register(data)
    _set_auth_cookies(response, access_token, refresh_token)
    return user


@router.post("/login", response_model=UserResponse)
async def login(
    data: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, access_token, refresh_token = await AuthService(db).login(data)
    _set_auth_cookies(response, access_token, refresh_token)
    return user


@router.post("/refresh", response_model=UserResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    user, access_token, new_refresh_token = await AuthService(db).refresh(refresh_token)
    _set_auth_cookies(response, access_token, new_refresh_token)
    return user


@router.post("/logout", status_code=204)
async def logout(response: Response):
    _clear_auth_cookies(response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

Note: `refresh_token` cookie is scoped to `path="/api/auth/refresh"` — the browser only sends it to that specific endpoint, reducing its exposure surface.

### 3c: Backend — dependencies read token from cookie

**Files:**
- Modify: `backend/app/core/dependencies.py`

- [ ] **Step 4: Update get_current_user to read from cookie**

Replace `backend/app/core/dependencies.py`:

```python
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Prefer cookie; fall back to Authorization header (for direct API / CLI use)
    token = request.cookies.get("access_token")
    if not token and credentials:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    auth_service = AuthService(db)
    return await auth_service.get_current_user(token)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

`auto_error=False` on the bearer scheme means it won't throw if the header is absent — we handle that ourselves.

### 3d: Frontend — api.ts stripped of localStorage

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 5: Rewrite api.ts**

Replace the entire file:

```typescript
const BASE_URL = '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function refreshSession(): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  return response.ok
}

async function requestFull<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',   // sends httpOnly cookies automatically
  })

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return requestFull<T>(path, options, false)
    }
    window.location.href = '/login'
    throw new ApiError(401, 'Session expired')
  }

  if (response.status === 204) return { data: undefined as T, headers: response.headers }

  const data = await response.json()

  if (!response.ok) {
    let errorMessage = 'Request failed'
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((err: unknown) => (err as { msg?: string }).msg || String(err))
          .join(', ')
      } else {
        errorMessage = String(data.detail)
      }
    }
    throw new ApiError(response.status, errorMessage)
  }

  return { data: data as T, headers: response.headers }
}

function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  return requestFull<T>(path, options, retry).then(r => r.data)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getPageable: <T>(path: string) =>
    requestFull<T>(path).then(({ data, headers }) => ({
      data,
      total: parseInt(headers.get('X-Total-Count') ?? '0', 10),
    })),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
```

Key changes:
- No `localStorage` anywhere
- `credentials: 'include'` on every request
- No `Authorization` header
- `refreshSession` calls `POST /auth/refresh` with no body (cookie is sent automatically)
- `storeTokens`, `clearTokens`, `getStoredTokens` removed from exports

### 3e: Frontend — auth.service.ts

**Files:**
- Modify: `frontend/src/services/auth.service.ts`

- [ ] **Step 6: Update auth service**

Replace the entire file:

```typescript
import { api } from './api'
import type { User } from '../types'

export const authService = {
  register: (email: string, password: string) =>
    api.post<User>('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),

  getMe: () => api.get<User>('/auth/me'),

  logout: () => api.post<void>('/auth/logout', {}),
}
```

`login` and `register` now return `User` directly (the backend sets cookies as a side effect). `logout` calls `POST /auth/logout` to clear the httpOnly cookies server-side.

### 3f: Frontend — AuthContext.tsx

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 7: Clean up AuthContext**

Replace the entire file:

```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authService } from '../services/auth.service'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadCurrentUser = useCallback(async () => {
    try {
      // If cookie exists and is valid, /auth/me returns the user
      const currentUser = await authService.getMe()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  const login = async (email: string, password: string) => {
    const currentUser = await authService.login(email, password)
    setUser(currentUser)
  }

  const register = async (email: string, password: string) => {
    const currentUser = await authService.register(email, password)
    setUser(currentUser)
  }

  const logout = async () => {
    await authService.logout()   // server clears httpOnly cookies
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

Key changes:
- `loadCurrentUser` no longer checks localStorage — just calls `/auth/me` (cookie is sent automatically)
- `login`/`register` receive `User` directly from service — no token storing
- `logout` is now `async` and calls the backend to clear cookies
- No imports from `api` — AuthContext doesn't need to know about token plumbing

### 3g: Frontend — types cleanup and logout call sites

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 8: Remove TokenResponse from types**

Open `frontend/src/types/index.ts`. Delete the `TokenResponse` interface (lines 7-11):

```typescript
// DELETE this block:
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}
```

- [ ] **Step 9: Fix logout call site — it's now async**

The `logout` function is now `async`. Search for uses of `logout()` in the codebase:

```bash
grep -r "logout" frontend/src --include="*.tsx" --include="*.ts" -n
```

For each call site where `logout()` is called without `await`, either add `await` or handle the promise. The most common location is the header/sidebar component. Open it and update:

```typescript
// BEFORE
const handleLogout = () => {
  logout()
}

// AFTER
const handleLogout = async () => {
  await logout()
}
```

- [ ] **Step 10: Commit**

```bash
git add \
  backend/app/services/auth_service.py \
  backend/app/schemas/auth.py \
  backend/app/routers/auth.py \
  backend/app/core/dependencies.py \
  backend/app/core/config.py \
  frontend/src/services/api.ts \
  frontend/src/services/auth.service.ts \
  frontend/src/context/AuthContext.tsx \
  frontend/src/types/index.ts
git commit -m "feat: migrate auth tokens from localStorage to httpOnly cookies"
```

---

## Verification Checklist

After completing all tasks, verify manually:

- [ ] Login sets two `Set-Cookie` headers in the response (visible in DevTools → Network → login request → Response Headers)
- [ ] Cookies appear in DevTools → Application → Cookies → localhost as `access_token` and `refresh_token` with `HttpOnly` flag
- [ ] JavaScript `document.cookie` does NOT contain `access_token` or `refresh_token`
- [ ] Refreshing the page while logged in keeps the session (cookie is sent to `/auth/me`)
- [ ] Clicking logout removes cookies (DevTools → Application → Cookies)
- [ ] After logout, refreshing → redirects to `/login`
- [ ] Admin page still works for admin users
- [ ] PDF upload still works (multipart request with cookies)

---

## Notes for Production Deployment

Set these env vars in the production `.env`:

```
APP_ENV=production
COOKIE_SECURE=True
```

With `COOKIE_SECURE=True`, cookies are only sent over HTTPS. Ensure the frontend and backend share the same domain so `SameSite=Strict` allows cookie transmission.
