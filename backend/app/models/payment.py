from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Date, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    client_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("clients.id"), nullable=True
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    concept: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # 'manual', 'bank_import'
    source: Mapped[str] = mapped_column(String(50), default="manual")
    # 'confirmed', 'pending', 'unmatched'
    status: Mapped[str] = mapped_column(String(50), default="confirmed")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    client: Mapped[Optional["Client"]] = relationship("Client", back_populates="payments")
