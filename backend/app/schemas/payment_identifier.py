from datetime import datetime
from typing import Optional

from app.schemas._base import BaseSchema


class PayerCreateRequest(BaseSchema):
    name: str
    info: Optional[str] = None


class PayerUpdateRequest(BaseSchema):
    name: Optional[str] = None
    info: Optional[str] = None


class PayerResponse(BaseSchema):
    id: int
    client_id: int
    name: str
    info: Optional[str]
    created_at: datetime
