"""Single shared rate limiter for the whole app.

One instance = one counter storage. Routers add stricter per-route limits with
``@limiter.limit(...)``; everything else falls under ``default_limits`` via
``SlowAPIMiddleware`` (registered in main.py). Tests disable it through the
``RATE_LIMIT_ENABLED`` setting so suites never trip 429s.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    enabled=settings.RATE_LIMIT_ENABLED,
)
