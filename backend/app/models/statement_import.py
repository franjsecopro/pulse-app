from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StatementImport(Base):
    """Registro de cada extracto bancario importado por el usuario.

    El formato del extracto (CSV hoy; Excel / PDF a futuro) es indistinto: este
    registro guarda el historial de la importación, no el archivo original.
    """
    __tablename__ = "statement_imports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transaction_count: Mapped[int] = mapped_column(Integer, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    # SHA-256 of the uploaded file — used to detect a re-uploaded statement (Nivel 1).
    file_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
