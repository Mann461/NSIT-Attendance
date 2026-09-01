import datetime
from typing import Optional
import hashlib
import os
import secrets
from jose import JWTError, jwt
from app.config import settings

def hash_password(password: str) -> str:
    """Hash password using SHA256 + salt for robust, portable security."""
    salt = "nsit_smartattend_salt_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_secure_session_token() -> str:
    """Generates a cryptographically random session token for QR attendance."""
    return f"sec_tok_{secrets.token_urlsafe(32)}"

def generate_device_token() -> str:
    """Generates a cryptographically random device token."""
    return f"dev_{secrets.token_hex(16)}"
