from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.class_repository import ClassRepository
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest, ClassResponse
from app.services import class_calendar_service

router = APIRouter(prefix="/classes", tags=["classes"])


def _build_response(class_: object) -> ClassResponse:
    data = ClassResponse.model_validate(class_)
    data.client_name = class_.client.name if class_.client else None
    data.contract_description = class_.contract.description if class_.contract else None
    data.total_amount = round(class_.duration_hours * class_.hourly_rate, 2)
    return data


@router.get("", response_model=list[ClassResponse])
async def list_classes(
    response: Response,
    client_id: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    total = await repo.count_all(current_user.id, client_id=client_id, month=month, year=year)
    classes = await repo.get_all(
        current_user.id, client_id=client_id, month=month, year=year, limit=limit, offset=offset
    )
    response.headers["X-Total-Count"] = str(total)
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
    background_tasks.add_task(class_calendar_service.sync_create, class_.id, current_user.id)
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
    background_tasks.add_task(class_calendar_service.sync_update, class_.id, current_user.id, google_event_id)
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
    google_event_id = class_.google_calendar_id
    await repo.delete(class_)
    if google_event_id:
        background_tasks.add_task(class_calendar_service.sync_delete, google_event_id, current_user.id)


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
    background_tasks.add_task(class_calendar_service.sync_update, class_.id, current_user.id, class_.google_calendar_id)
    return {"status": "sync scheduled"}
