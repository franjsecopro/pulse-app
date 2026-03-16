from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class ContractCreateRequest(BaseModel):
    description: str
    start_date: date
    end_date: Optional[date] = None
    hourly_rate: float
    is_active: bool = True
    notes: Optional[str] = None


class ContractUpdateRequest(BaseModel):
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    hourly_rate: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ContractResponse(BaseModel):
    id: int
    client_id: int
    description: str
    start_date: date
    end_date: Optional[date]
    hourly_rate: float
    is_active: bool
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
