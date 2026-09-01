from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.schema import User, UserRole, AuditLog
from app.services.report_service import generate_excel_attendance_sheet, generate_csv_attendance_sheet

router = APIRouter()

@router.get("/export/excel")
def export_excel(
    class_id: int = Query(1),
    subject_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        return Response(status_code=403, content="Unauthorized")

    excel_bytes = generate_excel_attendance_sheet(db, class_id=class_id, subject_id=subject_id)
    return StreamingResponse(
        iter([excel_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=Lesson_Attendance_Sheet_Sub_{subject_id}.xlsx"}
    )

@router.get("/export/csv")
def export_csv(
    class_id: int = Query(1),
    subject_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
        return Response(status_code=403, content="Unauthorized")

    csv_data = generate_csv_attendance_sheet(db, class_id=class_id, subject_id=subject_id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=Lesson_Attendance_Sheet_Sub_{subject_id}.csv"}
    )

@router.get("/audit-logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN.value:
        return Response(status_code=403, content="Admin access required")

    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    result = []
    for log in logs:
        user_name = log.user.full_name if log.user else "System"
        result.append({
            "id": log.id,
            "user_name": user_name,
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
    return result
