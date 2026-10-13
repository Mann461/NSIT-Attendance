import os
import sys

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_actual_main_file = os.path.join(_backend_dir, "app", "main.py")
with open(_actual_main_file, "r", encoding="utf-8") as f:
    _code = f.read()

exec(compile(_code, _actual_main_file, "exec"), globals())
