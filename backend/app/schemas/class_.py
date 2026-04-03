from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel


class ClassCreateRequest(BaseModel):
    client_id: int
    contract_id: Optional[int] = None
    class_date: date
    class_time: Optional[time] = None
    duration_hours: float = 1.0
    hourly_rate: float
    notes: Optional[str] = None


class ClassUpdateRequest(BaseModel):
    client_id: Optional[int] = None
    contract_id: Optional[int] = None
    class_date: Optional[date] = None
    class_time: Optional[time] = None
    duration_hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    notes: Optional[str] = None


class ClassResponse(BaseModel):
    id: int
    user_id: int
    client_id: int
    contract_id: Optional[int]
    class_date: date
    class_time: Optional[time]
    duration_hours: float
    hourly_rate: float
    notes: Optional[str]
    created_at: datetime
    # Computed fields
    client_name: Optional[str] = None
    contract_description: Optional[str] = None
    total_amount: Optional[float] = None

    model_config = {"from_attributes": True}
