import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

logger = logging.getLogger(__name__)


async def global_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception",
        extra={"path": request.url.path, "method": request.method, "error": str(exc)},
        exc_info=exc,
    )

    # Handle Pydantic validation errors with user-friendly messages
    if isinstance(exc, ValidationError):
        errors = []
        for error in exc.errors():
            field = ".".join(str(x) for x in error["loc"][1:])
            msg = error["msg"]
            errors.append(f"{field}: {msg}")
        return JSONResponse(
            status_code=422,
            content={"detail": " | ".join(errors)},
        )

    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Por favor, intenta de nuevo."},
    )
