import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.class_repository import ClassRepository
from app.repositories.google_auth_repository import GoogleAuthRepository
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest, ClassResponse
from app.services import google_calendar_service as gc_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classes", tags=["classes"])


def _build_response(class_: object) -> ClassResponse:
    client_name = class_.client.name if class_.client else None
    contract_description = class_.contract.description if class_.contract else None
    total_amount = round(class_.duration_hours * class_.hourly_rate, 2)
    data = ClassResponse.model_validate(class_)
    data.client_name = client_name
    data.contract_description = contract_description
    data.total_amount = total_amount
    return data


# ─────────────────────────────────────────────
# Background sync tasks — each opens its own DB session
# ─────────────────────────────────────────────

async def _sync_create(class_id: int, user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        try:
            class_ = await ClassRepository(db).get_by_id(class_id, user_id)
            if not class_:
                return
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return  # usuario no ha conectado Google Calendar
            event_id = await gc_service.create_event(
                class_=class_,
                client=class_.client,
                contract=class_.contract,
                google_auth=google_auth,
                db=db,
            )
            if event_id:
                class_.google_calendar_id = event_id
                await db.commit()
        except Exception as exc:
            logger.warning("_sync_create background task failed for class %s: %s", class_id, exc)


async def _sync_update(class_id: int, user_id: int, google_event_id: Optional[str]) -> None:
    async with AsyncSessionLocal() as db:
        try:
            class_ = await ClassRepository(db).get_by_id(class_id, user_id)
            if not class_:
                return
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return
            if google_event_id:
                await gc_service.update_event(
                    google_event_id=google_event_id,
                    class_=class_,
                    client=class_.client,
                    contract=class_.contract,
                    google_auth=google_auth,
                    db=db,
                )
            else:
                # No event yet — create it now
                event_id = await gc_service.create_event(
                    class_=class_,
                    client=class_.client,
                    contract=class_.contract,
                    google_auth=google_auth,
                    db=db,
                )
                if event_id:
                    class_.google_calendar_id = event_id
                    await db.commit()
        except Exception as exc:
            logger.warning("_sync_update background task failed for class %s: %s", class_id, exc)


async def _sync_delete(google_event_id: str, user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        try:
            google_auth = await GoogleAuthRepository(db).get_by_user_id(user_id)
            if not google_auth:
                return
            await gc_service.delete_event(
                google_event_id=google_event_id,
                google_auth=google_auth,
                db=db,
            )
        except Exception as exc:
            logger.warning("_sync_delete background task failed for event %s: %s", google_event_id, exc)


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.get("", response_model=list[ClassResponse])
async def list_classes(
    client_id: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classes = await ClassRepository(db).get_all(
        current_user.id, client_id=client_id, month=month, year=year
    )
    return [_build_response(c) for c in classes]


@router.post("", response_model=ClassResponse, status_code=201)
async def create_class(
    data: ClassCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    class_ = await repo.create(current_user.id, data)
    class_ = await repo.get_by_id(class_.id, current_user.id)
    background_tasks.add_task(_sync_create, class_.id, current_user.id)
    return _build_response(class_)


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    class_ = await ClassRepository(db).get_by_id(class_id, current_user.id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    return _build_response(class_)


@router.put("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: int,
    data: ClassUpdateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    class_ = await repo.get_by_id(class_id, current_user.id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    google_event_id = class_.google_calendar_id
    class_ = await repo.update(class_, data)
    class_ = await repo.get_by_id(class_.id, current_user.id)
    background_tasks.add_task(_sync_update, class_.id, current_user.id, google_event_id)
    return _build_response(class_)


@router.delete("/{class_id}", status_code=204)
async def delete_class(
    class_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    class_ = await repo.get_by_id(class_id, current_user.id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    google_event_id = class_.google_calendar_id  # capture before delete
    await repo.delete(class_)
    if google_event_id:
        background_tasks.add_task(_sync_delete, google_event_id, current_user.id)


@router.post("/{class_id}/sync-calendar", status_code=202)
async def sync_calendar(
    class_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a Google Calendar sync for a class that failed to sync automatically."""
    class_ = await ClassRepository(db).get_by_id(class_id, current_user.id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    background_tasks.add_task(_sync_update, class_.id, current_user.id, class_.google_calendar_id)
    return {"status": "sync scheduled"}
