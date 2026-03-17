from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PayerCreateRequest(BaseModel):
    name: str
    info: Optional[str] = None


class PayerUpdateRequest(BaseModel):
    name: Optional[str] = None
    info: Optional[str] = None


class PayerResponse(BaseModel):
    id: int
    client_id: int
    name: str
    info: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
