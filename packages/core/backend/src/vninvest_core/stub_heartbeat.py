import json
import os
import time
from datetime import datetime, UTC
from pathlib import Path


def _now_isoformat():
    return datetime.now(UTC).isoformat()


def _health_file(default_path):
    return Path(os.getenv("CORE_STUB_HEALTH_FILE", default_path))


def _health_max_age_seconds(default_seconds=90.0):
    try:
        return float(os.getenv("CORE_STUB_HEALTH_MAX_AGE_SECONDS", str(default_seconds)))
    except (TypeError, ValueError):
        return default_seconds


def write_heartbeat(service_name, interval_seconds, event, default_path):
    health_file = _health_file(default_path)
    health_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "ok": True,
        "service": service_name,
        "environment": os.getenv("CORE_ENV", "foundation"),
        "state": "running",
        "event": event,
        "pid": os.getpid(),
        "interval_seconds": interval_seconds,
        "updated_at": _now_isoformat(),
    }
    health_file.write_text(json.dumps(payload), encoding="utf-8")
    return health_file


def run_healthcheck(default_path):
    health_file = _health_file(default_path)
    max_age_seconds = _health_max_age_seconds()
    if not health_file.exists():
        raise SystemExit(1)
    if time.time() - health_file.stat().st_mtime > max_age_seconds:
        raise SystemExit(1)
    raise SystemExit(0)