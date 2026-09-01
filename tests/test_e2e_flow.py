import sys
import os
import datetime
import pytest

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.services.seed_service import seed_database
from app.models.schema import User, Student, AttendanceSession, AttendanceRecord, ScheduledLecture

def test_full_smartattend_e2e_flow():
    # 1. Initialize DB and seed
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()

    client = TestClient(app)

    # 2. Test Faculty Login
    fac_resp = client.post("/api/v1/auth/login", json={
        "email_or_enrollment": "akash.thakkar@nsit.ac.in",
        "password": "Faculty@123"
    })
    assert fac_resp.status_code == 200
    fac_token = fac_resp.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # 3. Test Today's Schedule Generation
    sched_resp = client.get("/api/v1/timetable/schedule", headers=fac_headers)
    assert sched_resp.status_code == 200
    lectures = sched_resp.json()["lectures"]
    assert len(lectures) > 0
    test_lecture = lectures[0]

    # 4. Test Lecture Confirmation (Conducting)
    conf_resp = client.post(f"/api/v1/attendance/lecture/{test_lecture['id']}/confirm", json={
        "status": "CONFIRMED"
    }, headers=fac_headers)
    assert conf_resp.status_code == 200
    assert conf_resp.json()["status"] == "CONFIRMED"

    # 5. Test Start Attendance Session (QR token generation)
    start_resp = client.post(f"/api/v1/attendance/lecture/{test_lecture['id']}/start", json={
        "duration_minutes": 5
    }, headers=fac_headers)
    assert start_resp.status_code == 200
    session_data = start_resp.json()
    qr_token = session_data["token"]
    session_id = session_data["session_id"]

    # 6. Test Student 1 Login
    st1_resp = client.post("/api/v1/auth/login", json={
        "email_or_enrollment": "251943004001",
        "password": "Student@123"
    })
    assert st1_resp.status_code == 200
    st1_token = st1_resp.json()["access_token"]
    st1_headers = {"Authorization": f"Bearer {st1_token}"}

    # 7. Test Student 1 Scanning QR Token
    mark_resp1 = client.post("/api/v1/attendance/mark", json={
        "session_token": qr_token,
        "device_token": "dev_test_device_001"
    }, headers=st1_headers)
    assert mark_resp1.status_code == 200
    assert mark_resp1.json()["status"] == "SUCCESS"

    # 8. Test Duplicate Student Scan (Same student scanning again)
    mark_resp_dup = client.post("/api/v1/attendance/mark", json={
        "session_token": qr_token,
        "device_token": "dev_test_device_001"
    }, headers=st1_headers)
    assert mark_resp_dup.status_code == 200
    assert mark_resp_dup.json()["status"] == "ALREADY_RECORDED"

    # 9. Test Student 2 Login & Proxy Device Reuse Attempt (Student 2 trying to use Student 1's device_token)
    st2_resp = client.post("/api/v1/auth/login", json={
        "email_or_enrollment": "251943004002",
        "password": "Student@123"
    })
    assert st2_resp.status_code == 200
    st2_token = st2_resp.json()["access_token"]
    st2_headers = {"Authorization": f"Bearer {st2_token}"}

    mark_resp_proxy = client.post("/api/v1/attendance/mark", json={
        "session_token": qr_token,
        "device_token": "dev_test_device_001"  # Same device!
    }, headers=st2_headers)
    assert mark_resp_proxy.status_code == 400
    assert "already been used" in mark_resp_proxy.json()["detail"]

    # 10. Test Student 2 Scanning with unique device token
    mark_resp2 = client.post("/api/v1/attendance/mark", json={
        "session_token": qr_token,
        "device_token": "dev_test_device_002"
    }, headers=st2_headers)
    assert mark_resp2.status_code == 200
    assert mark_resp2.json()["status"] == "SUCCESS"

    # 11. Test Faculty Close Attendance Session
    close_resp = client.post(f"/api/v1/attendance/session/{session_id}/close", headers=fac_headers)
    assert close_resp.status_code == 200

    # 12. Test Student Dashboard Summary Calculation
    dash_resp = client.get("/api/v1/dashboard/student", headers=st1_headers)
    assert dash_resp.status_code == 200
    assert dash_resp.json()["overall_percentage"] > 0

    # 13. Test Admin Dashboard Summary
    admin_login = client.post("/api/v1/auth/login", json={
        "email_or_enrollment": "admin@nsit.ac.in",
        "password": "Admin@123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_resp = client.get("/api/v1/dashboard/admin", headers=admin_headers)
    assert admin_resp.status_code == 200
    assert admin_resp.json()["total_students"] == 33

    # 14. Test Export Endpoints (Excel & CSV)
    excel_resp = client.get("/api/v1/reports/export/excel?class_id=1&subject_id=1", headers=fac_headers)
    assert excel_resp.status_code == 200
    assert len(excel_resp.content) > 0

    csv_resp = client.get("/api/v1/reports/export/csv?class_id=1&subject_id=1", headers=fac_headers)
    assert csv_resp.status_code == 200
    assert "Enrollment No" in csv_resp.text

    print("ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_smartattend_e2e_flow()
