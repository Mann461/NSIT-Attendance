import os

class Settings:
    PROJECT_NAME: str = "SmartAttend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret Key for JWT Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smartattend_super_secret_jwt_key_2026_nsit")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days persistent session
    
    # Database configuration (SQLite default, PostgreSQL supported)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./smartattend.db"
    )

settings = Settings()
