"""Unit tests for app.services.class_revenue.

This is the single source of truth for the effective-revenue rule. These
tests guard the contract that other modules (repository, routers, dashboard
service) consume.
"""
from app.models.class_ import Class
from app.services.class_revenue import (
    EXCLUDED_FROM_REVENUE,
    effective_revenue,
    is_excluded_status,
)


def _class(*, duration_hours: float = 1.0, hourly_rate: float = 20.0, status: str = "normal") -> Class:
    from datetime import date

    return Class(
        user_id=1,
        client_id=1,
        contract_id=1,
        class_date=date(2026, 4, 10),
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
