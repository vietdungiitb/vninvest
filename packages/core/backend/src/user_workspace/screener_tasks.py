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

        # P2.4: create server history (same shape as sync path) + new_symbols alert
        try:
            from django.contrib.auth import get_user_model as _get_user
            from user_workspace.models import ScreenerRule as _Rule, ScreenerRunHistory as _Hist

            _user = _get_user().objects.filter(pk=user_id).first()
            _rule = _Rule.objects.filter(pk=rule_id).first()
            _tenant = getattr(_rule, 'tenant', None) if _rule else None
            if tenant_id and _rule is None:
                pass
            prev_symbols = set()
            if _rule is not None:
                _prev = (
                    _Hist.objects.filter(user_id=user_id, rule_id=rule_id)
                    .order_by('-run_at')
                    .first()
                )
                if _prev and isinstance(_prev.matched, list):
                    prev_symbols = {str(r.get('symbol')) for r in _prev.matched if isinstance(r, dict) and r.get('symbol')}
            new_symbols = sorted({str(r.get('symbol')) for r in matched if r.get('symbol')} - prev_symbols)
            if _user is not None and _tenant is not None:
                _rows = []
                for r in matched[:100]:
                    _adv = r.get('ai_advisory') or {}
                    _rows.append(
                        {
                            'symbol': r.get('symbol'),
                            'close': r.get('close'),
                            'action': _adv.get('strategy_action'),
                            'score': _adv.get('ai_score_0_100'),
                        }
                    )
                _Hist.objects.create(
                    user=_user,
                    tenant=_tenant,
                    rule=_rule,
                    rule_name=getattr(_rule, 'name', f'rule-{rule_id}'),
                    matched_count=len(matched),
                    total_scanned=total_scanned,
                    window_days=window_days,
                    session_date=session_date,
                    matched=_rows,
                    params={'sort': 'ai_score', 'order': 'desc', 'include_ai': int(bool(include_ai)), 'via': 'task'},
                )
                if new_symbols:
                    _alerts_key = f"screener:sched_alerts:{user_id}"
                    try:
                        _alerts = dj_cache.get(_alerts_key) or []
                        if not isinstance(_alerts, list):
                            _alerts = []
                        _alerts.insert(
                            0,
                            {
                                'rule_id': rule_id,
                                'rule_name': getattr(_rule, 'name', f'rule-{rule_id}'),
                                'run_at': session_date.isoformat(),
                                'new_symbols': new_symbols[:50],
                                'matched_count': len(matched),
                                'job_id': job_id,
                            },
                        )
                        dj_cache.set(_alerts_key, _alerts[:50], timeout=7 * 24 * 3600)
                    except Exception:
                        logger.exception("screener task: push sched alert failed")
        except Exception:
            logger.exception("screener task: create history/alert failed")

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


@shared_task(name="user_workspace.screener_tasks.screener_scheduled_run", bind=True, max_retries=0)
def screener_scheduled_run(self):
    """P2.4 beat (5m): run due ScreenerSchedule entries (next_run_at <= now).

    For each due schedule: enqueue run_screener_scan_task per rule (snapshot),
    update last_run_at/next_run_at. Email channel is a residual (in_app only).
    """
    from django.utils import timezone

    from user_workspace.models import ScreenerRule, ScreenerSchedule, _compute_next_run

    now = timezone.now()
    from django.db.models import Q as _Q

    due = list(ScreenerSchedule.objects.filter(is_active=True).filter(_Q(next_run_at__lte=now) | _Q(next_run_at__isnull=True)))
    ran = 0
    for sched in due:
        try:
            rule_ids = sched.rule_ids if isinstance(sched.rule_ids, list) else []
            # Latest session date for snapshot
            try:
                from market_serving.models import SymbolSnapshot as _Snap

                _latest = _Snap.objects.order_by('-session_date').first()
                _session_iso = _latest.session_date.isoformat() if _latest and _latest.session_date else now.date().isoformat()
            except Exception:
                _session_iso = now.date().isoformat()
            for rid in rule_ids:
                try:
                    rule = ScreenerRule.objects.filter(pk=int(rid), user=sched.user).first()
                    if rule is None:
                        continue
                    try:
                        _uts = int(rule.updated_at.timestamp()) if getattr(rule, 'updated_at', None) else 0
                    except Exception:
                        _uts = 0
                    import uuid as _uuid

                    _jid = _uuid.uuid4().hex
                    run_screener_scan_task.delay(
                        sched.user_id,
                        sched.tenant_id,
                        rule.id,
                        {"rules_json": rule.rules_json, "updated_at_ts": _uts},
                        _session_iso,
                        1,
                        _jid,
                    )
                    ran += 1
                except Exception:
                    logger.exception("screener scheduled: enqueue rule %s failed", rid)
            sched.last_run_at = now
            try:
                sched.next_run_at = _compute_next_run(sched.run_time, sched.weekdays)
            except Exception:
                from datetime import timedelta as _td

                sched.next_run_at = now + _td(days=1)
            sched.save(update_fields=['last_run_at', 'next_run_at'])
        except Exception:
            logger.exception("screener scheduled: schedule %s failed", getattr(sched, 'id', '?'))
    return {"ok": True, "schedules_due": len(due), "jobs_enqueued": ran}
