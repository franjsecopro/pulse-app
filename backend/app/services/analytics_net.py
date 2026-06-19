"""Net-income estimation for the analytics module.

Net is estimated from *collected* revenue (the URSSAF chiffre d'affaires is the
amount actually encaissé), never from expected/invoiced amounts. The charge rate
is configured by the user (it depends on their activity and the fiscal year), so
when it is not set we return ``None`` and the UI shows an empty state instead of
inventing a number.
"""
from typing import Optional


def estimate_net(
    collected: float,
    social_charge_rate: Optional[float],
    income_tax_rate: Optional[float] = None,
) -> Optional[float]:
    """Estimate net income from collected revenue.

    Rates are percentages (e.g. ``22.0`` = 22%). Returns ``None`` when the social
    charge rate is not configured. ``income_tax_rate`` (optional versement
    libératoire) is treated as 0 when not set.
    """
    if social_charge_rate is None:
        return None
    total_rate = social_charge_rate + (income_tax_rate or 0.0)
    return round(collected * (1 - total_rate / 100), 2)
