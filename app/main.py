import os
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.api.v1.router import api_router
from app.services.seed_service import seed_database
from app.websocket.manager import ws_manager
from app.auth.security import decode_access_token
from app.models.schema import User, UserRole, AttendanceSession

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">> SmartAttend initializing database...", flush=True)
    try:
        Base.metadata.create_all(bind=engine)
        print(">> Database tables verified.", flush=True)
        db = SessionLocal()
        try:
            seed_database(db)
            print(">> Database seeding verified.", flush=True)

            # Purge any legacy sample/mock lectures from active database
            import datetime
            from app.models.schema import ScheduledLecture, AttendanceSession, AttendanceRecord
            old_lecs = db.query(ScheduledLecture).filter(ScheduledLecture.date < datetime.date(2026, 10, 1)).all()
            if old_lecs:
                old_ids = [l.id for l in old_lecs]
                old_sess = db.query(AttendanceSession).filter(AttendanceSession.scheduled_lecture_id.in_(old_ids)).all()
                old_sess_ids = [s.id for s in old_sess]
                if old_sess_ids:
                    db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(old_sess_ids)).delete(synchronize_session=False)
                    db.query(AttendanceSession).filter(AttendanceSession.id.in_(old_sess_ids)).delete(synchronize_session=False)
                db.query(ScheduledLecture).filter(ScheduledLecture.id.in_(old_ids)).delete(synchronize_session=False)
                db.commit()
                print(f">> Purged {len(old_ids)} past sample lectures from active database.", flush=True)
        except Exception as seed_err:
            print(f">> Startup warning during database seeding or purge: {seed_err}", flush=True)
        finally:
            db.close()
    except Exception as db_err:
        print(f">> Startup warning during database initialization: {db_err}", flush=True)
    print(">> SmartAttend startup complete. Ready to serve requests.", flush=True)
    yield
    print(">> SmartAttend shutting down.", flush=True)

from fastapi.responses import JSONResponse
import traceback

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Global error handler ensuring CORS headers are always present
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    err_trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    print(f">> Unhandled exception at {request.url.path}: {err_trace}", flush=True)
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error or server exception", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# FIX 11: Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self)"
    return response

# FIX 7: Explicit CORS restriction
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.netlify\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs"
    }

@app.get("/health")
def health(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
        user_count = db.query(User).count()
        return {
            "status": "healthy",
            "database": "connected",
            "database_type": settings.DATABASE_URL.split("://")[0],
            "users_count": user_count
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "error",
            "error": str(e),
            "database_type": settings.DATABASE_URL.split("://")[0]
        }

# FIX 1: Secure WebSocket Endpoint with JWT & Role Verification
@app.websocket("/ws/attendance/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: int,
    token: Optional[str] = Query(None)
):
    # Extract token from query param, cookies, or headers
    auth_token = token or websocket.cookies.get("smartattend_session")
    if not auth_token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ")[1]

    if not auth_token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required")
        return

    payload = decode_access_token(auth_token)
    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    db = SessionLocal()
    try:
        user_id = int(payload["sub"])
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not found")
            return

        if user.role not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Only faculty/admin authorized to monitor session")
            return

        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Session not found")
            return
    finally:
        db.close()

    # User is authenticated and authorized; accept connection
    await ws_manager.connect(websocket, session_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, session_id)

