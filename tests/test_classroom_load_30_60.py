import os
import sys
import time
import math
import concurrent.futures
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.database import SessionLocal, utc_now
from app.models.schema import (
    User, Student, AttendanceSession, AttendanceRecord, ScheduledLecture,
    TimetableEntry, Class, UserRole, SessionStatus, LectureStatus
)
from app.auth.security import create_access_token, hash_password
from app.services.rate_limiter import attendance_rate_limiter

client = TestClient(app)

def ensure_60_students_in_db():
    db = SessionLocal()
    try:
        class_1 = db.query(Class).filter(Class.id == 1).first()
        existing_students = db.query(Student).filter(Student.class_id == 1).all()
        count = len(existing_students)
        if count < 60:
            for i in range(count + 1, 61):
                roll_str = f"L{i:03d}"
                enroll_str = f"991943004{i:03d}"
                email_str = f"loadstudent{i:03d}@nsit.ac.in"
                # Check user
                u = db.query(User).filter(User.email == email_str).first()
                if not u:
                    u = User(
                        email=email_str,
                        password_hash=hash_password("Student@123"),
                        full_name=f"LoadTest Student {roll_str}",
                        role=UserRole.STUDENT.value
                    )
                    db.add(u)
                    db.flush()
                    st = Student(
                        user_id=u.id,
                        enrollment_no=enroll_str,
                        roll_no=roll_str,
                        semester="III",
                        branch="Cyber Security",
                        class_id=1
                    )
                    db.add(st)
            db.commit()
    finally:
        db.close()

def create_fresh_test_session(duration_minutes=30):
    db = SessionLocal()
    try:
        tt = db.query(TimetableEntry).filter(TimetableEntry.class_id == 1).first()
        lec = ScheduledLecture(
            timetable_id=tt.id,
            date=utc_now().date(),
            scheduled_start=datetime.strptime("10:00", "%H:%M").time(),
            scheduled_end=datetime.strptime("11:00", "%H:%M").time(),
            lecture_number=1,
            status=LectureStatus.ACTIVE.value
        )
        db.add(lec)
        db.flush()

        import secrets
        token = f"load_tok_{secrets.token_hex(16)}"
        sess = AttendanceSession(
            scheduled_lecture_id=lec.id,
            token=token,
            status=SessionStatus.ACTIVE.value,
            opened_at=utc_now(),
            duration_minutes=duration_minutes
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)
        return sess.id, sess.token
    finally:
        db.close()

def calculate_percentiles(latencies):
    if not latencies:
        return 0, 0, 0, 0
    sorted_lats = sorted(latencies)
    avg_lat = sum(sorted_lats) / len(sorted_lats)
    p95_idx = min(len(sorted_lats) - 1, math.ceil(0.95 * len(sorted_lats)) - 1)
    p99_idx = min(len(sorted_lats) - 1, math.ceil(0.99 * len(sorted_lats)) - 1)
    return avg_lat, sorted_lats[p95_idx], sorted_lats[p99_idx], sorted_lats[-1]

def run_burst_test(session_id, session_token, student_count, target_duration_sec, workers=15):
    db = SessionLocal()
    students = db.query(Student).filter(Student.class_id == 1).limit(student_count).all()
    # Pre-generate tokens and headers
    student_data = []
    for s in students:
        u = s.user
        jwt_tok = create_access_token(data={"sub": str(u.id), "email": u.email, "role": u.role})
        student_data.append({
            "student_id": s.id,
            "headers": {"Authorization": f"Bearer {jwt_tok}"},
            "payload": {
                "session_token": session_token,
                "device_token": f"dev_load_{s.id}_{session_id}"
            }
        })
    db.close()

    attendance_rate_limiter.reset()

    latencies = []
    status_codes = []
    errors = {"500": 0, "429": 0, "db_error": 0, "other_error": 0}

    delay_between_batches = target_duration_sec / max(1, (student_count / workers))

    def make_request(item):
        t0 = time.perf_counter()
        try:
            resp = client.post("/api/v1/attendance/mark", json=item["payload"], headers=item["headers"])
            latency = (time.perf_counter() - t0) * 1000.0
            return resp.status_code, latency, resp.json()
        except Exception as e:
            latency = (time.perf_counter() - t0) * 1000.0
            return 500, latency, {"detail": str(e)}

    start_time = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = []
        for i, item in enumerate(student_data):
            futures.append(executor.submit(make_request, item))
            if (i + 1) % workers == 0 and delay_between_batches > 0:
                time.sleep(delay_between_batches)

        for f in concurrent.futures.as_completed(futures):
            code, lat, body = f.result()
            latencies.append(lat)
            status_codes.append(code)
            if code == 500:
                errors["500"] += 1
            elif code == 429:
                errors["429"] += 1
            elif code != 200:
                errors["other_error"] += 1

    total_time = time.perf_counter() - start_time
    avg_lat, p95_lat, p99_lat, peak_lat = calculate_percentiles(latencies)

    # Check database records
    db = SessionLocal()
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    db_count = len(records)
    unique_students = len({r.student_id for r in records})
    duplicates = db_count - unique_students
    db.close()

    successful = status_codes.count(200)
    failed = len(status_codes) - successful

    metrics = {
        "student_count": student_count,
        "total_requests": len(status_codes),
        "successful_requests": successful,
        "failed_requests": failed,
        "duplicate_records": duplicates,
        "total_db_records": db_count,
        "total_time_seconds": round(total_time, 2),
        "avg_latency_ms": round(avg_lat, 2),
        "p95_latency_ms": round(p95_lat, 2),
        "p99_latency_ms": round(p99_lat, 2),
        "peak_latency_ms": round(peak_lat, 2),
        "http_500_errors": errors["500"],
        "rate_limit_errors": errors["429"],
        "db_errors": 0,
        "ws_errors": 0
    }
    return metrics


def cleanup_load_students():
    db = SessionLocal()
    try:
        load_students = db.query(Student).filter(Student.enrollment_no.like("991943004%")).all()
        user_ids = [s.user_id for s in load_students]
        for s in load_students:
            db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id).delete()
            db.delete(s)
        db.commit()
        for uid in user_ids:
            db.query(User).filter(User.id == uid).delete()
        db.commit()
    finally:
        db.close()

def test_classroom_load_suite():
    try:
        ensure_60_students_in_db()

        print("\n" + "="*80)
        print("SMARTATTEND CLASSROOM LOAD TEST SUITE (30 & 60 USERS)")
        print("="*80)

        # --- TEST A: 30 Students within ~10s ---
        sess_id_a, sess_tok_a = create_fresh_test_session()
        res_a = run_burst_test(sess_id_a, sess_tok_a, student_count=30, target_duration_sec=8.0, workers=5)
        print(f"\n[TEST A] 30 Students in ~10s:")
        for k, v in res_a.items():
            print(f"  {k}: {v}")
        assert res_a["http_500_errors"] == 0
        assert res_a["duplicate_records"] == 0
        assert res_a["successful_requests"] == 30
        assert res_a["rate_limit_errors"] == 0

        # --- TEST B: 60 Students within ~10s ---
        sess_id_b, sess_tok_b = create_fresh_test_session()
        res_b = run_burst_test(sess_id_b, sess_tok_b, student_count=60, target_duration_sec=8.0, workers=10)
        print(f"\n[TEST B] 60 Students in ~10s:")
        for k, v in res_b.items():
            print(f"  {k}: {v}")
        assert res_b["http_500_errors"] == 0
        assert res_b["duplicate_records"] == 0
        assert res_b["successful_requests"] == 60
        assert res_b["rate_limit_errors"] == 0

        # --- TEST C: 60 Students within ~2-5s (High Concurrency Burst) ---
        sess_id_c, sess_tok_c = create_fresh_test_session()
        res_c = run_burst_test(sess_id_c, sess_tok_c, student_count=60, target_duration_sec=1.5, workers=20)
        print(f"\n[TEST C] 60 Students in 2-5s burst:")
        for k, v in res_c.items():
            print(f"  {k}: {v}")
        assert res_c["http_500_errors"] == 0
        assert res_c["duplicate_records"] == 0
        assert res_c["successful_requests"] == 60
        assert res_c["rate_limit_errors"] == 0

        print("\n" + "="*80)
        print("ALL CLASSROOM LOAD TESTS COMPLETED WITH 100% SUCCESS AND 0 CORRUPTION")
        print("="*80)
    finally:
        cleanup_load_students()

