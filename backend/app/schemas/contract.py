from datetime import datetime, date
from typing import Optional

from app.schemas._base import BaseSchema


class DaySchedule(BaseSchema):
    start: str
    end: str


class ContractCreateRequest(BaseSchema):
    description: str
    start_date: date
    end_date: Optional[date] = None
    hourly_rate: float
    is_active: bool = True
    notes: Optional[str] = None
    schedule_days: Optional[dict[str, DaySchedule]] = None
    calendar_description: Optional[str] = None
    calendar_reminders: Optional[list[dict]] = None
    phone: Optional[str] = None
    notify: bool = False


class ContractUpdateRequest(BaseSchema):
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    hourly_rate: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    schedule_days: Optional[dict[str, DaySchedule]] = None
    calendar_description: Optional[str] = None
    calendar_reminders: Optional[list[dict]] = None
    phone: Optional[str] = None
    notify: Optional[bool] = None


class ContractResponse(BaseSchema):
    id: int
    client_id: int
    description: str
    start_date: date
    end_date: Optional[date]
    hourly_rate: float
    is_active: bool
    notes: Optional[str]
    schedule_days: Optional[dict[str, DaySchedule]]
    calendar_description: Optional[str]
    calendar_reminders: Optional[list[dict]]
    phone: Optional[str]
    notify: bool
    created_at: datetime
