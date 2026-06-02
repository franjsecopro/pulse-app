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
    # True when an identical bank_import payment already exists (Nivel 2).
    already_imported: bool = False


class ParseStatementResponse(BaseModel):
    transactions: list[ParsedTransactionResponse]
    file_hash: str
    # When the same file was already imported before (Nivel 1), its import date.
    file_already_imported_at: Optional[datetime] = None
    # How many of the parsed transactions are already imported (Nivel 2).
    duplicate_count: int = 0


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
    file_hash: Optional[str] = None


class StatementImportResponse(BaseModel):
    id: int
    filename: str
    imported_at: datetime
    month: Optional[int]
    year: Optional[int]
    transaction_count: int
    total_amount: float

    model_config = {"from_attributes": True}
