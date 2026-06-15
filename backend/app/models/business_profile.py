from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Text
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
    # French invoicing identity + contact (PII encrypted).
    siret: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    iban: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    bic: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    # Legal mention toggles on the invoice template.
    rcs_dispense: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vat_exempt: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    payment_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Numbering configuration consumed by invoice_numbering.
    invoice_number_format: Mapped[str] = mapped_column(
        String(40), nullable=False, default="YYYY-MM-NN"
    )
    invoice_sequence_scope: Mapped[str] = mapped_column(
        String(10), nullable=False, default="monthly"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
