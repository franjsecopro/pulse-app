from typing import List

from app.schemas._base import BaseSchema


class ContractBreakdownResponse(BaseSchema):
    contract_id: int | None
    contract_description: str
    hourly_rate: float
    class_count: int
    normal_count: int
    cancelled_with_payment_count: int
    cancelled_without_payment_count: int
    expected: float


class AccountingSummaryEntryResponse(BaseSchema):
    client_id: int
    client_name: str
    expected: float
    paid: float
    previous_credit: float
    balance: float
    month: int
    year: int
    month_name: str
    contracts: List[ContractBreakdownResponse]
