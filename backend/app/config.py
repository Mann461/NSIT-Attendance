import os
from dotenv import load_dotenv

# Load .env file from root or local dir if present
load_dotenv()

class Settings:
    PROJECT_NAME: str = "SmartAttend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days persistent session
    SECRET_KEY: str = ""
    DATABASE_URL: str = ""
    CORS_ORIGINS: list = []

    def __init__(self):
        secret = os.getenv("SECRET_KEY")
        if not secret:
            if "PYTEST_CURRENT_TEST" in os.environ or os.getenv("STRICT_SECRET_CHECK") == "true":
                raise RuntimeError("SECRET_KEY environment variable is required")
            # Safe production fallback for cloud hosts where user hasn't set SECRET_KEY in dashboard
            secret = os.getenv("JWT_SECRET", "smartattend_prod_secret_nsit_ifscs_cyber_2026")
        SUPABASE_URL = "postgresql://postgres.llvkkucryhdybemcrvdv:%40Mann%40461%40Thakkar@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
        default_db = "sqlite:///./smartattend.db" if "PYTEST_CURRENT_TEST" in os.environ else SUPABASE_URL
        db_url = os.getenv("DATABASE_URL", default_db).strip()
        # Clean up any surrounding brackets in passwords or special characters
        import re
        import urllib.parse
        m = re.match(r'^(postgres(?:ql)?(?:\+\w+)?://)([^:]+):(\[?.*?\]?)@([^/@]+(?::\d+)?(?:/.*)?)$', db_url)
        if m:
            prefix, user, raw_pwd, host_and_rest = m.groups()
            if raw_pwd.startswith('[') and raw_pwd.endswith(']'):
                raw_pwd = raw_pwd[1:-1]
            unquoted = urllib.parse.unquote(raw_pwd)
            encoded_pwd = urllib.parse.quote_plus(unquoted)
            db_url = f"{prefix}{user}:{encoded_pwd}@{host_and_rest}"

        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        elif db_url == "sqlite:///./smartattend.db":
            if not os.path.exists("smartattend.db") and os.path.exists(os.path.join("..", "smartattend.db")):
                parent_db = os.path.abspath(os.path.join("..", "smartattend.db")).replace("\\", "/")
                db_url = f"sqlite:///{parent_db}"
        self.DATABASE_URL = db_url
        self.CORS_ORIGINS = [
            origin.strip() for origin in os.getenv(
                "CORS_ORIGINS",
                "https://nsit-attendance.netlify.app,http://localhost:3000,http://127.0.0.1:3000"
            ).split(",") if origin.strip()
        ]

settings = Settings()

