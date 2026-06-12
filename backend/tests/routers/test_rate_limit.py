"""Rate-limiting tests.

The limiter is disabled for the whole test suite (see conftest.py) so normal
tests never hit 429. Each test here re-enables it explicitly and resets the
in-memory counters afterwards.
"""
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import limiter


class TestRefreshRateLimit:
    async def test_refresh_returns_429_after_20_requests_per_minute(
        self, app_client: AsyncClient
    ):
        limiter.reset()
        limiter.enabled = True
        try:
            for _ in range(20):
                response = await app_client.post("/api/auth/refresh")
                assert response.status_code == 401  # no cookie — but still counted

            response = await app_client.post("/api/auth/refresh")
            assert response.status_code == 429
        finally:
            limiter.enabled = False
            limiter.reset()


class TestGlobalDefaultRateLimit:
    async def test_undecorated_endpoint_returns_429_after_200_requests(self):
        from main import app

        limiter.reset()
        limiter.enabled = True
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                for _ in range(200):
                    response = await client.get("/api/health")
                    assert response.status_code == 200

                response = await client.get("/api/health")
                assert response.status_code == 429
        finally:
            limiter.enabled = False
            limiter.reset()
