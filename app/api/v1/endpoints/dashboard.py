from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.schema import User, UserRole, Student
from app.services.report_service import calculate_student_overall_dashboard, get_admin_dashboard_summary

router = APIRouter()

@router.get("/student")
def get_student_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.STUDENT.value:
        raise HTTPException(status_code=403, detail="Student portal accessible to students only.")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    summary = calculate_student_overall_dashboard(db, student.id)
    return summary

@router.get("/admin")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN.value, UserRole.FACULTY.value]:
        raise HTTPException(status_code=403, detail="Admin dashboard accessible to admin/faculty only.")

    summary = get_admin_dashboard_summary(db, class_id=1)
    return summary
