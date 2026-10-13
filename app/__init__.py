import os
import sys

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_backend_app = os.path.join(_backend_dir, "app")
if os.path.exists(_backend_app):
    __path__.append(_backend_app)
