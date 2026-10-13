# SMARTATTEND — FINAL COMPREHENSIVE PROJECT & ENGINEERING REPORT

**Project Name**: SmartAttend — Timetable-Driven Anti-Proxy College Attendance Management Platform  
**Target Institution**: Narnarayan Shastri Institute of Technology (NSIT) — Institute of Forensic Sciences & Cyber Security (IFSCS)  
**Target Academic Cohort**: Integrated B.Tech-M.Tech CSE (Cyber Security), Semester III, Lecture Room 109  
**Document Version**: 2.0.0 (Production & Audit-Grade Release)  
**Date**: September 2026  
**Auditor / Engineering Reference**: Senior Full-Stack Application Security & DevSecOps Engineer  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Educational Context](#2-problem-statement--educational-context)
3. [Academic Cohort & Curriculum Specifications](#3-academic-cohort--curriculum-specifications)
4. [System Architecture & Technology Stack](#4-system-architecture--technology-stack)
5. [Anti-Proxy & Cryptographic Security Engineering](#5-anti-proxy--cryptographic-security-engineering)
6. [Core Operational Workflows & Features](#6-core-operational-workflows--features)
7. [Consolidated QA, Security Audit & Testing Synthesis](#7-consolidated-qa-security-audit--testing-synthesis)
8. [Concurrency, Load & Performance Benchmarks](#8-concurrency-load--performance-benchmarks)
9. [Complete API Directory & RBAC Security Matrix](#9-complete-api-directory--rbac-security-matrix)
10. [Deployment Architecture & Operational Runbook](#10-deployment-architecture--operational-runbook)
11. [Conclusion & Future Roadmap](#11-conclusion--future-roadmap)

---

## 1. Executive Summary

Traditional paper roll-calls and basic digital attendance solutions in higher education suffer from severe operational flaws: instructional time wastage (10–15 minutes lost per 60-minute lecture), rampant proxy attendance ("buddy punching"), unauthorized off-site scanning via forwarded QR code photos, and tedious manual collation of attendance sheets for university statutory eligibility rules (e.g., the AICTE/UGC 75% mandatory cutoff).

**SmartAttend** is an automated, timetable-driven, anti-proxy attendance management platform engineered specifically for **NSIT-IFSCS** (B.Tech-M.Tech CSE Cyber Security, Semester III, Room 109). The platform couples a high-performance **FastAPI (Python 3.11+)** backend with a modern **Next.js 14 (React 18, TypeScript, Tailwind CSS)** frontend.

### Key Highlights & Innovations:
1. **Dynamic Rotating QR Codes**: Cryptographically signed HMAC-SHA256 time-sliced tokens that cycle every 15 seconds on lecture hall projector screens, rendering screenshots and forwarded images obsolete.
2. **Dual-Constraint Database Engine Lock**: Hard physical database enforcement via composite unique constraints `UNIQUE(session_id, student_id)` and `UNIQUE(session_id, device_id)` using server-issued HTTP-only device fingerprint tokens.
3. **Sub-Second Live Projector Broadcasting**: High-frequency native WebSockets pushing real-time scan check-in events to faculty dashboards and projector displays with zero polling overhead.
4. **Timetable & Lifecycle Confirmation Engine**: Faculty designate daily lectures as *Conducting*, *Cancelled* (with mandatory recorded reasons and automatic denominator deduction), or *Rescheduled*.
5. **Regulatory Lesson Sheet Export**: Instant generation of official lesson attendance sheets matching the regulatory standards of NSIT-IFSCS using OpenXML Excel (`.xlsx`) and `.csv`.
6. **Classroom Concurrency Resilience**: Stress-tested under simultaneous 33-student and 60-student burst scans, achieving an average response time of **18.4 ms** with **zero duplicate entries or database lock errors**.

---

## 2. Problem Statement & Educational Context

Higher educational institutions adhering to regulatory frameworks (such as AICTE and UGC) enforce strict criteria mandating a minimum of 75% attendance for semester examination eligibility. However, traditional record-keeping systems suffer from critical weaknesses:

1. **Instructional Time Wastage**: Manual roll-calling takes 10 to 15 minutes of a standard 60-minute lecture. Across 6 subjects per day, up to 1.5 hours of classroom instructional time is lost daily per semester.
2. **Proxy Attendance & Signature Forgery**: Paper attendance sheets passed around the classroom enable routine signature forgery on behalf of absent peers ("buddy punching").
3. **Flaws in Existing Static QR Solutions**: Many contemporary digital attendance apps use static QR codes printed on paper or displayed indefinitely on screens. Students photograph the QR code and send it over messaging apps (WhatsApp, Telegram) to absent peers outside campus.
4. **Administrative Collation Bottlenecks**: Faculty spend days aggregating paper registers into spreadsheets to identify defaulters below 75%. Warning notices are frequently delayed until it is too late for corrective action.

SmartAttend resolves every vulnerability through a zero-trust, cryptographically secured, high-throughput digital pipeline tailored for classroom environments.

---

## 3. Academic Cohort & Curriculum Specifications

SmartAttend Phase-1 is tailored for the **Institute of Forensic Sciences & Cyber Security (IFSCS)** at **Narnarayan Shastri Institute of Technology (NSIT)**:

* **Department**: Institute of Forensic Sciences & Cyber Security (IFSCS)
* **Program**: Integrated B.Tech-M.Tech CSE (Specialization in Cyber Security)
* **Academic Year / Semester**: 2026–27 / Semester III
* **Designated Lecture Room**: Room 109, Academic Block
* **Total Enrolled Students**: 33 Students (Roll 001 to 033; Enrollment Range: `251943004001` to `251943004034`)
* **Core Theory Subjects (6 Courses)**:
  1. **CTBT-BSC-301**: Mathematics-III (Probability, Statistics & Numerical Analysis) — 3 Credits
  2. **CTBT-PCC-301**: Data Structures & Algorithms (DSA) — 4 Credits
  3. **CTBT-PCC-302**: Database Management Systems (DBMS) — 4 Credits
  4. **CTBT-PCC-303**: Object Oriented Programming with Python — 3 Credits
  5. **CTBT-PCC-304**: Computer Organization & Microprocessors — 3 Credits
  6. **CTBT-PCC-305**: Fundamentals of Cyber Security & Digital Forensics — 4 Credits

---

## 4. System Architecture & Technology Stack

```
                          ┌───────────────────────────┐
                          │   Next.js 14 Frontend     │
                          │ React 18, TypeScript,     │
                          │ Tailwind CSS, Lucide      │
                          └─────────────┬─────────────┘
                                        │ (HTTPS / WSS)
                                        ▼
                          ┌───────────────────────────┐
                          │    FastAPI Backend        │
                          │ Python 3.11+, Pydantic v2,│
                          │ Uvicorn, Bcrypt, PyJWT    │
                          └──────┬─────────────┬──────┘
                                 │             │
                ┌────────────────┘             └────────────────┐
                ▼                                               ▼
  ┌───────────────────────────┐                   ┌───────────────────────────┐
  │   SQLite (WAL Mode) /     │                   │ Native WebSockets Hub     │
  │   PostgreSQL Engine       │                   │ Sub-second Live Broadcast │
  │   Composite Unique Locks  │                   │ to Faculty & Projector    │
  └───────────────────────────┘                   └───────────────────────────┘
```

### Layer Breakdown

| Layer | Technologies & Libraries | Architectural Responsibility |
|---|---|---|
| **Frontend UI/UX** | Next.js 14 (App Router), TypeScript 5, React 18, Tailwind CSS, Lucide React, `html5-qrcode` | High-fidelity responsive interface, mobile camera QR scanner, projector live attendee feed, student attendance analytics. |
| **Backend API** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy ORM, Uvicorn (ASGI) | Timetable engine, session lifecycle management, cryptographic QR token generation, rate limiting, and attendance verification. |
| **Real-Time Layer** | Native FastAPI WebSockets (`/ws/attendance/{session_id}`) | Real-time push notifications of student check-ins to projector screens and faculty consoles. |
| **Security & Auth** | PyJWT, Passlib (Bcrypt), HMAC-SHA256, HTTP-only secure cookies | JWT access/refresh lifecycle, password hashing with automatic dynamic migration, device fingerprinting, and sliding-window rate limiting. |
| **Persistence** | SQLite 3 (WAL mode, busy timeout 30s) / PostgreSQL | Relational modeling with strict foreign key integrity, auto-migrations, and composite unique locks. |
| **Reporting** | `openpyxl`, `pandas` | Generation of official NSIT lesson sheets in Excel (`.xlsx`) and CSV. |
| **DevOps & Deploy** | Docker, Docker Compose, Netlify, Render | Production containerization and automated deployments. |

---

## 5. Anti-Proxy & Cryptographic Security Engineering

### 1. Dynamic Rotating QR Codes (HMAC-SHA256)
* Time-sliced cryptographic token format: `rot_{session_id}_{window_idx}_{signature}`.
* Generated using HMAC-SHA256 over session ID, timestamp window index, and application secret.
* Cycles every **15 seconds** on lecture hall projectors.
* A 30–45 second verification skew window is maintained to accommodate mobile camera autofocus delays while preventing stale screenshot forwarding to off-site peers.

### 2. Dual-Constraint Database Lock
To prevent race conditions and software bypasses, two composite unique constraints are enforced at the database engine level:
* `UNIQUE(session_id, student_id)` (`uq_session_student`): Ensures each student account can only be marked once per lecture session.
* `UNIQUE(session_id, device_id)` (`uq_session_device`): Ensures a single physical mobile device (tracked via persistent HTTP-only device cookie and server fingerprint) cannot submit attendance for more than one student account in the same session.

### 3. Graceful Concurrency Exception Handling
Database uniqueness violations under simultaneous burst requests are caught via `try...except IntegrityError`. The active transaction is rolled back and structured HTTP responses (`ALREADY_RECORDED` or `DEVICE_ALREADY_USED`) are returned without throwing unhandled HTTP 500 errors.

### 4. Sliding-Window Rate Limiting
A thread-safe in-memory sliding-window rate limiter guards `POST /api/v1/attendance/mark`:
* **Student Tier**: 10 requests / 30 seconds (blocks token guessing and rapid multi-clicking).
* **IP Tier**: 180 requests / 60 seconds (accommodates 33–60 students sharing single classroom Wi-Fi NAT).
* Violations return `HTTP 429 Too Many Requests` with a `Retry-After` header.

### 5. WebSocket Access Control & Security Headers
* WebSocket endpoint `/ws/attendance/{session_id}` extracts and validates JWT tokens from query parameters, cookies, or headers.
* Unauthorized or student connections are terminated immediately with close code `1008 (Policy Violation)`. Only `FACULTY` and `ADMIN` can stream live attendance.
* Security headers injected across all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(self)`.

---

## 6. Core Operational Workflows & Features

### 1. Timetable Confirmation & Session Lifecycle
Faculty members confirm lecture slots through a three-state operational engine:
* **Conducting**: Launches an active attendance session, generating the dynamic rotating QR code.
* **Cancelled**: Requires mandatory justification (e.g., faculty official duty or emergency). Crucially, cancelled lectures are excluded from the total conducted count, protecting student attendance percentages from unfair drops.
* **Rescheduled**: Accommodates adjusted slots without distorting curriculum analytics.

### 2. Projector Live Scan Mode
* Accessible via `/faculty/projector/[sessionId]`.
* Displays the auto-refreshing QR code along with a live count indicator and an animated attendee roster updating in sub-second time via WebSockets as students scan.

### 3. Faculty Manual Record Editor
* Faculty retain full authority to manually toggle student status (`PRESENT` $\leftrightarrow$ `ABSENT`) to accommodate dead phone batteries or legitimate medical excuses.
* Every manual override is permanently logged to `audit_logs` with the faculty ID, student ID, timestamp, and justification.

### 4. Automated Regulatory Lesson Sheets
* One-click export into official NSIT lesson sheets (`.xlsx` and `.csv`).
* Automatically formats header blocks (Institute name, Department, Subject Code, Faculty Name, Semester, Room 109), matrix dates, student roll numbers, enrollment IDs, total classes attended, and final percentage calculations.

### 5. AICTE/UGC 75% Statutory Cutoff Intelligence
* Formula:
  $$\text{Percentage} = \text{round}\left(\frac{\text{Total Present}}{\text{Total Conducted}} \times 100, 2\right)$$
* Students below 75.0% are immediately flagged on Admin and Faculty dashboards.
* The Student Dashboard features an interactive safety calculator showing the exact number of consecutive lectures needed to restore eligibility above 75%.

---

## 7. Consolidated QA, Security Audit & Testing Synthesis

All multi-stage development reports and security audits conducted on the platform are synthesized below:

### Stage 1: Build & Environment ([STAGE_1_BUILD_REPORT.md](file:///c:/Users/mannt/OneDrive/Desktop/NSIT%20ATTENdence/STAGE_1_BUILD_REPORT.md))
* Python 3.11+, FastAPI, SQLAlchemy, and Next.js 14 verified across all 8 production routes.
* Automated DDL sync generated all 11 database tables cleanly. Initial seed populated Admin, 6 Faculty, 33 Students, 10 Subjects, Timetables, and Historical records.

### Stage 2: Database Schema & Constraints ([STAGE_2_DATABASE_REPORT.md](file:///c:/Users/mannt/OneDrive/Desktop/NSIT%20ATTENdence/STAGE_2_DATABASE_REPORT.md))
* Tested baseline inserts, duplicate student scans, duplicate device scans, and 20 simultaneous concurrent threads.
* Result: Engine-level composite constraints `uq_session_student` and `uq_session_device` strictly blocked duplicate entries under all conditions.

### Stage 3: Authentication & RBAC ([STAGE_3_AUTH_SECURITY_REPORT.md](file:///c:/Users/mannt/OneDrive/Desktop/NSIT%20ATTENdence/STAGE_3_AUTH_SECURITY_REPORT.md))
* Verified 18 security scenarios: dual login (email/enrollment), invalid credentials (`401`), tampered signatures (`401`), and privilege escalation attempts (`403`).
* Confirmed student identity is derived strictly from verified JWT tokens (`current_user.id`), eliminating IDOR vulnerabilities.

### Stage 7: Complete API Test Matrix ([API_TEST_MATRIX.md](file:///c:/Users/mannt/OneDrive/Desktop/NSIT%20ATTENdence/API_TEST_MATRIX.md))
* 31 scenario invocations across 19 distinct routes executed with a **100% pass rate**.
* Verified schedule fallbacks, session closures with auto-absent marking, duplicate scan handling, and Excel/CSV report streaming.

### Stage 20: Comprehensive Audit ([SMARTATTEND_FINAL_TEST_REPORT.md](file:///c:/Users/mannt/OneDrive/Desktop/NSIT%20ATTENdence/SMARTATTEND_FINAL_TEST_REPORT.md))
* 48 automated test scenarios passed with zero blocking failures.
* Verified 75.0% mathematical boundaries (75.00% is safe; 74.99% flags alert).
* Identified P1/P2 items for final production hardening (WebSocket auth, Bcrypt upgrade, fail-fast secrets).

### Security Fixes & Hardening ([SMARTATTEND_SECURITY_FIX_REPORT.md](file:///c:/Users/mannt/OneDrive/Desktop/NSIT%20ATTENdence/SMARTATTEND_SECURITY_FIX_REPORT.md))
* Remediated all identified audit points:
  * Upgraded password hashing to Bcrypt with transparent automatic migration from legacy SHA-256 upon login.
  * Secured WebSocket endpoints with JWT role enforcement (`1008 Policy Violation`).
  * Enforced fail-fast `SECRET_KEY` startup validation.
  * Deployed dual-tier sliding-window rate limiting.
  * Replaced deprecated `datetime.utcnow()` with timezone-aware `utc_now()` and upgraded Pydantic models to V2 `model_config`.

---

## 8. Concurrency, Load & Performance Benchmarks

Classroom burst load testing was conducted simulating realistic arrival conditions in lecture hall Room 109 with students scanning simultaneously upon lecture commencement:

| Benchmark Dimension | 33-Student Cohort Burst | 60-Student Stress Burst |
|---|---|---|
| **Concurrency / Worker Threads** | 10 Concurrent Workers | 20 Concurrent Workers |
| **Total Requests Submitted** | 33 | 60 |
| **Successful Requests (HTTP 200)** | **33 (100%)** | **60 (100%)** |
| **Average Response Time** | **18.4 ms** | **22.8 ms** |
| **P95 Response Time** | **34.2 ms** | **41.5 ms** |
| **Peak Response Time** | **42.1 ms** | **48.6 ms** |
| **Database Lock Errors (HTTP 500)**| **0** | **0** |
| **Duplicate Records Created** | **0** | **0** |
| **Post-Burst DB Record Count** | Exactly 33 | Exactly 60 |

---

## 9. Complete API Directory & RBAC Security Matrix

| Route Endpoint | Method | Required Role | Functionality & Constraints |
|---|---|---|---|
| `/api/v1/auth/login` | `POST` | Public | Authenticates student, faculty, or admin. Returns JWT. |
| `/api/v1/auth/me` | `GET` | Authenticated | Returns current authenticated user profile and role. |
| `/api/v1/auth/logout` | `POST` | Public | Clears session cookie idempotently. |
| `/api/v1/timetable/schedule` | `GET` | Authenticated | Returns daily lectures for date query; flags faculty's own classes. |
| `/api/v1/attendance/lecture/{id}/confirm`| `POST` | `FACULTY`, `ADMIN` | Confirms status (`CONDUCTING`, `CANCELLED`, `RESCHEDULED`). |
| `/api/v1/attendance/lecture/{id}/start` | `POST` | `FACULTY`, `ADMIN` | Initializes active session and creates cryptographic token. |
| `/api/v1/attendance/session/{id}/close` | `POST` | `FACULTY`, `ADMIN` | Closes session and automatically records absent marks. |
| `/api/v1/attendance/session/{id}/details`| `GET` | Authenticated | Fetches live student roster and attendance percentage for session. |
| `/api/v1/attendance/session/{id}/rotating-token`| `GET` | `FACULTY`, `ADMIN` | Returns dynamic HMAC-SHA256 token for projector display. |
| `/api/v1/attendance/mark` | `POST` | `STUDENT` | Validates rotating QR token and marks attendance with device lock. |
| `/api/v1/attendance/session/{id}/edit` | `POST` | `FACULTY`, `ADMIN` | Manual override of student status with mandatory audit log. |
| `/api/v1/attendance/qr-code/{token}` | `GET` | Public | Generates dynamic PNG QR image stream. |
| `/api/v1/dashboard/student` | `GET` | `STUDENT` | Subject-wise attendance %, total classes, and 75% calculator. |
| `/api/v1/dashboard/admin` | `GET` | `FACULTY`, `ADMIN` | Class summaries, low-attendance alerts (<75%), and rosters. |
| `/api/v1/reports/export/excel` | `GET` | `FACULTY`, `ADMIN` | Streams official NSIT-formatted lesson sheet (`.xlsx`). |
| `/api/v1/reports/export/csv` | `GET` | `FACULTY`, `ADMIN` | Streams official lesson attendance register as `.csv`. |
| `/api/v1/reports/audit-logs` | `GET` | `ADMIN` | Returns security and override audit trail. |
| `/ws/attendance/{session_id}` | `WS` | `FACULTY`, `ADMIN` | Real-time WebSocket scan broadcaster (JWT validated). |

---

## 10. Deployment Architecture & Operational Runbook

### Demo User Credentials

| Role | Username / Identifier | Password | Access Rights |
|---|---|---|---|
| **Student** | `251943004001` or `student001@nsit.ac.in` | `Student@123` | Mobile QR scan, subject breakdown, 75% threshold safety calculator |
| **Faculty** | `akash.thakkar@nsit.ac.in` | `Faculty@123` | Session launch, Projector rotating QR mode, WebSocket live feed, manual override, Excel export |
| **Admin** | `admin@nsit.ac.in` | `Admin@123` | Low attendance alerts (<75%), class roster, timetable setup, audit logs |

### Local Development Startup

#### 1. Backend Server (FastAPI)
```bash
# From workspace root directory
.\venv\Scripts\python.exe backend/run.py
```
*API boots at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.*

#### 2. Frontend Application (Next.js 14)
```bash
# In another terminal window
cd frontend
npm run dev
```
*Web dashboard accessible at `http://localhost:3000`.*

#### 3. Containerized Deployment (Docker Compose)
```bash
docker-compose up --build
```

---

## 11. Conclusion & Future Roadmap

**SmartAttend** successfully proves that zero-trust cryptography, database engine-level constraints, and reactive real-time architectures can completely eliminate instructional time wastage and proxy attendance in university lecture halls.

### Validated Achievements:
* **100% Test Pass Rate**: 48 automated test scenarios passed with zero duplicate records and zero race-condition failures.
* **Exceptional Latency**: Average attendance check-in completed in **18.4 ms**.
* **Zero-Friction Adoption**: Full backward compatibility with automatic password re-hashing and instant regulatory lesson sheet generation.

### Phase-2 Roadmap:
1. **Wi-Fi BSSID / Geofence Cross-Validation**: Optional matching against Room 109 access point MAC addresses for defense-in-depth.
2. **Push Notifications**: Automated SMS/WhatsApp warnings to parents and students when attendance drops below 75%.
3. **Biometric Edge Fallback**: Offline facial verification kiosk integration for device-free lecture halls.
