from datetime import datetime, date, time, timezone
from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Date, Time, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients.id"), nullable=False)
    contract_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("contracts.id"), nullable=True
    )
    class_date: Mapped[date] = mapped_column(Date, nullable=False)
    class_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    duration_hours: Mapped[float] = mapped_column(Float, default=1.0)
    # Hourly rate captured at time of class creation (contract rate snapshot)
    hourly_rate: Mapped[float] = mapped_column(Float, nullable=False)
    # normal | cancelled_with_payment | cancelled_without_payment
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="normal")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_calendar_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    client: Mapped["Client"] = relationship("Client", back_populates="classes")
    contract: Mapped[Optional["Contract"]] = relationship("Contract", lazy="select")
