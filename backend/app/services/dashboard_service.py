from datetime import datetime, timezone
from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pdf_import import PDFImport
from app.repositories.client_repository import ClientRepository
from app.repositories.class_repository import ClassRepository
from app.repositories.payment_repository import PaymentRepository


class DashboardService:
    def __init__(self, db: AsyncSession):
        self._client_repo = ClientRepository(db)
        self._class_repo = ClassRepository(db)
        self._payment_repo = PaymentRepository(db)

    async def get_summary(self, user_id: int) -> dict:
        now = datetime.now(timezone.utc)
        year, month = now.year, now.month

        class_totals = await self._class_repo.get_monthly_totals(user_id, year, month)
        payment_totals = await self._payment_repo.get_monthly_totals(user_id, year, month)

        total_expected = sum(class_totals.values())
        total_paid = sum(payment_totals.values())
        total_pending = max(0.0, total_expected - total_paid)

        active_clients = await self._client_repo.count_active(user_id)
        monthly_classes = await self._class_repo.count_current_month(user_id)
        monthly_payments = await self._payment_repo.sum_current_month(user_id)

        return {
            "total_expected": round(total_expected, 2),
            "total_paid": round(total_paid, 2),
            "total_pending": round(total_pending, 2),
            "active_clients": active_clients,
            "monthly_classes": monthly_classes,
            "monthly_payments": round(monthly_payments, 2),
            "month": month,
            "year": year,
        }

    async def get_alerts(self, user_id: int) -> list[dict]:
        """
        Compares expected vs paid for the current month per client.
        Returns alert objects for discrepancies.
        """
        now = datetime.now(timezone.utc)
        year, month = now.year, now.month

        class_totals = await self._class_repo.get_monthly_totals(user_id, year, month)
        payment_totals = await self._payment_repo.get_monthly_totals(user_id, year, month)

        clients = await ClientRepository(self._client_repo._db).get_all(user_id)
        client_map = {c.id: c.name for c in clients}

        alerts = []
        all_client_ids = set(class_totals.keys()) | set(payment_totals.keys())

        for client_id in all_client_ids:
            expected = class_totals.get(client_id, 0.0)
            paid = payment_totals.get(client_id, 0.0)
            diff = round(paid - expected, 2)

            if diff < 0:
                alert_type = "debt"
                message = f"Debe €{abs(diff):.2f} del mes de {_month_name(month)}"
            elif diff > 0:
                alert_type = "credit"
                message = f"Tiene un crédito de €{diff:.2f}"
            else:
                continue  # No discrepancy

            alerts.append({
                "client_id": client_id,
                "client_name": client_map.get(client_id, "Desconocido"),
                "type": alert_type,
                "message": message,
                "expected": round(expected, 2),
                "paid": round(paid, 2),
                "diff": diff,
                "month": month,
                "year": year,
            })

        # Alerta de PDF no subido: si ya pasaron 5 días del mes actual y no hay PDF del mes anterior
        pdf_alert = await self._check_pdf_missing(user_id, now)
        if pdf_alert:
            alerts.append(pdf_alert)

        return sorted(alerts, key=lambda a: a["diff"])


    async def _check_pdf_missing(self, user_id: int, now: datetime) -> dict | None:
        """Returns a pdf_missing alert if it's past day 5 of the month and no PDF was imported
        for the previous month."""
        if now.day <= 5:
            return None

        prev_month = now.month - 1 if now.month > 1 else 12
        prev_year = now.year if now.month > 1 else now.year - 1

        # Only alert if there was actual activity (classes) in the previous month
        from app.models.class_ import Class
        activity_result = await self._class_repo._db.execute(
            select(Class)
            .where(
                Class.user_id == user_id,
                extract("month", Class.class_date) == prev_month,
                extract("year", Class.class_date) == prev_year,
            )
            .limit(1)
        )
        had_activity = activity_result.scalar_one_or_none()
        if not had_activity:
            return None

        result = await self._class_repo._db.execute(
            select(PDFImport)
            .where(
                PDFImport.user_id == user_id,
                PDFImport.month == prev_month,
                PDFImport.year == prev_year,
            )
            .limit(1)
        )
        already_imported = result.scalar_one_or_none()
        if already_imported:
            return None

        return {
            "client_id": None,
            "client_name": None,
            "type": "pdf_missing",
            "message": f"No has subido el extracto bancario de {_month_name(prev_month)} {prev_year}",
            "expected": 0,
            "paid": 0,
            "diff": 0,
            "month": prev_month,
            "year": prev_year,
        }


def _month_name(month: int) -> str:
    months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
              "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    return months[month - 1]
