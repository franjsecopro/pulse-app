from datetime import datetime
from typing import Literal, Optional
from pydantic import EmailStr

from app.schemas._base import BaseSchema
from app.schemas.contract import ContractResponse
from app.schemas.payment_identifier import PayerResponse

PaymentTiming = Literal["same_month", "next_month"]


class ClientCreateRequest(BaseSchema):
    name: str
    payment_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    payment_timing: PaymentTiming = "same_month"
    is_active: bool = True


class ClientUpdateRequest(BaseSchema):
    name: Optional[str] = None
    payment_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    payment_timing: Optional[PaymentTiming] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseSchema):
    id: int
    name: str
    payment_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    whatsapp_phone: Optional[str]
    address: Optional[str]
    tax_id: Optional[str]
    payment_timing: PaymentTiming
    is_active: bool
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime]
    contracts: list[ContractResponse] = []
    payers: list[PayerResponse] = []


class ClientListResponse(BaseSchema):
    id: int
    name: str
    payment_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    whatsapp_phone: Optional[str]
    is_active: bool
    created_at: datetime
    archived_at: Optional[datetime]
    contracts: list[ContractResponse] = []
    payers: list[PayerResponse] = []
