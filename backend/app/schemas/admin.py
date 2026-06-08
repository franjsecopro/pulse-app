from datetime import datetime
from typing import Optional

from app.schemas._base import BaseSchema


class AdminClientResponse(BaseSchema):
    id: int
    name: str
    owner_id: int
    owner_email: str
    is_active: bool
    archived_at: Optional[datetime]
