from typing import Optional

from pydantic import BaseModel


class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    fiscal_address: Optional[str] = None


class BusinessProfileResponse(BaseModel):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    fiscal_address: Optional[str] = None

    model_config = {"from_attributes": True}
