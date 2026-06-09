"""Single source of truth for class revenue calculation.

A class's *effective* revenue is the amount actually billed to the client.
The raw product `duration_hours * hourly_rate` is the *gross* amount; for
`cancelledWithoutPayment` classes the business does not charge, so the
effective amount is 0.

This module is the only place that knows the rule. The repository, the
routers, the dashboard service, and any future consumer must import from
here — never re-derive the rule.
"""
from app.models.class_ import Class


# Statuses that contribute 0 to revenue. Keep this tuple in sync with
# `schemas.class_.CLASS_STATUSES` and the `status` literal values in the
# `classes.status` column.
EXCLUDED_FROM_REVENUE: tuple[str, ...] = ("cancelledWithoutPayment",)


def effective_revenue(class_: Class) -> float:
    """Return the billable amount for a single class.

    Returns 0.0 for excluded statuses (e.g. `cancelledWithoutPayment`).
    For all other statuses, returns `duration_hours * hourly_rate` rounded
    to 2 decimals.
    """
    if class_.status in EXCLUDED_FROM_REVENUE:
        return 0.0
    return round(class_.duration_hours * class_.hourly_rate, 2)


def is_excluded_status(status: str) -> bool:
    """True when classes with this status must not be summed into revenue."""
    return status in EXCLUDED_FROM_REVENUE
