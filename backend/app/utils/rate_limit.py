"""Tiny in-memory sliding-window rate limiter to guard against accidental API overspend.

Per-process only: it resets on restart and isn't shared across instances. That is fine for a
single small Render instance; a shared store (e.g. Redis) would be needed to scale out.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Request, status

from app.errors import AppError


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int, clock=time.monotonic):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        if self.max_requests <= 0:
            return  # disabled
        now = self._clock()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window_seconds:
                hits.popleft()
            if len(hits) >= self.max_requests:
                retry_after = int(self.window_seconds - (now - hits[0])) + 1
                raise AppError(
                    "rate_limited",
                    f"Too many requests. Please wait {retry_after}s and try again.",
                    status.HTTP_429_TOO_MANY_REQUESTS,
                )
            hits.append(now)
            if len(self._hits) > 10_000:  # bound memory: drop idle clients
                for stale in [k for k, v in self._hits.items() if not v]:
                    del self._hits[stale]


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"
