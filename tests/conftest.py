import os
import sys

# Ensure backend is on sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Ensure required environment variables exist during testing
os.environ.setdefault("SECRET_KEY", "smartattend_test_jwt_secret_key_pytest_conftest_2026")
os.environ.setdefault("CORS_ORIGINS", "https://nsit-attendance.netlify.app,http://localhost:3000,http://127.0.0.1:3000")
os.environ.setdefault("DATABASE_URL", "sqlite:///./smartattend.db")
