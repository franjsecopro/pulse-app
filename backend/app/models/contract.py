from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import String, Boolean, Integer, Float, ForeignKey, DateTime, Date, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients.id"), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hourly_rate: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # schedule_days: {"0": {"start": "09:00", "end": "10:30"}, ...} — weekday → {start, end}
    schedule_days: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Descripción que aparece en el evento de Google Calendar y en los emails de recordatorio
    calendar_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Recordatorios personalizados: [{"method": "email", "minutes": 1440}, ...]
    calendar_reminders: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Teléfono del alumno (puede diferir del pagador/client)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Habilita notificaciones/recordatorios para este contrato
    notify: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="contracts")
