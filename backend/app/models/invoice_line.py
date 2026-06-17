from typing import Optional

from sqlalchemy import String, Integer, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class InvoiceLine(Base):
    """A single billable line of an invoice (e.g. "Cours particuliers").

    `total_ht` is the effective billed amount (from class_revenue), which may be
    0 for a cancelled-without-payment source class even when quantity * unit
    price would be positive. `source_class_id` keeps traceability to the class.
    """
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    designation: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price_ht: Mapped[float] = mapped_column(Float, nullable=False)
    total_ht: Mapped[float] = mapped_column(Float, nullable=False)
    source_class_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=True
    )

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="lines")
