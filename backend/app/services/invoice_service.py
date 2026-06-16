"""Invoice orchestration: build drafts from classes and issue them.

A draft carries no number and is fully editable. Issuing reserves a gapless
number (see invoice_numbering), freezes the issuer/client snapshot, and flips the
status to ``issued`` — after which the invoice must not be mutated (corrections
go through a credit note / avoir, a later phase).
"""
import calendar
from datetime import date
from typing import Optional

from sqlalchemy import select, func, extract, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice
from app.models.invoice_line import InvoiceLine
from app.models.invoice_pdf import InvoicePdf
from app.models.class_ import Class
from app.models.client import Client
from app.models.business_profile import BusinessProfile
from app.services.class_revenue import effective_revenue, is_excluded_status
from app.services.invoice_numbering import next_invoice_number
from app.services.invoice_pdf_service import render_invoice_html, invoice_to_pdf

LINE_DESIGNATION = "Cours particuliers"


class InvoiceAlreadyIssuedError(Exception):
    """Raised when attempting to issue an invoice that is already issued."""


class InvoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_draft_from_class(self, user_id: int, class_id: int) -> Invoice:
        """Build a draft invoice (one "Cours particuliers" line) from a class."""
        result = await self.db.execute(
            select(Class).where(Class.id == class_id, Class.user_id == user_id)
        )
        cls = result.scalar_one()

        amount = effective_revenue(cls)
        invoice = Invoice(
            user_id=user_id,
            client_id=cls.client_id,
            status="draft",
            period_start=cls.class_date,
            period_end=cls.class_date,
            total_ht=amount,
            currency="EUR",
            lines=[
                InvoiceLine(
                    designation=LINE_DESIGNATION,
                    quantity=cls.duration_hours,
                    unit_price_ht=cls.hourly_rate,
                    total_ht=amount,
                    source_class_id=cls.id,
                )
            ],
        )
        self.db.add(invoice)
        await self.db.flush()
        await self.db.commit()
        return invoice

    async def create_draft_from_client_period(
        self,
        user_id: int,
        client_id: int,
        month: int,
        year: int,
        end_month: Optional[int] = None,
        end_year: Optional[int] = None,
    ) -> Invoice:
        """Build a draft invoice aggregating a client's billable classes over a
        month or a month range (inclusive). One line per class;
        cancelled-without-payment classes (0 revenue) are excluded."""
        period_start = date(year, month, 1)
        last_month = end_month or month
        last_year = end_year or year
        period_end = date(last_year, last_month, calendar.monthrange(last_year, last_month)[1])
        return await self.create_draft_from_client_dates(
            user_id, client_id, period_start, period_end
        )

    async def create_draft_from_client_dates(
        self, user_id: int, client_id: int, period_start: date, period_end: date
    ) -> Invoice:
        """Build a draft invoice aggregating a client's billable classes between
        two dates (inclusive). A single day = same start and end. One line per
        class; cancelled-without-payment classes (0 revenue) are excluded."""
        result = await self.db.execute(
            select(Class)
            .where(
                Class.user_id == user_id,
                Class.client_id == client_id,
                Class.class_date >= period_start,
                Class.class_date <= period_end,
            )
            .order_by(Class.class_date)
        )
        classes = result.scalars().all()

        lines: list[InvoiceLine] = []
        total = 0.0
        for cls in classes:
            if is_excluded_status(cls.status):
                continue
            amount = effective_revenue(cls)
            lines.append(
                InvoiceLine(
                    designation=LINE_DESIGNATION,
                    quantity=cls.duration_hours,
                    unit_price_ht=cls.hourly_rate,
                    total_ht=amount,
                    source_class_id=cls.id,
                )
            )
            total += amount

        invoice = Invoice(
            user_id=user_id,
            client_id=client_id,
            status="draft",
            period_start=period_start,
            period_end=period_end,
            total_ht=round(total, 2),
            currency="EUR",
            lines=lines,
        )
        self.db.add(invoice)
        await self.db.flush()
        await self.db.commit()
        return invoice

    async def list_for_user(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0,
        client_id: Optional[int] = None,
        status: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> tuple[list[Invoice], int]:
        """Return a filtered page of the user's invoices (newest first) + total count.

        Month/year filter on the billing period start, so drafts are included."""
        filters = [Invoice.user_id == user_id]
        if client_id is not None:
            filters.append(Invoice.client_id == client_id)
        if status:
            filters.append(Invoice.status == status)
        if year is not None:
            filters.append(extract("year", Invoice.period_start) == year)
        if month is not None:
            filters.append(extract("month", Invoice.period_start) == month)

        total = await self.db.scalar(
            select(func.count()).select_from(Invoice).where(*filters)
        )
        result = await self.db.execute(
            select(Invoice)
            .where(*filters)
            .order_by(Invoice.id.desc())
            .options(selectinload(Invoice.lines))
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all()), int(total or 0)

    async def get_by_id(self, user_id: int, invoice_id: int) -> Optional[Invoice]:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id, Invoice.user_id == user_id)
            .options(selectinload(Invoice.lines))
        )
        return result.scalar_one_or_none()

    async def delete(self, invoice_id: int) -> bool:
        """Hard-delete an invoice and its cached PDF. Admin/dev tool — there is no
        user scoping. Returns False if the invoice doesn't exist.

        NOTE: deleting an *issued* invoice breaks the gapless legal sequence and
        must never be exposed to non-admins in production (the router guards it
        with require_admin). The sequence counter is intentionally NOT rolled
        back — numbers are never reused.
        """
        result = await self.db.execute(
            select(Invoice).where(Invoice.id == invoice_id).options(selectinload(Invoice.lines))
        )
        invoice = result.scalar_one_or_none()
        if invoice is None:
            return False
        await self.db.execute(sa_delete(InvoicePdf).where(InvoicePdf.invoice_id == invoice_id))
        await self.db.delete(invoice)
        await self.db.commit()
        return True

    async def get_invoice_html(self, user_id: int, invoice_id: int) -> Optional[str]:
        """Render the invoice to HTML (None if it doesn't exist for this user)."""
        invoice = await self.get_by_id(user_id, invoice_id)
        if invoice is None:
            return None
        return render_invoice_html(
            invoice, await self._get_profile(user_id), await self._get_client(invoice.client_id)
        )

    async def get_invoice_pdf(self, user_id: int, invoice_id: int) -> Optional[bytes]:
        """Render the invoice to PDF bytes (None if it doesn't exist for this user)."""
        invoice = await self.get_by_id(user_id, invoice_id)
        if invoice is None:
            return None
        return invoice_to_pdf(
            invoice, await self._get_profile(user_id), await self._get_client(invoice.client_id)
        )

    async def get_or_create_pdf_by_id(self, invoice_id: int) -> Optional[bytes]:
        """Return the invoice's PDF bytes, generating and caching them on first
        access. No user scoping — callers (the signed-link endpoint) authorize via
        the token. Returns None if the invoice doesn't exist."""
        cached = (
            await self.db.execute(
                select(InvoicePdf).where(InvoicePdf.invoice_id == invoice_id)
            )
        ).scalar_one_or_none()
        if cached is not None:
            return cached.content

        invoice = (
            await self.db.execute(
                select(Invoice)
                .where(Invoice.id == invoice_id)
                .options(selectinload(Invoice.lines))
            )
        ).scalar_one_or_none()
        if invoice is None:
            return None

        pdf = invoice_to_pdf(
            invoice,
            await self._get_profile(invoice.user_id),
            await self._get_client(invoice.client_id),
        )
        self.db.add(InvoicePdf(invoice_id=invoice_id, content=pdf))
        await self.db.commit()
        return pdf

    async def _get_profile(self, user_id: int) -> Optional[BusinessProfile]:
        return (
            await self.db.execute(
                select(BusinessProfile).where(BusinessProfile.user_id == user_id)
            )
        ).scalar_one_or_none()

    async def issue(
        self, user_id: int, invoice_id: int, issue_date: Optional[date] = None
    ) -> Invoice:
        """Reserve a gapless number, freeze the snapshot, mark the invoice issued."""
        issue_date = issue_date or date.today()

        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id, Invoice.user_id == user_id)
            .options(selectinload(Invoice.lines))
        )
        invoice = result.scalar_one()

        if invoice.status != "draft" or invoice.number is not None:
            raise InvoiceAlreadyIssuedError(
                f"Invoice {invoice_id} is already issued (status={invoice.status})"
            )

        profile = await self._get_profile(user_id)

        self._freeze_client_snapshot(invoice, await self._get_client(invoice.client_id))
        self._freeze_issuer_snapshot(invoice, profile)

        invoice.number = await next_invoice_number(
            self.db,
            user_id,
            issue_date,
            scope=getattr(profile, "invoice_sequence_scope", None) or "monthly",
            number_format=getattr(profile, "invoice_number_format", None) or "YYYY-MM-NN",
        )
        invoice.status = "issued"
        invoice.issue_date = issue_date

        await self.db.commit()
        return invoice

    async def _get_client(self, client_id: int) -> Optional[Client]:
        return (
            await self.db.execute(select(Client).where(Client.id == client_id))
        ).scalar_one_or_none()

    @staticmethod
    def _freeze_client_snapshot(invoice: Invoice, client: Optional[Client]) -> None:
        if client is not None:
            invoice.client_name = client.name
            invoice.client_address = client.address
            invoice.client_tax_id = client.tax_id

    @staticmethod
    def _freeze_issuer_snapshot(invoice: Invoice, profile: Optional[BusinessProfile]) -> None:
        if profile is not None:
            invoice.issuer_name = profile.business_name
            invoice.issuer_address = profile.fiscal_address
            # Prefer the dedicated SIRET field; fall back to tax_id for older profiles.
            invoice.issuer_siret = profile.siret or profile.tax_id
