from typing import Optional

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

from app.schemas._base import BaseSchema

# Config for analytics schemas: always include None fields in JSON output.
_analytics_config = ConfigDict(
    from_attributes=True,
    populate_by_name=True,
    alias_generator=to_camel,
    exclude_none=False,
)


class RevenueTimeseriesPoint(BaseSchema):
    """One month of the revenue trend. `net` is None when charges aren't configured."""

    model_config = _analytics_config

    period: str  # "YYYY-MM"
    expected: float
    paid: float
    pending: float
    net: Optional[float] = None


class ProjectionResponse(BaseSchema):
    """Scheduled revenue + net for a calendar period (see AnalyticsService.projection)."""

    model_config = _analytics_config

    horizon: str
    period_start: str  # "YYYY-MM-DD" inclusive
    period_end: str  # "YYYY-MM-DD" inclusive
    projected_revenue: float
    projected_net: Optional[float] = None


class ClientContributionItem(BaseSchema):
    """Per-client contribution to income + reliability over a period."""

    model_config = _analytics_config

    client_id: int
    client_name: str
    billed: float  # billable revenue (normal + cancelledWithPayment)
    share_pct: Optional[float] = None  # slice of total billed; null if total is 0
    held_count: int  # delivered (normal) classes
    cancelled_paid_count: int  # cancelled but still charged
    cancelled_unpaid_count: int  # cancelled without charge → drives lost_revenue
    lost_revenue: float  # planned − billed (value of unpaid cancellations)


class ReceivableItem(BaseSchema):
    """One client with a negative balance (they owe money)."""

    client_id: int
    client_name: str
    expected: float
    paid: float
    balance: float  # negative = they owe


class AnalyticsOverview(BaseSchema):
    """Range KPIs plus comparison against the immediately-preceding equal-length period.

    `collection_rate` and the `*_change_pct` deltas are percentages; they are None when
    undefined (nothing expected, or the previous period had a zero baseline). `net` is
    None when charge rates aren't configured.
    """

    model_config = _analytics_config

    period_from: str
    period_to: str
    expected: float
    paid: float
    pending: float
    net: Optional[float] = None
    collection_rate: Optional[float] = None
    expected_change_pct: Optional[float] = None
    paid_change_pct: Optional[float] = None
