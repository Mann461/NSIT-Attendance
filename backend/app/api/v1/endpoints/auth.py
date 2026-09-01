from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.schema import User, Student, UserRole, Device
from app.auth.security import verify_password, create_access_token, decode_access_token, generate_device_token
from app.schemas.pydantic_models import LoginRequest, TokenResponse, UserResponse

router = APIRouter()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("smartattend_session")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

@router.post("/login", response_model=TokenResponse)
def login(
    req: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    query_str = req.email_or_enrollment.strip()

    # Try matching email or enrollment number
    user = db.query(User).filter(User.email == query_str).first()
    if not user:
        student = db.query(Student).filter(Student.enrollment_no == query_str).first()
        if student:
            user = student.user

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your username/password."
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})

    # Ensure device token exists in cookies
    device_token = request.cookies.get("smartattend_device_id")
    if not device_token:
        device_token = generate_device_token()
        response.set_cookie(
            key="smartattend_device_id",
            value=device_token,
            max_age=365*24*3600,
            httponly=True,
            samesite="lax"
        )

    response.set_cookie(
        key="smartattend_session",
        value=token,
        max_age=7*24*3600,
        httponly=True,
        samesite="lax"
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("smartattend_session")
    return {"message": "Successfully logged out"}
