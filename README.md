# SmartAttend - Timetable-Driven College Attendance Management System

**SmartAttend** is a Phase-1 prototype of a college attendance management platform built for **Narnarayan Shastri Institute of Technology - Institute of Forensic Sciences & Cyber Security (NSIT-IFSCS)**.

Specifically configured for:
- **Class**: B.Tech-M.Tech CSE (Cyber Security), Semester III, Room 109
- **Students**: 33 Students (Roll 001 - 033, Enrollments `251943004001` to `251943004034`)
- **Core Theory Subjects**: 6 Subjects (Maths-3, DSA, DBMS, Python, CO & Microprocessors, Cyber Security)

---

## 🔑 Demo Credentials

| Role | Username / Identifier | Password | Access Level |
|---|---|---|---|
| **Student** | `251943004001` or `student001@nsit.ac.in` | `Student@123` | View attendance %, subject breakdown, QR scan landing |
| **Faculty** | `akash.thakkar@nsit.ac.in` | `Faculty@123` | Conduct/Cancel/Reschedule lectures, QR display, live WebSockets monitor, Record editor, Excel export |
| **Admin** | `admin@nsit.ac.in` | `Admin@123` | Low attendance warning alerts (&lt;75%), Class roster, Subjects, Audit logs |

---

## 🚀 Quick Start Instructions

### Option 1: Running Locally with Python & Node.js

#### 1. Backend Server (FastAPI)
```bash
# From workspace root directory
.\venv\Scripts\python.exe backend/run.py
```
*Backend API will run on `http://localhost:8000` and automatically seed DB on first run.*

#### 2. Frontend Application (Next.js)
```bash
# In another terminal
cd frontend
npm run dev
```
*Frontend will run on `http://localhost:3000`.*

---

### Option 2: Running via Docker Compose

```bash
docker-compose up --build
```

---

## 🛠 Tech Stack & Key Features

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Python FastAPI, SQLAlchemy, Pydantic, Passlib/Bcrypt, PyJWT, Python `qrcode`, `openpyxl`, `pandas`.
- **Database**: PostgreSQL / SQLite with automatic seed populator.
- **Real-Time**: FastAPI WebSockets broadcasting live QR scan events to faculty dashboards and projector mode.
- **Anti-Proxy Constraints**:
  - `UNIQUE(session_id, student_id)` - Enforces 1 attendance record per student per lecture.
  - `UNIQUE(session_id, device_id)` - Server-issued HTTP-only device token prevents 1 device marking multiple students.
- **Timetable Confirmation Engine**: Faculty confirms whether a lecture is **Conducting**, **Cancelled** (with reason, excluded from attendance %), or **Rescheduled**.
- **Excel & CSV Sheet Export**: Generates attendance sheets matching the exact format of official college lesson attendance sheets.
