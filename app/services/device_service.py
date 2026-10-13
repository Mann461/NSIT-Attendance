import hashlib
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.database import utc_now
from app.models.schema import (
    User, Student, Device, DeviceStatus, DeviceResetLog,
    AuditLog, UserRole, TimetableEntry
)
from app.auth.security import (
    generate_device_token, generate_device_secret,
    hash_device_secret, verify_device_secret
)

def register_student_device(
    db: Session,
    student_user_id: int,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    requested_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Registers the authenticated student's first trusted device or a replacement device
    following faculty authorization.
    Enforces atomic one-device-per-student constraint and binds cryptographic secret.
    """
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered student accounts can enroll a trusted device."
        )

    # 1. Check if student already has an active trusted phone
    existing_active = db.query(Device).filter(
        Device.student_id == student.id,
        Device.status == DeviceStatus.ACTIVE.value
    ).first()
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A trusted phone is already registered for this student account. Replacing your registered phone requires faculty authorization."
        )

    # 2. Check if requested device token belongs to another student
    if requested_token:
        conflict_device = db.query(Device).filter(Device.device_token == requested_token).first()
        if conflict_device:
            if conflict_device.student_id is not None and conflict_device.student_id != student.id:
                # Audit cross-account attempt
                audit = AuditLog(
                    user_id=student_user_id,
                    action="CROSS_ACCOUNT_DEVICE_ENROLLMENT_BLOCKED",
                    entity="Device",
                    entity_id=str(conflict_device.id),
                    details=f"Student {student.enrollment_no} attempted to enroll device already owned by student_id {conflict_device.student_id}",
                    ip_address=client_ip
                )
                db.add(audit)
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This device is already registered to another student account."
                )
            elif conflict_device.student_id == student.id:
                # Previous revoked/inactive device record from this student: generate fresh token to maintain unique index
                dev_token = generate_device_token()
            else:
                dev_token = requested_token
        else:
            dev_token = requested_token
    else:
        dev_token = generate_device_token()

    # 3. Generate high-entropy cryptographic registration secret
    dev_secret = generate_device_secret()
    secret_hash = hash_device_secret(dev_secret)
    now = utc_now()

    # 4. Atomic insert protected against concurrent races
    try:
        # Check if an unclaimed legacy device record exists with this token
        unclaimed = db.query(Device).filter(
            Device.device_token == dev_token,
            Device.student_id == None
        ).first()

        if unclaimed:
            unclaimed.student_id = student.id
            unclaimed.device_secret_hash = secret_hash
            unclaimed.status = DeviceStatus.ACTIVE.value
            unclaimed.registered_at = now
            unclaimed.user_agent = user_agent
            db.flush()
            device_record = unclaimed
        else:
            device_record = Device(
                student_id=student.id,
                device_token=dev_token,
                device_secret_hash=secret_hash,
                status=DeviceStatus.ACTIVE.value,
                user_agent=user_agent,
                first_used_at=now,
                registered_at=now
            )
            db.add(device_record)
            db.flush()

        audit = AuditLog(
            user_id=student_user_id,
            action="TRUSTED_DEVICE_REGISTERED",
            entity="Device",
            entity_id=str(device_record.id),
            details=f"Trusted device successfully enrolled for student {student.enrollment_no}",
            ip_address=client_ip
        )
        db.add(audit)
        db.commit()
        db.refresh(device_record)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Concurrent registration detected. Only one active trusted phone permitted per student."
        )

    return {
        "status": "SUCCESS",
        "message": "Device successfully registered as your trusted attendance phone.",
        "device_token": dev_token,
        "device_secret": dev_secret,
        "student_id": student.id,
        "registered_at": device_record.registered_at.isoformat()
    }

def get_student_device_status(
    db: Session,
    user_id: int,
    cookie_token: Optional[str] = None,
    cookie_secret: Optional[str] = None
) -> Dict[str, Any]:
    """
    Returns the current trusted device status for an authenticated student.
    """
    student = db.query(Student).filter(Student.user_id == user_id).first()
    if not student:
        return {
            "has_trusted_device": False,
            "status": "NOT_A_STUDENT",
            "is_current_device_trusted": False,
            "message": "User is not a student"
        }

    active_dev = db.query(Device).filter(
        Device.student_id == student.id,
        Device.status == DeviceStatus.ACTIVE.value
    ).first()

    if not active_dev:
        revoked = db.query(Device).filter(
            Device.student_id == student.id,
            Device.status == DeviceStatus.REVOKED.value
        ).order_by(Device.revoked_at.desc()).first()

        if revoked:
            return {
                "has_trusted_device": False,
                "status": "REVOKED",
                "registered_at": revoked.registered_at.isoformat() if revoked.registered_at else None,
                "is_current_device_trusted": False,
                "message": f"Previous device registration was reset on {revoked.revoked_at.strftime('%Y-%m-%d %H:%M') if revoked.revoked_at else 'recently'}. Please enroll your replacement phone."
            }

        return {
            "has_trusted_device": False,
            "status": "NONE",
            "is_current_device_trusted": False,
            "message": "No trusted device registered. Please register this phone as your trusted attendance device."
        }

    # Verify if caller's cookies/headers match this student's active device
    is_trusted = False
    if cookie_token and cookie_token == active_dev.device_token:
        if active_dev.device_secret_hash and cookie_secret:
            is_trusted = verify_device_secret(cookie_secret, active_dev.device_secret_hash)
        elif not active_dev.device_secret_hash:
            is_trusted = True

    masked_token = active_dev.device_token[:8] + "..." + active_dev.device_token[-4:] if len(active_dev.device_token) > 12 else active_dev.device_token

    return {
        "has_trusted_device": True,
        "status": "ACTIVE",
        "device_token": masked_token,
        "registered_at": active_dev.registered_at.isoformat() if active_dev.registered_at else None,
        "is_current_device_trusted": is_trusted,
        "message": "Trusted device active and verified." if is_trusted else "Mismatched device. Please use your registered phone."
    }

def reset_student_device(
    db: Session,
    faculty_user_id: int,
    student_id: int,
    reason: str,
    client_ip: Optional[str] = None
) -> Dict[str, Any]:
    """
    Faculty/Admin authorized reset of a student's trusted device.
    Immediately revokes all active device credentials and writes immutable audit records.
    Scoped by timetable and class assignment for faculty.
    """
    actor = db.query(User).filter(User.id == faculty_user_id).first()
    if not actor or actor.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only faculty or administrative personnel are authorized to reset student devices."
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found."
        )

    # Scoped authorization: faculty may only reset students enrolled in classes they teach
    if actor.role == UserRole.FACULTY.value:
        faculty = actor.faculty_profile
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Faculty profile not linked to user account."
            )
        teaches_class = db.query(TimetableEntry).filter(
            TimetableEntry.faculty_id == faculty.id,
            TimetableEntry.class_id == student.class_id
        ).first()

        if not teaches_class:
            # Audit unauthorized attempt
            audit = AuditLog(
                user_id=faculty_user_id,
                action="UNAUTHORIZED_DEVICE_RESET_ATTEMPT",
                entity="Student",
                entity_id=str(student.id),
                details=f"Faculty {actor.email} attempted to reset student {student.enrollment_no} outside their assigned classes.",
                ip_address=client_ip
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: You may only reset device registrations for students enrolled in your assigned classes."
            )

    clean_reason = (reason or "").strip()
    if len(clean_reason) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A substantive reason is required for resetting a student's trusted device (min 3 characters)."
        )

    now = utc_now()
    active_devices = db.query(Device).filter(
        Device.student_id == student.id,
        Device.status == DeviceStatus.ACTIVE.value
    ).all()

    old_device_id = None
    for d in active_devices:
        old_device_id = d.id
        d.status = DeviceStatus.REVOKED.value
        d.revoked_at = now
        d.revoked_by_user_id = faculty_user_id
        d.revocation_reason = clean_reason

    # Create immutable audit record in device_reset_logs
    reset_log = DeviceResetLog(
        student_id=student.id,
        faculty_user_id=faculty_user_id,
        old_device_id=old_device_id,
        reason=clean_reason,
        timestamp=now,
        ip_address=client_ip
    )
    db.add(reset_log)

    # Record general security audit event
    audit = AuditLog(
        user_id=faculty_user_id,
        action="FACULTY_DEVICE_RESET_AUTHORIZED",
        entity="Device",
        entity_id=str(old_device_id) if old_device_id else "NONE",
        details=f"Faculty {actor.full_name} revoked device for student {student.enrollment_no}. Reason: {clean_reason}",
        ip_address=client_ip
    )
    db.add(audit)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Trusted device for student {student.enrollment_no} has been reset. The student may now register a replacement phone.",
        "student_id": student.id,
        "revoked_count": len(active_devices),
        "reset_at": now.isoformat()
    }
