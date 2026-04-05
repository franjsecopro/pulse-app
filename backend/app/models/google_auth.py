from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserGoogleAuth(Base):
    """Almacena las credenciales OAuth de Google Calendar por usuario.
    Los tokens se guardan cifrados con Fernet. Un único registro por usuario.
    """
    __tablename__ = "user_google_auth"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_google_auth_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    google_email: Mapped[str] = mapped_column(String(255), nullable=False)
    # Tokens almacenados cifrados (Fernet base64)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # ID del calendario de Google donde se crean los eventos (default: "primary")
    calendar_id: Mapped[str] = mapped_column(String(255), default="primary", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User")
