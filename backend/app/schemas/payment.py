from datetime import datetime, date
from typing import Optional

from app.schemas._base import BaseSchema


class PaymentCreateRequest(BaseSchema):
    client_id: Optional[int] = None
    amount: float
    payment_date: date
    concept: Optional[str] = None
    source: str = "manual"
    status: str = "confirmed"
    notes: Optional[str] = None


class PaymentUpdateRequest(BaseSchema):
    client_id: Optional[int] = None
    amount: Optional[float] = None
    payment_date: Optional[date] = None
    concept: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseSchema):
    id: int
    user_id: int
    client_id: Optional[int]
    amount: float
    payment_date: date
    concept: Optional[str]
    source: str
    status: str
    notes: Optional[str]
    created_at: datetime
    client_name: Optional[str] = None
