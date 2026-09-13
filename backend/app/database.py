from datetime import datetime, timezone, timedelta, date
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Indian Standard Time (IST, UTC+5:30) for NSIT college schedule
IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

def current_ist_date() -> date:
    """Returns current date in Indian Standard Time (IST, UTC+5:30)."""
    return datetime.now(timezone.utc).astimezone(IST_TIMEZONE).date()

def utc_now() -> datetime:
    """Returns timezone-safe UTC datetime compatible with SQLite and Postgres."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import event
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
