import asyncio
import sys
import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Añadir el directorio backend al path para importar la app
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base

# Importar todos los modelos para que Alembic los detecte en Base.metadata
from app.models import *  # noqa: F401, F403

config = context.config
fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Modo offline: genera SQL sin conectar a la BD."""
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Modo online: conecta a la BD y aplica migraciones."""
    connectable = create_async_engine(settings.DATABASE_URL)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
