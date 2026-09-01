from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
import datetime

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    email_or_enrollment: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    student_profile: Optional["StudentResponse"] = None
    faculty_profile: Optional["FacultyResponse"] = None

    class Config:
        from_attributes = True

class StudentResponse(BaseModel):
    id: int
    user_id: int
    enrollment_no: str
    roll_no: str
    semester: str
    branch: str
    class_id: int

    class Config:
        from_attributes = True

class FacultyResponse(BaseModel):
    id: int
    user_id: int
    employee_code: str
    department: str
    abbreviation: Optional[str] = None

    class Config:
        from_attributes = True

# --- Timetable & Lecture Schemas ---
class TimetableEntryResponse(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    room: str
    subject_code: str
    subject_name: str
    faculty_name: str
    faculty_abbrev: Optional[str] = None
    subject_type: str

class LectureConfirmRequest(BaseModel):
    status: str  # CONFIRMED, CANCELLED, RESCHEDULED
    cancel_reason: Optional[str] = None
    rescheduled_date: Optional[str] = None  # YYYY-MM-DD
    rescheduled_start: Optional[str] = None # HH:MM
    rescheduled_end: Optional[str] = None   # HH:MM

class ScheduledLectureResponse(BaseModel):
    id: int
    timetable_id: int
    date: str
    scheduled_start: str
    scheduled_end: str
    lecture_number: int
    status: str
    cancel_reason: Optional[str] = None
    rescheduled_date: Optional[str] = None
    rescheduled_start: Optional[str] = None
    rescheduled_end: Optional[str] = None
    subject_code: str
    subject_name: str
    faculty_name: str
    room: str
    active_session_token: Optional[str] = None
    session_status: Optional[str] = None
    opened_at: Optional[str] = None
    duration_minutes: Optional[int] = None

# --- Attendance Session & Record Schemas ---
class StartAttendanceRequest(BaseModel):
    duration_minutes: int = 5

class AttendanceSessionResponse(BaseModel):
    id: int
    scheduled_lecture_id: int
    token: str
    status: str
    opened_at: str
    duration_minutes: int
    qr_code_url: str
    total_students: int
    present_count: int

class MarkAttendanceRequest(BaseModel):
    session_token: str
    device_token: Optional[str] = None

class AttendanceRecordResponse(BaseModel):
    id: int
    roll_no: str
    enrollment_no: str
    student_name: str
    status: str
    timestamp: Optional[str] = None
    source: Optional[str] = None
    device_status: Optional[str] = None

class EditAttendanceRequest(BaseModel):
    student_id: int
    status: str  # PRESENT or ABSENT
    remarks: Optional[str] = None

# --- Reports & Analytics Schemas ---
class StudentAttendanceSummary(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: str
    faculty_name: str
    present_count: int
    total_conducted: int
    percentage: float

class OverallStudentDashboard(BaseModel):
    student: StudentResponse
    overall_percentage: float
    total_conducted: int
    total_present: int
    subject_summaries: List[StudentAttendanceSummary]

class AdminDashboardSummary(BaseModel):
    class_name: str
    semester: str
    total_students: int
    total_subjects: int
    overall_class_attendance: float
    low_attendance_students: List[dict]
    today_lectures_count: int
    conducted_lectures_count: int

class AuditLogResponse(BaseModel):
    id: int
    user_name: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: str

UserResponse.model_rebuild()
