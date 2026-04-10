from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ParsedTransactionResponse(BaseModel):
    date: str
    concept: str
    amount: float
    suggested_client_id: Optional[int]
    suggested_client_name: Optional[str]
    match_type: str
    confidence: float


class ConfirmPaymentItem(BaseModel):
    date: str
    concept: str
    amount: float
    client_id: Optional[int] = None


class ConfirmImportRequest(BaseModel):
    payments: list[ConfirmPaymentItem]
    filename: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None


class PDFImportResponse(BaseModel):
    id: int
    filename: str
    imported_at: datetime
    month: Optional[int]
    year: Optional[int]
    transaction_count: int
    total_amount: float

    model_config = {"from_attributes": True}
