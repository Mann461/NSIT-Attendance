import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.schema import (
    ScheduledLecture, LectureStatus, AttendanceSession, SessionStatus,
    AttendanceRecord, AttendanceStatus, AttendanceSource, Student, Device,
    AuditLog, Class
)
from app.auth.security import generate_secure_session_token, generate_device_token
from app.websocket.manager import ws_manager

async def confirm_lecture(
    db: Session,
    lecture_id: int,
    status_str: str,
    cancel_reason: str = None,
    rescheduled_date_str: str = None,
    rescheduled_start_str: str = None,
    rescheduled_end_str: str = None,
    user_id: int = None
):
    lecture = db.query(ScheduledLecture).filter(ScheduledLecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Scheduled lecture not found")

    if status_str not in [LectureStatus.CONFIRMED.value, LectureStatus.CANCELLED.value, LectureStatus.RESCHEDULED.value]:
        raise HTTPException(status_code=400, detail="Invalid confirmation status")

    lecture.status = status_str

    if status_str == LectureStatus.CANCELLED.value:
        lecture.cancel_reason = cancel_reason or "Faculty unavailable"
    elif status_str == LectureStatus.RESCHEDULED.value:
        if rescheduled_date_str:
            lecture.rescheduled_date = datetime.datetime.strptime(rescheduled_date_str, "%Y-%m-%d").date()
        if rescheduled_start_str:
            lecture.rescheduled_start = datetime.datetime.strptime(rescheduled_start_str, "%H:%M").time()
        if rescheduled_end_str:
            lecture.rescheduled_end = datetime.datetime.strptime(rescheduled_end_str, "%H:%M").time()
        lecture.cancel_reason = cancel_reason

    # Audit log
    audit = AuditLog(
        user_id=user_id,
        action=f"LECTURE_{status_str}",
        entity="ScheduledLecture",
        entity_id=str(lecture.id),
        details=f"Status set to {status_str}. Reason: {cancel_reason or 'N/A'}"
    )
    db.add(audit)
    db.commit()
    db.refresh(lecture)
    return lecture

async def start_attendance_session(db: Session, lecture_id: int, duration_minutes: int = 5, user_id: int = None):
    lecture = db.query(ScheduledLecture).filter(ScheduledLecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Scheduled lecture not found")

    if lecture.status not in [LectureStatus.CONFIRMED.value, LectureStatus.ACTIVE.value, LectureStatus.SCHEDULED.value]:
        raise HTTPException(status_code=400, detail=f"Cannot start attendance for lecture with status {lecture.status}")

    # Check if session already exists
    if lecture.attendance_session:
        session = lecture.attendance_session
        session.status = SessionStatus.ACTIVE.value
        session.opened_at = datetime.datetime.utcnow()
        session.duration_minutes = duration_minutes
    else:
        token = generate_secure_session_token()
        session = AttendanceSession(
            scheduled_lecture_id=lecture.id,
            token=token,
            status=SessionStatus.ACTIVE.value,
            opened_at=datetime.datetime.utcnow(),
            duration_minutes=duration_minutes
        )
        db.add(session)

    lecture.status = LectureStatus.ACTIVE.value

    audit = AuditLog(
        user_id=user_id,
        action="ATTENDANCE_SESSION_STARTED",
        entity="AttendanceSession",
        entity_id=str(session.id if session.id else "new"),
        details=f"Duration: {duration_minutes} mins"
    )
    db.add(audit)
    db.commit()
    db.refresh(session)
    db.refresh(lecture)
    return session

async def close_attendance_session(db: Session, session_id: int, user_id: int = None):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    session.status = SessionStatus.CLOSED.value
    session.closed_at = datetime.datetime.utcnow()
    
    lecture = session.scheduled_lecture
    lecture.status = LectureStatus.COMPLETED.value

    # Auto-fill ABSENT records for students who didn't scan
    class_id = lecture.timetable_entry.class_id
    students = db.query(Student).filter(Student.class_id == class_id).all()
    
    existing_records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    existing_student_ids = {r.student_id for r in existing_records}

    for student in students:
        if student.id not in existing_student_ids:
            absent_record = AttendanceRecord(
                session_id=session.id,
                student_id=student.id,
                device_id=None,
                status=AttendanceStatus.ABSENT.value,
                source=AttendanceSource.MANUAL_FACULTY.value,
                remarks="Auto-marked absent on session close"
            )
            db.add(absent_record)

    audit = AuditLog(
        user_id=user_id,
        action="ATTENDANCE_SESSION_CLOSED",
        entity="AttendanceSession",
        entity_id=str(session.id),
        details="Session manually/automatically closed"
    )
    db.add(audit)
    db.commit()

    # Broadcast WebSocket update
    await ws_manager.broadcast_attendance_update(session.id, {
        "type": "SESSION_CLOSED",
        "message": "Attendance session closed"
    })
    return session

async def mark_student_attendance(
    db: Session,
    session_token: str,
    student_user_id: int,
    device_token: str,
    user_agent: str = None
):
    session = db.query(AttendanceSession).filter(AttendanceSession.token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired attendance session token.")

    # Check if session is closed/expired
    if session.status != SessionStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="This attendance session is no longer active.")

    # Check timer expiration
    now = datetime.datetime.utcnow()
    expires_at = session.opened_at + datetime.timedelta(minutes=session.duration_minutes)
    if now > expires_at:
        session.status = SessionStatus.EXPIRED.value
        db.commit()
        raise HTTPException(status_code=400, detail="This attendance session has expired.")

    # Fetch student profile
    student = db.query(Student).filter(Student.user_id == student_user_id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Only registered students can mark attendance.")

    # Ensure student belongs to the class
    lecture_class_id = session.scheduled_lecture.timetable_entry.class_id
    if student.class_id != lecture_class_id:
        raise HTTPException(status_code=403, detail="You are not enrolled in this class.")

    # Look up or create Device
    if not device_token:
        device_token = generate_device_token()

    device = db.query(Device).filter(Device.device_token == device_token).first()
    if not device:
        device = Device(device_token=device_token, user_agent=user_agent)
        db.add(device)
        db.commit()
        db.refresh(device)

    # Check 1: Has student already marked attendance for this session?
    existing_student_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == student.id
    ).first()

    if existing_student_record:
        return {
            "status": "ALREADY_RECORDED",
            "message": "Attendance already recorded for this lecture.",
            "record": {
                "student_name": student.user.full_name,
                "roll_no": student.roll_no,
                "status": existing_student_record.status,
                "timestamp": existing_student_record.timestamp.isoformat()
            }
        }

    # Check 2: Has this device already been used for this session?
    existing_device_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.device_id == device.id
    ).first()

    if existing_device_record:
        # Audit log proxy attempt
        audit = AuditLog(
            user_id=student_user_id,
            action="PROXY_ATTENDANCE_ATTEMPT",
            entity="AttendanceSession",
            entity_id=str(session.id),
            details=f"Device {device_token} already used by another student."
        )
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="This device has already been used for this attendance session."
        )

    # Insert AttendanceRecord
    new_record = AttendanceRecord(
        session_id=session.id,
        student_id=student.id,
        device_id=device.id,
        timestamp=now,
        status=AttendanceStatus.PRESENT.value,
        source=AttendanceSource.QR_SCAN.value
    )
    db.add(new_record)

    # Audit log
    audit = AuditLog(
        user_id=student_user_id,
        action="ATTENDANCE_MARKED_PRESENT",
        entity="AttendanceRecord",
        entity_id=str(student.id),
        details=f"Marked PRESENT via QR token."
    )
    db.add(audit)
    db.commit()
    db.refresh(new_record)

    # Broadcast update to faculty dashboard WebSockets
    total_students = db.query(Student).filter(Student.class_id == lecture_class_id).count()
    present_count = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.status == AttendanceStatus.PRESENT.value
    ).count()

    await ws_manager.broadcast_attendance_update(session.id, {
        "type": "STUDENT_SCANNED",
        "student": {
            "id": student.id,
            "roll_no": student.roll_no,
            "enrollment_no": student.enrollment_no,
            "name": student.user.full_name,
            "timestamp": new_record.timestamp.strftime("%H:%M:%S"),
            "status": "PRESENT"
        },
        "present_count": present_count,
        "total_students": total_students
    })

    return {
        "status": "SUCCESS",
        "message": "Attendance successfully recorded!",
        "device_token": device_token,
        "record": {
            "subject_name": session.scheduled_lecture.timetable_entry.subject.name,
            "subject_code": session.scheduled_lecture.timetable_entry.subject.code,
            "date": session.scheduled_lecture.date.isoformat(),
            "student_name": student.user.full_name,
            "roll_no": student.roll_no,
            "status": "PRESENT",
            "timestamp": new_record.timestamp.strftime("%H:%M:%S")
        }
    }

async def edit_student_attendance(
    db: Session,
    session_id: int,
    student_id: int,
    new_status: str,
    remarks: str = None,
    faculty_user_id: int = None
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.student_id == student_id
    ).first()

    if not record:
        record = AttendanceRecord(
            session_id=session_id,
            student_id=student_id,
            device_id=None,
            status=new_status,
            source=AttendanceSource.MANUAL_FACULTY.value,
            remarks=remarks or "Manual edit by faculty"
        )
        db.add(record)
    else:
        record.status = new_status
        record.source = AttendanceSource.MANUAL_FACULTY.value
        record.remarks = remarks or "Manual edit by faculty"

    audit = AuditLog(
        user_id=faculty_user_id,
        action="ATTENDANCE_MODIFIED",
        entity="AttendanceRecord",
        entity_id=str(student_id),
        details=f"Status set to {new_status}. Remarks: {remarks}"
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    # Broadcast WS update
    total_students = db.query(Student).filter(Student.class_id == session.scheduled_lecture.timetable_entry.class_id).count()
    present_count = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.status == AttendanceStatus.PRESENT.value
    ).count()

    await ws_manager.broadcast_attendance_update(session.id, {
        "type": "ATTENDANCE_MODIFIED",
        "student_id": student_id,
        "new_status": new_status,
        "present_count": present_count,
        "total_students": total_students
    })

    return record
