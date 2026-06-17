from datetime import datetime, timezone

from sqlalchemy import Integer, ForeignKey, DateTime, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InvoicePdf(Base):
    """Cached PDF bytes for an issued invoice (1-1 with Invoice).

    Generated lazily on first access and frozen thereafter — the immutable PDF
    artifact behind the shareable signed link. Kept in its own table so listing
    invoices never loads the binary blob.
    """
    __tablename__ = "invoice_pdfs"

    invoice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("invoices.id", ondelete="CASCADE"), primary_key=True
    )
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
