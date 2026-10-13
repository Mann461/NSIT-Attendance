import os
import sys
import time
import secrets
import concurrent.futures
import pytest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.database import Base, SessionLocal, utc_now, engine
from app.models.schema import (
    User, Student, Faculty, Device, DeviceStatus, DeviceResetLog,
    AttendanceSession, AttendanceRecord, ScheduledLecture, TimetableEntry,
    Class, UserRole, SessionStatus, LectureStatus, AttendanceStatus, AttendanceSource, AuditLog
)
from app.auth.security import (
    create_access_token, hash_password, generate_device_secret,
    hash_device_secret, verify_device_secret, generate_presence_code,
    generate_rotating_qr_token
)
from app.services.rate_limiter import attendance_rate_limiter

client = TestClient(app)

# Helper to authenticate user
def get_user_headers(email_or_enrollment: str, password: str = "Student@123") -> dict:
    resp = client.post("/api/v1/auth/login", json={
        "email_or_enrollment": email_or_enrollment,
        "password": password
    })
    assert resp.status_code == 200, f"Login failed for {email_or_enrollment}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# Helper to create active test lecture & session
def create_active_lecture_session(db, duration_minutes=15, presence_code="4829"):
    # Ensure a lecture exists
    lec = db.query(ScheduledLecture).filter(ScheduledLecture.status == LectureStatus.ACTIVE.value).first()
    if not lec:
        tt = db.query(TimetableEntry).first()
        lec = ScheduledLecture(
            timetable_id=tt.id,
            date=utc_now().date(),
            scheduled_start=datetime.strptime("09:00", "%H:%M").time(),
            scheduled_end=datetime.strptime("10:00", "%H:%M").time(),
            lecture_number=1,
            status=LectureStatus.ACTIVE.value
        )
        db.add(lec)
        db.flush()

    sess = db.query(AttendanceSession).filter(
        AttendanceSession.scheduled_lecture_id == lec.id,
        AttendanceSession.status == SessionStatus.ACTIVE.value
    ).first()

    now = utc_now()
    if not sess:
        sess = AttendanceSession(
            scheduled_lecture_id=lec.id,
            token=f"sess_tok_{secrets.token_hex(12)}",
            status=SessionStatus.ACTIVE.value,
            opened_at=now,
            duration_minutes=duration_minutes,
            presence_code=presence_code,
            presence_code_expires_at=now + timedelta(minutes=duration_minutes),
            presence_challenge_required=True
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)
    else:
        sess.presence_code = presence_code
        sess.presence_code_expires_at = now + timedelta(minutes=duration_minutes)
        sess.presence_challenge_required = True
        sess.opened_at = now
        sess.duration_minutes = duration_minutes
        db.commit()
        db.refresh(sess)
    return sess


# ==============================================================================
# SUITE A: TRUSTED-DEVICE OWNERSHIP
# ==============================================================================

def test_first_legitimate_device_enrollment_succeeds():
    """First legitimate device enrollment binds the phone and returns secret."""
    db = SessionLocal()
    try:
        # Pick student 1
        student = db.query(Student).filter(Student.roll_no == "001").first()
        assert student is not None
        # Clean existing devices for test isolation
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        u = student.user
        headers = get_user_headers(u.email, "Student@123")

        device_token = f"phone_device_{secrets.token_hex(8)}"
        resp = client.post("/api/v1/devices/register", json={
            "device_token": device_token
        }, headers=headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert data["device_token"] == device_token
        assert "device_secret" in data
        assert len(data["device_secret"]) >= 32

        # Check DB state
        dev = db.query(Device).filter(Device.device_token == device_token).first()
        assert dev is not None
        assert dev.student_id == student.id
        assert dev.status == DeviceStatus.ACTIVE.value
        # Raw secret must NEVER be stored in DB
        assert dev.device_secret_hash is not None
        assert dev.device_secret_hash != data["device_secret"]
        assert verify_device_secret(data["device_secret"], dev.device_secret_hash)
    finally:
        db.close()


def test_same_student_cannot_silently_enroll_second_phone():
    """A student with an active device cannot silently register another device."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "001").first()
        u = student.user
        headers = get_user_headers(u.email, "Student@123")

        # Attempt to register second device
        resp = client.post("/api/v1/devices/register", json={
            "device_token": f"second_phone_{secrets.token_hex(8)}"
        }, headers=headers)

        assert resp.status_code in [400, 409]
        assert "already registered" in resp.json()["detail"].lower()
        assert "faculty authorization" in resp.json()["detail"].lower()
    finally:
        db.close()


def test_different_student_cannot_reuse_already_bound_device():
    """Student B cannot register or claim a device already bound to Student A."""
    db = SessionLocal()
    try:
        student1 = db.query(Student).filter(Student.roll_no == "001").first()
        dev1 = db.query(Device).filter(
            Device.student_id == student1.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).first()
        assert dev1 is not None

        # Student 2
        student2 = db.query(Student).filter(Student.roll_no == "002").first()
        # Clean any device for student 2 first
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student2.id).delete()
        db.query(Device).filter(Device.student_id == student2.id).delete()
        db.commit()

        u2 = student2.user
        headers2 = get_user_headers(u2.email, "Student@123")

        # Attempt to register with Student 1's device token
        resp = client.post("/api/v1/devices/register", json={
            "device_token": dev1.device_token
        }, headers=headers2)

        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]
    finally:
        db.close()


def test_untrusted_phone_cannot_mark_attendance():
    """An unregistered or mismatched device is rejected for attendance."""
    db = SessionLocal()
    try:
        sess = create_active_lecture_session(db)
        student = db.query(Student).filter(Student.roll_no == "001").first()
        headers = get_user_headers(student.user.email, "Student@123")

        attendance_rate_limiter.reset()

        # Submit random unregistered device token
        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": f"rogue_phone_{secrets.token_hex(8)}",
            "device_secret": secrets.token_hex(32),
            "presence_code": sess.presence_code
        }, headers=headers)

        assert resp.status_code == 403
        assert "Device mismatch" in resp.json()["detail"]
    finally:
        db.close()


def test_invalid_device_secret_rejected():
    """Matching device_token but invalid cryptographic secret is rejected."""
    db = SessionLocal()
    try:
        sess = create_active_lecture_session(db)
        student = db.query(Student).filter(Student.roll_no == "001").first()
        dev = db.query(Device).filter(
            Device.student_id == student.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).first()

        headers = get_user_headers(student.user.email, "Student@123")
        attendance_rate_limiter.reset()

        # Submit valid device_token but WRONG secret
        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": dev.device_token,
            "device_secret": "tampered_wrong_secret_1234567890abcdef",
            "presence_code": sess.presence_code
        }, headers=headers)

        assert resp.status_code == 403
        assert "Device authentication failed" in resp.json()["detail"]
    finally:
        db.close()


def test_revoked_phone_cannot_mark_attendance():
    """A revoked device cannot mark attendance."""
    db = SessionLocal()
    try:
        student3 = db.query(Student).filter(Student.roll_no == "003").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student3.id).delete()
        db.query(Device).filter(Device.student_id == student3.id).delete()
        db.commit()

        # Create a revoked device
        rev_dev = Device(
            student_id=student3.id,
            device_token=f"revoked_phone_{secrets.token_hex(8)}",
            device_secret_hash=hash_device_secret("secret123"),
            status=DeviceStatus.REVOKED.value,
            revoked_at=utc_now(),
            revocation_reason="FACULTY_RESET"
        )
        db.add(rev_dev)
        db.commit()

        sess = create_active_lecture_session(db)
        headers = get_user_headers(student3.user.email, "Student@123")
        attendance_rate_limiter.reset()

        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": rev_dev.device_token,
            "device_secret": "secret123",
            "presence_code": sess.presence_code
        }, headers=headers)

        assert resp.status_code == 403
        assert "revoked" in resp.json()["detail"].lower()
    finally:
        db.close()


def test_concurrent_first_time_enrollment_results_in_only_one_active_device():
    """Concurrent enrollment requests for the same student allow exactly one device."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "004").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        headers = get_user_headers(student.user.email, "Student@123")

        def attempt_enroll(idx):
            thread_client = TestClient(app)
            return thread_client.post("/api/v1/devices/register", json={
                "device_token": f"concurrent_phone_{idx}_{secrets.token_hex(6)}"
            }, headers=headers)

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(attempt_enroll, i) for i in range(5)]
            results = [f.result() for f in futures]

        status_codes = [r.status_code for r in results]
        assert 200 in status_codes
        # Exactly one must succeed (200), others fail with 400
        success_count = sum(1 for code in status_codes if code == 200)
        assert success_count == 1

        active_devices = db.query(Device).filter(
            Device.student_id == student.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).all()
        assert len(active_devices) == 1
    finally:
        db.close()


# ==============================================================================
# SUITE B: CREDENTIAL SHARING & CROSS-ACCOUNT REUSE
# ==============================================================================

def test_student_a_marks_attendance_on_trusted_phone():
    """Student A marks attendance legitimately with registered phone and presence code."""
    db = SessionLocal()
    try:
        studentA = db.query(Student).filter(Student.roll_no == "005").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == studentA.id).delete()
        db.query(Device).filter(Device.student_id == studentA.id).delete()
        db.commit()

        headersA = get_user_headers(studentA.user.email, "Student@123")

        # Register device
        dev_token_A = f"phone_A_{secrets.token_hex(8)}"
        reg_resp = client.post("/api/v1/devices/register", json={
            "device_token": dev_token_A
        }, headers=headersA)
        assert reg_resp.status_code == 200
        secret_A = reg_resp.json()["device_secret"]

        # Create session
        sess = create_active_lecture_session(db)

        # Clear any prior attendance record
        db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess.id,
            AttendanceRecord.student_id == studentA.id
        ).delete()
        db.commit()

        attendance_rate_limiter.reset()

        # Mark attendance
        mark_resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": dev_token_A,
            "device_secret": secret_A,
            "presence_code": sess.presence_code
        }, headers=headersA)

        assert mark_resp.status_code == 200
        assert mark_resp.json()["status"] == "SUCCESS"

        # Verify DB
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess.id,
            AttendanceRecord.student_id == studentA.id
        ).first()
        assert rec is not None
        assert rec.status == AttendanceStatus.PRESENT.value
    finally:
        db.close()


def test_student_b_logging_in_on_student_a_phone_cannot_mark_attendance():
    """Student B authenticating on Student A's phone is blocked from marking attendance."""
    db = SessionLocal()
    try:
        studentA = db.query(Student).filter(Student.roll_no == "005").first()
        devA = db.query(Device).filter(
            Device.student_id == studentA.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).first()
        assert devA is not None

        studentB = db.query(Student).filter(Student.roll_no == "006").first()
        # Ensure Student B has their own registered device
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == studentB.id).delete()
        db.query(Device).filter(Device.student_id == studentB.id).delete()
        db.commit()

        headersB = get_user_headers(studentB.user.email, "Student@123")
        regB = client.post("/api/v1/devices/register", json={
            "device_token": f"phone_B_{secrets.token_hex(8)}"
        }, headers=headersB)
        assert regB.status_code == 200

        sess = create_active_lecture_session(db)
        attendance_rate_limiter.reset()

        # Student B uses Student A's device token
        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": devA.device_token,
            "device_secret": "any_secret",
            "presence_code": sess.presence_code
        }, headers=headersB)

        assert resp.status_code == 403
        assert "Device mismatch" in resp.json()["detail"]
    finally:
        db.close()


def test_valid_jwt_alone_cannot_bypass_device_check():
    """Valid student JWT calling attendance endpoint without valid device credentials fails."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "007").first()
        headers = get_user_headers(student.user.email, "Student@123")
        sess = create_active_lecture_session(db)

        # Empty device token
        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": "",
            "presence_code": sess.presence_code
        }, headers=headers)
        assert resp.status_code in [400, 403, 422]
    finally:
        db.close()


def test_faculty_and_admin_continue_authorized_workflows():
    """Faculty and Admin accounts preserve existing workflows."""
    db = SessionLocal()
    try:
        fac_headers = get_user_headers("akash.thakkar@nsit.ac.in", "Faculty@123")
        adm_headers = get_user_headers("admin@nsit.ac.in", "Admin@123")

        # Faculty can view schedule
        r_sched = client.get("/api/v1/timetable/schedule", headers=fac_headers)
        assert r_sched.status_code == 200

        # Faculty cannot mark student attendance directly via student endpoint
        sess = create_active_lecture_session(db)
        r_fac_mark = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token
        }, headers=fac_headers)
        assert r_fac_mark.status_code == 403

        # Admin can view dashboard
        r_adm_dash = client.get("/api/v1/dashboard/admin", headers=adm_headers)
        assert r_adm_dash.status_code == 200
    finally:
        db.close()


# ==============================================================================
# SUITE C: FACULTY-AUTHORIZED DEVICE REPLACEMENT
# ==============================================================================

def test_student_cannot_reset_own_device():
    """A student account cannot reset their own or anyone else's device."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "001").first()
        headers = get_user_headers(student.user.email, "Student@123")

        resp = client.post("/api/v1/devices/reset", json={
            "student_id": student.id,
            "reason": "I bought a new phone myself"
        }, headers=headers)

        assert resp.status_code == 403
        assert "faculty" in resp.json()["detail"].lower() or "admin" in resp.json()["detail"].lower()
    finally:
        db.close()


def test_unauthorized_faculty_cannot_reset_outside_scope():
    """Faculty cannot reset devices for students in classes they do not teach."""
    db = SessionLocal()
    try:
        # Create Class 99 and Student in Class 99
        c99 = db.query(Class).filter(Class.name == "Class-Unassigned-99").first()
        if not c99:
            c99 = Class(
                name="Class-Unassigned-99",
                code="CSE-CS-99",
                semester="VII",
                room_no="999",
                academic_year="2026-27",
                term_start=datetime.now().date(),
                term_end=datetime.now().date()
            )
            db.add(c99)
            db.flush()

        u_outside = db.query(User).filter(User.email == "outside99@nsit.ac.in").first()
        if not u_outside:
            u_outside = User(
                email="outside99@nsit.ac.in",
                password_hash=hash_password("Student@123"),
                full_name="Outside Student",
                role=UserRole.STUDENT.value
            )
            db.add(u_outside)
            db.flush()

        st_outside = db.query(Student).filter(Student.user_id == u_outside.id).first()
        if not st_outside:
            st_outside = Student(
                user_id=u_outside.id,
                enrollment_no="999999999999",
                roll_no="99CS999",
                semester="VII",
                branch="Cyber Security",
                class_id=c99.id
            )
            db.add(st_outside)
            db.commit()
            db.refresh(st_outside)

        # Faculty akash.thakkar teaches Class 1, NOT Class 99
        fac_headers = get_user_headers("akash.thakkar@nsit.ac.in", "Faculty@123")

        resp = client.post("/api/v1/devices/reset", json={
            "student_id": st_outside.id,
            "reason": "Testing unauthorized reset"
        }, headers=fac_headers)

        assert resp.status_code == 403
        assert "outside their assigned classes" in resp.json()["detail"] or "unauthorized" in resp.json()["detail"].lower()
    finally:
        db.close()


def test_authorized_faculty_reset_succeeds_and_creates_audit_log():
    """Authorized faculty reset immediately revokes old phone and logs audit record."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "008").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        headers_stu = get_user_headers(student.user.email, "Student@123")
        old_dev_token = f"old_phone_{secrets.token_hex(8)}"
        reg_resp = client.post("/api/v1/devices/register", json={
            "device_token": old_dev_token
        }, headers=headers_stu)
        assert reg_resp.status_code == 200

        old_dev = db.query(Device).filter(Device.device_token == old_dev_token).first()
        assert old_dev.status == DeviceStatus.ACTIVE.value

        # Faculty reset
        fac_headers = get_user_headers("akash.thakkar@nsit.ac.in", "Faculty@123")
        reset_resp = client.post("/api/v1/devices/reset", json={
            "student_id": student.id,
            "reason": "Student phone screen broken and replaced"
        }, headers=fac_headers)

        assert reset_resp.status_code == 200
        assert reset_resp.json()["status"] == "SUCCESS"
        assert reset_resp.json()["revoked_count"] >= 1

        # Verify DB changes
        db.refresh(old_dev)
        assert old_dev.status == DeviceStatus.REVOKED.value
        assert old_dev.revoked_at is not None
        assert "Student phone screen broken" in old_dev.revocation_reason

        # Verify audit log
        log = db.query(DeviceResetLog).filter(
            DeviceResetLog.student_id == student.id,
            DeviceResetLog.old_device_id == old_dev.id
        ).first()
        assert log is not None
        assert "Student phone screen broken" in log.reason

        # Student status endpoint shows REVOKED
        status_resp = client.get("/api/v1/devices/status", headers=headers_stu)
        assert status_resp.status_code == 200
        assert status_resp.json()["has_trusted_device"] is False
        assert status_resp.json()["status"] == "REVOKED"
    finally:
        db.close()


def test_newly_enrolled_replacement_phone_succeeds_after_reset():
    """After authorized reset, student can enroll replacement phone and mark attendance."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "008").first()
        headers_stu = get_user_headers(student.user.email, "Student@123")

        # Register replacement phone
        new_dev_token = f"replacement_phone_{secrets.token_hex(8)}"
        reg_resp = client.post("/api/v1/devices/register", json={
            "device_token": new_dev_token
        }, headers=headers_stu)

        assert reg_resp.status_code == 200
        new_secret = reg_resp.json()["device_secret"]

        # Mark attendance with new phone
        sess = create_active_lecture_session(db)
        db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess.id,
            AttendanceRecord.student_id == student.id
        ).delete()
        db.commit()

        attendance_rate_limiter.reset()

        mark_resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": new_dev_token,
            "device_secret": new_secret,
            "presence_code": sess.presence_code
        }, headers=headers_stu)

        assert mark_resp.status_code == 200
        assert mark_resp.json()["status"] == "SUCCESS"
    finally:
        db.close()


# ==============================================================================
# SUITE D: REMOTE QR SHARING & CLASSROOM PRESENCE CHALLENGES
# ==============================================================================

def test_valid_rotating_qr_token_accepted():
    """Rotating QR token with valid presence code and trusted phone marks attendance."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "009").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        headers = get_user_headers(student.user.email, "Student@123")
        dev_token = f"phone_qr_{secrets.token_hex(8)}"
        reg = client.post("/api/v1/devices/register", json={"device_token": dev_token}, headers=headers)
        secret = reg.json()["device_secret"]

        sess = create_active_lecture_session(db)
        db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess.id,
            AttendanceRecord.student_id == student.id
        ).delete()
        db.commit()

        # Generate a valid rotating token
        rotating_tok = generate_rotating_qr_token(sess.id)

        attendance_rate_limiter.reset()

        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": rotating_tok,
            "device_token": dev_token,
            "device_secret": secret,
            "presence_code": sess.presence_code
        }, headers=headers)

        assert resp.status_code == 200
        assert resp.json()["status"] == "SUCCESS"
    finally:
        db.close()


def test_expired_or_invalid_rotating_qr_token_rejected():
    """Expired or invalid rotating QR token is rejected."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "009").first()
        dev = db.query(Device).filter(
            Device.student_id == student.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).first()
        headers = get_user_headers(student.user.email, "Student@123")

        # Fake or tampered rotating token
        tampered_token = f"rot_{time.time()}_9999_invalidsignature"

        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": tampered_token,
            "device_token": dev.device_token,
            "presence_code": "1234"
        }, headers=headers)

        assert resp.status_code in [400, 404]
    finally:
        db.close()


def test_invalid_presence_challenge_rejected_and_audited():
    """Invalid presence code is rejected and logs security audit event."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "009").first()
        dev = db.query(Device).filter(
            Device.student_id == student.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).first()
        headers = get_user_headers(student.user.email, "Student@123")
        sess = create_active_lecture_session(db, presence_code="9876")

        attendance_rate_limiter.reset()

        # Submit WRONG presence code
        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": dev.device_token,
            "presence_code": "0000"
        }, headers=headers)

        assert resp.status_code == 400
        assert "Invalid classroom presence code" in resp.json()["detail"]

        # Verify audit log
        audit = db.query(AuditLog).filter(
            AuditLog.user_id == student.user.id,
            AuditLog.action == "SUSPICIOUS_PRESENCE_CHALLENGE_FAILED"
        ).order_by(AuditLog.id.desc()).first()
        assert audit is not None
    finally:
        db.close()


def test_faculty_rotates_presence_code_and_old_code_fails():
    """Faculty rotating the classroom code immediately invalidates the previous code."""
    db = SessionLocal()
    try:
        sess = create_active_lecture_session(db, presence_code="1111")
        fac_headers = get_user_headers("akash.thakkar@nsit.ac.in", "Faculty@123")

        # Rotate presence code
        rot_resp = client.post(
            f"/api/v1/attendance/session/{sess.id}/presence-code/rotate",
            headers=fac_headers
        )
        assert rot_resp.status_code == 200
        new_code = rot_resp.json()["presence_code"]
        assert new_code != "1111"

        student = db.query(Student).filter(Student.roll_no == "009").first()
        dev = db.query(Device).filter(
            Device.student_id == student.id,
            Device.status == DeviceStatus.ACTIVE.value
        ).first()
        headers = get_user_headers(student.user.email, "Student@123")

        attendance_rate_limiter.reset()

        # Try with old code "1111" -> must be rejected
        old_resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": dev.device_token,
            "presence_code": "1111"
        }, headers=headers)
        assert old_resp.status_code == 400
    finally:
        db.close()


def test_duplicate_attendance_submission_is_idempotent():
    """Duplicate attendance submission returns ALREADY_RECORDED and prevents duplicates."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "005").first()
        headers = get_user_headers(student.user.email, "Student@123")
        sess = create_active_lecture_session(db)

        # Clear existing device for clean test isolation
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        dev_token = f"phone_dup_{secrets.token_hex(8)}"
        reg_resp = client.post("/api/v1/devices/register", json={"device_token": dev_token}, headers=headers)
        assert reg_resp.status_code == 200
        sec = reg_resp.json()["device_secret"]

        # Clear any prior attendance
        db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess.id,
            AttendanceRecord.student_id == student.id
        ).delete()
        db.commit()

        attendance_rate_limiter.reset()

        # Mark first time -> SUCCESS
        r1 = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": dev_token,
            "device_secret": sec,
            "presence_code": sess.presence_code
        }, headers=headers)
        assert r1.status_code == 200
        assert r1.json()["status"] == "SUCCESS"

        # Mark second time -> ALREADY_RECORDED
        dup_resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": dev_token,
            "device_secret": sec,
            "presence_code": sess.presence_code
        }, headers=headers)

        assert dup_resp.status_code == 200
        assert dup_resp.json()["status"] == "ALREADY_RECORDED"

        # Exactly 1 record in DB
        recs = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess.id,
            AttendanceRecord.student_id == student.id
        ).all()
        assert len(recs) == 1
    finally:
        db.close()


def test_faculty_manual_edit_and_session_close():
    """Faculty can close session and manually edit student attendance record."""
    db = SessionLocal()
    try:
        sess = create_active_lecture_session(db)
        fac_headers = get_user_headers("akash.thakkar@nsit.ac.in", "Faculty@123")
        student = db.query(Student).filter(Student.roll_no == "001").first()

        # Faculty manual edit
        edit_resp = client.post(f"/api/v1/attendance/session/{sess.id}/edit", json={
            "student_id": student.id,
            "status": "PRESENT",
            "remarks": "Manual faculty override during test"
        }, headers=fac_headers)
        assert edit_resp.status_code == 200

        # Faculty close session
        close_resp = client.post(f"/api/v1/attendance/session/{sess.id}/close", headers=fac_headers)
        assert close_resp.status_code == 200

        db.refresh(sess)
        assert sess.status == SessionStatus.CLOSED.value
    finally:
        db.close()


# ==============================================================================
# SUITE E: DATABASE MIGRATION, HISTORICAL DATA & CONSTRAINTS
# ==============================================================================

def test_database_constraint_prevents_multiple_active_devices_per_student():
    """Partial unique index uq_one_active_device_per_student blocks second active device."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "010").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        # Add first ACTIVE device
        dev1 = Device(
            student_id=student.id,
            device_token=f"sql_dev1_{secrets.token_hex(6)}",
            status=DeviceStatus.ACTIVE.value,
            registered_at=utc_now()
        )
        db.add(dev1)
        db.commit()

        # Add second ACTIVE device directly via ORM/SQL
        dev2 = Device(
            student_id=student.id,
            device_token=f"sql_dev2_{secrets.token_hex(6)}",
            status=DeviceStatus.ACTIVE.value,
            registered_at=utc_now()
        )
        db.add(dev2)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        # Adding a REVOKED device for same student MUST succeed (partial index allows multiple REVOKED)
        dev_revoked = Device(
            student_id=student.id,
            device_token=f"sql_dev_rev_{secrets.token_hex(6)}",
            status=DeviceStatus.REVOKED.value,
            registered_at=utc_now(),
            revoked_at=utc_now(),
            revocation_reason="TEST_REVOCATION"
        )
        db.add(dev_revoked)
        db.commit()

        # Check total devices
        devs = db.query(Device).filter(Device.student_id == student.id).all()
        assert len(devs) == 2
        active_count = sum(1 for d in devs if d.status == DeviceStatus.ACTIVE.value)
        assert active_count == 1
    finally:
        db.close()


def test_legacy_unclaimed_devices_cannot_mark_attendance():
    """Legacy devices marked LEGACY_UNCLAIMED cannot mark attendance."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.roll_no == "011").first()
        db.query(DeviceResetLog).filter(DeviceResetLog.student_id == student.id).delete()
        db.query(Device).filter(Device.student_id == student.id).delete()
        db.commit()

        # Legacy device with no student_id
        leg_dev = Device(
            student_id=None,
            device_token=f"legacy_dev_{secrets.token_hex(6)}",
            status=DeviceStatus.LEGACY_UNCLAIMED.value,
            revocation_reason="LEGACY_UNTRUSTED_MIGRATION_BACKFILL"
        )
        db.add(leg_dev)
        db.commit()

        sess = create_active_lecture_session(db)
        headers = get_user_headers(student.user.email, "Student@123")
        attendance_rate_limiter.reset()

        resp = client.post("/api/v1/attendance/mark", json={
            "session_token": sess.token,
            "device_token": leg_dev.device_token,
            "presence_code": sess.presence_code
        }, headers=headers)

        assert resp.status_code == 403
        assert "No trusted phone registered" in resp.json()["detail"]
    finally:
        db.close()


def test_historical_attendance_records_preserved_intact():
    """Verify that existing historical attendance records in database are intact."""
    db = SessionLocal()
    try:
        count = db.query(AttendanceRecord).count()
        # Must have historical attendance records populated
        assert count > 0
        records = db.query(AttendanceRecord).limit(10).all()
        for r in records:
            assert r.session_id is not None
            assert r.student_id is not None
            assert r.status in [AttendanceStatus.PRESENT.value, AttendanceStatus.ABSENT.value]
    finally:
        db.close()
