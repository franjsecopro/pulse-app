import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.crypto import load_field_encryption_keys, load_google_token_encryption_keys
from app.core.rate_limit import limiter
from app.middleware.error_handler import global_error_handler
from app.routers import auth, clients, classes, payments, dashboard, google_calendar, accounting, notifications, admin
from app.routers import alerts
from app.routers import imports as imports_router
from app.routers import business_profile
from app.routers import invoices
from app.routers import jobs

logging.basicConfig(level=logging.INFO)

if settings.APP_ENV == "development":
    # Allow OAuth2 flow over plain HTTP — only in local development
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

# Google returns full scope URLs (e.g. userinfo.email) instead of short aliases (email)
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_production_secrets()
    load_field_encryption_keys()
    load_google_token_encryption_keys()
    yield


app = FastAPI(
    title="Pulse - Gestor de Contabilidad",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Enforces default_limits on every route without an explicit @limiter.limit
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Total-Count"],
)


async def validation_error_handler(request: Request, exc: ValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = ".".join(str(x) for x in error["loc"][1:])
        msg = error["msg"]
        errors.append(f"{field}: {msg}")
    return JSONResponse(
        status_code=422,
        content={"detail": " | ".join(errors)},
    )


app.add_exception_handler(ValidationError, validation_error_handler)
app.add_exception_handler(Exception, global_error_handler)

app.include_router(auth.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(classes.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(imports_router.router, prefix="/api")
app.include_router(google_calendar.router, prefix="/api")
app.include_router(accounting.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(business_profile.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
