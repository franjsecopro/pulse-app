from typing import List, Optional

from app.schemas._base import BaseSchema


class UpcomingClassItem(BaseSchema):
    id: int
    client_name: Optional[str]
    contract_description: Optional[str]
    class_date: str
    class_time: Optional[str]
    duration_hours: float
    total_amount: float
    status: str


class UpcomingClassesResponse(BaseSchema):
    today: List[UpcomingClassItem]
    tomorrow: List[UpcomingClassItem]


class DashboardSummaryResponse(BaseSchema):
    total_expected: float
    total_paid: float
    total_pending: float
    active_clients: int
    monthly_classes: int
    monthly_payments: float
    month: int
    year: int
