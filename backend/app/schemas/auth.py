"""Authentication schemas."""

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.models.enums import Role
from app.schemas.user import UserOut

#: Deliberately permissive - real verification would be an email OTP.
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=5,
        max_length=255,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]

Password = Annotated[str, StringConstraints(min_length=8, max_length=72)]


class RegisterIn(BaseModel):
    email: Email
    password: Password
    full_name: str = Field(min_length=2, max_length=120)
    roll_number: str | None = Field(default=None, max_length=40)
    department: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=20)


class AdminCreateUserIn(RegisterIn):
    role: Role = Role.STUDENT


class LoginIn(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=72)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds")
    user: UserOut


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: Password
