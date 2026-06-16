"""Invoice HTTP surface (/api/invoices).

Drafts are built from a single class or from a client + month/period; issuing
assigns a gapless number and freezes the snapshot. All access is scoped to the
authenticated user.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, Query, Request
from fastapi.responses import HTMLResponse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.invoice import InvoiceResponse, CreateFromPeriodRequest, SendInvoiceRequest
from app.services.invoice_service import InvoiceService, InvoiceAlreadyIssuedError
from app.services.invoice_links import (
    create_invoice_file_token,
    verify_invoice_file_token,
    InvalidInvoiceTokenError,
    build_invoice_whatsapp_url,
)
from app.services.email_service import ResendEmailService, EmailNotConfiguredError
from app.services.invoice_pdf_service import PdfGenerationError

router = APIRouter(prefix="/invoices", tags=["invoices"])


def get_email_service() -> ResendEmailService:
    """Injectable email service (overridden in tests)."""
    return ResendEmailService()


def _build_share_url(request: Request, invoice_id: int) -> str:
    token = create_invoice_file_token(invoice_id)
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/invoices/{invoice_id}/file?token={token}"


@router.post("/from-class/{class_id}", response_model=InvoiceResponse, status_code=201)
async def create_invoice_from_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Build a draft invoice from a single class."""
    return await InvoiceService(db).create_draft_from_class(current_user.id, class_id)


@router.post("/from-period", response_model=InvoiceResponse, status_code=201)
async def create_invoice_from_period(
    data: CreateFromPeriodRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Build a draft invoice from a client's classes — by explicit date range
    (period_start/period_end, e.g. a single day) or by month/month-range."""
    service = InvoiceService(db)
    if data.period_start and data.period_end:
        return await service.create_draft_from_client_dates(
            current_user.id, data.client_id, data.period_start, data.period_end
        )
    if data.month and data.year:
        return await service.create_draft_from_client_period(
            current_user.id, data.client_id, data.month, data.year, data.end_month, data.end_year
        )
    raise HTTPException(
        status_code=422, detail="Provide period_start/period_end or month/year"
    )


@router.get("", response_model=list[InvoiceResponse])
async def list_invoices(
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: Optional[int] = Query(None, alias="clientId"),
    status: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List the current user's invoices (newest first), optionally filtered."""
    invoices, total = await InvoiceService(db).list_for_user(
        current_user.id, limit, offset,
        client_id=client_id, status=status, month=month, year=year,
    )
    response.headers["X-Total-Count"] = str(total)
    return invoices


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = await InvoiceService(db).get_by_id(current_user.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/{invoice_id}/preview", response_class=HTMLResponse)
async def preview_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Render the invoice as HTML (browser-friendly; no WeasyPrint needed)."""
    html = await InvoiceService(db).get_invoice_html(current_user.id, invoice_id)
    if html is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return HTMLResponse(content=html)


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Render the invoice as a PDF (requires WeasyPrint — Linux/WSL/Docker)."""
    try:
        pdf = await InvoiceService(db).get_invoice_pdf(current_user.id, invoice_id)
    except PdfGenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if pdf is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=facture.pdf"},
    )


@router.post("/{invoice_id}/share")
async def share_invoice(
    invoice_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a short-lived signed link to the invoice PDF (shareable; no login)."""
    invoice = await InvoiceService(db).get_by_id(current_user.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"url": _build_share_url(request, invoice_id)}


@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: int,
    data: SendInvoiceRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service: ResendEmailService = Depends(get_email_service),
):
    """Send the invoice via email (link + PDF attachment) and/or build a wa.me link."""
    service = InvoiceService(db)
    invoice = await service.get_by_id(current_user.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    share_url = _build_share_url(request, invoice_id)
    result: dict = {"shareUrl": share_url, "whatsappUrl": None, "email": {"sent": False}}

    if data.phone:
        result["whatsappUrl"] = build_invoice_whatsapp_url(
            data.phone, share_url, invoice.client_name
        )

    if data.email:
        try:
            pdf = await service.get_or_create_pdf_by_id(invoice_id)
        except Exception:  # WeasyPrint/GTK unavailable — fall back to a link-only email
            pdf = None
        attachments = [{"filename": "facture.pdf", "content": pdf}] if pdf else None
        number = invoice.number or ""
        html = (
            f"<p>Bonjour,</p><p>Veuillez trouver votre facture <strong>{number}</strong> : "
            f'<a href="{share_url}">{share_url}</a></p>'
        )
        try:
            await email_service.send(
                to=data.email,
                subject=f"Facture {number}".strip(),
                html=html,
                attachments=attachments,
            )
            result["email"] = {"sent": True}
        except EmailNotConfiguredError:
            result["email"] = {"sent": False, "reason": "not_configured"}

    return result


@router.get("/{invoice_id}/file")
async def get_invoice_file(
    invoice_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Serve the invoice PDF authorized by a signed token (no auth cookie)."""
    try:
        token_invoice_id = verify_invoice_file_token(token)
    except InvalidInvoiceTokenError:
        raise HTTPException(status_code=403, detail="Invalid or expired link")
    if token_invoice_id != invoice_id:
        raise HTTPException(status_code=403, detail="Token does not match this invoice")

    try:
        pdf = await InvoiceService(db).get_or_create_pdf_by_id(invoice_id)
    except PdfGenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if pdf is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=facture.pdf"},
    )


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin-only hard delete (dev/cleanup tool). Issued invoices should never be
    deleted in production — this exists for development."""
    deleted = await InvoiceService(db).delete(invoice_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"deleted": invoice_id}


@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
async def issue_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reserve a gapless number, freeze the snapshot, and mark the invoice issued."""
    try:
        return await InvoiceService(db).issue(current_user.id, invoice_id)
    except InvoiceAlreadyIssuedError:
        raise HTTPException(status_code=409, detail="Invoice is already issued")
