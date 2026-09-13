# SmartAttend — System Architecture & Testing Map (Stage 0)

**Document Status**: COMPLETED  
**Target System**: SmartAttend — College Attendance Management Platform  
**Target Class**: B.Tech-M.Tech CSE (Cyber Security), Semester III, Room 109, NSIT-IFSCS  
**Date**: September 14, 2026  

---

## 1. Component Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router) | React 18, TypeScript, Tailwind CSS, Lucide Icons, html5-qrcode |
| **Backend Framework** | FastAPI (Python 3.14) | ASGI server (Uvicorn), Starlette |
| **Database** | SQLite 3 (WAL mode enabled) / PostgreSQL | Configured via `DATABASE_URL` in `app/config.py` |
| **ORM / Query Layer** | SQLAlchemy 2.0 | Declarative Base with eager/lazy relationships & session management |
| **Authentication** | JWT (PyJWT / Python-Jose) + SHA-256 password hashing | Bearer token in header, `smartattend_session` cookie, or URL query param fallback |
| **QR Generation** | Python `qrcode` library | Dynamic endpoint `/api/v1/attendance/qr-code/{token}` yielding PNG stream |
| **QR Scanning / Display** | `html5-qrcode` & Next.js Image | Client-side mobile camera stream or Projector display mode |
| **Cryptographic Tokens** | `secrets.token_urlsafe(32)` | Prefixed session token: `sec_tok_<random32>` |
| **Device Identification** | Cookie / Header / Body token | Prefixed device token: `dev_<random16>` (`smartattend_device_id`) |
| **Real-Time Communication** | FastAPI WebSockets | In-memory `ConnectionManager` mapping `session_id -> List[WebSocket]` |
| **Attendance Calculation** | Python Services (`report_service.py`) | Subject-wise & class overall %, 75.0% threshold alert trigger |
| **Timetable System** | Day-of-week based scheduler | Auto-materializes `ScheduledLecture` records from `TimetableEntry` |
| **Role System** | Enum: `STUDENT`, `FACULTY`, `ADMIN` | Role enforcement in endpoint dependencies (`get_current_user`) |
| **Excel Export** | `openpyxl` & `pandas` | Styled workbook formatted to official college lesson attendance sheets |

---

## 2. Database Schema & Relational Map

```
  +-------------+            1:1          +---------------+
  |    users    | ----------------------- |   students    |
  |-------------|                         |---------------|
  | id (PK)     |                         | id (PK)       |
  | email (UQ)  |                         | user_id (FK)  |
  | role        |                         | roll_no       |
  | password    |                         | enrollment_no |
  +-------------+                         | class_id (FK) |
         |                                +---------------+
         | 1:1                                    |
         v                                        |
  +-------------+                                 |
  |   faculty   |                                 |
  |-------------|                                 |
  | id (PK)     |                                 |
  | user_id (FK)|                                 |
  | emp_code    |                                 |
  +-------------+                                 |
         | 1:N                                    |
         v                                        v
  +--------------------+ 1:N              +--------------------+
  | timetable_entries  | -------------->  | attendance_records |
  |--------------------|                  |--------------------|
  | id (PK)            |                  | id (PK)            |
  | subject_id (FK)    |                  | session_id (FK)    |
  | faculty_id (FK)    |                  | student_id (FK)    |
  | day_of_week        |                  | device_id (FK)     |
  | start_time         |                  | status (P/A)       |
  +--------------------+                  +--------------------+
         | 1:N                                    ^
         v                                        |
  +--------------------+                          |
  | scheduled_lectures |                          |
  |--------------------|                          |
  | id (PK)            |                          |
  | timetable_id (FK)  |                          |
  | date               |                          |
  | status             |                          |
  +--------------------+                          |
         | 1:1                                    |
         v                                        | 1:N
  +---------------------+                         |
  | attendance_sessions | ------------------------+
  |---------------------|
  | id (PK)             |
  | scheduled_id (FK)   |
  | token (UQ)          |
  | status (ACTIVE/CLS) |
  | duration_minutes    |
  +---------------------+
```

### Critical Constraints Declared in Schema:
1. `UNIQUE(session_id, student_id)` — Name: `uq_session_student`
2. `UNIQUE(session_id, device_id)` — Name: `uq_session_device`
3. `User.email` UNIQUE
4. `Student.enrollment_no` UNIQUE
5. `Faculty.employee_code` UNIQUE
6. `Subject.code` UNIQUE
7. `AttendanceSession.token` UNIQUE
8. `Device.device_token` UNIQUE

---

## 3. Discovered API Endpoints Surface

| Router Prefix | Method | Endpoint Path | Auth Required | Authorized Roles | Functionality |
|---|---|---|---|---|---|
| `/api/v1/auth` | `POST` | `/login` | No | Any | User login, issues JWT & device token |
| `/api/v1/auth` | `GET` | `/me` | Yes | Any | Returns authenticated user profile |
| `/api/v1/auth` | `POST` | `/logout` | No | Any | Deletes session cookie |
| `/api/v1/timetable` | `GET` | `/schedule` | Yes | Any | Queries scheduled lectures for date |
| `/api/v1/attendance` | `POST` | `/lecture/{id}/confirm` | Yes | `FACULTY`, `ADMIN` | Confirm, cancel, reschedule lecture |
| `/api/v1/attendance` | `POST` | `/lecture/{id}/start` | Yes | `FACULTY`, `ADMIN` | Start QR attendance session |
| `/api/v1/attendance` | `POST` | `/session/{id}/close` | Yes | `FACULTY`, `ADMIN` | Close session, auto-fills absent |
| `/api/v1/attendance` | `GET` | `/session/{id}/details`| Yes | Any | Get session metadata & student roster |
| `/api/v1/attendance` | `POST` | `/mark` | Yes | `STUDENT` | Submit QR scan to record attendance |
| `/api/v1/attendance` | `POST` | `/session/{id}/edit` | Yes | `FACULTY`, `ADMIN` | Manual toggle/override of student status |
| `/api/v1/attendance` | `GET` | `/qr-code/{token}` | No | Public | Returns PNG QR code image stream |
| `/api/v1/dashboard` | `GET` | `/student` | Yes | `STUDENT` | Subject breakdown, %, total lectures |
| `/api/v1/dashboard` | `GET` | `/admin` | Yes | `FACULTY`, `ADMIN` | Overall stats & low attendance alerts |
| `/api/v1/reports` | `GET` | `/export/excel` | Yes | `FACULTY`, `ADMIN` | Stream/download Lesson sheet (.xlsx) |
| `/api/v1/reports` | `GET` | `/export/csv` | Yes | `FACULTY`, `ADMIN` | Download Lesson sheet (.csv) |
| `/api/v1/reports` | `GET` | `/audit-logs` | Yes | `ADMIN` | View audit trail records |
| `/ws` | `WebSocket` | `/ws/attendance/{session_id}` | No | Public/Unauthenticated | Live push of scan & close events |

---

## 4. Key Security & Vulnerability Vectors to Test

1. **Anti-Proxy Constraints**:
   - `UNIQUE(session_id, student_id)` enforcement.
   - `UNIQUE(session_id, device_id)` enforcement.
   - Race conditions on simultaneous scans.
2. **Authorization & Privilege Escalation**:
   - Student calling `/attendance/lecture/{id}/start` or `/session/{id}/edit`.
   - Student calling `/reports/export/excel` or `/reports/audit-logs`.
   - Faculty calling admin audit logs.
3. **Session & Token Integrity**:
   - Expired QR token scanning (`now > expires_at`).
   - Closed session scan attempts (`status == CLOSED`).
   - Tampered QR token strings.
   - QR token replay from previous sessions.
4. **WebSocket Connection Guard**:
   - Unauthenticated access to private classroom event streams.
5. **Database Transaction Integrity**:
   - Lack of `try/except IntegrityError` on record commits causing HTTP 500 errors under concurrent race conditions.
