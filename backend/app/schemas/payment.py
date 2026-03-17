from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class PaymentCreateRequest(BaseModel):
    client_id: Optional[int] = None
    amount: float
    payment_date: date
    concept: Optional[str] = None
    source: str = "manual"
    status: str = "confirmed"
    notes: Optional[str] = None


class PaymentUpdateRequest(BaseModel):
    client_id: Optional[int] = None
    amount: Optional[float] = None
    payment_date: Optional[date] = None
    concept: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
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

    model_config = {"from_attributes": True}
