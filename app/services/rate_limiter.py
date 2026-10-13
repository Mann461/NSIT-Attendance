import time
import threading
from collections import defaultdict, deque
from typing import Tuple, Optional

class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Supports both per-user and per-IP rate limiting designed
    specifically for classroom burst attendance scenarios.
    """
    def __init__(self):
        self._lock = threading.Lock()
        # key -> deque of monotonic timestamps
        self._history = defaultdict(deque)

    def is_allowed(self, key: str, max_requests: int, window_seconds: float) -> Tuple[bool, float]:
        """
        Check if an action is allowed under the rate limit.
        Returns:
            (allowed: bool, retry_after_seconds: float)
        """
        now = time.monotonic()
        with self._lock:
            queue = self._history[key]
            cutoff = now - window_seconds
            
            # Evict timestamps outside the active window
            while queue and queue[0] <= cutoff:
                queue.popleft()
            
            if len(queue) >= max_requests:
                # Rate limit exceeded; compute retry after
                oldest = queue[0]
                retry_after = max(0.1, round(window_seconds - (now - oldest), 1))
                return False, retry_after
            
            # Record current request timestamp
            queue.append(now)
            return True, 0.0

    def reset(self, key: Optional[str] = None):
        """Reset history for a key or all keys (useful for testing)."""
        with self._lock:
            if key:
                self._history.pop(key, None)
            else:
                self._history.clear()

# Global singleton rate limiter instance
attendance_rate_limiter = SlidingWindowRateLimiter()

# Configured thresholds:
# Per Student: 10 requests per 30 seconds (allows retries/duplicate taps, blocks script spamming)
USER_MAX_REQUESTS = 10
USER_WINDOW_SECONDS = 30.0

# Per IP (Classroom Wi-Fi NAT): 180 requests per 60 seconds (allows 60-100 students on same IP)
IP_MAX_REQUESTS = 180
IP_WINDOW_SECONDS = 60.0
