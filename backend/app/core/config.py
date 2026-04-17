from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str  # Sin default — debe venir del .env
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    APP_ENV: str = "development"   # "development" | "production"
    COOKIE_SECURE: bool = False    # True en producción (requiere HTTPS)

    # Google Calendar OAuth — dejar vacíos si no se usa la integración
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8001/api/google-calendar/callback"
    GOOGLE_TOKEN_ENCRYPTION_KEY: str = ""  # Fernet key: 32 bytes url-safe base64
    FRONTEND_URL: str = "http://localhost:5173"


settings = Settings()
