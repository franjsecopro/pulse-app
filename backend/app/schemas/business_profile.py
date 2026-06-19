from typing import Optional

from app.schemas._base import BaseSchema


class BusinessProfileUpdate(BaseSchema):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    fiscal_address: Optional[str] = None
    # French invoicing identity + bank
    siret: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    # Legal mention toggles + numbering config
    rcs_dispense: bool = False
    vat_exempt: bool = True
    payment_conditions: Optional[str] = None
    invoice_number_format: str = "YYYY-MM-NN"
    invoice_sequence_scope: str = "monthly"
    # Analytics config (percentages of collected revenue; goal in currency).
    social_charge_rate: Optional[float] = None
    income_tax_rate: Optional[float] = None
    monthly_income_goal: Optional[float] = None


class BusinessProfileResponse(BaseSchema):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    fiscal_address: Optional[str] = None
    siret: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    rcs_dispense: bool = False
    vat_exempt: bool = True
    payment_conditions: Optional[str] = None
    invoice_number_format: str = "YYYY-MM-NN"
    invoice_sequence_scope: str = "monthly"
    # Analytics config (percentages of collected revenue; goal in currency).
    social_charge_rate: Optional[float] = None
    income_tax_rate: Optional[float] = None
    monthly_income_goal: Optional[float] = None
