from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PaymentIdentifier(Base):
    __tablename__ = "payment_identifiers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    client: Mapped["Client"] = relationship("Client", back_populates="payers")
