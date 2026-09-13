# Stage 2 — Database Schema & Constraint Testing Report

**Overall Status**: **PASS**  
**Date**: September 14, 2026  
**Target Environment**: SQLite 3 (WAL Mode, Busy Timeout: 30000ms)  

---

## 1. Schema & Field Verification

### Student Schema (`students` table)
- **Primary Key**: `id` (Integer, Auto-increment)
- **User Reference**: `user_id` (`ForeignKey("users.id")`, `unique=True`, `nullable=False`) — **VERIFIED**
- **Enrollment Number**: `enrollment_no` (`String`, `unique=True`, `index=True`, `nullable=False`) — **VERIFIED**
- **Roll Number**: `roll_no` (`String`, `nullable=False`) — **VERIFIED**
- **Class Reference**: `class_id` (`ForeignKey("classes.id")`, `nullable=False`) — **VERIFIED**
- **Semester / Branch**: `semester`, `branch` (`String`, `nullable=False`) — **VERIFIED**
- **Active State**: Linked via `User.is_active` (`Boolean`, default=True) — **VERIFIED**

### Faculty Schema (`faculty` table)
- **Primary Key**: `id` (Integer, Auto-increment)
- **User Reference**: `user_id` (`ForeignKey("users.id")`, `unique=True`, `nullable=False`) — **VERIFIED**
- **Employee Code**: `employee_code` (`String`, `unique=True`, `nullable=False`) — **VERIFIED**
- **Department**: `department` (`String`, `nullable=False`) — **VERIFIED**
- **Role Identity**: Associated User has `role = "FACULTY"` — **VERIFIED**

### Attendance Session Schema (`attendance_sessions` table)
- **Session Reference**: `scheduled_lecture_id` (`ForeignKey("scheduled_lectures.id")`, `unique=True`, `nullable=False`) — **VERIFIED**
- **Cryptographic Token**: `token` (`String`, `unique=True`, `index=True`, `nullable=False`) — **VERIFIED**
- **Lifecycle Status**: `status` (Enum: `ACTIVE`, `CLOSED`, `EXPIRED`) — **VERIFIED**
- **Timestamps**: `opened_at`, `closed_at`, `duration_minutes` — **VERIFIED**

### Attendance Record Schema (`attendance_records` table)
- **Foreign Keys**: `session_id`, `student_id`, `device_id` — **VERIFIED**
- **Status & Source**: `status` (`PRESENT`/`ABSENT`), `source` (`QR_SCAN`/`MANUAL_FACULTY`) — **VERIFIED**
- **Timestamp**: `timestamp` (`DateTime`, default `utcnow`) — **VERIFIED**

---

## 2. Constraint & Race Condition Test Results

| Test ID | Test Scenario | Execution Method | Expected Behavior | Actual Result | Status |
|---|---|---|---|---|---|
| **DB-01** | Baseline Insert | Direct SQLAlchemy commit | Record created | Record created | **PASS** |
| **DB-02** | Same Student Twice | Attempt 2nd insert with same `(session_id, student_id)` | Blocked by `uq_session_student` | `IntegrityError: UNIQUE constraint failed` | **PASS** |
| **DB-03** | Same Device / 2 Students | Attempt 2nd insert with same `(session_id, device_id)` | Blocked by `uq_session_device` | `IntegrityError: UNIQUE constraint failed` | **PASS** |
| **DB-04** | Two Devices / Same Student | Attempt insert from Device 2 for Student 1 | Blocked by `uq_session_student` | `IntegrityError: UNIQUE constraint failed` | **PASS** |
| **DB-05** | High-Concurrency Race Condition | 20 simultaneous threads attempting duplicate insert | Exactly 1 record created; 19 rejected | 1 Succeeded, 19 Blocked, Count in DB = 1 | **PASS** |

---

## 3. Database Observations & Recommendations
1. **Constraint Enforcement**: Both composite unique constraints `uq_session_student` and `uq_session_device` are strictly enforced by the database engine.
2. **Exception Handling Notice**: When concurrent duplicate requests reach the database layer, SQLAlchemy raises `IntegrityError`. The API endpoint `mark_student_attendance` must explicitly catch `IntegrityError` to return a structured HTTP 400 response rather than an unhandled HTTP 500 error.
