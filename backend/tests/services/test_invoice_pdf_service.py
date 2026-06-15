"""Tests for invoice PDF generation.

The HTML rendering (Jinja2) is pure and tested deterministically everywhere.
The HTML->PDF step (WeasyPrint) has a smoke test that is skipped when WeasyPrint
isn't importable (e.g. bare Windows without GTK) — it runs in WSL/Docker/Linux.
"""
from datetime import date

import pytest

from app.models.invoice import Invoice
from app.models.invoice_line import InvoiceLine
from app.models.business_profile import BusinessProfile
from app.services.invoice_pdf_service import render_invoice_html, invoice_to_pdf


def _invoice() -> Invoice:
    return Invoice(
        number="2026-06-01",
        status="issued",
        issue_date=date(2026, 6, 7),
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        total_ht=60.0,
        currency="EUR",
        client_name="Dupont",
        client_address="2 rue Victor Hugo",
        issuer_name="Prof Particulier",
        issuer_address="1 rue de l'École",
        issuer_siret="12345678900012",
        lines=[InvoiceLine(
            designation="Cours particuliers", quantity=1.5, unit_price_ht=40.0, total_ht=60.0,
        )],
    )


class TestRenderInvoiceHtml:
    def test_includes_number_client_and_line(self):
        html = render_invoice_html(_invoice())
        assert "2026-06-01" in html
        assert "Dupont" in html
        assert "Cours particuliers" in html

    def test_includes_issuer_identity(self):
        html = render_invoice_html(_invoice())
        assert "Prof Particulier" in html
        assert "12345678900012" in html

    def test_shows_total(self):
        assert "60" in render_invoice_html(_invoice())

    def test_vat_exemption_mention_when_vat_exempt(self):
        html = render_invoice_html(_invoice(), BusinessProfile(vat_exempt=True))
        assert "TVA non applicable, art. 293 B du CGI" in html

    def test_no_vat_mention_when_not_exempt(self):
        html = render_invoice_html(_invoice(), BusinessProfile(vat_exempt=False))
        assert "293 B" not in html

    def test_rcs_dispense_mention_when_flagged(self):
        html = render_invoice_html(_invoice(), BusinessProfile(rcs_dispense=True))
        assert "Dispensé d'immatriculation" in html

    def test_rcs_dispense_absent_by_default(self):
        html = render_invoice_html(_invoice())
        assert "Dispensé d'immatriculation" not in html

    def test_issuer_falls_back_to_live_profile_for_a_draft(self):
        # A draft has no frozen issuer snapshot — the issuer block must still show
        # the configured profile so the preview isn't empty.
        draft = Invoice(
            number=None, status="draft", total_ht=40.0, currency="EUR",
            client_name="Marie",
            lines=[InvoiceLine(designation="Cours particuliers", quantity=1.0,
                               unit_price_ht=40.0, total_ht=40.0)],
        )
        profile = BusinessProfile(
            business_name="Jean Dupont", fiscal_address="1 rue X", siret="12345678900012",
            phone="+33612345678", email="jean@dupont.fr", iban="FR7612345", bic="ABCDEF",
        )
        html = render_invoice_html(draft, profile)
        assert "Jean Dupont" in html
        assert "12345678900012" in html
        assert "+33612345678" in html
        assert "jean@dupont.fr" in html
        assert "FR7612345" in html

    def test_issued_snapshot_takes_precedence_over_profile(self):
        # An issued invoice keeps its frozen name even if the profile changed.
        issued = _invoice()  # issuer_name = "Prof Particulier"
        profile = BusinessProfile(business_name="NEW NAME", siret="999")
        html = render_invoice_html(issued, profile)
        assert "Prof Particulier" in html
        assert "NEW NAME" not in html


class TestInvoiceToPdf:
    def test_returns_pdf_bytes(self):
        try:
            import weasyprint  # noqa: F401
        except Exception as exc:  # ImportError or OSError (missing native GTK libs)
            pytest.skip(f"WeasyPrint native libraries unavailable: {exc}")
        pdf = invoice_to_pdf(_invoice())
        assert pdf[:4] == b"%PDF"

    def test_raises_clean_error_when_engine_unavailable(self, monkeypatch):
        from app.services import invoice_pdf_service as svc

        def boom():
            raise OSError("cannot load library 'libgobject-2.0-0'")

        monkeypatch.setattr(svc, "_weasyprint_html", boom)
        with pytest.raises(svc.PdfGenerationError):
            svc.invoice_to_pdf(_invoice())
