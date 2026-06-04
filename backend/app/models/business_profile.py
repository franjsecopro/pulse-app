from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.crypto import EncryptedString
from app.core.database import Base


class BusinessProfile(Base):
    """Datos fiscales del emisor (1-a-1 con User). Base para la facturación."""
    __tablename__ = "business_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    business_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    fiscal_address: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
