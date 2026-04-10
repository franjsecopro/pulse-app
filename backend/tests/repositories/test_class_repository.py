"""Tests for ClassRepository — filtering, user isolation, aggregations."""
from datetime import date, time

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.repositories.class_repository import ClassRepository
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest

USER_A = 1
USER_B = 2


# ─── Helpers ────────────────────────────────────────────────────────────────

def _class(
    *,
    user_id: int = USER_A,
    client_id: int = 10,
    class_date: str = "2026-04-10",
    duration_hours: float = 1.0,
    hourly_rate: float = 20.0,
    status: str = "normal",
) -> Class:
    return Class(
        user_id=user_id,
        client_id=client_id,
        class_date=date.fromisoformat(class_date),
        duration_hours=duration_hours,
        hourly_rate=hourly_rate,
        status=status,
    )


async def _seed(db: AsyncSession, *classes: Class) -> list[Class]:
    for c in classes:
        db.add(c)
    await db.commit()
    for c in classes:
        await db.refresh(c)
    return list(classes)


# ─── get_all — user isolation ────────────────────────────────────────────────

class TestGetAllUserIsolation:
    async def test_only_returns_own_classes(self, db: AsyncSession):
        await _seed(
            db,
            _class(user_id=USER_A),
            _class(user_id=USER_B),
        )
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A)

        assert len(results) == 1
        assert results[0].user_id == USER_A

    async def test_returns_empty_for_user_with_no_classes(self, db: AsyncSession):
        await _seed(db, _class(user_id=USER_B))
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A)

        assert results == []


# ─── get_all — month/year filter ────────────────────────────────────────────

class TestGetAllMonthYearFilter:
    async def test_filters_by_month_and_year(self, db: AsyncSession):
        await _seed(
            db,
            _class(class_date="2026-04-10"),   # April — match
            _class(class_date="2026-04-25"),   # April — match
            _class(class_date="2026-05-01"),   # May — no match
            _class(class_date="2025-04-10"),   # April different year — no match
        )
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A, month=4, year=2026)

        assert len(results) == 2
        for c in results:
            assert c.class_date.month == 4
            assert c.class_date.year == 2026

    async def test_no_filter_returns_all(self, db: AsyncSession):
        await _seed(
            db,
            _class(class_date="2026-04-10"),
            _class(class_date="2026-05-01"),
        )
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A)

        assert len(results) == 2

    async def test_month_without_year_returns_all(self, db: AsyncSession):
        """Only applying month without year should not filter (both required)."""
        await _seed(
            db,
            _class(class_date="2026-04-10"),
            _class(class_date="2025-04-15"),
        )
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A, month=4)

        assert len(results) == 2


# ─── get_all — client_id filter ─────────────────────────────────────────────

class TestGetAllClientIdFilter:
    async def test_filters_by_client_id(self, db: AsyncSession):
        await _seed(
            db,
            _class(client_id=10),
            _class(client_id=20),
            _class(client_id=10),
        )
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A, client_id=10)

        assert len(results) == 2
        assert all(c.client_id == 10 for c in results)

    async def test_returns_empty_when_no_match(self, db: AsyncSession):
        await _seed(db, _class(client_id=10))
        repo = ClassRepository(db)

        results = await repo.get_all(USER_A, client_id=99)

        assert results == []


# ─── get_by_id ───────────────────────────────────────────────────────────────

class TestGetById:
    async def test_returns_class_by_id(self, db: AsyncSession):
        [cls] = await _seed(db, _class())
        repo = ClassRepository(db)

        found = await repo.get_by_id(cls.id, USER_A)

        assert found is not None
        assert found.id == cls.id

    async def test_returns_none_for_wrong_user(self, db: AsyncSession):
        [cls] = await _seed(db, _class(user_id=USER_A))
        repo = ClassRepository(db)

        found = await repo.get_by_id(cls.id, USER_B)

        assert found is None

    async def test_returns_none_for_unknown_id(self, db: AsyncSession):
        repo = ClassRepository(db)

        found = await repo.get_by_id(99999, USER_A)

        assert found is None


# ─── create ──────────────────────────────────────────────────────────────────

class TestCreate:
    async def test_create_persists_class(self, db: AsyncSession):
        repo = ClassRepository(db)
        data = ClassCreateRequest(
            client_id=10,
            class_date=date(2026, 4, 10),
            duration_hours=1.5,
            hourly_rate=25.0,
        )

        cls = await repo.create(USER_A, data)

        assert cls.id is not None
        assert cls.user_id == USER_A
        assert cls.duration_hours == 1.5
        assert cls.hourly_rate == 25.0


# ─── update ──────────────────────────────────────────────────────────────────

class TestUpdate:
    async def test_update_changes_fields(self, db: AsyncSession):
        [cls] = await _seed(db, _class(hourly_rate=20.0))
        repo = ClassRepository(db)

        updated = await repo.update(cls, ClassUpdateRequest(hourly_rate=30.0))

        assert updated.hourly_rate == 30.0

    async def test_update_changes_status(self, db: AsyncSession):
        [cls] = await _seed(db, _class(status="normal"))
        repo = ClassRepository(db)

        updated = await repo.update(cls, ClassUpdateRequest(status="cancelled_with_payment"))

        assert updated.status == "cancelled_with_payment"


# ─── delete ──────────────────────────────────────────────────────────────────

class TestDelete:
    async def test_delete_removes_class(self, db: AsyncSession):
        [cls] = await _seed(db, _class())
        repo = ClassRepository(db)

        await repo.delete(cls)
        found = await repo.get_by_id(cls.id, USER_A)

        assert found is None


# ─── get_monthly_totals ──────────────────────────────────────────────────────

class TestGetMonthlyTotals:
    async def test_returns_total_per_client(self, db: AsyncSession):
        await _seed(
            db,
            _class(client_id=10, duration_hours=2.0, hourly_rate=20.0, class_date="2026-04-10"),  # €40
            _class(client_id=10, duration_hours=1.0, hourly_rate=20.0, class_date="2026-04-15"),  # €20
            _class(client_id=20, duration_hours=1.5, hourly_rate=30.0, class_date="2026-04-20"),  # €45
        )
        repo = ClassRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals[10] == 60.0
        assert totals[20] == 45.0

    async def test_excludes_cancelled_without_payment(self, db: AsyncSession):
        await _seed(
            db,
            _class(client_id=10, duration_hours=2.0, hourly_rate=20.0, class_date="2026-04-10"),  # €40 — counted
            _class(
                client_id=10, duration_hours=1.0, hourly_rate=20.0, class_date="2026-04-15",
                status="cancelled_without_payment"
            ),  # €20 — excluded
        )
        repo = ClassRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals[10] == 40.0

    async def test_includes_cancelled_with_payment(self, db: AsyncSession):
        """cancelled_with_payment classes ARE billed — should be counted."""
        await _seed(
            db,
            _class(
                client_id=10, duration_hours=1.0, hourly_rate=20.0, class_date="2026-04-10",
                status="cancelled_with_payment"
            ),
        )
        repo = ClassRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals[10] == 20.0

    async def test_returns_empty_for_different_month(self, db: AsyncSession):
        await _seed(db, _class(class_date="2026-05-01"))
        repo = ClassRepository(db)

        totals = await repo.get_monthly_totals(USER_A, year=2026, month=4)

        assert totals == {}


# ─── count_current_month ─────────────────────────────────────────────────────

class TestCountCurrentMonth:
    async def test_counts_classes_in_current_month(self, db: AsyncSession):
        today = date.today()
        current = today.isoformat()
        # Place one class in the current month, one in a different month
        other_month = today.replace(month=1) if today.month != 1 else today.replace(month=2)

        await _seed(
            db,
            _class(class_date=current),
            _class(class_date=other_month.isoformat()),
        )
        repo = ClassRepository(db)

        count = await repo.count_current_month(USER_A)

        assert count == 1

    async def test_returns_zero_when_no_classes(self, db: AsyncSession):
        repo = ClassRepository(db)

        count = await repo.count_current_month(USER_A)

        assert count == 0
