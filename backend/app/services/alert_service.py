"""Alerts system: derives debt/credit from AccountingService (single source of
truth) and gates them on a reconciliation check (statement imported OR day-5
fallback)."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.client import Client
from app.models.statement_import import StatementImport
from app.services.accounting_service import AccountingService


class AlertService:
    def __init__(self, db: AsyncSession, now: Optional[datetime] = None):
        self._db = db
        self._now = now or datetime.now(timezone.utc)

    async def get_alerts(
        self,
        user_id: int,
        month: int,
        year: int,
        types: Optional[list[str]] = None,
    ) -> list[dict]:
        summary = await AccountingService(self._db).get_monthly_summary(
            user_id, month, year
        )

        client_ids_with_balance = [s["client_id"] for s in summary if s["balance"] != 0.0]
        timings = await self._get_payment_timings(user_id, client_ids_with_balance)

        alerts: list[dict] = []
        for entry in summary:
            if entry["balance"] == 0.0:
                continue
            client_id = entry["client_id"]
            timing = timings.get(client_id, "same_month")
            closing_month, closing_year = self._closing_period(month, year, timing)
            if not await self._is_period_reconciled(
                user_id, closing_month, closing_year
            ):
                continue
            balance = entry["balance"]
            alert_type = "debt" if balance < 0 else "credit"
            alerts.append({
                "client_id": client_id,
                "client_name": entry["client_name"],
                "type": alert_type,
                "severity": "error" if alert_type == "debt" else "info",
                "amount": abs(balance),
                "month": month,
                "year": year,
            })

        if not types or "statement_missing" in types:
            stmt_alert = await self._check_statement_missing(user_id, month, year)
            if stmt_alert is not None:
                alerts.append(stmt_alert)

        if types:
            alerts = [a for a in alerts if a["type"] in types]

        return alerts

    async def _get_payment_timings(
        self, user_id: int, client_ids: list[int]
    ) -> dict[int, str]:
        if not client_ids:
            return {}
        result = await self._db.execute(
            select(Client.id, Client.payment_timing)
            .where(Client.user_id == user_id, Client.id.in_(client_ids))
        )
        return {row[0]: row[1] for row in result.all()}

    @staticmethod
    def _closing_period(month: int, year: int, timing: str) -> tuple[int, int]:
        if timing == "next_month":
            if month == 12:
                return 1, year + 1
            return month + 1, year
        return month, year

    async def _is_period_reconciled(
        self, user_id: int, closing_month: int, closing_year: int
    ) -> bool:
        result = await self._db.execute(
            select(StatementImport.id)
            .where(
                StatementImport.user_id == user_id,
                StatementImport.month == closing_month,
                StatementImport.year == closing_year,
            )
            .limit(1)
        )
        if result.scalar_one_or_none() is not None:
            return True
        return self._fallback_active(closing_month, closing_year)

    def _fallback_active(self, closing_month: int, closing_year: int) -> bool:
        fallback_month = closing_month + 1
        fallback_year = closing_year
        if fallback_month > 12:
            fallback_month = 1
            fallback_year += 1
        today = self._now
        if (today.year, today.month) > (fallback_year, fallback_month):
            return True
        if (today.year, today.month) == (fallback_year, fallback_month) and today.day > 5:
            return True
        return False

    async def _check_statement_missing(
        self, user_id: int, month: int, year: int
    ) -> Optional[dict]:
        activity = await self._db.execute(
            select(Class.id)
            .where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
            )
            .limit(1)
        )
        if activity.scalar_one_or_none() is None:
            return None

        stmt = await self._db.execute(
            select(StatementImport.id)
            .where(
                StatementImport.user_id == user_id,
                StatementImport.month == month,
                StatementImport.year == year,
            )
            .limit(1)
        )
        if stmt.scalar_one_or_none() is not None:
            return None

        if not self._fallback_active(month, year):
            return None

        return {
            "client_id": None,
            "client_name": None,
            "type": "statement_missing",
            "severity": "warning",
            "amount": 0.0,
            "month": month,
            "year": year,
        }
