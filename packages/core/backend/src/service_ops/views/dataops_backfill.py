from .dataops_base import *

from ..envelope import envelope
from vninvest_core.api_envelope import envelope_response

# ---------------------------------------------------------------------------
# B03 — Backfill Progress API
# ---------------------------------------------------------------------------


class BackfillRunListView(SOCBaseView):
    """GET /api/core/v1/operator/scraping/dataops/backfill/runs/ — danh sách run gần nhất."""

    @extend_schema(
        summary='Danh sách lần chạy backfill gần nhất',
        description=(
            'Trả về danh sách BackfillExecutionRun theo thứ tự mới nhất trước. '
            'Hỗ trợ lọc theo status và job_key qua query params.'
        ),
        parameters=[
            OpenApiParameter('status', OpenApiTypes.STR, description='Lọc theo status (running/success/partial/failed)'),
            OpenApiParameter('job_key', OpenApiTypes.STR, description='Lọc theo job_key'),
            OpenApiParameter('limit', OpenApiTypes.INT, description='Số bản ghi tối đa (mặc định 20)'),
        ],
        responses={200: envelope_response(), 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        from ..models import BackfillExecutionRun
        from ..services.backfill_service import BackfillService
        qs = BackfillExecutionRun.objects.all().order_by('-started_at')
        status_filter = request.query_params.get('status', '').strip()
        job_key_filter = request.query_params.get('job_key', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        if job_key_filter:
            qs = qs.filter(job_key=job_key_filter)
        try:
            limit = max(1, min(int(request.query_params.get('limit', 20)), 100))
        except (ValueError, TypeError):
            limit = 20
        runs = list(qs[:limit])
        # F6 — bọc **cả khối** {count, results}; không nhét `results` ra ngoài.
        return envelope({
            'count': len(runs),
            'results': [BackfillService.serialize_run(r) for r in runs],
        })


class BackfillRunDetailView(SOCBaseView):
    """GET /api/core/v1/operator/scraping/dataops/backfill/runs/<run_id>/ — chi tiết một run."""

    @extend_schema(
        summary='Chi tiết một lần chạy backfill',
        description='Trả về BackfillExecutionRun và tất cả BackfillExecutionBatch của run đó.',
        responses={200: envelope_response(), 404: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def get(self, request, run_id):
        from ..models import BackfillExecutionBatch, BackfillExecutionRun
        from ..services.backfill_service import BackfillService
        try:
            run = BackfillExecutionRun.objects.get(run_id=run_id)
        except BackfillExecutionRun.DoesNotExist:
            return Response({'detail': 'Không tìm thấy run.'}, status=status.HTTP_404_NOT_FOUND)
        batches = list(BackfillExecutionBatch.objects.filter(run=run).order_by('batch_index'))
        data = BackfillService.serialize_run(run)
        data['batches'] = [BackfillService.serialize_batch(b) for b in batches]
        return envelope(data)


# B07 — Operator manual trigger with explicit mode
_B07_ALLOWED_MODES = frozenset({
    'daily_delta',
    'repair_missing',
    'deep_bootstrap',
    'targeted_symbol_repair',
})


class BackfillRunNowView(SOCBaseView):
    """POST /dataops/backfill/run-now/ — Operator manual trigger.

    Yêu cầu mode rõ ràng. Force refresh là override explicit (requires force_refresh=true).
    Body JSON:
      {
        "mode": "repair_missing",          # bắt buộc, một trong 4 canonical modes
        "symbols": ["VCB", "FPT"],         # tùy chọn; null = all active symbols
        "days": 30,                        # tùy chọn; mặc định 30
        "force_refresh": false             # tùy chọn; mặc định false
      }
    """

    def post(self, request):
        import json as _json
        from ..services.backfill_service import BackfillService

        try:
            body = _json.loads(request.body or b'{}')
        except Exception:
            return self.error_response(request, 'invalid_json', 'Body không phải JSON hợp lệ.', http_status=400)

        mode = str(body.get('mode') or '').strip()
        if not mode:
            return self.error_response(
                request, 'mode_required',
                f'Trường mode bắt buộc. Các mode hợp lệ: {sorted(_B07_ALLOWED_MODES)}',
                http_status=400,
            )
        if mode not in _B07_ALLOWED_MODES:
            return self.error_response(
                request, 'invalid_mode',
                f'Mode "{mode}" không hợp lệ. Các mode hợp lệ: {sorted(_B07_ALLOWED_MODES)}',
                http_status=400,
            )

        symbols = body.get('symbols') or None
        if symbols is not None:
            if not isinstance(symbols, list):
                return self.error_response(request, 'symbols_must_be_list', 'symbols phải là danh sách string.', http_status=400)
            symbols = [str(s).strip().upper() for s in symbols if s]
            if not symbols:
                symbols = None

        days = int(body.get('days') or 30)

        try:
            result = BackfillService.trigger_backfill(
                mode=mode,
                symbols=symbols,
                days=days
            )
        except Exception as exc:
            return self.error_response(request, 'enqueue_failed', str(exc), http_status=500)

        return envelope(result, status=202)