from datetime import datetime
from typing import Optional

from app.schemas._base import BaseSchema


class ParsedTransactionResponse(BaseSchema):
    date: str
    concept: str
    amount: float
    suggested_client_id: Optional[int]
    suggested_client_name: Optional[str]
    match_type: str
    confidence: float
    already_imported: bool = False


class ParseStatementResponse(BaseSchema):
    transactions: list[ParsedTransactionResponse]
    file_hash: str
    file_already_imported_at: Optional[datetime] = None
    duplicate_count: int = 0


class ConfirmPaymentItem(BaseSchema):
    date: str
    concept: str
    amount: float
    client_id: Optional[int] = None


class ConfirmImportRequest(BaseSchema):
    payments: list[ConfirmPaymentItem]
    filename: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None
    file_hash: Optional[str] = None


class StatementImportResponse(BaseSchema):
    id: int
    filename: str
    imported_at: datetime
    month: Optional[int]
    year: Optional[int]
    transaction_count: int
    total_amount: float
