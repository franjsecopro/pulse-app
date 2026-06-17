from datetime import datetime, timezone

from sqlalchemy import String, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InvoiceSequence(Base):
    """Per-user, per-series invoice counter.

    The invoice number is derived from this persistent counter — never from a
    COUNT(*) of invoices — so discarding a draft never creates a gap in the
    issued sequence. `series_key` identifies the legal series ("2026-01" for a
    monthly scope, "2026" for an annual one); `last_number` is the highest
    number already assigned within that series.
    """
    __tablename__ = "invoice_sequences"
    __table_args__ = (
        UniqueConstraint("user_id", "series_key", name="uq_invoice_sequence_user_series"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    series_key: Mapped[str] = mapped_column(String(20), nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
