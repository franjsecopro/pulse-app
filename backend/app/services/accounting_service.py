"""Accounting service.

Computes financial summaries per client and contract, applying historical credit carry-overs.
The credit carry-over is derived from the all-time difference between confirmed payments and
billable classes — no separate credit table is needed.
"""
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.models.contract import Contract
from app.models.payment import Payment
from app.repositories.client_repository import ClientRepository


MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


class AccountingService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_monthly_summary(self, user_id: int, month: int, year: int) -> list[dict]:
        """Return per-client billing summary for the given month.

        Each entry includes:
        - expected: billable class total for the month
        - paid: confirmed payments received in the month
        - previous_credit: surplus accumulated before this month
        - balance: paid + previous_credit - expected (positive = credit, negative = debt)
        """
        # Monthly billable class totals (excludes cancelled_without_payment)
        class_result = await self._db.execute(
            select(Class.client_id, func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == month,
                extract("year", Class.class_date) == year,
                Class.status != "cancelled_without_payment",
            )
            .group_by(Class.client_id)
        )
        monthly_expected: dict[int, float] = {row[0]: row[1] for row in class_result.all()}

        # Monthly confirmed payments
        payment_result = await self._db.execute(
            select(Payment.client_id, func.sum(Payment.amount))
            .where(
                Payment.user_id == user_id,
                Payment.client_id.is_not(None),
                Payment.status == "confirmed",
                extract("month", Payment.payment_date) == month,
                extract("year", Payment.payment_date) == year,
            )
            .group_by(Payment.client_id)
        )
        monthly_paid: dict[int, float] = {row[0]: row[1] for row in payment_result.all()}

        # All clients involved this month
        all_client_ids = set(monthly_expected.keys()) | set(monthly_paid.keys())
        if not all_client_ids:
            return []

        # Historical credit before this month for each client
        historical_credits = await self._get_historical_credits_before(
            user_id, month, year, list(all_client_ids)
        )

        # Load client names
        clients = await ClientRepository(self._db).get_all(user_id)
        client_map = {c.id: c.name for c in clients}

        # Contract-level breakdown for all clients this month
        contract_breakdown = await self._get_contract_breakdown(
            user_id, month, year, list(all_client_ids)
        )

        summary = []
        for client_id in all_client_ids:
            expected = round(monthly_expected.get(client_id, 0.0), 2)
            paid = round(monthly_paid.get(client_id, 0.0), 2)
            previous_credit = round(max(0.0, historical_credits.get(client_id, 0.0)), 2)
            balance = round(paid + previous_credit - expected, 2)

            summary.append({
                "client_id": client_id,
                "client_name": client_map.get(client_id, "Desconocido"),
                "expected": expected,
                "paid": paid,
                "previous_credit": previous_credit,
                "balance": balance,
                "month": month,
                "year": year,
                "month_name": MONTH_NAMES[month - 1],
                "contracts": contract_breakdown.get(client_id, []),
            })

        return sorted(summary, key=lambda x: x["client_name"])

    async def get_client_balance(self, user_id: int, client_id: int) -> dict:
        """Return the all-time accumulated balance for a single client.

        Positive balance = client has overpaid (credit available).
        Negative balance = client has an outstanding debt.
        """
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

    # ─── Private helpers ───────────────────────────────────────────────────────

    async def _get_contract_breakdown(
        self,
        user_id: int,
        month: int,
        year: int,
        client_ids: list[int],
    ) -> dict[int, list[dict]]:
        """Return per-contract class breakdown grouped by client_id.

        Each contract entry contains:
        - contract_id, contract_description, hourly_rate
        - class_count: total billable classes (normal + cancelled_with_payment)
        - normal_count, cancelled_with_payment_count, cancelled_without_payment_count
        - expected: billable amount for the month
        """
        # Query: class counts and amounts grouped by client + contract + status
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

        # Load contract descriptions
        contract_ids = {r.contract_id for r in rows if r.contract_id is not None}
        contract_map: dict[int, Contract] = {}
        if contract_ids:
            contracts_result = await self._db.execute(
                select(Contract).where(Contract.id.in_(contract_ids))
            )
            for c in contracts_result.scalars().all():
                contract_map[c.id] = c

        # Aggregate by (client_id, contract_id)
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
            elif row.status == "cancelled_with_payment":
                entry["cancelled_with_payment_count"] += count
                entry["expected"] += amount
            elif row.status == "cancelled_without_payment":
                entry["cancelled_without_payment_count"] += count
                # not added to expected

        # Group by client_id
        by_client: dict[int, list[dict]] = {}
        for (client_id, _), entry in aggregated.items():
            entry["expected"] = round(entry["expected"], 2)
            entry["class_count"] = entry["normal_count"] + entry["cancelled_with_payment_count"]
            by_client.setdefault(client_id, []).append(entry)

        return by_client

    async def _get_historical_credits_before(
        self,
        user_id: int,
        month: int,
        year: int,
        client_ids: list[int],
    ) -> dict[int, float]:
        """Calculate each client's accumulated surplus BEFORE the given month.
        A positive value means the client has pre-paid credit to apply this month."""
        # Total paid before this month
        paid_result = await self._db.execute(
            select(Payment.client_id, func.sum(Payment.amount))
            .where(
                Payment.user_id == user_id,
                Payment.client_id.in_(client_ids),
                Payment.status == "confirmed",
                (extract("year", Payment.payment_date) * 100 + extract("month", Payment.payment_date))
                < (year * 100 + month),
            )
            .group_by(Payment.client_id)
        )
        paid_before: dict[int, float] = {row[0]: row[1] for row in paid_result.all()}

        # Total billable before this month
        class_result = await self._db.execute(
            select(Class.client_id, func.sum(Class.duration_hours * Class.hourly_rate))
            .where(
                Class.user_id == user_id,
                Class.client_id.in_(client_ids),
                Class.status != "cancelled_without_payment",
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
                Class.status != "cancelled_without_payment",
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
