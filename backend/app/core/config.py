from pydantic import model_validator
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
    COOKIE_SECURE: bool = False
    RATE_LIMIT_ENABLED: bool = True

    # Google Calendar OAuth — dejar vacíos si no se usa la integración
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8001/api/google-calendar/callback"
    GOOGLE_TOKEN_ENCRYPTION_KEY: str = ""  # Fernet key: 32 bytes url-safe base64
    FRONTEND_URL: str = "http://localhost:5173"

    # Resend email — dejar vacíos si no se usa el envío de facturas por email
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = ""  # remitente verificado, ej. "Facturas <facturas@tudominio.com>"

    # Scheduled jobs (auto-generation). The external cron sends this token in the
    # X-Job-Token header. Empty = jobs disabled (endpoint returns 503).
    JOB_TOKEN: str = ""
    # Timezone used to resolve "today" for the daily jobs (the tutor's locale).
    BUSINESS_TIMEZONE: str = "Europe/Paris"

    @model_validator(mode="after")
    def _derive_cookie_secure(self):
        self.COOKIE_SECURE = self.APP_ENV == "production"
        return self

    def validate_production_secrets(self) -> None:
        if self.APP_ENV != "production":
            return
        if self.SECRET_KEY == "dev-secret-key-change-in-production":
            raise ValueError(
                "SECRET_KEY is still the dev default. Set a real SECRET_KEY "
                "in the environment for production."
            )
        if not self.GOOGLE_TOKEN_ENCRYPTION_KEY and (
            self.GOOGLE_CLIENT_ID or self.GOOGLE_CLIENT_SECRET
        ):
            raise ValueError(
                "GOOGLE_TOKEN_ENCRYPTION_KEY is empty but Google OAuth is "
                "configured. Either set the key or clear GOOGLE_CLIENT_ID/"
                "GOOGLE_CLIENT_SECRET to disable the integration."
            )


settings = Settings()
