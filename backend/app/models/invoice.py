from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Date, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import EncryptedString
from app.core.database import Base


class Invoice(Base):
    """A French invoice (factura). Once issued it is a legally immutable
    document: it carries a gapless number and a *frozen snapshot* of the issuer
    and client data, so later edits to the Client/BusinessProfile never alter an
    already-issued invoice.
    """
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients.id"), nullable=False)

    # NULL until issuance — the number is reserved only when the invoice is issued.
    number: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    # 'draft', 'issued', 'sent', 'paid', 'cancelled'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    issue_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # Free-text dates from the French template (may list several sessions).
    execution_dates: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_dates: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_ht: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")

    # Frozen client snapshot (PII encrypted, mirroring the Client model).
    client_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    client_address: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    client_tax_id: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)

    # Frozen issuer snapshot (from BusinessProfile).
    issuer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    issuer_address: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    issuer_siret: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)

    pdf_storage_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pdf_signed_url_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    lines: Mapped[list["InvoiceLine"]] = relationship(
        "InvoiceLine",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
