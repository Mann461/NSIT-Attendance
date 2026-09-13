# Stage 3 — Authentication & Authorization Security Report

**Overall Status**: **PASS**  
**Date**: September 14, 2026  
**Auditor**: Senior Application Security Engineer  

---

## 1. Authentication Test Results

| Test ID | Test Scenario | Input / Vector | Expected HTTP Status | Actual HTTP Status | Result |
|---|---|---|---|---|---|
| **AUTH-01** | Faculty Login | `akash.thakkar@nsit.ac.in` / `Faculty@123` | `200 OK` | `200 OK` | **PASS** |
| **AUTH-02** | Student Login (Enrollment) | `251943004001` / `Student@123` | `200 OK` | `200 OK` | **PASS** |
| **AUTH-03** | Student Login (Email) | `student001@nsit.ac.in` / `Student@123` | `200 OK` | `200 OK` | **PASS** |
| **AUTH-04** | Admin Login | `admin@nsit.ac.in` / `Admin@123` | `200 OK` | `200 OK` | **PASS** |
| **AUTH-05** | Invalid Password | Valid Email + `WrongPassword!` | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **AUTH-06** | Non-existent User | `ghost@nsit.ac.in` + `Student@123` | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **AUTH-07** | Empty Credentials | `""` / `""` | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **AUTH-08** | Expired JWT Token | JWT with negative delta `exp` | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **AUTH-09** | Tampered JWT Signature | Altered signature bytes | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **AUTH-10** | Unauthenticated Request | Request `/dashboard/student` with no auth | `401 Unauthorized` | `401 Unauthorized` | **PASS** |

---

## 2. Authorization & RBAC Test Results

| Test ID | Security Vector | User Role | Target Endpoint | Expected Status | Actual Status | Result |
|---|---|---|---|---|---|---|
| **RBAC-01** | Privilege Escalation | `STUDENT` | `POST /attendance/lecture/{id}/start` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **RBAC-02** | Session Manipulation | `STUDENT` | `POST /attendance/session/{id}/close` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **RBAC-03** | Unauthorized Edit | `STUDENT` | `POST /attendance/session/{id}/edit` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **RBAC-04** | Admin Portal Access | `STUDENT` | `GET /dashboard/admin` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **RBAC-05** | Audit Logs Snooping | `STUDENT` | `GET /reports/audit-logs` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **RBAC-06** | Audit Logs Access | `FACULTY` | `GET /reports/audit-logs` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **RBAC-07** | Authorized Audit View | `ADMIN` | `GET /reports/audit-logs` | `200 OK` | `200 OK` | **PASS** |
| **RBAC-08** | Student Marking As Faculty | `FACULTY` | `POST /attendance/mark` | `403 Forbidden` | `403 Forbidden` | **PASS** |

---

## 3. IDOR & Access Control Analysis
1. **IDOR Prevention on Student Dashboard**: `/dashboard/student` extracts the student's ID directly from the authenticated session context (`current_user.id`), eliminating any route parameter IDOR vulnerability.
2. **IDOR Prevention on Attendance Mark**: When calling `POST /attendance/mark`, the student ID is not accepted in the JSON body; it is strictly pulled from the verified JWT token (`current_user.id`).
3. **Password Storage Notice**: Passwords use salted SHA-256 with a static application salt. While portable, industry best practice for production is Argon2id or Bcrypt with per-user dynamic salts and adaptive cost factors.
