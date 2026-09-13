"""
screener_tasks.py — P1.4 celery task cho scan dài (Entry 77).

- Input snapshot rule để không lệch nếu user sửa rule giữa chừng (plan §5a).
- Progress mỗi 200 mã qua Django cache job_key.
- Xong → cache scan-key P1.2 + job completed (không nhúng full matched vào job — FE fetch lại via POST sync hit).
- Route vào manual_on_demand (queue_policy).
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.core.cache import cache as dj_cache

logger = logging.getLogger(__name__)


@shared_task(name="user_workspace.screener_tasks.run_screener_scan_task", bind=True, max_retries=0)
def run_screener_scan_task(
    self,
    user_id: int,
    tenant_id,
    rule_id: int,
    rule_snapshot: dict,
    session_date_iso: str,
    include_ai: int,
    job_id: str,
):
    """Execute scan synchronously (or via worker) and populate caches.

    rule_snapshot: {"rules_json": [...], "updated_at_ts": int}
    session_date_iso: "YYYY-MM-DD"
    include_ai: 0/1
    job_id: uuid4 string for status tracking
    """
    from datetime import date as date_cls

    job_key = f"screener:job:{job_id}"
    jobs_set_key = f"screener:jobs:{user_id}"

    def _set_job(payload: dict, timeout: int = 3600):
        try:
            dj_cache.set(job_key, payload, timeout=timeout)
        except Exception:
            logger.exception("screener task: set job_key failed %s", job_key)

    try:
        # Mark running
        _set_job({"status": "running", "scanned": 0, "total": 0, "job_id": job_id})

        # Parse snapshot
        conditions = rule_snapshot.get("rules_json") if isinstance(rule_snapshot, dict) else []
        if not isinstance(conditions, list):
            conditions = []
        updated_ts = rule_snapshot.get("updated_at_ts") if isinstance(rule_snapshot, dict) else 0

        # Parse session_date
        try:
            session_date = date_cls.fromisoformat(session_date_iso)
        except Exception:
            session_date = date_cls.today()

        # Reuse _compute_scan (import lazily to avoid circular)
        from user_workspace.portfolio_analytics_views import _compute_scan, _scan_cache_key
        from user_workspace.models import ScreenerRule

        # For progress simulation: we don't have per-200 hook in _compute_scan yet,
        # so we set running once, then compute, then completed.
        # Future: inject progress callback into _compute_scan loop.

        # Compute full scan (unsorted)
        # Note: _compute_scan internally recomputes window_days and scans DB.
        matched, total_scanned, missing_counts, window_days = _compute_scan(
            conditions, session_date, bool(include_ai)
        )

        # Build scan cache key matching view's Option B (no sort/order)
        # Need a rule-like object with id and updated_at
        class _RuleStub:
            def __init__(self, rid, ts):
                self.id = rid
                if ts:
                    from datetime import datetime, timezone as dt_tz
                    self.updated_at = datetime.fromtimestamp(int(ts), tz=dt_tz.utc)
                else:
                    self.updated_at = None

        rule_stub = _RuleStub(rule_id, updated_ts)
        # session_date is already date object
        try:
            from django.conf import settings as dj_settings
            scan_ttl = getattr(dj_settings, "SCREENER_SCAN_CACHE_TTL", 14400)
        except Exception:
            scan_ttl = 14400

        try:
            scan_key = _scan_cache_key(user_id, rule_stub, session_date, bool(include_ai))
            dj_cache.set(
                scan_key,
                {
                    "matched": matched,
                    "total_scanned": total_scanned,
                    "missing_counts": dict(missing_counts),
                },
                timeout=scan_ttl,
            )
        except Exception:
            logger.exception("screener task: set scan_key failed")

        # Mark completed with result_meta (no full matched — FE will fetch via sync hit)
        _set_job(
            {
                "status": "completed",
                "scanned": total_scanned,
                "total": total_scanned,
                "job_id": job_id,
                "result_meta": {
                    "matched_count": len(matched),
                    "total_scanned": total_scanned,
                    "window_days": window_days,
                    "session_date": session_date.isoformat(),
                },
            }
        )
        return {"ok": True, "matched_count": len(matched), "total_scanned": total_scanned}

    except Exception as exc:
        logger.exception("screener task failed job %s", job_id)
        _set_job({"status": "failed", "error": str(exc), "job_id": job_id})
        raise
    finally:
        # Remove from pending set
        try:
            raw = dj_cache.get(jobs_set_key)
            if isinstance(raw, set) and job_id in raw:
                raw.remove(job_id)
                dj_cache.set(jobs_set_key, raw, timeout=3600)
            elif isinstance(raw, list) and job_id in raw:
                raw.remove(job_id)
                dj_cache.set(jobs_set_key, raw, timeout=3600)
        except Exception:
            pass
