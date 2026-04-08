from pydantic import BaseModel, EmailStr, field_validator
import re


class UserRegisterRequest(BaseModel):
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


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str = "user"

    model_config = {"from_attributes": True}
