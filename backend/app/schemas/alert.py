from typing import Optional

from app.schemas._base import BaseSchema


class AlertResponse(BaseSchema):
    client_id: Optional[int]
    client_name: Optional[str]
    type: str
    severity: str
    amount: float
    month: int
    year: int
