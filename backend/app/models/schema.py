import enum
import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Time, Enum, ForeignKey, UniqueConstraint, Text
)
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    FACULTY = "FACULTY"
    ADMIN = "ADMIN"

class LectureStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    RESCHEDULED = "RESCHEDULED"

class SessionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    EXPIRED = "EXPIRED"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"

class AttendanceSource(str, enum.Enum):
    QR_SCAN = "QR_SCAN"
    MANUAL_FACULTY = "MANUAL_FACULTY"

class SubjectType(str, enum.Enum):
    THEORY = "THEORY"
    LABORATORY = "LABORATORY"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default=UserRole.STUDENT.value)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student_profile = relationship("Student", back_populates="user", uselist=False)
    faculty_profile = relationship("Faculty", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")

class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g. B.Tech-M.Tech CSE (Cyber Security)
    code = Column(String, nullable=False)  # e.g. CSE-CS-3
    semester = Column(String, nullable=False)  # e.g. III
    room_no = Column(String, nullable=False)  # e.g. 109
    academic_year = Column(String, nullable=False)  # e.g. 2026-27
    term_start = Column(Date, nullable=False)
    term_end = Column(Date, nullable=False)

    students = relationship("Student", back_populates="student_class")
    timetable_entries = relationship("TimetableEntry", back_populates="class_obj")

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    enrollment_no = Column(String, unique=True, index=True, nullable=False)
    roll_no = Column(String, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    semester = Column(String, nullable=False)
    branch = Column(String, nullable=False)

    user = relationship("User", back_populates="student_profile")
    student_class = relationship("Class", back_populates="students")
    attendance_records = relationship("AttendanceRecord", back_populates="student")

class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    employee_code = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=False)
    abbreviation = Column(String, nullable=True)  # e.g., AT, MS, SI, NT, VS, HS

    user = relationship("User", back_populates="faculty_profile")
    timetable_entries = relationship("TimetableEntry", back_populates="faculty")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)  # e.g., CTBT-BSC-301
    name = Column(String, nullable=False)
    credits = Column(Integer, default=3)
    subject_type = Column(String, default=SubjectType.THEORY.value)

    timetable_entries = relationship("TimetableEntry", back_populates="subject")

class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    room = Column(String, nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_until = Column(Date, nullable=False)

    class_obj = relationship("Class", back_populates="timetable_entries")
    subject = relationship("Subject", back_populates="timetable_entries")
    faculty = relationship("Faculty", back_populates="timetable_entries")
    scheduled_lectures = relationship("ScheduledLecture", back_populates="timetable_entry")

class ScheduledLecture(Base):
    __tablename__ = "scheduled_lectures"

    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("timetable_entries.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    scheduled_start = Column(Time, nullable=False)
    scheduled_end = Column(Time, nullable=False)
    lecture_number = Column(Integer, default=1)
    status = Column(String, default=LectureStatus.SCHEDULED.value)
    cancel_reason = Column(String, nullable=True)
    rescheduled_date = Column(Date, nullable=True)
    rescheduled_start = Column(Time, nullable=True)
    rescheduled_end = Column(Time, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    timetable_entry = relationship("TimetableEntry", back_populates="scheduled_lectures")
    attendance_session = relationship("AttendanceSession", back_populates="scheduled_lecture", uselist=False)

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    scheduled_lecture_id = Column(Integer, ForeignKey("scheduled_lectures.id"), unique=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default=SessionStatus.ACTIVE.value)
    opened_at = Column(DateTime, default=datetime.datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=5)

    scheduled_lecture = relationship("ScheduledLecture", back_populates="attendance_session")
    records = relationship("AttendanceRecord", back_populates="session")

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_token = Column(String, unique=True, index=True, nullable=False)
    user_agent = Column(Text, nullable=True)
    first_used_at = Column(DateTime, default=datetime.datetime.utcnow)

    attendance_records = relationship("AttendanceRecord", back_populates="device")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default=AttendanceStatus.PRESENT.value)
    source = Column(String, default=AttendanceSource.QR_SCAN.value)
    remarks = Column(String, nullable=True)

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")
    device = relationship("Device", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
        UniqueConstraint("session_id", "device_id", name="uq_session_device"),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
