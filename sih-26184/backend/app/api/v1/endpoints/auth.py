from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, RefreshTokenRequest, Token, UserCreate, UserRead
from app.schemas.common import StandardResponse
from app.services.audit_service import AuditService
from jose import jwt, JWTError

router = APIRouter()


@router.post("/register", response_model=StandardResponse[UserRead])
async def register_user(
    user_in: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Security policy: Public registration is strictly restricted to VIEWER role
    assigned_role = "VIEWER"

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        badge_number=user_in.badge_number,
        agency=user_in.agency,
        role=assigned_role,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    await AuditService.log_event(
        db=db,
        event_type="USER_REGISTER",
        actor=new_user,
        resource_type="User",
        resource_id=new_user.id,
        action_details={"email": new_user.email, "role": assigned_role},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(new_user)
    return StandardResponse(data=UserRead.model_validate(new_user))


@router.post("/login", response_model=StandardResponse[Token])
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalars().first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive account")

    access_token = create_access_token(subject=user.id, roles=[user.role])
    refresh_token = create_refresh_token(subject=user.id)

    await AuditService.log_event(
        db=db,
        event_type="USER_LOGIN",
        actor=user,
        resource_type="User",
        resource_id=user.id,
        action_details={"action": "login_success"},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return StandardResponse(
        data=Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserRead.model_validate(user),
        )
    )


@router.post("/refresh", response_model=StandardResponse[Token])
async def refresh_token(
    refresh_in: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = jwt.decode(refresh_in.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not user_id_str or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id_str))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")

    new_access_token = create_access_token(subject=user.id, roles=[user.role])
    new_refresh_token = create_refresh_token(subject=user.id)

    return StandardResponse(
        data=Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            user=UserRead.model_validate(user),
        )
    )


@router.get("/me", response_model=StandardResponse[UserRead])
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    return StandardResponse(data=UserRead.model_validate(current_user))
