"""Tests for statement_parser — the format-dispatch seam and shared helpers.

normalize_amount / parse_date are the parsing primitives every format parser
relies on (Hello Bank exports are French locale: comma decimals, DD/MM/YYYY).
"""
import pytest

from app.services.statement_parser import (
    SUPPORTED_EXTENSIONS,
    normalize_amount,
    parse_date,
    parse_statement,
)

HELLO_BANK_CSV = (
    "Date;Date de valeur;D\xe9bit;Cr\xe9dit;Libell\xe9\n"
    "15/04/2026;15/04/2026;;150,00;VIR GARCIA\n"
).encode("cp1252")


# ─── parse_statement (dispatch) ──────────────────────────────────────────────

class TestParseStatementDispatch:
    def test_routes_csv_to_csv_parser(self):
        transactions = parse_statement("extracto.csv", HELLO_BANK_CSV)

        assert len(transactions) == 1
        assert transactions[0].date == "2026-04-15"
        assert transactions[0].amount == 150.0
        assert transactions[0].concept == "VIR GARCIA"

    def test_extension_check_is_case_insensitive(self):
        transactions = parse_statement("EXTRACTO.CSV", HELLO_BANK_CSV)

        assert len(transactions) == 1

    def test_unknown_extension_raises_value_error(self):
        with pytest.raises(ValueError, match="no soportado"):
            parse_statement("extracto.xlsx", b"whatever")

    def test_filename_without_extension_raises_value_error(self):
        with pytest.raises(ValueError):
            parse_statement("extracto", b"whatever")

    def test_supported_extensions_is_csv_only(self):
        # The business is CSV-only — a new format here must be a deliberate decision.
        assert SUPPORTED_EXTENSIONS == (".csv",)


# ─── normalize_amount ────────────────────────────────────────────────────────

class TestNormalizeAmount:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("150,00", 150.0),
            ("1 234,56", 1234.56),      # French thousands space
            ("1.234,56", 1234.56),      # dot thousands separator
            ("160", 160.0),             # integer without decimals
            ("0,50", 0.5),
        ],
    )
    def test_parses_european_formats(self, raw: str, expected: float):
        assert normalize_amount(raw) == expected

    @pytest.mark.parametrize("raw", ["abc", "", "12,34,56"])
    def test_returns_none_for_unparseable_values(self, raw: str):
        assert normalize_amount(raw) is None


# ─── parse_date ──────────────────────────────────────────────────────────────

class TestParseDate:
    def test_converts_dd_mm_yyyy_to_iso(self):
        assert parse_date("15/04/2026") == "2026-04-15"

    def test_strips_surrounding_whitespace(self):
        assert parse_date("  15/04/2026  ") == "2026-04-15"

    @pytest.mark.parametrize(
        "raw",
        ["2026-04-15", "15/4/2026", "32/01/2026", "01/13/2026", "garbage", ""],
        ids=["iso-input", "single-digit-month", "day-32", "month-13", "garbage", "empty"],
    )
    def test_returns_none_for_invalid_dates(self, raw: str):
        assert parse_date(raw) is None
