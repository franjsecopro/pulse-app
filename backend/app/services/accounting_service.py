"""Accounting service.

Computes financial summaries per client and contract, applying historical credit carry-overs.
The credit carry-over is derived from the all-time difference between confirmed payments and
billable classes — no separate credit table is needed.
"""
from sqlalchemy import select, func, extract, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.client import Client
from app.models.contract import Contract
from app.models.payment import Payment
from app.repositories.client_repository import ClientRepository
from app.schemas.accounting import (
    AccountingSummaryEntryResponse,
    ContractBreakdownResponse,
)


MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _payment_billing_period():
    """Continuous month index a payment APPLIES to. For "next_month" clients (paying
    in arrears) the period is shifted back by one, so a May payment covers April.
    """
    offset = case((Client.payment_timing == "next_month", 1), else_=0)
    return (
        extract("year", Payment.payment_date) * 12
        + extract("month", Payment.payment_date)
        - offset
    )


class AccountingService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_monthly_summary(
        self, user_id: int, month: int, year: int
    ) -> list[AccountingSummaryEntryResponse]:
        class_result = await self._db.execute(
            select(Class.client_id, func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
                Class.status != "cancelledWithoutPayment",
            )
            .group_by(Class.client_id)
        )
        monthly_expected: dict[int, float] = {row[0]: row[1] for row in class_result.all()}

        payment_result = await self._db.execute(
            select(Payment.client_id, func.sum(Payment.amount))
            .join(Client, Payment.client_id == Client.id)
            .where(
                Payment.user_id == user_id,
                Payment.client_id.is_not(None),
                Payment.status == "confirmed",
                _payment_billing_period() == year * 12 + month,
            )
            .group_by(Payment.client_id)
        )
        monthly_paid: dict[int, float] = {row[0]: row[1] for row in payment_result.all()}

        all_client_ids = set(monthly_expected.keys()) | set(monthly_paid.keys())
        if not all_client_ids:
            return []

        historical_credits = await self._get_historical_credits_before(
            user_id, month, year, list(all_client_ids)
        )

        clients = await ClientRepository(self._db).get_all(user_id)
        client_map = {c.id: c.name for c in clients}

        contract_breakdown = await self._get_contract_breakdown(
            user_id, month, year, list(all_client_ids)
        )

        summary = []
        for client_id in all_client_ids:
            expected = round(monthly_expected.get(client_id, 0.0), 2)
            paid = round(monthly_paid.get(client_id, 0.0), 2)
            previous_credit = round(max(0.0, historical_credits.get(client_id, 0.0)), 2)
            balance = round(paid + previous_credit - expected, 2)

            summary.append(AccountingSummaryEntryResponse(
                client_id=client_id,
                client_name=client_map.get(client_id, "Desconocido"),
                expected=expected,
                paid=paid,
                previous_credit=previous_credit,
                balance=balance,
                month=month,
                year=year,
                month_name=MONTH_NAMES[month - 1],
                contracts=contract_breakdown.get(client_id, []),
            ))

        return sorted(summary, key=lambda x: x.client_name)

    async def get_client_balance(self, user_id: int, client_id: int) -> dict:
        total_expected = await self._get_all_time_expected(user_id, client_id)
        total_paid = await self._get_all_time_paid(user_id, client_id)
        balance = round(total_paid - total_expected, 2)

        clients = await ClientRepository(self._db).get_all(user_id)
        client_map = {c.id: c.name for c in clients}

        return {
            "client_id": client_id,
            "client_name": client_map.get(client_id, "Desconocido"),
            "total_expected": round(total_expected, 2),
            "total_paid": round(total_paid, 2),
            "balance": balance,
        }

    async def _get_contract_breakdown(
        self,
        user_id: int,
        month: int,
        year: int,
        client_ids: list[int],
    ) -> dict[int, list[ContractBreakdownResponse]]:
        result = await self._db.execute(
            select(
                Class.client_id,
                Class.contract_id,
                Class.status,
                func.count().label("class_count"),
                func.sum(Class.duration_hours * Class.hourly_rate).label("amount"),
            )
            .where(
                Class.user_id == user_id,
                Class.client_id.in_(client_ids),
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
            )
            .group_by(Class.client_id, Class.contract_id, Class.status)
        )
        rows = result.all()

        contract_ids = {r.contract_id for r in rows if r.contract_id is not None}
        contract_map: dict[int, Contract] = {}
        if contract_ids:
            contracts_result = await self._db.execute(
                select(Contract).where(Contract.id.in_(contract_ids))
            )
            for c in contracts_result.scalars().all():
                contract_map[c.id] = c

        aggregated: dict[tuple, dict] = {}
        for row in rows:
            key = (row.client_id, row.contract_id)
            if key not in aggregated:
                contract = contract_map.get(row.contract_id) if row.contract_id else None
                aggregated[key] = {
                    "contract_id": row.contract_id,
                    "contract_description": contract.description if contract else "Sin contrato",
                    "hourly_rate": contract.hourly_rate if contract else 0.0,
                    "normal_count": 0,
                    "cancelled_with_payment_count": 0,
                    "cancelled_without_payment_count": 0,
                    "expected": 0.0,
                }
            entry = aggregated[key]
            count = row.class_count or 0
            amount = float(row.amount or 0)

            if row.status == "normal":
                entry["normal_count"] += count
                entry["expected"] += amount
            elif row.status == "cancelledWithPayment":
                entry["cancelled_with_payment_count"] += count
            elif row.status == "cancelledWithoutPayment":
                entry["cancelled_without_payment_count"] += count

        by_client: dict[int, list[ContractBreakdownResponse]] = {}
        for (client_id, _), entry in aggregated.items():
            by_client.setdefault(client_id, []).append(ContractBreakdownResponse(
                contract_id=entry["contract_id"],
                contract_description=entry["contract_description"],
                hourly_rate=entry["hourly_rate"],
                class_count=entry["normal_count"] + entry["cancelled_with_payment_count"],
                normal_count=entry["normal_count"],
                cancelled_with_payment_count=entry["cancelled_with_payment_count"],
                cancelled_without_payment_count=entry["cancelled_without_payment_count"],
                expected=round(entry["expected"], 2),
            ))

        return by_client

    async def _get_historical_credits_before(
        self,
        user_id: int,
        month: int,
        year: int,
        client_ids: list[int],
    ) -> dict[int, float]:
        # Same arrears-aware bucketing as the monthly query, so a "next_month" client's
        # surplus lands in the right period.
        paid_result = await self._db.execute(
            select(Payment.client_id, func.sum(Payment.amount))
            .join(Client, Payment.client_id == Client.id)
            .where(
                Payment.user_id == user_id,
                Payment.client_id.in_(client_ids),
                Payment.status == "confirmed",
                _payment_billing_period() < (year * 12 + month),
            )
            .group_by(Payment.client_id)
        )
        paid_before: dict[int, float] = {row[0]: row[1] for row in paid_result.all()}

        class_result = await self._db.execute(
            select(Class.client_id, func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                Class.client_id.in_(client_ids),
                Class.status != "cancelledWithoutPayment",
                (extract("year", Class.class_date) * 100 + extract("month", Class.class_date))
                < (year * 100 + month),
            )
            .group_by(Class.client_id)
        )
        expected_before: dict[int, float] = {row[0]: row[1] for row in class_result.all()}

        return {
            cid: (paid_before.get(cid, 0.0) - expected_before.get(cid, 0.0))
            for cid in client_ids
        }

    async def _get_all_time_expected(self, user_id: int, client_id: int) -> float:
        result = await self._db.execute(
            select(func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                Class.client_id == client_id,
                Class.status != "cancelledWithoutPayment",
            )
        )
        return result.scalar_one() or 0.0

    async def _get_all_time_paid(self, user_id: int, client_id: int) -> float:
        result = await self._db.execute(
            select(func.sum(Payment.amount))
            .where(
                Payment.user_id == user_id,
                Payment.client_id == client_id,
                Payment.status == "confirmed",
            )
        )
        return result.scalar_one() or 0.0
