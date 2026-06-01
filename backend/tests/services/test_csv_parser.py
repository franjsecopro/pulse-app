"""Tests for csv_parser — Hello Bank / BNP Paribas CSV statement parsing.

Real format (French bank export):
  - delimiter ';'
  - encoding cp1252 / latin-1 (NOT utf-8)
  - columns: Date;Date de valeur;Débit;Crédit;Libellé
  - date DD/MM/YYYY
  - amount comma-decimal, integers without decimals (160, 109,69)
  - income rows = Crédit column non-empty, Débit empty
"""
from app.services.csv_parser import parse_csv

HEADER = "Date;Date de valeur;Débit;Crédit;Libellé"


def _csv(*rows: str, encoding: str = "cp1252") -> bytes:
    """Build raw CSV bytes the way the bank exports them."""
    return "\r\n".join([HEADER, *rows]).encode(encoding)


class TestParseCsv:
    def test_parses_a_credit_row_into_a_transaction(self):
        result = parse_csv(_csv("03/05/2026;03/05/2026;;160;VIR INST"))

        assert len(result) == 1
        tx = result[0]
        assert tx.date == "2026-05-03"        # DD/MM/YYYY -> ISO
        assert tx.amount == 160.0             # integer amount, no decimals
        assert tx.concept == "VIR INST"       # Libellé extracted verbatim

    def test_parses_comma_decimal_amount(self):
        result = parse_csv(_csv("25/05/2026;25/05/2026;;109,69;VIR STR"))

        assert result[0].amount == 109.69

    def test_skips_debit_rows(self):
        """A débit (expense) row has Crédit empty and must be ignored."""
        result = parse_csv(_csv(
            "03/05/2026;03/05/2026;;160;VIR INST",
            "10/05/2026;10/05/2026;50,00;;ACHAT CB SUPERMARCHE",
        ))

        assert len(result) == 1
        assert result[0].concept == "VIR INST"

    def test_decodes_cp1252_when_content_is_not_utf8(self):
        """Accented Libellé in cp1252 must decode without mojibake."""
        result = parse_csv(_csv("03/05/2026;03/05/2026;;160;VIREMENT REÇU", encoding="cp1252"))

        assert result[0].concept == "VIREMENT REÇU"

    def test_decodes_utf8_content_too(self):
        """A future bank exporting UTF-8 must still parse."""
        result = parse_csv(_csv("03/05/2026;03/05/2026;;160;VIREMENT REÇU", encoding="utf-8"))

        assert result[0].amount == 160.0
        assert result[0].concept == "VIREMENT REÇU"

    def test_returns_empty_when_only_debit_rows(self):
        result = parse_csv(_csv("10/05/2026;10/05/2026;50,00;;ACHAT CB"))

        assert result == []

    def test_returns_empty_for_empty_content(self):
        assert parse_csv(b"") == []

    def test_parses_multiple_credit_rows(self):
        result = parse_csv(_csv(
            "03/05/2026;03/05/2026;;160;VIR INST",
            "25/05/2026;25/05/2026;;109,69;VIR STR",
        ))

        assert [tx.amount for tx in result] == [160.0, 109.69]
        assert [tx.date for tx in result] == ["2026-05-03", "2026-05-25"]
