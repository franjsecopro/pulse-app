from datetime import date, datetime, time, timezone

import pytest

from app.models.class_ import Class
from app.models.client import Client
from app.models.contract import Contract
from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings
from app.services.notification_service import NotificationService

USER_ID = 1


async def _seed(db, *objects):
    for obj in objects:
        db.add(obj)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def _seed_client_with_notification_settings(
    db, *, name: str, whatsapp: str | None = None
) -> tuple[Client, Contract, NotificationSettings]:
    (client,) = await _seed(db, Client(user_id=USER_ID, name=name, whatsapp_phone=whatsapp))
    (contract,) = await _seed(
        db,
        Contract(
            client_id=client.id,
            description="Clases",
            start_date=date(2026, 1, 1),
            hourly_rate=20.0,
        ),
    )
    # get_settings() creates defaults with default_channel="whatsapp" and the
    # DEFAULT_TEMPLATE; we don't care about the template here, just the channel.
    settings = await NotificationService(db).get_settings(USER_ID)
    return client, contract, settings


def _class_on(client_id: int, contract_id: int, when: date, when_time: time | None = None) -> Class:
    return Class(
        user_id=USER_ID,
        client_id=client_id,
        contract_id=contract_id,
        class_date=when,
        class_time=when_time,
        duration_hours=1.0,
        hourly_rate=20.0,
        status="normal",
    )


def _notification(
    client_id: int,
    class_id: int,
    class_date: date,
    *,
    status: str = "pending",
    channel: str = "whatsapp",
    created_at: datetime | None = None,
) -> Notification:
    return Notification(
        user_id=USER_ID,
        client_id=client_id,
        class_id=class_id,
        channel=channel,
        status=status,
        message="Hola",
        class_date=class_date,
        created_at=created_at or datetime(2026, 4, 15, 10, 0, tzinfo=timezone.utc),
    )


class TestGetPendingBySendDate:
    @pytest.mark.asyncio
    async def test_returns_all_pending_when_date_is_none(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _class_on(client.id, contract.id, date(2026, 4, 11)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="pending"),
            _notification(client.id, 2, date(2026, 4, 11), status="pending"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_send_date(USER_ID)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_filters_pending_by_send_date_uses_next_day_as_class_date(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _class_on(client.id, contract.id, date(2026, 4, 11)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="pending"),
            _notification(client.id, 2, date(2026, 4, 11), status="pending"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_send_date(USER_ID, send_date=date(2026, 4, 9))

        assert len(result) == 1
        assert result[0]["class_date"] == "2026-04-10"

    @pytest.mark.asyncio
    async def test_filters_include_skipped(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="skipped"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_send_date(USER_ID, send_date=date(2026, 4, 9))

        assert len(result) == 1
        assert result[0]["status"] == "skipped"

    @pytest.mark.asyncio
    async def test_excludes_sent_when_send_date_is_set(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="sent"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_send_date(USER_ID, send_date=date(2026, 4, 9))

        assert result == []


class TestGetPendingByClassDate:
    @pytest.mark.asyncio
    async def test_filters_pending_by_class_date_directly(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _class_on(client.id, contract.id, date(2026, 4, 11)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="pending"),
            _notification(client.id, 2, date(2026, 4, 11), status="pending"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_class_date(USER_ID, class_date=date(2026, 4, 10))

        assert len(result) == 1
        assert result[0]["class_date"] == "2026-04-10"

    @pytest.mark.asyncio
    async def test_includes_skipped(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="skipped"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_class_date(USER_ID, class_date=date(2026, 4, 10))

        assert len(result) == 1
        assert result[0]["status"] == "skipped"

    @pytest.mark.asyncio
    async def test_excludes_sent(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="sent"),
        )

        service = NotificationService(db)
        result = await service.get_pending_by_class_date(USER_ID, class_date=date(2026, 4, 10))

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_existing_pending_after_generate_called_with_same_date(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="pending"),
        )

        service = NotificationService(db)
        await service.generate_daily(USER_ID, target_date=date(2026, 4, 10))
        result = await service.get_pending_by_class_date(USER_ID, class_date=date(2026, 4, 10))

        assert len(result) == 1
        assert result[0]["class_date"] == "2026-04-10"


class TestGetLogModeFilter:
    @pytest.mark.asyncio
    async def test_filters_by_month_mode(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client.id, 1, date(2026, 4, 10),
                status="sent",
                created_at=datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                status="sent",
                created_at=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                status="sent",
                created_at=datetime(2026, 3, 28, 10, 0, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, mode="month", date=date(2026, 4, 15))

        assert result["total"] == 1
        assert len(result["items"]) == 1
        assert result["items"][0]["status"] == "sent"

    @pytest.mark.asyncio
    async def test_month_mode_first_second_of_next_month_belongs_to_next(self, db):
        # Boundary: created_at = 2026-05-01 00:00:00 UTC must belong to May, not April.
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client.id, 1, date(2026, 4, 10),
                status="sent",
                created_at=datetime(2026, 5, 1, 0, 0, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        april = await service.get_log(USER_ID, mode="month", date=date(2026, 4, 15))
        may = await service.get_log(USER_ID, mode="month", date=date(2026, 5, 15))

        assert april["total"] == 0
        assert may["total"] == 1

    @pytest.mark.asyncio
    async def test_no_mode_filter_returns_all(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 7, 12, 10, 0, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID)

        assert result["total"] == 2

    @pytest.mark.asyncio
    async def test_day_mode_returns_only_that_day(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 15, 9, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 15, 23, 59, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 16, 0, 1, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 14, 23, 59, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, mode="day", date=date(2026, 4, 15))

        assert result["total"] == 2

    @pytest.mark.asyncio
    async def test_week_mode_monday_to_sunday(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 13, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 19, 23, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 20, 0, 1, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 12, 23, 59, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, mode="week", date=date(2026, 4, 15))

        assert result["total"] == 2

    @pytest.mark.asyncio
    async def test_week_mode_anchored_at_wednesday_returns_same_week(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 13, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client.id, 1, date(2026, 4, 10),
                created_at=datetime(2026, 4, 19, 10, 0, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, mode="week", date=date(2026, 4, 15))

        assert result["total"] == 2

    @pytest.mark.asyncio
    async def test_unknown_mode_raises(self, db):
        service = NotificationService(db)

        with pytest.raises(ValueError, match="Unknown mode"):
            await service.get_log(USER_ID, mode="year", date=date(2026, 4, 15))


class TestGetLogAdditionalFilters:
    @pytest.mark.asyncio
    async def test_filter_by_status(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _class_on(client.id, contract.id, date(2026, 4, 11)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), status="sent"),
            _notification(client.id, 2, date(2026, 4, 11), status="skipped"),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, status="sent")

        assert result["total"] == 1
        assert result["items"][0]["status"] == "sent"

    @pytest.mark.asyncio
    async def test_filter_by_client_id(self, db):
        client_a, contract_a, _ = await _seed_client_with_notification_settings(db, name="Ana")
        client_b, contract_b, _ = await _seed_client_with_notification_settings(db, name="Bea")
        await _seed(
            db,
            _class_on(client_a.id, contract_a.id, date(2026, 4, 10)),
            _class_on(client_b.id, contract_b.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(client_a.id, 1, date(2026, 4, 10)),
            _notification(client_b.id, 2, date(2026, 4, 10)),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, client_id=client_a.id)

        assert result["total"] == 1
        assert result["items"][0]["client_id"] == client_a.id

    @pytest.mark.asyncio
    async def test_filter_by_channel(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(
            db,
            _class_on(client.id, contract.id, date(2026, 4, 10)),
            _class_on(client.id, contract.id, date(2026, 4, 11)),
        )
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10), channel="whatsapp"),
            _notification(client.id, 2, date(2026, 4, 11), channel="email"),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, channel="email")

        assert result["total"] == 1
        assert result["items"][0]["channel"] == "email"

    @pytest.mark.asyncio
    async def test_combined_filters_compose_with_and(self, db):
        client_a, contract_a, _ = await _seed_client_with_notification_settings(db, name="Ana")
        client_b, contract_b, _ = await _seed_client_with_notification_settings(db, name="Bea")
        await _seed(
            db,
            _class_on(client_a.id, contract_a.id, date(2026, 4, 10)),
            _class_on(client_b.id, contract_b.id, date(2026, 4, 10)),
        )
        await _seed(
            db,
            _notification(
                client_a.id, 1, date(2026, 4, 10),
                status="sent", channel="whatsapp",
                created_at=datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client_a.id, 1, date(2026, 4, 10),
                status="skipped", channel="whatsapp",
                created_at=datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc),
            ),
            _notification(
                client_b.id, 2, date(2026, 4, 10),
                status="sent", channel="whatsapp",
                created_at=datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc),
            ),
        )

        service = NotificationService(db)
        result = await service.get_log(
            USER_ID, mode="month", date=date(2026, 4, 15), status="sent", client_id=client_a.id
        )

        assert result["total"] == 1
        assert result["items"][0]["client_id"] == client_a.id
        assert result["items"][0]["status"] == "sent"


class TestGetLogPagination:
    @pytest.mark.asyncio
    async def test_returns_envelope_shape(self, db):
        service = NotificationService(db)
        result = await service.get_log(USER_ID)

        assert set(result.keys()) == {"items", "total", "page", "page_size"}
        assert result["page"] == 1
        assert result["page_size"] == 50
        assert result["total"] == 0
        assert result["items"] == []

    @pytest.mark.asyncio
    async def test_first_page_returns_first_slice(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))
        notifs = []
        for i in range(5):
            notifs.append(
                _notification(
                    client.id, 1, date(2026, 4, 10),
                    created_at=datetime(2026, 4, 5, 10, i, tzinfo=timezone.utc),
                )
            )
        await _seed(db, *notifs)

        service = NotificationService(db)
        result = await service.get_log(USER_ID, page=1, page_size=2)

        assert result["total"] == 5
        assert len(result["items"]) == 2

    @pytest.mark.asyncio
    async def test_second_page_returns_next_slice(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))
        notifs = []
        for i in range(5):
            notifs.append(
                _notification(
                    client.id, 1, date(2026, 4, 10),
                    created_at=datetime(2026, 4, 5, 10, i, tzinfo=timezone.utc),
                )
            )
        await _seed(db, *notifs)

        service = NotificationService(db)
        first = await service.get_log(USER_ID, page=1, page_size=2)
        second = await service.get_log(USER_ID, page=2, page_size=2)
        third = await service.get_log(USER_ID, page=3, page_size=2)

        assert first["total"] == 5
        assert second["total"] == 5
        assert third["total"] == 5
        # No overlap and full coverage of the 5 records across 3 pages of 2.
        seen_ids = (
            {item["id"] for item in first["items"]}
            | {item["id"] for item in second["items"]}
            | {item["id"] for item in third["items"]}
        )
        assert len(seen_ids) == 5

    @pytest.mark.asyncio
    async def test_page_out_of_range_returns_empty_items(self, db):
        client, contract, _ = await _seed_client_with_notification_settings(db, name="Ana")
        await _seed(db, _class_on(client.id, contract.id, date(2026, 4, 10)))
        await _seed(
            db,
            _notification(client.id, 1, date(2026, 4, 10)),
        )

        service = NotificationService(db)
        result = await service.get_log(USER_ID, page=99, page_size=10)

        assert result["total"] == 1
        assert result["items"] == []
        assert result["page"] == 99
