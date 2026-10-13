# SmartAttend - Timetable-Driven College Attendance Management System

**SmartAttend** is a production-hardened college attendance management platform built for **Narnarayan Shastri Institute of Technology - Institute of Forensic Sciences & Cyber Security (NSIT-IFSCS)**.

Specifically configured for:
- **Class**: B.Tech-M.Tech CSE (Cyber Security), Semester III, Room 109
- **Students**: 33 Students (Roll 001 - 033, Enrollments `251943004001` to `251943004034`)
- **Core Theory Subjects**: 6 Subjects (Maths-3, DSA, DBMS, Python, CO & Microprocessors, Cyber Security)

---

## 🔑 Demo Credentials

| Role | Username / Identifier | Password | Access Level |
|---|---|---|---|
| **Student** | `251943004001` or `student001@nsit.ac.in` | `Student@123` | View attendance %, trusted phone registration, QR scan landing |
| **Faculty** | `akash.thakkar@nsit.ac.in` | `Faculty@123` | Conduct/Cancel/Reschedule lectures, QR display, live WebSockets monitor, Classroom Presence Code, Record editor, Device reset, Excel export |
| **Admin** | `admin@nsit.ac.in` | `Admin@123` | Low attendance warning alerts (<75%), Class roster, Subjects, Global device reset, Audit logs |

---

## 🛡️ Anti-Proxy Architecture & Security Model

SmartAttend implements a multi-layered anti-proxy attendance security framework to eliminate casual and remote proxy attendance:

### 1. One Registered Phone per Student
- **Strict 1:1 Device Binding**: Each student account may have exactly **one** active trusted device.
- **Cryptographic Device Secrets**: When enrolling, the server issues a high-entropy cryptographically random device secret (`dsec_...`). The client securely stores this token in browser local storage. The database stores only a SHA-256 hash representation (`device_secret_hash`); raw secrets are never logged, exposed, or transmitted in responses.
- **Atomic Concurrency Protection**: Partial unique database index (`uq_one_active_device_per_student`) enforces at the database level that no two concurrent requests can register multiple active devices for the same student.
- **Cross-Account Reuse Denial**: Device ownership is bound to the verified student profile server-side. Student B cannot register or claim Student A's device token or secret. A copied cookie or shared token is rejected with HTTP 403.

### 2. Faculty-Authorized Device Replacement Workflow
- **Student Replacement Lockdown**: A student cannot reset or replace their registered trusted device.
- **Role & Scope Authorization**: Replacing a phone requires authorization from faculty or administrators. Faculty members are strictly authorized to reset devices **only for students enrolled in classes they currently teach**. Administrators hold global reset authority.
- **Immutable Audit Trail**: Every reset creates an immutable entry in `device_reset_logs` recording the actor, target student, old device ID, substantive justification reason, timestamp, and IP address.
- **Immediate Credential Revocation**: The previous trusted device is immediately marked as `REVOKED`, instantly blocking any attendance marking from the old phone. The replacement phone must go through the authenticated enrollment flow.

### 3. Layered Defense Against Remote QR Sharing
- **Layer 1: Rotating QR Tokens**: Time-sliced HMAC-SHA256 rotating QR tokens (15-second windows) ensure that static photographs or screenshots of the projector screen rapidly expire.
- **Layer 2: Classroom-Only Presence Challenge**: Authorized faculty receive a short-lived 4-digit numeric presence code generated per session and displayed on the classroom screen / projector. Students must enter this code when submitting attendance. Faculty can rotate this code on demand.
- **Layer 3: Trusted Hardware Secret Verification**: QR attendance submission strictly validates the authenticated session against the student's registered active phone and verifies the cryptographic device secret hash.

---

## 📋 Operational Procedures

### Student Device Enrollment Flow
1. Student logs in to SmartAttend via student portal or attendance scan link.
2. If no trusted phone is enrolled, the student is presented with the **"Register Trusted Attendance Phone"** prompt.
3. Upon confirming registration, the server creates an `ACTIVE` device record, generates a cryptographically random device secret, and stores the SHA-256 hash in the database.
4. The client persists the device credentials (`smartattend_device_id` and `smartattend_device_secret`).

### Student Attendance Marking Flow
1. Student scans the rotating QR code projected on the classroom screen.
2. The frontend extracts the session token, reads stored device credentials, and prompts for the 4-digit **Classroom Presence Code** displayed on the projector.
3. The student submits the attendance request (`/api/v1/attendance/mark`).
4. The backend verifies:
   - Valid session status and non-expired session timer.
   - Valid presence challenge code matching current session.
   - Student enrollment in the scheduled lecture's class.
   - Verified active trusted device registered to the student.
   - Constant-time validation of device secret hash.
   - Idempotent submission (prevents duplicate scans).
5. Attendance is recorded (`status: PRESENT`), and real-time updates broadcast to faculty live dashboards via WebSockets.

### Faculty Device Reset Procedure
1. If a student loses or replaces their phone, they report to their class faculty member.
2. Faculty opens the attendance roster for their lecture, locates the student, and clicks **"Reset Phone"**.
3. Faculty inputs a mandatory justification reason (e.g. *"Screen broken, verified new device in person"*).
4. System revokes the old device and logs an immutable audit entry.
5. The student is immediately unblocked to register their new phone on their next login.

---

## ⚠️ Residual Security Limitations

While this architecture provides enterprise-grade protection against proxy attendance, the following inherent physical limitations must be honestly recognized:

1. **Real-Time Remote Relay (Remote Screen Sharing / Messaging)**:
   A student physically present in Room 109 can theoretically message both the current rotating QR link and the 4-digit classroom code to an absent friend via WhatsApp/Telegram in real-time. If the absent friend possesses their own registered phone, they could mark attendance remotely during the 15-second window.
2. **Physical Device Lending**:
   If Student A gives their physical phone to Student B prior to class, Student B can scan and mark attendance on Student A's behalf. Cryptographic software cannot distinguish which human holds the trusted physical device.
3. **Biological Presence Proof**:
   Software tokens and QR codes cannot furnish absolute mathematical proof of biological human presence in a specific room without physical biometric hardware (e.g., in-person fingerprint or facial recognition scanners).

---

## 🗄️ Database Migrations & Rollout

Database changes are managed via **Alembic**:
- **Migration Script**: `backend/alembic/versions/001_trusted_device_anti_proxy.py`
- **Tables Added/Modified**:
  - `devices`: Added `student_id`, `device_secret_hash`, `status`, `registered_at`, `last_used_at`, `revoked_at`, `revoked_by_user_id`, `revocation_reason`.
  - Added partial unique index `uq_one_active_device_per_student` (`student_id` WHERE `status = 'ACTIVE'`).
  - Created `device_reset_logs` table for immutable faculty-authorized reset audit logging.
  - `attendance_sessions`: Added `presence_code`, `presence_code_expires_at`, `presence_challenge_required`.

### Legacy Device Backfill Strategy
When upgrading a populated database, historical `devices` without student ownership are backfilled with `status = 'LEGACY_UNCLAIMED'` and `revocation_reason = 'LEGACY_UNTRUSTED_MIGRATION_BACKFILL'`. Legacy devices are never automatically assumed to be trusted. All historical attendance sessions (230+ records) remain preserved and immutable.

### Running Migrations
```bash
# Upgrade to latest schema
venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head

# Rollback to initial schema (downgrades security columns, preserves attendance records)
venv\Scripts\python.exe -m alembic -c backend/alembic.ini downgrade base
```

---

## 🚀 Quick Start Instructions

### Option 1: Running Locally with Python & Node.js

#### 1. Backend Server (FastAPI)
```bash
# From workspace root directory
.\venv\Scripts\python.exe backend/run.py
```
*Backend API will run on `http://localhost:8000`.*

#### 2. Frontend Application (Next.js)
```bash
# In another terminal
cd frontend
npm run dev
```
*Frontend will run on `http://localhost:3000`.*

---

## 🧪 Automated Testing & Validation

The test suite consists of 39 automated tests covering end-to-end flows, API matrix contracts, classroom high-concurrency load (30 & 60 users), security regressions, and comprehensive anti-proxy test suites:

```bash
# Run complete test suite (all 39 tests)
venv\Scripts\python.exe -m pytest tests/

# Run trusted device anti-proxy regression suite specifically (24 tests)
venv\Scripts\python.exe -m pytest tests/test_trusted_device_anti_proxy.py
```
