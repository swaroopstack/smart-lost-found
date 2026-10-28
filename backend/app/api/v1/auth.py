"""Authentication endpoints."""

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.errors import AuthError, ConflictError, ValidationError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import ChangePasswordIn, LoginIn, RegisterIn, Token
from app.schemas.common import Message
from app.schemas.user import UserOut, UserUpdateSelf

router = APIRouter(prefix="/auth", tags=["Auth"])


def _issue_token(user: User) -> Token:
    token = create_access_token(user.id, user.role)
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


def _authenticate(db: Session, email: str, password: str) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        # Same message for both cases: never reveal whether an email exists.
        raise AuthError("Incorrect email or password.")
    if not user.is_active:
        raise AuthError("This account has been deactivated.")
    return user


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a student account",
)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> User:
    exists = db.execute(select(User.id).where(User.email == payload.email)).scalar_one_or_none()
    if exists:
        raise ConflictError("An account with this email already exists.", fields={"email": "Already registered"})

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        roll_number=payload.roll_number,
        department=payload.department,
        phone=payload.phone,
        # Self-registration can never create an admin.
        role=Role.STUDENT.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="OAuth2 password login (used by the Swagger 'Authorize' button)",
)
def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    user = _authenticate(db, form.username.strip().lower(), form.password)
    return _issue_token(user)


@router.post(
    "/login/json",
    response_model=Token,
    summary="JSON login (use this from the frontend)",
)
def login_json(payload: LoginIn, db: Session = Depends(get_db)) -> Token:
    user = _authenticate(db, payload.email, payload.password)
    return _issue_token(user)


@router.get("/me", response_model=UserOut, summary="Current user profile")
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut, summary="Update your own profile")
def update_me(
    payload: UserUpdateSelf,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", response_model=Message, summary="Change your password")
def change_password(
    payload: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    if not verify_password(payload.current_password, user.hashed_password):
        raise ValidationError(
            "Current password is incorrect.", fields={"current_password": "Incorrect password"}
        )
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return Message(message="Password updated.")
