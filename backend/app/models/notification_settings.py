from sqlalchemy import String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

DEFAULT_TEMPLATE = "Hola {nombre}, te recuerdo que mañana {dia} tienes clase a las {hora}. ¡Hasta mañana!"


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    default_channel: Mapped[str] = mapped_column(String(20), nullable=False, default="whatsapp")
    message_template: Mapped[str] = mapped_column(Text, nullable=False, default=DEFAULT_TEMPLATE)

    user: Mapped["User"] = relationship("User")
