from typing import Literal

from pydantic import EmailStr, field_validator
import re

from app.schemas._base import BaseSchema


class UserRegisterRequest(BaseSchema):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        errors = []
        if len(password) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", password):
            errors.append("one uppercase letter")
        if not re.search(r"[0-9]", password):
            errors.append("one digit")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return password


class UserLoginRequest(BaseSchema):
    email: EmailStr
    password: str


class UserResponse(BaseSchema):
    id: int
    email: str
    role: str = "user"
    locale: str = "es-ES"
    is_demo_active: bool = False
    real_email: str | None = None


class UserUpdateRequest(BaseSchema):
    locale: Literal["es-ES", "fr-FR"]
