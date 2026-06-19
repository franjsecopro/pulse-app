"""Single source of truth for class revenue calculation.

A class's *effective* revenue is the amount actually billed to the client.
The raw product `duration_hours * hourly_rate` is the *gross* amount; for
`cancelledWithoutPayment` classes the business does not charge, so the
effective amount is 0.

This module is the only place that knows the rule. The repository, the
routers, the dashboard service, and any future consumer must import from
here — never re-derive the rule.

Status values are stored in the database in camelCase to match the wire
format. The `BaseSchema` alias generator also serializes them as
camelCase in JSON, so values are stable end-to-end.
"""
from datetime import datetime, timedelta

from app.models.class_ import Class
from app.schemas.class_ import (
    STATUS_CANCELLED_WITH_PAYMENT,
    STATUS_CANCELLED_WITHOUT_PAYMENT,
)


# Statuses that contribute 0 to revenue. Values come from
# `schemas.class_.ClassStatus` — the single source of truth.
EXCLUDED_FROM_REVENUE: tuple[str, ...] = (STATUS_CANCELLED_WITHOUT_PAYMENT,)

# Statuses excluded from worked-hours totals. Worked hours reflect classes the
# teacher actually delivered, so BOTH cancellation statuses are excluded — unlike
# revenue, which still counts `cancelledWithPayment` (the client paid for it).
EXCLUDED_FROM_WORKED_HOURS: tuple[str, ...] = (
    STATUS_CANCELLED_WITH_PAYMENT,
    STATUS_CANCELLED_WITHOUT_PAYMENT,
)


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


def class_has_ended(class_: Class, now: datetime) -> bool:
    """Return True when the class has already finished relative to `now`.

    The end instant is `class_date + class_time + duration_hours`. When the class
    has no time set, it counts as ended only once the whole day has passed. This
    is what separates *worked* hours (already delivered) from *planned* hours
    (scheduled, possibly in the future).
    """
    if class_.class_time is not None:
        start = datetime.combine(class_.class_date, class_.class_time)
        return start + timedelta(hours=class_.duration_hours) <= now
    return class_.class_date < now.date()
