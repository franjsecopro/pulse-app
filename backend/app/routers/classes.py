from datetime import date
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_real_user
from app.models.class_ import Class
from app.models.user import User
from app.repositories.class_repository import ClassRepository
from app.repositories.google_auth_repository import GoogleAuthRepository
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest, ClassResponse, ClassStatsResponse
from app.services import class_calendar_service
from app.services.class_revenue import effective_revenue

router = APIRouter(prefix="/classes", tags=["classes"])


def _build_response(class_: object) -> ClassResponse:
    data = ClassResponse.model_validate(class_)
    data.client_name = class_.client.name if class_.client else None
    data.contract_description = class_.contract.description if class_.contract else None
    data.effective_revenue = effective_revenue(class_)
    return data


@router.get("", response_model=list[ClassResponse])
async def list_classes(
    response: Response,
    client_id: Optional[int] = Query(None, alias="clientId"),
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


@router.get("/stats", response_model=ClassStatsResponse)
async def get_class_stats(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    client_id: Optional[int] = Query(None, alias="clientId"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    stats = await repo.get_stats(
        current_user.id, year=year, month=month, client_id=client_id
    )
    return ClassStatsResponse(**stats)


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


@router.post("/sync-gcal")
async def sync_gcal_all(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_real_user),
):
    """Enqueue a Google Calendar sync for all future classes of the current user.

    Uses get_real_user so that in demo mode the admin's own classes (not the
    demo user's) are synced, and the admin's GCal credentials are used.
    Returns {scheduled: N} before tasks complete — failures are logged server-side.
    """
    google_auth = await GoogleAuthRepository(db).get_by_user_id(current_user.id)
    if not google_auth:
        raise HTTPException(status_code=400, detail="No Google Calendar connected")

    result = await db.execute(
        select(Class).where(
            Class.user_id == current_user.id,
            Class.class_date >= date.today(),
        )
    )
    classes = result.scalars().all()

    for cls in classes:
        if cls.google_calendar_id:
            background_tasks.add_task(
                class_calendar_service.sync_update, cls.id, current_user.id, cls.google_calendar_id
            )
        else:
            background_tasks.add_task(
                class_calendar_service.sync_create, cls.id, current_user.id
            )

    return {"scheduled": len(classes)}


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
