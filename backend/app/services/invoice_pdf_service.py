"""Invoice PDF generation.

Two responsibilities, kept apart:
- ``render_invoice_html`` builds the invoice HTML with Jinja2. Pure, dependency-
  light, works everywhere.
- ``invoice_to_pdf`` turns that HTML into PDF bytes with WeasyPrint, which is
  imported *lazily* so the app still boots on environments without the native
  GTK stack (e.g. Windows dev). PDF generation runs in WSL/Docker/Linux.
"""
import os
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.invoice import Invoice
from app.models.business_profile import BusinessProfile
from app.models.client import Client

_TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)

DEFAULT_PAYMENT_CONDITIONS = (
    "Virement bancaire. Aucun escompte consenti pour règlement anticipé."
)


def render_invoice_html(
    invoice: Invoice,
    profile: Optional[BusinessProfile] = None,
    client: Optional[Client] = None,
) -> str:
    """Render the French invoice template to an HTML string."""
    # Auto-entrepreneurs are VAT-exempt by default; only an explicit False hides
    # the mention.
    show_vat = True if profile is None or profile.vat_exempt is None else profile.vat_exempt
    show_rcs = bool(profile and profile.rcs_dispense)
    payment_conditions = (
        profile.payment_conditions
        if profile is not None and profile.payment_conditions
        else DEFAULT_PAYMENT_CONDITIONS
    )

    # Issuer identity: prefer the invoice's frozen snapshot (immutable once issued),
    # falling back to the live profile so a draft preview isn't empty. Contact/bank
    # fields aren't snapshotted, so they always come from the live profile.
    issuer = {
        "name": invoice.issuer_name or (profile.business_name if profile else None),
        "address": invoice.issuer_address or (profile.fiscal_address if profile else None),
        "siret": invoice.issuer_siret
        or (profile.siret or profile.tax_id if profile else None),
        "phone": profile.phone if profile else None,
        "email": profile.email if profile else None,
        "iban": profile.iban if profile else None,
        "bic": profile.bic if profile else None,
    }

    # Client identity: prefer the frozen snapshot, fall back to the live client so a
    # draft preview isn't empty.
    recipient = {
        "name": invoice.client_name or (client.name if client else None),
        "address": invoice.client_address or (client.address if client else None),
        "tax_id": invoice.client_tax_id or (client.tax_id if client else None),
    }

    template = _env.get_template("invoice_fr.html")
    return template.render(
        invoice=invoice,
        issuer=issuer,
        recipient=recipient,
        show_vat=show_vat,
        show_rcs=show_rcs,
        payment_conditions=payment_conditions,
    )


class PdfGenerationError(Exception):
    """Raised when the PDF engine is unavailable (WeasyPrint native GTK libs missing)."""


def _weasyprint_html():
    """Import WeasyPrint's HTML lazily. Isolated so it can be monkeypatched and so
    the GTK-load failure surfaces in one place."""
    from weasyprint import HTML  # noqa: PLC0415 — lazy on purpose (native deps)

    return HTML


def invoice_to_pdf(
    invoice: Invoice,
    profile: Optional[BusinessProfile] = None,
    client: Optional[Client] = None,
) -> bytes:
    """Render the invoice and return PDF bytes.

    WeasyPrint is imported lazily so importing this module never requires the
    native GTK libraries. If those libraries are missing (e.g. bare Windows), a
    clean ``PdfGenerationError`` is raised instead of a raw OSError.
    """
    html = render_invoice_html(invoice, profile, client)
    try:
        html_engine = _weasyprint_html()
    except (ImportError, OSError) as exc:
        raise PdfGenerationError(
            "PDF generation is unavailable: WeasyPrint native libraries (GTK) are "
            "not installed in this environment."
        ) from exc

    return html_engine(string=html).write_pdf()
