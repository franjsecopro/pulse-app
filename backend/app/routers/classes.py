from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.class_repository import ClassRepository
from app.schemas.class_ import ClassCreateRequest, ClassUpdateRequest, ClassResponse

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    class_ = await repo.create(current_user.id, data)
    # Re-fetch with join for the response
    class_ = await repo.get_by_id(class_.id, current_user.id)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    class_ = await repo.get_by_id(class_id, current_user.id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    class_ = await repo.update(class_, data)
    class_ = await repo.get_by_id(class_.id, current_user.id)
    return _build_response(class_)


@router.delete("/{class_id}", status_code=204)
async def delete_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClassRepository(db)
    class_ = await repo.get_by_id(class_id, current_user.id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    await repo.delete(class_)
