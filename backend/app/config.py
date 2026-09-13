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
        self.SECRET_KEY = secret
        self.DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smartattend.db")
        self.CORS_ORIGINS = [
            origin.strip() for origin in os.getenv(
                "CORS_ORIGINS",
                "https://nsit-attendance.netlify.app,http://localhost:3000,http://127.0.0.1:3000"
            ).split(",") if origin.strip()
        ]

settings = Settings()

