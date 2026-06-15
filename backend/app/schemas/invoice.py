from datetime import date
from typing import Optional

from app.schemas._base import BaseSchema


class InvoiceLineResponse(BaseSchema):
    id: int
    designation: str
    quantity: float
    unit_price_ht: float
    total_ht: float
    source_class_id: Optional[int] = None


class InvoiceResponse(BaseSchema):
    id: int
    number: Optional[str] = None
    status: str
    issue_date: Optional[date] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    total_ht: float
    currency: str
    client_id: int
    client_name: Optional[str] = None
    lines: list[InvoiceLineResponse] = []


class CreateFromPeriodRequest(BaseSchema):
    client_id: int
    # Month mode: month + year (+ optional end_month/end_year for a month range).
    month: Optional[int] = None
    year: Optional[int] = None
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    # Date mode: explicit inclusive range (same date = a single day). Takes
    # precedence over month/year when provided.
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class SendInvoiceRequest(BaseSchema):
    email: Optional[str] = None
    phone: Optional[str] = None
