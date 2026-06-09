from datetime import datetime, date, time
from typing import Optional

from app.schemas._base import BaseSchema


CLASS_STATUSES = ("normal", "cancelled_with_payment", "cancelled_without_payment")


class ClassCreateRequest(BaseSchema):
    client_id: int
    contract_id: int
    class_date: date
    class_time: Optional[time] = None
    duration_hours: float = 1.0
    hourly_rate: float
    status: str = "normal"
    notes: Optional[str] = None


class ClassUpdateRequest(BaseSchema):
    client_id: Optional[int] = None
    contract_id: Optional[int] = None
    class_date: Optional[date] = None
    class_time: Optional[time] = None
    duration_hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ClassResponse(BaseSchema):
    id: int
    user_id: int
    client_id: int
    contract_id: int
    class_date: date
    class_time: Optional[time]
    duration_hours: float
    hourly_rate: float
    status: str = "normal"
    notes: Optional[str]
    created_at: datetime
    google_calendar_id: Optional[str] = None
    client_name: Optional[str] = None
    contract_description: Optional[str] = None
    effective_revenue: Optional[float] = None


class ClassStatsResponse(BaseSchema):
    count: int
    total_revenue: float
