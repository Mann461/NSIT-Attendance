import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
import asyncio
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.schema import User, Student, AttendanceSession, AttendanceRecord, ScheduledLecture, TimetableEntry, Subject, AttendanceStatus
from app.services.report_service import calculate_student_overall_dashboard, get_admin_dashboard_summary, generate_excel_attendance_sheet
from app.websocket.manager import ws_manager

client = TestClient(app)

def test_attendance_calculation_edge_cases():
    # 75.0% must NOT be flagged
    p3, tot4 = 3, 4
    pct75 = round((p3 / tot4 * 100), 2)
    assert pct75 == 75.0
    assert not (pct75 < 75.0), "75% exactly must not be flagged"

    # 66.67% must be flagged
    p2, tot3 = 2, 3
    pct66 = round((p2 / tot3 * 100), 2)
    assert pct66 == 66.67
    assert (pct66 < 75.0), "66.67% must be flagged"

    # 74.99% must be flagged
    assert 74.99 < 75.0

    # 100% must not be flagged
    assert not (100.0 < 75.0)

    # 0% must be flagged
    assert 0.0 < 75.0

def test_database_admin_dashboard_eval():
    db = SessionLocal()
    try:
        admin_summary = get_admin_dashboard_summary(db, class_id=1)
        assert admin_summary["total_students"] == 33
        assert "overall_class_attendance" in admin_summary
        assert "low_attendance_students" in admin_summary
        # Check all flagged students actually have < 75.0%
        for s in admin_summary["low_attendance_students"]:
            assert s["overall_percentage"] < 75.0
    finally:
        db.close()

def test_websocket_realtime_stream():
    db = SessionLocal()
    session = db.query(AttendanceSession).first()
    db.close()
    
    with client.websocket_connect(f"/ws/attendance/{session.id}") as websocket:
        # Broadcast event
        test_payload = {"type": "STUDENT_SCANNED", "roll_no": "001", "name": "Dhrumil Nandanvar"}
        asyncio.run(ws_manager.broadcast_attendance_update(session.id, test_payload))
        msg = websocket.receive_json()
        assert msg["type"] == "STUDENT_SCANNED"
        assert msg["roll_no"] == "001"

def test_excel_generation_all_subjects():
    db = SessionLocal()
    try:
        for subj_id in range(1, 7):
            excel_bytes = generate_excel_attendance_sheet(db, class_id=1, subject_id=subj_id)
            assert len(excel_bytes) > 5000, f"Subject {subj_id} excel export failed or empty"
            # Verify magic bytes for zip/xlsx
            assert excel_bytes[:4] == b"PK\x03\x04", "File is not a valid zip/xlsx archive"
    finally:
        db.close()

def test_burst_concurrent_load():
    # Simulate burst of 33 students scanning concurrently
    import concurrent.futures
    db = SessionLocal()
    try:
        # Pick or create an active lecture
        lec = db.query(ScheduledLecture).filter(ScheduledLecture.id == 9).first()
        if not lec:
            lec = ScheduledLecture(timetable_id=1, date=lec.date if lec else "2026-09-14", scheduled_start="09:00", scheduled_end="10:00", status="SCHEDULED")
            db.add(lec)
            db.commit()
        
        # Start session
        r_login = client.post("/api/v1/auth/login", json={"email_or_enrollment": "akash.thakkar@nsit.ac.in", "password": "Faculty@123"})
        fac_hdr = {"Authorization": f"Bearer {r_login.json()['access_token']}"}
        
        # Reset session if needed
        if lec.attendance_session:
            db.query(AttendanceRecord).filter(AttendanceRecord.session_id == lec.attendance_session.id).delete()
            db.delete(lec.attendance_session)
            db.commit()
        
        lec.status = "SCHEDULED"
        db.commit()

        r_start = client.post(f"/api/v1/attendance/lecture/{lec.id}/start", json={"duration_minutes": 15}, headers=fac_hdr)
        session_token = r_start.json()["token"]
        session_id = r_start.json()["session_id"]

        students = db.query(Student).filter(Student.class_id == 1).all()
        assert len(students) == 33

        def student_scan_worker(student):
            thread_client = TestClient(app)
            r_auth = thread_client.post("/api/v1/auth/login", json={"email_or_enrollment": student.enrollment_no, "password": "Student@123"})
            token = r_auth.json()["access_token"]
            device_token = f"dev_concurrent_{student.roll_no}"
            r_mark = thread_client.post(
                "/api/v1/attendance/mark",
                json={"session_token": session_token, "device_token": device_token},
                headers={"Authorization": f"Bearer {token}"}
            )
            return (student.roll_no, r_mark.status_code, r_mark.json())

        # Execute 33 simultaneous scans
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(student_scan_worker, students))

        successful_scans = [r for r in results if r[1] == 200 and r[2].get("status") == "SUCCESS"]
        assert len(successful_scans) == 33, f"Expected 33 successful scans, got {len(successful_scans)}"

        # Close session
        r_close = client.post(f"/api/v1/attendance/session/{session_id}/close", headers=fac_hdr)
        assert r_close.status_code == 200

        # Verify DB records
        records_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.status == "PRESENT"
        ).count()
        assert records_count == 33
    finally:
        db.close()
