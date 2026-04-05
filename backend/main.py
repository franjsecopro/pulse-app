import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.config import settings
from app.middleware.error_handler import global_error_handler
from app.routers import auth, clients, classes, payments, dashboard, google_calendar
from app.routers import imports as imports_router

logging.basicConfig(level=logging.INFO)

# Required for OAuth2 flow over HTTP in local development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
# Google returns full scope URLs (e.g. userinfo.email) instead of short aliases (email)
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # Tablas gestionadas por Alembic: ejecutar "make migrate"


app = FastAPI(
    title="Pulse - Gestor de Contabilidad",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
