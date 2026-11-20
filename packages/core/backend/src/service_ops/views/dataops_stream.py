"""
SOC DataOps SSE stream — P1-1 realtime (F-REAL-05).

GET /api/soc/dataops/stream/?ticket=

Auth: SOCBaseView (IsAuthenticated + IsAdminUser). Ticket single-use (?ticket=)
cho EventSource không gửi được Authorization header; ?token= chi de tuong thich.

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
import logging
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

logger = logging.getLogger(__name__)


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
    """GET /api/soc/dataops/stream/ — SSE realtime for Monitor tab."""

    throttle_classes = [SOCStreamThrottle]

    def initial(self, request, *args, **kwargs):
        # C-01: EventSource không gửi được Authorization header → ưu tiên
        # ?ticket= single-use (human-only). request.auth giữ None = human semantics.
        ticket_ok = False
        ticket = request.query_params.get("ticket") or request.GET.get("ticket")
        if ticket and not request.META.get("HTTP_AUTHORIZATION"):
            try:
                from django.contrib.auth import get_user_model

                from identity_access.ws_ticket import redeem_ws_ticket, strip_machine_privileges

                payload = redeem_ws_ticket(ticket)
                if payload:
                    request.user = strip_machine_privileges(
                        get_user_model().objects.get(pk=payload["user_id"]), payload,
                    )
                    ticket_ok = True
            except Exception:
                pass
        # Tương thích: ?token= cho client cũ — log cảnh báo, sẽ bỏ sau 1 tuần.
        token = request.query_params.get("token") or request.GET.get("token")
        if not ticket_ok and token and not request.META.get("HTTP_AUTHORIZATION"):
            logger.warning("sse_token_query_deprecated: DataOpsStreamView van nhan ?token=")
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
