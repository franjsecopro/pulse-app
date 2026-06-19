from datetime import datetime, date, time
from typing import Literal, Optional, get_args

from app.schemas._base import BaseSchema


# Single source of truth for class statuses. Stored in the DB and sent on the
# wire in camelCase — billing logic compares these exact strings, so any other
# value must be rejected at the schema boundary.
ClassStatus = Literal["normal", "cancelledWithPayment", "cancelledWithoutPayment"]
CLASS_STATUSES: tuple[str, ...] = get_args(ClassStatus)

STATUS_NORMAL: ClassStatus = "normal"
STATUS_CANCELLED_WITH_PAYMENT: ClassStatus = "cancelledWithPayment"
STATUS_CANCELLED_WITHOUT_PAYMENT: ClassStatus = "cancelledWithoutPayment"


class ClassCreateRequest(BaseSchema):
    client_id: int
    contract_id: int
    class_date: date
    class_time: Optional[time] = None
    duration_hours: float = 1.0
    hourly_rate: float
    status: ClassStatus = STATUS_NORMAL
    notes: Optional[str] = None


class ClassUpdateRequest(BaseSchema):
    client_id: Optional[int] = None
    contract_id: Optional[int] = None
    class_date: Optional[date] = None
    class_time: Optional[time] = None
    duration_hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    status: Optional[ClassStatus] = None
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
    gcal_sync_status: Optional[str] = None
    client_name: Optional[str] = None
    contract_description: Optional[str] = None
    effective_revenue: Optional[float] = None


class ClassStatsResponse(BaseSchema):
    count: int
    total_revenue: float
    total_hours: float
    worked_hours: float
