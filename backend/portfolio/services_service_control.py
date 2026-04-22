# services_service_control.py
"""Utility module for the Crawling Control Plane.
Provides a Redis-based distributed lock to guarantee that a given
CrawlJob is not executed concurrently (anti-overlap guard).
The lock handles token-safe release using the Celery task ID.
"""

import time
from django.conf import settings
from redis import Redis

# Initialise a Redis client
_REDIS_CLIENT = Redis.from_url(getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0"))

_LOCK_TTL = getattr(settings, "CRAWL_JOB_LOCK_TTL_SECONDS", 60 * 60)  # 1 hour default


def _lock_key(job_id: int) -> str:
    """Return the Redis key for a given CrawlJob ID."""
    return f"crawl_job_lock:{job_id}"


class TokenSafeLock:
    def __init__(self, job_id: int, token: str):
        self.job_id = job_id
        self.token = token

    def release(self):
        force_release_job_lock(self.job_id, self.token)


def acquire_job_lock(job_id: int, task_id: str, timeout: int = 10):
    """Attempt to acquire a token-safe lock for *job_id* using *task_id*.
    
    Returns the lock object if acquired, None otherwise.
    """
    key = _lock_key(job_id)
    start = time.time()
    
    while True:
        if _REDIS_CLIENT.set(key, task_id, ex=_LOCK_TTL, nx=True):
            return TokenSafeLock(job_id, task_id)
            
        if time.time() - start >= timeout:
            return None
        time.sleep(0.5)


def release_job_lock(lock) -> None:
    """Release the acquired lock object safely."""
    if lock:
        lock.release()

def force_release_job_lock(job_id: int, task_id: str) -> None:
    """Force release the lock ONLY IF the current token matches task_id."""
    script = """
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    else
        return 0
    end
    """
    try:
        _REDIS_CLIENT.eval(script, 1, _lock_key(job_id), task_id)
    except Exception:
        pass
