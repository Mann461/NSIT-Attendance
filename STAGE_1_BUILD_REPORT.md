# Stage 1 — Build & Environment Test Report

**Overall Status**: **PASS** (with minor runtime warnings)  
**Date**: September 14, 2026  
**Auditor**: Senior DevSecOps / QA Engineer  

---

## 1. Test Matrix Summary

| Component | Test Item | Status | Details |
|---|---|---|---|
| **Python Environment** | Dependency Resolution | **PASS** | `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `jose`, `openpyxl`, `pandas`, `qrcode` installed and functional |
| **Node.js Environment**| Dependency Resolution | **PASS** | Next.js 14, TypeScript 5, React 18, Tailwind CSS, html5-qrcode installed |
| **Database Connection**| SQLite Engine Init | **PASS** | Connected with PRAGMA WAL mode & busy timeout 30000ms |
| **Database Migration** | Automatic DDL Sync | **PASS** | `Base.metadata.create_all` generates all 11 tables without schema errors |
| **Seed Execution** | `seed_database()` | **PASS** | Successfully seeds Admin, 6 Faculty, 33 Students, 10 Subjects, Timetable entries & historical records |
| **Backend Startup** | FastAPI App Initialization | **PASS** | App boots clean with `/docs` OpenAPI schema available |
| **Frontend Dev/Build** | Next.js Production Build | **PASS** | Compiled all 8 routes (`/`, `admin`, `attendance/[token]`, `faculty`, `faculty/projector/[sessionId]`, `login`, `student`, `_not-found`) |

---

## 2. Identified Warnings & Deprecations

### 1. Pydantic V2 Configuration Style
- **Status**: `WARNING`
- **Component**: `backend/app/schemas/pydantic_models.py`
- **Log**: `PydanticDeprecatedSince20: Support for class-based Config is deprecated, use ConfigDict instead.`
- **Root Cause**: `UserResponse`, `StudentResponse`, and `FacultyResponse` use `class Config: orm_mode = True` rather than `model_config = ConfigDict(from_attributes=True)`.
- **Recommended Fix**: Update Pydantic schemas to Pydantic v2 `ConfigDict(from_attributes=True)`.

### 2. Python `datetime.datetime.utcnow()` Deprecation
- **Status**: `WARNING`
- **Component**: `schema.py`, `attendance_service.py`, `security.py`
- **Log**: `DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in Python 3.14+`
- **Root Cause**: Standard library deprecation in modern Python.
- **Recommended Fix**: Migrate to `datetime.datetime.now(datetime.timezone.utc)`.

### 3. SQLAlchemy `declarative_base()` Import Location
- **Status**: `WARNING`
- **Component**: `backend/app/database.py:28`
- **Log**: `MovedIn20Warning: The declarative_base() function is now available as sqlalchemy.orm.declarative_base()`
- **Recommended Fix**: Import directly from `sqlalchemy.orm`.

---

## 3. Conclusion
The environment builds, initializes, seeds, and compiles cleanly with zero blocking failures.
