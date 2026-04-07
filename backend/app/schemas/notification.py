from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationResponse(BaseModel):
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

    model_config = {"from_attributes": True}


class NotificationSettingsResponse(BaseModel):
    default_channel: str
    message_template: str

    model_config = {"from_attributes": True}


class NotificationSettingsUpdate(BaseModel):
    default_channel: Optional[str] = None
    message_template: Optional[str] = None
