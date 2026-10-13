from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.schema import User, UserRole
from app.schemas.pydantic_models import (
    DeviceRegisterRequest, DeviceRegisterResponse,
    DeviceStatusResponse, DeviceResetRequest, DeviceResetResponse
)
from app.services.device_service import (
    register_student_device, get_student_device_status, reset_student_device
)

router = APIRouter()

@router.post("/register", response_model=DeviceRegisterResponse)
def api_register_device(
    req: DeviceRegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registers the authenticated student's first trusted phone or replacement device.
    Generates a cryptographically random device secret and sets secure HttpOnly cookies.
    """
    if current_user.role != UserRole.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only student accounts can register a trusted phone."
        )

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent")

    # If client passed device_token in body or cookies
    existing_cookie_token = req.device_token or request.cookies.get("smartattend_device_id")

    res = register_student_device(
        db=db,
        student_user_id=current_user.id,
        client_ip=client_ip,
        user_agent=user_agent,
        requested_token=existing_cookie_token
    )

    # Set secure HttpOnly cookies
    response.set_cookie(
        key="smartattend_device_id",
        value=res["device_token"],
        max_age=365 * 24 * 3600,
        httponly=True,
        samesite="lax"
    )
    response.set_cookie(
        key="smartattend_device_secret",
        value=res["device_secret"],
        max_age=365 * 24 * 3600,
        httponly=True,
        samesite="lax"
    )

    return res

@router.get("/status", response_model=DeviceStatusResponse)
def api_get_device_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns trusted device status for the caller, verifying whether the current phone
    holds the cryptographic credentials bound to the account.
    """
    cookie_token = request.headers.get("X-Device-Token") or request.cookies.get("smartattend_device_id")
    cookie_secret = request.headers.get("X-Device-Secret") or request.cookies.get("smartattend_device_secret")

    return get_student_device_status(
        db=db,
        user_id=current_user.id,
        cookie_token=cookie_token,
        cookie_secret=cookie_secret
    )

@router.post("/reset", response_model=DeviceResetResponse)
def api_reset_device(
    req: DeviceResetRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Faculty/Admin authorized reset of a student's trusted device.
    Revokes the current device immediately and logs the action immutably.
    """
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only faculty or administrators can authorize trusted-device resets."
        )

    client_ip = request.client.host if request.client else "unknown"

    return reset_student_device(
        db=db,
        faculty_user_id=current_user.id,
        student_id=req.student_id,
        reason=req.reason,
        client_ip=client_ip
    )
