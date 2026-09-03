import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    badge_number: Optional[str] = None
    agency: Optional[str] = None
    is_active: Optional[bool] = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    badge_number: Optional[str] = None
    agency: Optional[str] = None
    # Security: role is intentionally excluded from public UserCreate.
    # Public registrations are assigned VIEWER by default.


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    badge_number: Optional[str] = None
    agency: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserRead(UserBase):
    id: uuid.UUID
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserRead"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    roles: Optional[list[str]] = None
    type: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
