from __future__ import annotations
from datetime import datetime, date, timedelta, timezone
from typing import Optional
from urllib.parse import quote
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.class_ import Class
from app.models.client import Client
from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings, DEFAULT_TEMPLATE
from app.schemas.notification import NotificationSettingsUpdate

DAYS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MONTHS_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _format_date_es(d: date) -> str:
    """Returns 'lunes 14 de abril'."""
    day_name = DAYS_ES[d.weekday()]
    month_name = MONTHS_ES[d.month - 1]
    return f"{day_name} {d.day} de {month_name}"


def _render_template(template: str, client: Client, cls: Class) -> str:
    """Replaces {nombre}, {hora}, {dia}, {materia} in the template."""
    hora = cls.class_time.strftime("%H:%M") if cls.class_time else "la hora habitual"
    dia = _format_date_es(cls.class_date)
    materia = cls.contract.description if cls.contract else ""
    return (
        template
        .replace("{nombre}", client.name)
        .replace("{hora}", hora)
        .replace("{dia}", dia)
        .replace("{materia}", materia)
    )


def _build_whatsapp_url(phone: str, message: str) -> str:
    """Builds a wa.me deep link with the encoded message."""
    clean_phone = phone.replace(" ", "").replace("-", "").replace("+", "")
    return f"https://wa.me/{clean_phone}?text={quote(message)}"


class NotificationService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_settings(self, user_id: int) -> NotificationSettings:
        """Returns settings for the user, creating defaults if they don't exist yet."""
        result = await self._db.execute(
            select(NotificationSettings).where(NotificationSettings.user_id == user_id)
        )
        settings = result.scalar_one_or_none()
        if settings is None:
            settings = NotificationSettings(
                user_id=user_id,
                default_channel="whatsapp",
                message_template=DEFAULT_TEMPLATE,
            )
            self._db.add(settings)
            await self._db.commit()
            await self._db.refresh(settings)
        return settings

    async def update_settings(self, user_id: int, data: NotificationSettingsUpdate) -> NotificationSettings:
        settings = await self.get_settings(user_id)
        if data.default_channel is not None:
            settings.default_channel = data.default_channel
        if data.message_template is not None:
            settings.message_template = data.message_template
        await self._db.commit()
        await self._db.refresh(settings)
        return settings

    async def generate_daily(self, user_id: int, target_date: Optional[date] = None) -> list[Notification]:
        """
        Creates 'pending' notification records for classes on target_date
        that don't already have a notification. Defaults to tomorrow.
        """
        if target_date is None:
            target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()

        settings = await self.get_settings(user_id)

        # Load classes for target_date (excluding cancelled without payment)
        result = await self._db.execute(
            select(Class)
            .options(selectinload(Class.client), selectinload(Class.contract))
            .where(
                Class.user_id == user_id,
                Class.class_date == target_date,
                Class.status != "cancelled_without_payment",
            )
        )
        classes = result.scalars().all()

        # Find class_ids that already have a pending or sent notification (not skipped —
        # skipped can be retried if the client now has a WhatsApp number)
        existing_result = await self._db.execute(
            select(Notification.class_id).where(
                Notification.user_id == user_id,
                Notification.class_date == target_date,
                Notification.status.in_(["pending", "sent"]),
            )
        )
        already_notified = set(existing_result.scalars().all())

        # Delete existing skipped notifications so they can be recreated with updated info
        await self._db.execute(
            delete(Notification).where(
                Notification.user_id == user_id,
                Notification.class_date == target_date,
                Notification.status == "skipped",
            )
        )

        created: list[Notification] = []
        for cls in classes:
            if cls.id in already_notified:
                continue

            client = cls.client
            phone = client.whatsapp_phone
            message = _render_template(settings.message_template, client, cls)

            if phone:
                status = "pending"
                whatsapp_url = _build_whatsapp_url(phone, message)
            else:
                status = "skipped"
                whatsapp_url = None

            notification = Notification(
                user_id=user_id,
                class_id=cls.id,
                client_id=client.id,
                channel=settings.default_channel,
                status=status,
                message=message,
                class_date=target_date,
            )
            # Store the whatsapp_url as a transient attribute for the response
            notification.__dict__["_whatsapp_url"] = whatsapp_url
            self._db.add(notification)
            created.append(notification)

        await self._db.commit()
        for n in created:
            await self._db.refresh(n)
            # Re-attach the url after refresh
            url = n.__dict__.get("_whatsapp_url")
            if url is None and n.status == "pending":
                # Reload client to rebuild url
                client_result = await self._db.execute(
                    select(Client).where(Client.id == n.client_id)
                )
                client = client_result.scalar_one()
                if client.whatsapp_phone:
                    n.__dict__["_whatsapp_url"] = _build_whatsapp_url(client.whatsapp_phone, n.message)

        return created

    async def mark_sent(self, notification_id: int, user_id: int) -> Notification:
        """Marks a notification as sent."""
        result = await self._db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if notification is None:
            raise ValueError(f"Notification {notification_id} not found")
        notification.status = "sent"
        notification.sent_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(notification)
        return notification

    async def get_pending(self, user_id: int) -> list[dict]:
        """Returns pending notifications with computed whatsapp_url."""
        result = await self._db.execute(
            select(Notification)
            .options(selectinload(Notification.client), selectinload(Notification.class_session))
            .where(
                Notification.user_id == user_id,
                Notification.status.in_(["pending", "skipped"]),
            )
            .order_by(Notification.class_date, Notification.created_at)
        )
        notifications = result.scalars().all()
        return [_serialize(n) for n in notifications]

    async def get_log(self, user_id: int, limit: int = 100) -> list[dict]:
        """Returns notification history ordered by most recent first."""
        result = await self._db.execute(
            select(Notification)
            .options(selectinload(Notification.client), selectinload(Notification.class_session))
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        notifications = result.scalars().all()
        return [_serialize(n) for n in notifications]


def _serialize(n: Notification) -> dict:
    """Converts a Notification ORM object to a response dict with whatsapp_url."""
    client = n.client
    cls = n.class_session

    whatsapp_url = None
    if n.status == "pending" and client and client.whatsapp_phone:
        whatsapp_url = _build_whatsapp_url(client.whatsapp_phone, n.message)

    return {
        "id": n.id,
        "client_id": n.client_id,
        "client_name": client.name if client else "",
        "class_id": n.class_id,
        "class_date": n.class_date.isoformat(),
        "class_time": cls.class_time.strftime("%H:%M") if cls and cls.class_time else None,
        "channel": n.channel,
        "status": n.status,
        "message": n.message,
        "whatsapp_url": whatsapp_url,
        "sent_at": n.sent_at,
    }
