from typing import Optional

from app.schemas._base import BaseSchema


class BusinessProfileUpdate(BaseSchema):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    fiscal_address: Optional[str] = None


class BusinessProfileResponse(BaseSchema):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    fiscal_address: Optional[str] = None
