import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="session")
def tokens():
    r_fac = client.post("/api/v1/auth/login", json={"email_or_enrollment": "akash.thakkar@nsit.ac.in", "password": "Faculty@123"})
    r_stu = client.post("/api/v1/auth/login", json={"email_or_enrollment": "251943004001", "password": "Student@123"})
    r_adm = client.post("/api/v1/auth/login", json={"email_or_enrollment": "admin@nsit.ac.in", "password": "Admin@123"})
    return {
        "fac": {"Authorization": f"Bearer {r_fac.json()['access_token']}"},
        "stu": {"Authorization": f"Bearer {r_stu.json()['access_token']}"},
        "adm": {"Authorization": f"Bearer {r_adm.json()['access_token']}"}
    }

def test_api_matrix_comprehensive(tokens):
    matrix = [
        ("POST", "/api/v1/auth/login", {"email_or_enrollment": "admin@nsit.ac.in", "password": "Admin@123"}, {}, 200),
        ("POST", "/api/v1/auth/login", {"email_or_enrollment": "admin@nsit.ac.in", "password": "wrong"}, {}, 401),
        ("GET", "/api/v1/auth/me", None, tokens["adm"], 200),
        ("POST", "/api/v1/auth/logout", None, {}, 200),
        ("GET", "/api/v1/timetable/schedule", None, tokens["fac"], 200),
        ("GET", "/api/v1/timetable/schedule?date=2026-09-14", None, tokens["fac"], 200),
        ("GET", "/api/v1/timetable/schedule?date=invalid-date", None, tokens["fac"], 200),
        ("POST", "/api/v1/attendance/lecture/8/confirm", {"status": "CONFIRMED"}, tokens["fac"], 200),
        ("POST", "/api/v1/attendance/lecture/8/confirm", {"status": "INVALID_STATUS"}, tokens["fac"], 400),
        ("POST", "/api/v1/attendance/lecture/99999/confirm", {"status": "CONFIRMED"}, tokens["fac"], 404),
        ("POST", "/api/v1/attendance/lecture/8/confirm", {"status": "CONFIRMED"}, tokens["stu"], 403),
        ("POST", "/api/v1/attendance/lecture/8/start", {"duration_minutes": 5}, tokens["stu"], 403),
        ("POST", "/api/v1/attendance/lecture/99999/start", {"duration_minutes": 5}, tokens["fac"], 404),
        ("GET", "/api/v1/attendance/session/1/details", None, tokens["fac"], 200),
        ("GET", "/api/v1/attendance/session/nonexistent_token/details", None, tokens["fac"], 404),
        ("POST", "/api/v1/attendance/mark", {"session_token": "nonexistent_token"}, tokens["stu"], 404),
        ("POST", "/api/v1/attendance/mark", {"session_token": "test"}, tokens["fac"], 403),
        ("POST", "/api/v1/attendance/session/1/edit", {"student_id": 1, "status": "PRESENT"}, tokens["fac"], 200),
        ("POST", "/api/v1/attendance/session/1/edit", {"student_id": 1, "status": "PRESENT"}, tokens["stu"], 403),
        ("GET", "/api/v1/attendance/qr-code/test_token", None, {}, 200),
        ("GET", "/api/v1/dashboard/student", None, tokens["stu"], 200),
        ("GET", "/api/v1/dashboard/student", None, tokens["fac"], 403),
        ("GET", "/api/v1/dashboard/admin", None, tokens["adm"], 200),
        ("GET", "/api/v1/dashboard/admin", None, tokens["stu"], 403),
        ("GET", "/api/v1/reports/export/excel?class_id=1&subject_id=1", None, tokens["fac"], 200),
        ("GET", "/api/v1/reports/export/excel?class_id=1&subject_id=1", None, tokens["stu"], 403),
        ("GET", "/api/v1/reports/export/csv?class_id=1&subject_id=1", None, tokens["fac"], 200),
        ("GET", "/api/v1/reports/export/csv?class_id=1&subject_id=1", None, tokens["stu"], 403),
        ("GET", "/api/v1/reports/audit-logs", None, tokens["adm"], 200),
        ("GET", "/api/v1/reports/audit-logs", None, tokens["fac"], 403),
        ("GET", "/api/v1/reports/audit-logs", None, tokens["stu"], 403),
    ]

    for method, path, body, headers, expected in matrix:
        if method == "GET":
            r = client.get(path, headers=headers)
        else:
            r = client.post(path, json=body, headers=headers)
        assert r.status_code == expected, f"{method} {path} returned {r.status_code}, expected {expected}. Detail: {r.text}"
