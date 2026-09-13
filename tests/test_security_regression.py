import os
import sys
import time
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.database import SessionLocal
from app.config import settings
from app.models.schema import User, Student, AttendanceSession, AttendanceRecord, ScheduledLecture
from app.auth.security import (
    hash_password, verify_password, verify_and_check_rehash,
    create_access_token, generate_rotating_qr_token, verify_rotating_qr_token
)
from app.services.rate_limiter import attendance_rate_limiter

client = TestClient(app)

# -------------------------------------------------------------
# 1. WEBSOCKET SECURITY REGRESSION
# -------------------------------------------------------------
def test_websocket_security_all_roles():
    db = SessionLocal()
    session = db.query(AttendanceSession).first()
    admin_user = db.query(User).filter(User.role == "ADMIN").first()
    faculty_user = db.query(User).filter(User.role == "FACULTY").first()
    student_user = db.query(User).filter(User.role == "STUDENT").first()
    db.close()

    session_id = session.id

    # 1. No token -> Rejected (1008)
    with pytest.raises(WebSocketDisconnect) as exc_no_token:
        with client.websocket_connect(f"/ws/attendance/{session_id}"):
            pass
    assert exc_no_token.value.code == 1008

    # 2. Invalid token -> Rejected (1008)
    with pytest.raises(WebSocketDisconnect) as exc_invalid:
        with client.websocket_connect(f"/ws/attendance/{session_id}?token=bad_fake_token"):
            pass
    assert exc_invalid.value.code == 1008

    # 3. Expired token -> Rejected (1008)
    expired_token = create_access_token(
        data={"sub": str(faculty_user.id), "email": faculty_user.email, "role": faculty_user.role},
        expires_delta=timedelta(seconds=-30)
    )
    with pytest.raises(WebSocketDisconnect) as exc_expired:
        with client.websocket_connect(f"/ws/attendance/{session_id}?token={expired_token}"):
            pass
    assert exc_expired.value.code == 1008

    # 4. Student token -> Rejected (1008 - Students forbidden from observing faculty stream)
    student_token = create_access_token(
        data={"sub": str(student_user.id), "email": student_user.email, "role": student_user.role}
    )
    with pytest.raises(WebSocketDisconnect) as exc_student:
        with client.websocket_connect(f"/ws/attendance/{session_id}?token={student_token}"):
            pass
    assert exc_student.value.code == 1008

    # 5. Authorized Teacher token -> Accepted (handshake completes successfully)
    faculty_token = create_access_token(
        data={"sub": str(faculty_user.id), "email": faculty_user.email, "role": faculty_user.role}
    )
    with client.websocket_connect(f"/ws/attendance/{session_id}?token={faculty_token}") as ws:
        assert ws is not None

    # 6. Authorized Admin token -> Accepted (handshake completes successfully)
    admin_token = create_access_token(
        data={"sub": str(admin_user.id), "email": admin_user.email, "role": admin_user.role}
    )
    with client.websocket_connect(f"/ws/attendance/{session_id}?token={admin_token}") as ws:
        assert ws is not None


def get_or_create_active_session():
    import datetime
    from app.database import utc_now
    db = SessionLocal()
    session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not session:
        session = db.query(AttendanceSession).first()
        if session:
            session.status = "ACTIVE"
            session.opened_at = utc_now()
            session.duration_minutes = 60
            db.commit()
            db.refresh(session)
    db.close()
    return session

# -------------------------------------------------------------
# 2. FAIL-FAST JWT SECRET CONFIGURATION REGRESSION
# -------------------------------------------------------------
def test_jwt_secret_fail_fast(monkeypatch):
    from unittest.mock import patch
    from app import config

    monkeypatch.delenv("SECRET_KEY", raising=False)
    with patch("dotenv.load_dotenv"):
        with pytest.raises(RuntimeError) as exc_info:
            config.Settings()
        assert "SECRET_KEY environment variable is required" in str(exc_info.value)


# -------------------------------------------------------------
# 3. CONCURRENT INTEGRITYERROR RACE CONDITION HANDLING
# -------------------------------------------------------------
def test_integrity_error_graceful_handling():
    import concurrent.futures

    session = get_or_create_active_session()
    db = SessionLocal()
    student = db.query(Student).filter(Student.class_id == 1).first()
    student_user = student.user
    db.close()

    token = create_access_token(
        data={"sub": str(student_user.id), "email": student_user.email, "role": student_user.role}
    )
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "session_token": session.token,
        "device_token": f"dev_race_test_{student.id}"
    }

    # Reset rate limit for this test
    attendance_rate_limiter.reset()

    # Send 5 concurrent requests with identical student & session
    def send_mark():
        return client.post("/api/v1/attendance/mark", json=payload, headers=headers)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(send_mark) for _ in range(5)]
        responses = [f.result() for f in futures]

    status_codes = [r.status_code for r in responses]
    # ZERO HTTP 500 ERRORS!
    assert 500 not in status_codes
    # All responses must be HTTP 200 (either SUCCESS or ALREADY_RECORDED)
    assert all(code == 200 for code in status_codes)

    # Verify only exactly 1 record was written in the database
    db = SessionLocal()
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == student.id
    ).all()
    db.close()
    assert len(records) == 1, "Database constraint violated or duplicate record created!"


# -------------------------------------------------------------
# 4. PASSWORD HASHING (BCRYPT) & SEAMLESS MIGRATION
# -------------------------------------------------------------
def test_password_hashing_and_migration():
    # 1. Test Bcrypt hash generation & verification
    plain = "TestPassword@999"
    hashed = hash_password(plain)
    assert hashed.startswith("$2b$")
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

    # 2. Test legacy SHA-256 hash detection & migration flag
    import hashlib
    salt = "nsit_smartattend_salt_2026"
    legacy_hash = hashlib.sha256(("LegacyPass@123" + salt).encode("utf-8")).hexdigest()
    
    is_valid, needs_rehash = verify_and_check_rehash("LegacyPass@123", legacy_hash)
    assert is_valid is True
    assert needs_rehash is True

    # 3. Test that once rehashed, needs_rehash becomes False
    new_bcrypt = hash_password("LegacyPass@123")
    is_valid_new, needs_rehash_new = verify_and_check_rehash("LegacyPass@123", new_bcrypt)
    assert is_valid_new is True
    assert needs_rehash_new is False


# -------------------------------------------------------------
# 5. CORS ORIGINS ENFORCEMENT & SECURITY HEADERS
# -------------------------------------------------------------
def test_cors_and_security_headers():
    # Preflight request from authorized origin
    resp = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://nsit-attendance.netlify.app",
            "Access-Control-Request-Method": "POST"
        }
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://nsit-attendance.netlify.app"

    # Unauthorized origin
    resp_bad = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://malicious-phishing-site.com",
            "Access-Control-Request-Method": "POST"
        }
    )
    # Malicious origin must NOT be allowed
    assert resp_bad.headers.get("access-control-allow-origin") != "https://malicious-phishing-site.com"

    # Test Security Headers middleware
    get_resp = client.get("/api/v1/auth/me")
    assert get_resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert get_resp.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert get_resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


# -------------------------------------------------------------
# 6. RATE LIMITING REGRESSION
# -------------------------------------------------------------
def test_rate_limiting_enforcement():
    session = get_or_create_active_session()
    db = SessionLocal()
    student = db.query(Student).first()
    student_user = student.user
    db.close()

    token = create_access_token(
        data={"sub": str(student_user.id), "email": student_user.email, "role": student_user.role}
    )
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"session_token": session.token, "device_token": f"dev_rl_{student.id}"}

    attendance_rate_limiter.reset()

    # Make 10 requests rapidly -> Should all succeed (allowed)
    for _ in range(10):
        r = client.post("/api/v1/attendance/mark", json=payload, headers=headers)
        assert r.status_code == 200

    # 11th request within 30s -> Must trigger HTTP 429 Too Many Requests
    r_limit = client.post("/api/v1/attendance/mark", json=payload, headers=headers)
    assert r_limit.status_code == 429
    assert "Too many attendance attempts" in r_limit.json()["detail"]
    assert "Retry-After" in r_limit.headers

    # Reset limiter
    attendance_rate_limiter.reset()


# -------------------------------------------------------------
# 7. ROTATING QR TOKEN CRYPTOGRAPHIC VALIDATION
# -------------------------------------------------------------
def test_rotating_qr_token_validation():
    session_id = 1
    # 1. Valid token generated for session 1
    token = generate_rotating_qr_token(session_id, window_seconds=15)
    assert token.startswith("rot_1_")
    verified_id = verify_rotating_qr_token(token, window_seconds=15)
    assert verified_id == session_id

    # 2. Tampered token -> Rejected
    tampered_token = token[:-4] + "ffff"
    assert verify_rotating_qr_token(tampered_token, window_seconds=15) is None

    # 3. Outdated/expired token window (skew > 2) -> Rejected
    expired_token = f"rot_{session_id}_100_dummyhash12345"
    assert verify_rotating_qr_token(expired_token, window_seconds=15) is None
