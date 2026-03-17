from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.schemas.contract import ContractResponse
from app.schemas.payment_identifier import PayerResponse


class ClientCreateRequest(BaseModel):
    name: str
    payment_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True


class ClientUpdateRequest(BaseModel):
    name: Optional[str] = None
    payment_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: int
    name: str
    payment_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]
    contracts: list[ContractResponse] = []
    payers: list[PayerResponse] = []

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    id: int
    name: str
    payment_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime
    contracts: list[ContractResponse] = []
    payers: list[PayerResponse] = []

    model_config = {"from_attributes": True}
