from datetime import datetime
from typing import List, Optional

from app.schemas._base import BaseSchema


class NotificationResponse(BaseSchema):
    id: int
    client_id: int
    client_name: str
    class_id: int
    class_date: str
    class_time: Optional[str]
    channel: str
    status: str
    message: str
    whatsapp_url: Optional[str]
    sent_at: Optional[datetime]


class NotificationLogPage(BaseSchema):
    items: List[NotificationResponse]
    total: int
    page: int
    page_size: int


class NotificationSettingsResponse(BaseSchema):
    default_channel: str
    message_template: str


class NotificationSettingsUpdate(BaseSchema):
    default_channel: Optional[str] = None
    message_template: Optional[str] = None
