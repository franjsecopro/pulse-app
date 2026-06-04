import os
from typing import Optional

from cryptography.fernet import Fernet, MultiFernet
from sqlalchemy import Text, types
from sqlalchemy.engine import Dialect


KEYSET_FIELD = "field"
KEYSET_GOOGLE = "google"

_KEYSETS: dict[str, list[str]] = {}
_MULTIFERNET_CACHE: dict[str, MultiFernet] = {}


def _set_keys(keys: list[str], keyset: str = KEYSET_FIELD) -> None:
    """Test-only backdoor: the underscore signals it isn't part of the public
    API, but the test suite needs direct access to control keys without going
    through the full startup flow. Production calls ``load_field_encryption_keys``.
    """
    _KEYSETS[keyset] = list(keys)
    _MULTIFERNET_CACHE.pop(keyset, None)


def _get_multifernet(keyset: str = KEYSET_FIELD) -> MultiFernet:
    cached = _MULTIFERNET_CACHE.get(keyset)
    if cached is not None:
        return cached
    keys = _KEYSETS.get(keyset, [])
    if not keys:
        raise RuntimeError(
            f"Encryption keyset {keyset!r} is not configured. Call "
            f"load_field_encryption_keys() (or load_google_token_encryption_keys()) "
            f"at startup, or _set_keys() in tests."
        )
    mf = MultiFernet([Fernet(k.encode()) for k in keys])
    _MULTIFERNET_CACHE[keyset] = mf
    return mf


def encrypt_value(
    plain: Optional[str], keyset: str = KEYSET_FIELD
) -> Optional[str]:
    if plain is None:
        return None
    return _get_multifernet(keyset).encrypt(plain.encode()).decode()


def decrypt_value(
    cipher: Optional[str], keyset: str = KEYSET_FIELD
) -> Optional[str]:
    if cipher is None:
        return None
    return _get_multifernet(keyset).decrypt(cipher.encode()).decode()


def is_already_encrypted(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.startswith("gAAAAA")


def _async_to_sync_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + url[len("postgresql+asyncpg://"):]
    return url


def load_field_encryption_keys() -> list[str]:
    from sqlalchemy import create_engine, text

    from app.core.config import settings

    keys: list[str] = []

    if os.environ.get("APP_ENV", "development") == "production":
        url = os.environ.get("DATABASE_URL_DIRECT") or _async_to_sync_url(
            settings.DATABASE_URL
        )
        engine = create_engine(url)
        try:
            with engine.connect() as conn:
                rows = conn.execute(
                    text(
                        "SELECT name, decrypted_secret FROM vault.decrypted_secrets "
                        "WHERE name IN ("
                        "'field_encryption_key', 'field_encryption_key_prev'"
                        ")"
                    )
                ).all()
        finally:
            engine.dispose()

        by_name = {row[0]: row[1] for row in rows}
        primary = by_name.get("field_encryption_key")
        prev = by_name.get("field_encryption_key_prev")
        if primary:
            keys.append(primary)
        if prev:
            keys.append(prev)
    else:
        raw = os.environ.get("FIELD_ENCRYPTION_KEYS", "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]

    if not keys:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEYS is empty — cannot start. "
            "Set the env var in dev, or load from Supabase Vault in production. "
            "Generate a key with: "
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )

    _set_keys(keys, KEYSET_FIELD)
    return keys


def load_google_token_encryption_keys() -> list[str]:
    from app.core.config import settings

    raw = settings.GOOGLE_TOKEN_ENCRYPTION_KEY.strip()
    if not raw:
        return []

    _set_keys([raw], KEYSET_GOOGLE)
    return [raw]


class EncryptedString(types.TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect: Dialect):
        if value is None:
            return None
        return encrypt_value(value)

    def process_result_value(self, value, dialect: Dialect):
        if value is None:
            return None
        return decrypt_value(value)
