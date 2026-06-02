"""Tests for payment_matcher — token-based fuzzy matching of bank concepts.

Real context: French bank concepts are UPPERCASE, accent-stripped, include
titles (MADAME) and long reference numbers, and may put the surname first.
Confidence must measure how much of the CLIENT'S NAME appears — never how much
of the noisy concept is the name.
"""
from types import SimpleNamespace

from app.services.payment_matcher import match_transaction


def make_client(id, name, payment_name=None, payers=()):
    """Duck-typed stand-in for a Client (id, name, payment_name, payers[].name)."""
    return SimpleNamespace(
        id=id,
        name=name,
        payment_name=payment_name,
        payers=[SimpleNamespace(name=p) for p in payers],
    )


class TestMatchTransaction:
    def test_full_name_present_with_noise_is_exact(self):
        """The real failing case: full name inside title + reference number."""
        clients = [make_client(1, "Manuela Josefa", payment_name="Manuela Josefa")]

        result = match_transaction("VIR INST MADAME MANUELA JOSEFA 6134110727708434", clients)

        assert result.client_id == 1
        assert result.match_type == "exact"
        assert result.confidence == 1.0

    def test_matches_accented_name_against_uppercase_concept(self):
        clients = [make_client(1, "José García", payment_name="José García")]

        result = match_transaction("VIR INST JOSE GARCIA 998877", clients)

        assert result.client_id == 1
        assert result.match_type == "exact"

    def test_matches_when_surname_comes_first(self):
        clients = [make_client(1, "Jose Garcia", payment_name="Jose Garcia")]

        result = match_transaction("VIR GARCIA JOSE REF4412", clients)

        assert result.client_id == 1
        assert result.match_type == "exact"

    def test_does_not_match_substring_inside_a_word(self):
        """'Ana' must not match 'semana' — token boundaries, not substrings."""
        clients = [make_client(1, "Ana", payment_name="Ana")]

        result = match_transaction("transferencia semana 12", clients)

        assert result.match_type == "none"
        assert result.client_id is None

    def test_single_token_full_match_is_partial_not_exact(self):
        clients = [make_client(1, "Ana", payment_name="Ana")]

        result = match_transaction("VIR ANA LOPEZ", clients)

        assert result.client_id == 1
        assert result.match_type == "partial"
        assert result.confidence == 0.5

    def test_partial_name_coverage_yields_partial(self):
        clients = [make_client(1, "Manuela Josefa Garcia", payment_name="Manuela Josefa Garcia")]

        result = match_transaction("VIR MANUELA JOSEFA REF", clients)

        assert result.match_type == "partial"
        assert result.confidence == 0.67

    def test_drops_match_below_confidence_threshold(self):
        clients = [make_client(1, "Ana Maria Lopez Garcia", payment_name="Ana Maria Lopez Garcia")]

        result = match_transaction("VIR GARCIA REF", clients)

        assert result.match_type == "none"

    def test_returns_none_when_no_client_matches(self):
        clients = [make_client(1, "Manuela Josefa", payment_name="Manuela Josefa")]

        result = match_transaction("VIR INST PEDRO SANCHEZ 12345", clients)

        assert result.match_type == "none"

    def test_picks_highest_confidence_among_multiple_clients(self):
        clients = [
            make_client(1, "Garcia", payment_name="Garcia"),
            make_client(2, "Manuela Josefa", payment_name="Manuela Josefa"),
        ]

        result = match_transaction("VIR MANUELA JOSEFA GARCIA", clients)

        assert result.client_id == 2  # full 2-token name beats single-token "Garcia"

    def test_matches_via_payer_name(self):
        clients = [make_client(1, "Cliente X", payment_name=None, payers=["Manuela Josefa"])]

        result = match_transaction("VIR INST MANUELA JOSEFA 6134110727708434", clients)

        assert result.client_id == 1
        assert result.match_type == "exact"
