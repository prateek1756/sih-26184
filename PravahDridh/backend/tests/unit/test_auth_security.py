import uuid
from datetime import timedelta
from jose import jwt
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token


def test_password_hashing_and_verification():
    raw_password = "SecureSuperPassword@2026"
    hashed = get_password_hash(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_access_and_refresh_token_creation():
    user_id = uuid.uuid4()
    roles = ["INVESTIGATOR", "ANALYST"]

    access_token = create_access_token(subject=user_id, roles=roles, expires_delta=timedelta(minutes=30))
    decoded = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    assert decoded["sub"] == str(user_id)
    assert decoded["roles"] == roles
    assert decoded["type"] == "access"

    refresh_token = create_refresh_token(subject=user_id, expires_delta=timedelta(days=1))
    decoded_refresh = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded_refresh["sub"] == str(user_id)
    assert decoded_refresh["type"] == "refresh"
