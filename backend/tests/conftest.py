import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
_TEST_FERNET_KEY = "VdGPZU_Fwo2rTdZ5AYMazTmg8jzjyDRVktJSEhafJm4="
os.environ.setdefault("FIELD_ENCRYPTION_KEYS", _TEST_FERNET_KEY)
# Keep 429s out of the suite — rate-limit tests re-enable the limiter explicitly
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core import crypto
from app.core.database import Base, get_db
from app.core.dependencies import get_current_user, get_real_user, require_admin
from app.models.user import User

# Re-import all models so Base.metadata knows about every table
import app.models.user          # noqa: F401
import app.models.client        # noqa: F401
import app.models.contract      # noqa: F401
import app.models.class_        # noqa: F401
import app.models.payment       # noqa: F401
import app.models.statement_import  # noqa: F401
import app.models.business_profile  # noqa: F401
import app.models.invoice_sequence  # noqa: F401
import app.models.invoice          # noqa: F401
import app.models.invoice_line     # noqa: F401
import app.models.invoice_pdf      # noqa: F401
import app.models.notification  # noqa: F401
import app.models.notification_settings  # noqa: F401
import app.models.payment_identifier     # noqa: F401
import app.models.google_auth            # noqa: F401

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Fake users reused across router tests — mirror the User model fields
FAKE_USER  = User(id=1, email="test@pulse.dev",  role="user",  password_hash="x", locale="es-ES")
FAKE_ADMIN = User(id=1, email="admin@pulse.dev", role="admin", password_hash="x", locale="es-ES")


@pytest.fixture(autouse=True)
def _seed_crypto_keys():
    crypto._set_keys([_TEST_FERNET_KEY])
    yield


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """Async DB session backed by an in-memory SQLite database.

    Each test gets a fresh schema — created before the test, dropped after.
    SQLite does not enforce FK constraints by default, so fixtures only need
    to satisfy the columns the code under test actually reads.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def app_client(db: AsyncSession) -> AsyncClient:
    """HTTPX async client wired to the FastAPI app with test overrides:

    - get_db → yields the test SQLite session (same as ``db`` fixture)
    - get_current_user → returns FAKE_USER (no JWT needed)

    Seeding data through the ``db`` fixture is immediately visible to the
    app because they share the same session object.
    """
    from main import app  # late import — DATABASE_URL already set at module top

    async def _override_get_db():
        yield db

    async def _override_get_current_user():
        return FAKE_USER

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_client(db: AsyncSession) -> AsyncClient:
    """HTTPX async client wired to the FastAPI app with admin overrides:

    - get_db → yields the test SQLite session
    - require_admin → returns FAKE_ADMIN (bypasses JWT + role check)

    Use this fixture for all /api/admin/* tests.
    """
    from main import app  # late import — DATABASE_URL already set at module top

    async def _override_get_db():
        yield db

    async def _override_require_admin():
        return FAKE_ADMIN

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_real_user] = _override_require_admin
    app.dependency_overrides[require_admin] = _override_require_admin

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
