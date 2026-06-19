"""Unit tests for app.services.class_revenue.

This is the single source of truth for the effective-revenue rule. These
tests guard the contract that other modules (repository, routers, dashboard
service) consume.
"""
from datetime import date, datetime, time

from app.models.class_ import Class
from app.services.class_revenue import (
    EXCLUDED_FROM_REVENUE,
    class_has_ended,
    effective_revenue,
    is_excluded_status,
)


def _class(
    *,
    duration_hours: float = 1.0,
    hourly_rate: float = 20.0,
    status: str = "normal",
    class_date: date = date(2026, 4, 10),
    class_time: time | None = None,
) -> Class:
    return Class(
        user_id=1,
        client_id=1,
        contract_id=1,
        class_date=class_date,
        class_time=class_time,
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
        status=status,
    )


def test_normal_class_returns_full_amount():
    cls = _class(duration_hours=2.0, hourly_rate=20.0, status="normal")

    assert effective_revenue(cls) == 40.0


def test_cancelled_with_payment_is_billed():
    cls = _class(duration_hours=2.0, hourly_rate=20.0, status="cancelledWithPayment")

    assert effective_revenue(cls) == 40.0


def test_cancelled_without_payment_is_zero():
    cls = _class(duration_hours=2.0, hourly_rate=20.0, status="cancelledWithoutPayment")

    assert effective_revenue(cls) == 0.0


def test_rounds_to_two_decimals():
    cls = _class(duration_hours=1.0, hourly_rate=33.333)

    assert effective_revenue(cls) == 33.33


def test_excluded_from_revenue_constant_contains_cancelled_without_payment():
    assert "cancelledWithoutPayment" in EXCLUDED_FROM_REVENUE


def test_is_excluded_status_helper():
    assert is_excluded_status("cancelledWithoutPayment") is True
    assert is_excluded_status("cancelledWithPayment") is False
    assert is_excluded_status("normal") is False
    assert is_excluded_status("anything_else") is False


# ─── class_has_ended ─────────────────────────────────────────────────────────

_NOW = datetime(2026, 4, 18, 12, 0, 0)


def test_class_has_ended_true_for_past_timed_class():
    cls = _class(class_date=date(2026, 4, 10), class_time=time(10, 0), duration_hours=1.0)

    assert class_has_ended(cls, _NOW) is True


def test_class_has_ended_false_for_future_timed_class():
    cls = _class(class_date=date(2026, 4, 25), class_time=time(10, 0), duration_hours=1.0)

    assert class_has_ended(cls, _NOW) is False


def test_class_has_ended_false_when_today_not_finished_yet():
    # starts 14:00 today, now is 12:00
    cls = _class(class_date=date(2026, 4, 18), class_time=time(14, 0), duration_hours=1.0)

    assert class_has_ended(cls, _NOW) is False


def test_class_has_ended_true_when_today_already_finished():
    # 10:00 + 1h = 11:00 today, now is 12:00
    cls = _class(class_date=date(2026, 4, 18), class_time=time(10, 0), duration_hours=1.0)

    assert class_has_ended(cls, _NOW) is True


def test_class_has_ended_without_time_counts_only_past_days():
    assert class_has_ended(_class(class_date=date(2026, 4, 10), class_time=None), _NOW) is True
    assert class_has_ended(_class(class_date=date(2026, 4, 18), class_time=None), _NOW) is False
    assert class_has_ended(_class(class_date=date(2026, 4, 25), class_time=None), _NOW) is False
