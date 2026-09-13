from datetime import datetime, timezone, timedelta
from typing import Optional
import hashlib
import os
import secrets
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

# Dedicated password hashing context using Bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash password using Bcrypt with automatic unique salt per password."""
    return pwd_context.hash(password)

def verify_and_check_rehash(plain_password: str, hashed_password: str) -> tuple[bool, bool]:
    """
    Verifies password against stored hash.
    Returns: (is_valid: bool, needs_rehash: bool)
    Supports seamless transparent migration from legacy SHA-256 to Bcrypt.
    """
    if not hashed_password:
        return (False, False)

    # 1. Bcrypt hash check ($2b$ or $2a$)
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        try:
            is_valid = pwd_context.verify(plain_password, hashed_password)
            needs_rehash = pwd_context.needs_update(hashed_password)
            return (is_valid, needs_rehash)
        except Exception:
            return (False, False)

    # 2. Check legacy SHA-256 + salt
    salt = "nsit_smartattend_salt_2026"
    legacy_hash = hashlib.sha256((plain_password + salt).encode("utf-8")).hexdigest()
    if legacy_hash == hashed_password:
        # Valid legacy password; flag for immediate automatic upgrade to Bcrypt
        return (True, True)

    return (False, False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    is_valid, _ = verify_and_check_rehash(plain_password, hashed_password)
    return is_valid

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
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

def generate_rotating_qr_token(session_id: int, window_seconds: int = 15) -> str:
    """
    Generates a cryptographically signed time-sliced rotating QR token.
    Token format: rot_{session_id}_{window_index}_{signature}
    """
    import hmac
    import time
    window_idx = int(time.time() // window_seconds)
    message = f"{session_id}:{window_idx}".encode("utf-8")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()[:16]
    return f"rot_{session_id}_{window_idx}_{sig}"

def verify_rotating_qr_token(token_str: str, window_seconds: int = 15, max_skew_windows: int = 2) -> Optional[int]:
    """
    Verifies a rotating QR token.
    Returns session_id if valid, or None if invalid/expired signature.
    Allows max_skew_windows (default: 2 windows = 30-45s) for scanning delay tolerance.
    """
    import hmac
    import time
    if not token_str or not token_str.startswith("rot_"):
        return None
    try:
        parts = token_str.split("_")
        if len(parts) != 4:
            return None
        _, session_id_str, token_window_str, sig = parts
        session_id = int(session_id_str)
        token_window = int(token_window_str)
        
        current_window = int(time.time() // window_seconds)
        # Check window expiration (current +/- max_skew_windows)
        if abs(current_window - token_window) > max_skew_windows:
            return None
            
        message = f"{session_id}:{token_window}".encode("utf-8")
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()[:16]
        if hmac.compare_digest(sig, expected_sig):
            return session_id
        return None
    except Exception:
        return None


