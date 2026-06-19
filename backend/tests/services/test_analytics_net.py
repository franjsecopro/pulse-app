"""Unit tests for the net-estimate helper (app.services.analytics_net)."""
from app.services.analytics_net import estimate_net


def test_returns_none_when_charge_rate_not_configured():
    # NULL social charge rate → we cannot estimate net, so the caller shows an empty state.
    assert estimate_net(1000.0, None, None) is None


def test_subtracts_social_charge_percentage():
    assert estimate_net(1000.0, 22.0, None) == 780.0


def test_includes_optional_income_tax_rate():
    # (22 + 2.2)% = 24.2% → 1000 * 0.758
    assert estimate_net(1000.0, 22.0, 2.2) == 758.0


def test_income_tax_none_is_treated_as_zero():
    assert estimate_net(500.0, 10.0, None) == 450.0


def test_rounds_to_two_decimals():
    # 33.33 * 0.9 = 29.997 → 30.0
    assert estimate_net(33.33, 10.0, None) == 30.0


def test_zero_collected_is_zero_net():
    assert estimate_net(0.0, 22.0, 2.2) == 0.0
