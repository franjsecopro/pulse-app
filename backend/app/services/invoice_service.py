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


class InvoiceNotDraftError(Exception):
    """Raised when attempting to delete an invoice that is not a draft."""


class InvoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_draft_from_class(self, user_id: int, class_id: int) -> Invoice:
        """Build a draft invoice (one "Cours particuliers" line) from a class."""
        result = await self.db.execute(
            select(Class)
            .where(Class.id == class_id, Class.user_id == user_id)
            .options(selectinload(Class.contract))
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
            contract_label=cls.contract.description if cls.contract else None,
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
            .options(selectinload(Class.contract))
            .order_by(Class.class_date)
        )
        billable = [c for c in result.scalars().all() if not is_excluded_status(c.status)]
        return await self._build_draft_invoice(
            user_id, client_id, period_start, period_end, billable
        )

    async def _build_draft_invoice(
        self, user_id: int, client_id: int, period_start: date, period_end: date,
        billable: list[Class],
    ) -> Invoice:
        """Persist a draft invoice from an already-filtered list of billable classes."""
        lines = [
            InvoiceLine(
                designation=LINE_DESIGNATION,
                quantity=cls.duration_hours,
                unit_price_ht=cls.hourly_rate,
                total_ht=effective_revenue(cls),
                source_class_id=cls.id,
            )
            for cls in billable
        ]
        total = round(sum(effective_revenue(cls) for cls in billable), 2)
        invoice = Invoice(
            user_id=user_id,
            client_id=client_id,
            status="draft",
            period_start=period_start,
            period_end=period_end,
            total_ht=total,
            currency="EUR",
            contract_label=self._single_contract_label(billable),
            lines=lines,
        )
        self.db.add(invoice)
        await self.db.flush()
        await self.db.commit()
        return invoice

    async def auto_generate_daily_drafts(self, user_id: int, day: date) -> int:
        """Create one draft per client for the day's billable classes that aren't
        already invoiced. Idempotent (skips classes already on an invoice line).
        Returns the number of drafts created."""
        already_invoiced = (
            select(InvoiceLine.source_class_id)
            .join(Invoice, InvoiceLine.invoice_id == Invoice.id)
            .where(Invoice.user_id == user_id, InvoiceLine.source_class_id.is_not(None))
        )
        result = await self.db.execute(
            select(Class)
            .where(
                Class.user_id == user_id,
                Class.class_date == day,
                Class.id.not_in(already_invoiced),
            )
            .options(selectinload(Class.contract))
            .order_by(Class.client_id)
        )
        billable = [c for c in result.scalars().all() if not is_excluded_status(c.status)]

        by_client: dict[int, list[Class]] = {}
        for cls in billable:
            by_client.setdefault(cls.client_id, []).append(cls)

        for client_id, cls_list in by_client.items():
            await self._build_draft_invoice(user_id, client_id, day, day, cls_list)
        return len(by_client)

    @staticmethod
    def _single_contract_label(classes: list[Class]) -> Optional[str]:
        """The contract description when all classes share one contract, else None.
        Display-only label for the invoices list — not shown on the PDF."""
        contract_ids = {c.contract_id for c in classes}
        if len(contract_ids) == 1 and classes[0].contract is not None:
            return classes[0].contract.description
        return None

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

    async def list_by_class(self, user_id: int, class_id: int) -> list[Invoice]:
        """Invoices that reference a given class via one of their lines (newest first)."""
        result = await self.db.execute(
            select(Invoice)
            .join(InvoiceLine, InvoiceLine.invoice_id == Invoice.id)
            .where(Invoice.user_id == user_id, InvoiceLine.source_class_id == class_id)
            .options(selectinload(Invoice.lines))
            .order_by(Invoice.id.desc())
        )
        return list(result.scalars().unique().all())

    async def get_by_id(self, user_id: int, invoice_id: int) -> Optional[Invoice]:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id, Invoice.user_id == user_id)
            .options(selectinload(Invoice.lines))
        )
        return result.scalar_one_or_none()

    async def delete_draft(self, user_id: int, invoice_id: int) -> bool:
        """Delete a DRAFT invoice (and its cached PDF) owned by the user.

        Only drafts can be deleted — they carry no number, so removing one never
        creates a gap in the legal sequence. Issued invoices are immutable
        (corrections go through a credit note / avoir) and raise
        InvoiceNotDraftError. Returns False if the invoice doesn't exist for the user.
        """
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id, Invoice.user_id == user_id)
            .options(selectinload(Invoice.lines))
        )
        invoice = result.scalar_one_or_none()
        if invoice is None:
            return False
        if invoice.status != "draft":
            raise InvoiceNotDraftError(
                f"Invoice {invoice_id} is {invoice.status}; only drafts can be deleted"
            )
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
