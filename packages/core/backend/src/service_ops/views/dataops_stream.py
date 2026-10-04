"""
SOC DataOps SSE stream — P1-1 realtime (F-REAL-05).

GET /operator/soc/dataops/stream/?token=

Auth: SOCBaseView (IsAuthenticated + IsAdminUser). Token via ?token= fallback
cho EventSource không gửi được Authorization header (pattern signals/overview_stream).

SSE wire:
  retry: 3000
  : ping
  event: dataops
  data: {"observability":{...},"coverage":{...},"queue_tiers":{...},"generated_at":"..."}

Nguồn: build_market_data_observability_summary + build_global_coverage_summary
      + build_market_data_queue_tier_snapshot (poll DB 5s, throttled).
Chỉ emit khi signature đổi (backlog/fail_rates/parity/coverage hash).
"""

import json
import time

from django.db import close_old_connections, connection
from django.http import StreamingHttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema

from market_data.global_symbol_coverage import build_global_coverage_summary

from ..dataops_market_data import (
    build_market_data_observability_summary,
    build_market_data_queue_tier_snapshot,
)
from .base import SOCBaseView
from .signals_stream import SOCStreamThrottle, _sse_format


def _build_dataops_snapshot():
    observability = build_market_data_observability_summary()
    coverage = build_global_coverage_summary(top_gap_limit=10)
    tiers, tiers_updated = build_market_data_queue_tier_snapshot(example_limit=5)
    return {
        "generated_at": timezone.now().isoformat(),
        "observability": observability,
        "coverage": coverage,
        "queue_tiers": {"tiers": tiers, "updated_at": tiers_updated.isoformat() if hasattr(tiers_updated, "isoformat") else str(tiers_updated)},
    }


def _dataops_signature(snap: dict) -> str:
    try:
        obs = snap.get("observability") or {}
        cov = snap.get("coverage") or {}
        tiers = snap.get("queue_tiers") or {}
        backlog = obs.get("backlog") or {}
        fail_rates = obs.get("fail_rates") or {}
        # Slice G (QueueRecovery, audit C-4): hash cả queue_depths — nếu không, SSE không emit
        # khi depth đổi và card Depth đứng im trong khi stream mở.
        queue_depths = obs.get("queue_depths") or {}
        # hash relevant parts
        parts = [
            json.dumps(backlog, sort_keys=True, default=str),
            json.dumps(fail_rates, sort_keys=True, default=str),
            json.dumps(queue_depths, sort_keys=True, default=str),
            json.dumps(cov.get("datasets") or [], sort_keys=True, default=str),
            json.dumps([g.get("freshness_state") for g in (cov.get("top_gaps") or [])[:5]], sort_keys=True),
            json.dumps(tiers.get("tiers") or [], sort_keys=True, default=str),
        ]
        return "|".join(parts)
    except Exception:
        return json.dumps(snap, sort_keys=True, default=str)


class DataOpsStreamView(SOCBaseView):
    """GET /operator/soc/dataops/stream/ — SSE realtime for Monitor tab."""

    throttle_classes = [SOCStreamThrottle]

    def initial(self, request, *args, **kwargs):
        token = request.query_params.get("token") or request.GET.get("token")
        if token and not request.META.get("HTTP_AUTHORIZATION"):
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
            try:
                from identity_access.authentication import CorePATAuthentication

                pat_auth = CorePATAuthentication()
                user_auth = pat_auth.authenticate(request)
                if user_auth is not None:
                    request.user, request.auth = user_auth
            except Exception:
                pass
        return super().initial(request, *args, **kwargs)

    @extend_schema(exclude=True)
    def get(self, request):
        import sys

        testing = "test" in sys.argv
        max_loops = int(request.query_params.get("max_loops") or 0) or None

        def event_stream():
            yield _sse_format(retry=3000)
            last_sig = None
            last_hb = time.time()
            start = time.time()
            loops = 0
            while True:
                loops += 1
                if max_loops is not None and loops > max_loops:
                    break
                if not testing and time.time() - start > 3600:
                    break
                try:
                    # Guarded: `close_old_connections()` inside an atomic block
                    # closes the live connection (Django compares
                    # `get_autocommit()` to `settings_dict['AUTOCOMMIT']`), so the
                    # next query dies with `OperationalError: the connection is
                    # closed`. Outside atomic blocks the ORM reopens by itself.
                    if not connection.in_atomic_block:
                        close_old_connections()
                    snap = _build_dataops_snapshot()
                    sig = _dataops_signature(snap)
                    if sig != last_sig:
                        yield _sse_format(event="dataops", data=snap, sse_id=str(loops))
                        last_sig = sig
                        last_hb = time.time()
                    else:
                        if testing or time.time() - last_hb >= 15:
                            yield _sse_format(comment="ping")
                            last_hb = time.time()
                except GeneratorExit:
                    break
                except Exception:
                    try:
                        yield _sse_format(comment="ping")
                    except GeneratorExit:
                        break
                if testing and max_loops is not None:
                    continue
                try:
                    time.sleep(5)
                except Exception:
                    break

        resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"
        resp["Connection"] = "keep-alive"
        return resp
