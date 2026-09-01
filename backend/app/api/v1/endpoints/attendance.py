import io
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import qrcode

from app.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.schema import User, UserRole, AttendanceSession, ScheduledLecture, Student, AttendanceRecord, AttendanceStatus
from app.schemas.pydantic_models import (
    LectureConfirmRequest, StartAttendanceRequest, MarkAttendanceRequest, EditAttendanceRequest
)
from app.services.attendance_service import (
    confirm_lecture, start_attendance_session, close_attendance_session,
    mark_student_attendance, edit_student_attendance
)

router = APIRouter()

@router.post("/lecture/{lecture_id}/confirm")
async def api_confirm_lecture(
    lecture_id: int,
    req: LectureConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only faculty/admin can confirm lectures.")

    lecture = await confirm_lecture(
        db=db,
        lecture_id=lecture_id,
        status_str=req.status,
        cancel_reason=req.cancel_reason,
        rescheduled_date_str=req.rescheduled_date,
        rescheduled_start_str=req.rescheduled_start,
        rescheduled_end_str=req.rescheduled_end,
        user_id=current_user.id
    )
    return {"message": f"Lecture status updated to {lecture.status}", "lecture_id": lecture.id, "status": lecture.status}

@router.post("/lecture/{lecture_id}/start")
async def api_start_attendance(
    lecture_id: int,
    req: StartAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only faculty/admin can start attendance sessions.")

    session = await start_attendance_session(
        db=db,
        lecture_id=lecture_id,
        duration_minutes=req.duration_minutes,
        user_id=current_user.id
    )
    return {
        "message": "Attendance session started",
        "session_id": session.id,
        "token": session.token,
        "duration_minutes": session.duration_minutes,
        "status": session.status
    }

@router.post("/session/{session_id}/close")
async def api_close_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only faculty/admin can close attendance sessions.")

    session = await close_attendance_session(db=db, session_id=session_id, user_id=current_user.id)
    return {"message": "Attendance session closed successfully", "session_id": session.id, "status": session.status}

@router.get("/session/{token_or_id}/details")
def api_get_session_details(
    token_or_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = None
    if token_or_id.isdigit():
        session = db.query(AttendanceSession).filter(AttendanceSession.id == int(token_or_id)).first()
    else:
        session = db.query(AttendanceSession).filter(AttendanceSession.token == token_or_id).first()

    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found.")

    lecture = session.scheduled_lecture
    timetable = lecture.timetable_entry
    class_id = timetable.class_id

    all_students = db.query(Student).filter(Student.class_id == class_id).order_by(Student.roll_no).all()
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    record_map = {r.student_id: r for r in records}

    student_list = []
    present_count = 0

    for st in all_students:
        rec = record_map.get(st.id)
        st_status = rec.status if rec else ("ABSENT" if session.status == "CLOSED" else "PENDING")
        if st_status == "PRESENT":
            present_count += 1

        student_list.append({
            "id": st.id,
            "roll_no": st.roll_no,
            "enrollment_no": st.enrollment_no,
            "name": st.user.full_name,
            "status": st_status,
            "timestamp": rec.timestamp.strftime("%H:%M:%S") if rec and rec.timestamp else "-",
            "source": rec.source if rec else "-",
            "remarks": rec.remarks if rec else "-"
        })

    expires_at = session.opened_at + datetime.timedelta(minutes=session.duration_minutes) if session.opened_at else None
    remaining_seconds = max(0, int((expires_at - datetime.datetime.utcnow()).total_seconds())) if expires_at and session.status == "ACTIVE" else 0

    return {
        "session_id": session.id,
        "token": session.token,
        "status": session.status,
        "duration_minutes": session.duration_minutes,
        "remaining_seconds": remaining_seconds,
        "lecture": {
            "id": lecture.id,
            "date": lecture.date.isoformat(),
            "scheduled_start": lecture.scheduled_start.strftime("%H:%M"),
            "scheduled_end": lecture.scheduled_end.strftime("%H:%M"),
            "subject_code": timetable.subject.code,
            "subject_name": timetable.subject.name,
            "faculty_name": timetable.faculty.user.full_name,
            "room": timetable.room,
            "class_name": timetable.class_obj.name,
            "semester": timetable.class_obj.semester
        },
        "stats": {
            "total_students": len(all_students),
            "present_count": present_count,
            "percentage": round((present_count / len(all_students) * 100), 1) if all_students else 0.0
        },
        "students": student_list
    }

@router.post("/mark")
async def api_mark_attendance(
    req: MarkAttendanceRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.STUDENT.value:
        raise HTTPException(status_code=403, detail="Only student accounts can mark attendance.")

    device_token = req.device_token or request.cookies.get("smartattend_device_id")
    user_agent = request.headers.get("user-agent")

    res = await mark_student_attendance(
        db=db,
        session_token=req.session_token,
        student_user_id=current_user.id,
        device_token=device_token,
        user_agent=user_agent
    )

    if res.get("device_token"):
        response.set_cookie(
            key="smartattend_device_id",
            value=res["device_token"],
            max_age=365*24*3600,
            httponly=True,
            samesite="lax"
        )
    return res

@router.post("/session/{session_id}/edit")
async def api_edit_attendance(
    session_id: int,
    req: EditAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only faculty/admin can edit attendance records.")

    rec = await edit_student_attendance(
        db=db,
        session_id=session_id,
        student_id=req.student_id,
        new_status=req.status,
        remarks=req.remarks,
        faculty_user_id=current_user.id
    )
    return {"message": "Attendance record updated", "student_id": rec.student_id, "status": rec.status}

@router.get("/qr-code/{token}")
def api_generate_qr_code(token: str, request: Request):
    # Base URL for frontend attendance landing page
    host = request.headers.get("host", "localhost:3000")
    scheme = "https" if "https" in request.url.scheme else "http"
    
    # URL encoded in QR Code
    url = f"http://{host.split(':')[0]}:3000/attendance/{token}"

    img = qrcode.make(url)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)

    return StreamingResponse(img_byte_arr, media_type="image/png")
