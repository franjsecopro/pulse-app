"""Issuer fiscal profile (1-1 with the current user). Groundwork for invoicing."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.business_profile import BusinessProfile
from app.models.user import User
from app.schemas.business_profile import BusinessProfileResponse, BusinessProfileUpdate

router = APIRouter(prefix="/business-profile", tags=["business-profile"])


async def _get_profile(db: AsyncSession, user_id: int) -> BusinessProfile | None:
    result = await db.execute(
        select(BusinessProfile).where(BusinessProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=BusinessProfileResponse)
async def get_business_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's fiscal profile (empty fields if not set yet)."""
    return await _get_profile(db, current_user.id) or BusinessProfile()


@router.put("", response_model=BusinessProfileResponse)
async def upsert_business_profile(
    data: BusinessProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update the current user's fiscal profile (full replace)."""
    profile = await _get_profile(db, current_user.id)
    if profile is None:
        profile = BusinessProfile(user_id=current_user.id)
        db.add(profile)

    for field, value in data.model_dump().items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile
