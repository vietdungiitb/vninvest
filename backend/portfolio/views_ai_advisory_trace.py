from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


def _build_advisory_trace_payload_for_user(
    *,
    user,
    symbol: str,
    advisory_id: int | None,
    snapshot_id: int | None,
    max_logs: int,
    audit_reason: str = '',
    audit_actor: str = '',
    audit_start_at=None,
    audit_end_at=None,
    strict_after_state: bool = False,
) -> dict:
    legacy_views = _legacy_views_module()
    advisory = None
    snapshot = None

    if advisory_id is not None:
        advisory = (
            legacy_views.WhaleAdvisory.objects.select_related('aggregate_snapshot')
            .filter(id=advisory_id, user=user, symbol=symbol)
            .first()
        )
        if advisory is None:
            return {'ok': False, 'message': 'Khong tim thay advisory theo advisory_id.'}
        snapshot = advisory.aggregate_snapshot
        if snapshot is not None and snapshot_id is None:
            snapshot_id = snapshot.id

    if snapshot_id is not None and snapshot is None:
        snapshot = legacy_views.AdvisoryAggregateSnapshot.objects.filter(
            id=snapshot_id,
            user=user,
            symbol=symbol,
        ).first()
        if snapshot is None:
            return {'ok': False, 'message': 'Khong tim thay snapshot theo snapshot_id.'}

    if advisory is None and snapshot is not None:
        advisory = (
            legacy_views.WhaleAdvisory.objects.filter(user=user, symbol=symbol, aggregate_snapshot=snapshot)
            .order_by('-created_at')
            .first()
        )
        if advisory is not None and advisory_id is None:
            advisory_id = advisory.id

    if advisory is None and snapshot is None:
        return {'ok': False, 'message': 'Can truyen advisory_id hoac snapshot_id hop le cho symbol nay.'}

    def _matches_trace(log_item) -> bool:
        before_state = log_item.before_state_json or {}
        after_state = log_item.after_state_json or {}
        metadata = log_item.metadata_json or {}

        advisory_candidates = {
            before_state.get('advisory_id'),
            after_state.get('advisory_id'),
            metadata.get('advisory_id'),
        }
        snapshot_candidates = {
            before_state.get('snapshot_id'),
            after_state.get('snapshot_id'),
            metadata.get('snapshot_id'),
        }

        if strict_after_state:
            advisory_ok = advisory_id is None or after_state.get('advisory_id') == advisory_id
            snapshot_ok = snapshot_id is None or after_state.get('snapshot_id') == snapshot_id
        else:
            advisory_ok = advisory_id is None or advisory_id in advisory_candidates
            snapshot_ok = snapshot_id is None or snapshot_id in snapshot_candidates
        reason_ok = not audit_reason or log_item.reason == audit_reason
        actor_ok = not audit_actor or log_item.actor == audit_actor
        start_ok = audit_start_at is None or (log_item.created_at is not None and log_item.created_at >= audit_start_at)
        end_ok = audit_end_at is None or (log_item.created_at is not None and log_item.created_at <= audit_end_at)
        return advisory_ok and snapshot_ok and reason_ok and actor_ok and start_ok and end_ok

    matched_logs = []
    logs_qs = legacy_views.AdvisoryAggregateAuditLog.objects.filter(user=user, symbol=symbol).order_by('-created_at')
    for log_item in logs_qs.iterator():
        if _matches_trace(log_item):
            matched_logs.append(log_item)
            if len(matched_logs) >= max_logs:
                break

    return {
        'ok': True,
        'trace': {
            'symbol': symbol,
            'advisory_id': advisory_id,
            'snapshot_id': snapshot_id,
            'replay_ready': bool(snapshot_id),
        },
        'advisory': {
            'id': advisory.id if advisory else None,
            'created_at': advisory.created_at.isoformat() if advisory and advisory.created_at else None,
            'source': advisory.source if advisory else '',
            'severity': advisory.severity if advisory else '',
            'threshold': float(advisory.threshold or 0) if advisory else 0.0,
            'aggregate_snapshot_id': advisory.aggregate_snapshot_id if advisory else None,
            'ai_provider': advisory.ai_provider if advisory else '',
            'ai_model': advisory.ai_model if advisory else '',
        },
        'snapshot': {
            'id': snapshot.id if snapshot else None,
            'snapshot_seq': snapshot.snapshot_seq if snapshot else None,
            'created_at': snapshot.created_at.isoformat() if snapshot and snapshot.created_at else None,
            'expires_at': snapshot.expires_at.isoformat() if snapshot and snapshot.expires_at else None,
            'state_json': snapshot.state_json if snapshot else {},
        },
        'audit_logs': [
            {
                'id': log_item.id,
                'created_at': log_item.created_at.isoformat() if log_item.created_at else None,
                'reason': log_item.reason,
                'actor': log_item.actor,
                'actor_id': log_item.actor_id,
                'before_state_json': log_item.before_state_json,
                'after_state_json': log_item.after_state_json,
                'metadata_json': log_item.metadata_json,
            }
            for log_item in matched_logs
        ],
        'counts': {
            'matched_audit_logs': len(matched_logs),
            'max_logs': max_logs,
        },
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_trace_api(request, symbol: str):
    from django.utils.dateparse import parse_datetime

    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    advisory_id_raw = request.query_params.get('advisory_id')
    snapshot_id_raw = request.query_params.get('snapshot_id')
    max_logs_raw = request.query_params.get('max_logs')
    reason_raw = str(request.query_params.get('reason') or '').strip().lower()
    actor_raw = str(request.query_params.get('actor') or '').strip().lower()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()

    try:
        advisory_id = int(advisory_id_raw) if advisory_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        snapshot_id = int(snapshot_id_raw) if snapshot_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'snapshot_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        max_logs = max(int(max_logs_raw or 20), 1)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'max_logs khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = {value for value, _ in legacy_views.AdvisoryAggregateAuditLog.ReasonChoices.choices}
    valid_actors = {value for value, _ in legacy_views.AdvisoryAggregateAuditLog.ActorChoices.choices}
    if reason_raw and reason_raw not in valid_reasons:
        return Response({'ok': False, 'message': 'reason khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if actor_raw and actor_raw not in valid_actors:
        return Response({'ok': False, 'message': 'actor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    start_at = None
    end_at = None
    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_at is not None and end_at is not None and start_at > end_at:
        return Response({'ok': False, 'message': 'start_at phai <= end_at.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = _build_advisory_trace_payload_for_user(
        user=request.user,
        symbol=normalized_symbol,
        advisory_id=advisory_id,
        snapshot_id=snapshot_id,
        max_logs=max_logs,
        audit_reason=reason_raw,
        audit_actor=actor_raw,
        audit_start_at=start_at,
        audit_end_at=end_at,
    )
    if not payload.get('ok'):
        return Response(payload, status=status.HTTP_404_NOT_FOUND)

    return Response(payload, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_trace_list_api(request, symbol: str):
    from django.utils.dateparse import parse_datetime

    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    limit_raw = request.query_params.get('limit')
    cursor_raw = request.query_params.get('cursor')
    reason_raw = str(request.query_params.get('reason') or '').strip().lower()
    actor_raw = str(request.query_params.get('actor') or '').strip().lower()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()

    try:
        limit = max(int(limit_raw or 20), 1)
        limit = min(limit, 100)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'limit khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        cursor = int(cursor_raw) if cursor_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'cursor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = {value for value, _ in legacy_views.AdvisoryAggregateAuditLog.ReasonChoices.choices}
    valid_actors = {value for value, _ in legacy_views.AdvisoryAggregateAuditLog.ActorChoices.choices}
    if reason_raw and reason_raw not in valid_reasons:
        return Response({'ok': False, 'message': 'reason khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if actor_raw and actor_raw not in valid_actors:
        return Response({'ok': False, 'message': 'actor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    start_at = None
    end_at = None
    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_at is not None and end_at is not None and start_at > end_at:
        return Response({'ok': False, 'message': 'start_at phai <= end_at.'}, status=status.HTTP_400_BAD_REQUEST)

    advisories_qs = (
        legacy_views.WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-id')
    )
    if cursor is not None:
        advisories_qs = advisories_qs.filter(id__lt=cursor)

    advisories = []
    for advisory_item in advisories_qs.iterator():
        advisories.append(advisory_item)
        if len(advisories) >= 500:
            break

    items = []
    has_audit_filters = bool(reason_raw or actor_raw or start_at is not None or end_at is not None)
    for advisory in advisories:
        snapshot = advisory.aggregate_snapshot
        trace_payload = _build_advisory_trace_payload_for_user(
            user=request.user,
            symbol=normalized_symbol,
            advisory_id=advisory.id,
            snapshot_id=snapshot.id if snapshot is not None else None,
            max_logs=5,
            audit_reason=reason_raw,
            audit_actor=actor_raw,
            audit_start_at=start_at,
            audit_end_at=end_at,
            strict_after_state=True,
        )
        if not trace_payload.get('ok'):
            continue
        matched_count = trace_payload.get('counts', {}).get('matched_audit_logs', 0)
        if has_audit_filters and matched_count <= 0:
            continue

        items.append(
            {
                'advisory_id': advisory.id,
                'created_at': advisory.created_at.isoformat() if advisory.created_at else None,
                'severity': advisory.severity,
                'source': advisory.source,
                'snapshot_id': advisory.aggregate_snapshot_id,
                'snapshot_seq': snapshot.snapshot_seq if snapshot is not None else None,
                'matched_audit_logs': matched_count,
                'last_audit_reason': (
                    (trace_payload.get('audit_logs') or [{}])[0].get('reason')
                    if trace_payload.get('audit_logs')
                    else ''
                ),
            }
        )
        if len(items) >= limit:
            break

    has_more = len(items) == limit and advisories_qs.filter(id__lt=items[-1]['advisory_id']).exists()
    next_cursor = items[-1]['advisory_id'] if has_more else None

    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'items': items,
            'filters': {
                'reason': reason_raw or None,
                'actor': actor_raw or None,
                'start_at': start_at_raw or None,
                'end_at': end_at_raw or None,
            },
            'paging': {
                'limit': limit,
                'cursor': cursor,
                'next_cursor': next_cursor,
                'has_more': has_more,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_trace_export_api(request, symbol: str):
    from django.utils.dateparse import parse_datetime

    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    advisory_id_raw = request.query_params.get('advisory_id')
    snapshot_id_raw = request.query_params.get('snapshot_id')
    max_logs_raw = request.query_params.get('max_logs')
    history_limit_raw = request.query_params.get('history_limit')
    contract_raw = str(request.query_params.get('contract') or 'v2').strip().lower()
    reason_raw = str(request.query_params.get('reason') or '').strip().lower()
    actor_raw = str(request.query_params.get('actor') or '').strip().lower()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()

    if contract_raw not in {'v1', 'v2'}:
        return Response({'ok': False, 'message': 'contract khong hop le. Ho tro: v1, v2.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        advisory_id = int(advisory_id_raw) if advisory_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        snapshot_id = int(snapshot_id_raw) if snapshot_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'snapshot_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        max_logs = max(int(max_logs_raw or 20), 1)
        max_logs = min(max_logs, 200)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'max_logs khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        history_limit = max(int(history_limit_raw or 10), 1)
        history_limit = min(history_limit, 50)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'history_limit khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = {value for value, _ in legacy_views.AdvisoryAggregateAuditLog.ReasonChoices.choices}
    valid_actors = {value for value, _ in legacy_views.AdvisoryAggregateAuditLog.ActorChoices.choices}
    if reason_raw and reason_raw not in valid_reasons:
        return Response({'ok': False, 'message': 'reason khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if actor_raw and actor_raw not in valid_actors:
        return Response({'ok': False, 'message': 'actor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    start_at = None
    end_at = None
    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_at is not None and end_at is not None and start_at > end_at:
        return Response({'ok': False, 'message': 'start_at phai <= end_at.'}, status=status.HTTP_400_BAD_REQUEST)

    trace_payload = _build_advisory_trace_payload_for_user(
        user=request.user,
        symbol=normalized_symbol,
        advisory_id=advisory_id,
        snapshot_id=snapshot_id,
        max_logs=max_logs,
        audit_reason=reason_raw,
        audit_actor=actor_raw,
        audit_start_at=start_at,
        audit_end_at=end_at,
    )
    if not trace_payload.get('ok'):
        return Response(trace_payload, status=status.HTTP_404_NOT_FOUND)

    advisory_ref_id = trace_payload.get('advisory', {}).get('id')
    advisory_obj = (
        legacy_views.WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(id=advisory_ref_id, user=request.user, symbol=normalized_symbol)
        .first()
    )
    snapshot_obj = advisory_obj.aggregate_snapshot if advisory_obj is not None else None

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    ai_status = legacy_views._get_ai_runtime_config_status(user_cfg)
    advisory_data = legacy_views.WhaleAdvisorySerializer(advisory_obj).data if advisory_obj is not None else None
    if advisory_data and legacy_views._get_plan(request.user) not in ('premium', 'admin'):
        advisory_data['ai_detail'] = ''

    session_payload = {
        'contract_version': contract_raw,
        'symbol': normalized_symbol,
        'advisory': advisory_data,
        'effective_ai_provider': ai_status.get('provider'),
        'effective_ai_model': ai_status.get('model'),
        'effective_ai_source': ai_status.get('source'),
    }
    if contract_raw == 'v2':
        latest_log = (trace_payload.get('audit_logs') or [None])[0]
        session_payload['aggregate'] = {
            'advisory_id': advisory_obj.id if advisory_obj is not None else None,
            'snapshot_id': advisory_obj.aggregate_snapshot_id if advisory_obj is not None else None,
            'snapshot_seq': snapshot_obj.snapshot_seq if snapshot_obj is not None else None,
            'last_audit_reason': latest_log.get('reason') if latest_log else None,
            'last_audit_actor': latest_log.get('actor') if latest_log else None,
            'last_audit_at': latest_log.get('created_at') if latest_log else None,
            'decision': legacy_views._build_session_v2_decision_digest(advisory_obj, snapshot_obj),
            'observability': legacy_views._build_session_v2_observability(request.user, normalized_symbol, advisory_obj, snapshot_obj),
        }

    history_qs = (
        legacy_views.WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-id')
    )
    if advisory_obj is not None:
        history_qs = history_qs.filter(id__lte=advisory_obj.id)

    history_items = []
    has_audit_filters = bool(reason_raw or actor_raw or start_at is not None or end_at is not None)
    for advisory_item in history_qs.iterator():
        history_snapshot = advisory_item.aggregate_snapshot
        item_trace_payload = _build_advisory_trace_payload_for_user(
            user=request.user,
            symbol=normalized_symbol,
            advisory_id=advisory_item.id,
            snapshot_id=history_snapshot.id if history_snapshot is not None else None,
            max_logs=2,
            audit_reason=reason_raw,
            audit_actor=actor_raw,
            audit_start_at=start_at,
            audit_end_at=end_at,
            strict_after_state=True,
        )
        if not item_trace_payload.get('ok'):
            continue
        matched_count = item_trace_payload.get('counts', {}).get('matched_audit_logs', 0)
        if has_audit_filters and matched_count <= 0:
            continue

        history_items.append(
            {
                'advisory_id': advisory_item.id,
                'created_at': advisory_item.created_at.isoformat() if advisory_item.created_at else None,
                'source': advisory_item.source,
                'severity': advisory_item.severity,
                'snapshot_id': advisory_item.aggregate_snapshot_id,
                'snapshot_seq': history_snapshot.snapshot_seq if history_snapshot is not None else None,
                'matched_audit_logs': matched_count,
                'last_audit_reason': (
                    (item_trace_payload.get('audit_logs') or [{}])[0].get('reason')
                    if item_trace_payload.get('audit_logs')
                    else None
                ),
            }
        )
        if len(history_items) >= history_limit:
            break

    history_has_more = len(history_items) == history_limit and history_qs.filter(id__lt=history_items[-1]['advisory_id']).exists()

    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'exported_at': timezone.now().isoformat(),
            'filters': {
                'contract': contract_raw,
                'reason': reason_raw or None,
                'actor': actor_raw or None,
                'start_at': start_at_raw or None,
                'end_at': end_at_raw or None,
            },
            'session': session_payload,
            'trace': trace_payload,
            'history': {
                'limit': history_limit,
                'has_more': history_has_more,
                'items': history_items,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_observability_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    holistic_gate_status = legacy_views._get_holistic_advisory_v1_gate_status(request.user)
    if not bool(holistic_gate_status.get('enabled')):
        legacy_views._log_holistic_rollout_gate_deny(
            user=request.user,
            symbol=normalized_symbol,
            endpoint='stock_ai_advisory_observability_api',
            gate_status=holistic_gate_status,
        )
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'reason': 'holistic_disabled',
                'message': 'Holistic Advisory V1 dang tat theo rollout gate.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == 'POST':
        payload = request.data if isinstance(request.data, dict) else {}
        telemetry = payload.get('telemetry') if isinstance(payload.get('telemetry'), dict) else {}

        event_type = str(payload.get('event_type') or 'frontend_retry_telemetry').strip()[:80]
        outcome = str(payload.get('outcome') or '').strip()[:60]
        client_ts = str(payload.get('client_ts') or '').strip()[:64]

        def _safe_non_negative_int(value, default=0):
            try:
                parsed = int(value)
                return parsed if parsed >= 0 else default
            except (TypeError, ValueError):
                return default

        scheduled_count = _safe_non_negative_int(telemetry.get('scheduled_count', 0))
        recovered_count = _safe_non_negative_int(telemetry.get('recovered_count', 0))
        failed_count = _safe_non_negative_int(telemetry.get('failed_count', 0))
        last_reason = str(telemetry.get('last_reason') or '').strip()[:120]

        metadata_payload = {
            'event_type': event_type,
            'outcome': outcome,
            'telemetry': {
                'scheduled_count': scheduled_count,
                'recovered_count': recovered_count,
                'failed_count': failed_count,
                'last_reason': last_reason,
                'last_event_at': str(telemetry.get('last_event_at') or '').strip()[:64],
            },
            'client_ts': client_ts,
        }

        audit_log = legacy_views.AdvisoryAggregateAuditLog.objects.create(
            user=request.user,
            symbol=normalized_symbol,
            before_state_json={},
            after_state_json={
                'operation': 'frontend_retry_telemetry',
                'outcome': outcome,
                'event_type': event_type,
            },
            reason=legacy_views.AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=legacy_views.AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(request.user.id),
            metadata_json=metadata_payload,
        )

        return Response(
            {
                'ok': True,
                'symbol': normalized_symbol,
                'log_id': audit_log.id,
                'message': 'Telemetry recorded.',
            },
            status=status.HTTP_201_CREATED,
        )

    limit_raw = request.query_params.get('limit')
    window_hours_raw = request.query_params.get('window_hours')
    try:
        limit = max(int(limit_raw or 20), 1)
        limit = min(limit, 100)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'limit khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        window_hours = max(int(window_hours_raw or 24), 1)
        window_hours = min(window_hours, 168)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'window_hours khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    retry_outcome_filter = str(request.query_params.get('retry_outcome') or '').strip().lower()
    retry_reason_filter = str(request.query_params.get('retry_reason') or '').strip().lower()
    retry_sort = str(request.query_params.get('retry_sort') or 'newest').strip().lower()
    governance_bucket = str(request.query_params.get('governance_bucket') or 'hour').strip().lower()
    governance_endpoint_filter = str(request.query_params.get('governance_endpoint') or '').strip().lower()
    governance_reason_filter = str(request.query_params.get('governance_reason') or '').strip().lower()
    valid_retry_sort_values = {'newest', 'oldest', 'most_failed'}
    if retry_sort not in valid_retry_sort_values:
        return Response({'ok': False, 'message': 'retry_sort khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if governance_bucket not in {'hour', 'day'}:
        return Response({'ok': False, 'message': 'governance_bucket khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    runtime_thresholds = legacy_views._get_runtime_governance_delta_thresholds()
    warning_threshold = runtime_thresholds['warning']
    critical_threshold = runtime_thresholds['critical']
    cooldown_threshold = runtime_thresholds['cooldown']

    def _safe_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    since_at = timezone.now() - timedelta(hours=window_hours)
    advisories = list(
        legacy_views.WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(user=request.user, symbol=normalized_symbol, created_at__gte=since_at)
        .order_by('-created_at')[:limit]
    )

    severity_rank = {
        legacy_views.WhaleAdvisory.SeverityChoices.INFO: 1.0,
        legacy_views.WhaleAdvisory.SeverityChoices.WARNING: 2.0,
        legacy_views.WhaleAdvisory.SeverityChoices.URGENT: 3.0,
    }

    timeline = []
    severity_scores = []
    quality_scores = []
    for advisory in advisories:
        snapshot = advisory.aggregate_snapshot
        quality_metrics = legacy_views._build_session_v2_aggregate_quality_metrics(advisory, snapshot)
        severity_score = severity_rank.get(str(advisory.severity or ''), 1.0)
        severity_scores.append(severity_score)
        quality_scores.append(quality_metrics['score'])
        timeline.append(
            {
                'advisory_id': advisory.id,
                'created_at': advisory.created_at.isoformat() if advisory.created_at else None,
                'source': advisory.source,
                'severity': advisory.severity,
                'severity_score': severity_score,
                'snapshot_id': advisory.aggregate_snapshot_id,
                'snapshot_seq': snapshot.snapshot_seq if snapshot is not None else None,
                'aggregate_quality': quality_metrics,
            }
        )

    current_severity = timeline[0]['severity'] if timeline else legacy_views.WhaleAdvisory.SeverityChoices.INFO
    current_severity_score = timeline[0]['severity_score'] if timeline else 1.0
    baseline_score = round(sum(severity_scores) / len(severity_scores), 2) if severity_scores else 1.0
    severity_delta = round(current_severity_score - baseline_score, 2)
    drift_label = 'high_drift' if abs(severity_delta) >= 1.2 else 'moderate_drift' if abs(severity_delta) >= 0.6 else 'stable'
    avg_quality_score = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 0.0

    audit_logs = list(
        legacy_views.AdvisoryAggregateAuditLog.objects.filter(
            user=request.user,
            symbol=normalized_symbol,
            created_at__gte=since_at,
        ).order_by('-created_at')[:200]
    )
    retry_events = []
    retry_scheduled_total = 0
    retry_recovered_total = 0
    retry_failed_total = 0
    rollout_deny_total = 0
    rollout_deny_by_endpoint = {}
    rollout_deny_by_reason = {}
    rollout_gate_cohort_modes = set()
    rollout_deny_trend = {}
    for log_item in audit_logs:
        metadata = log_item.metadata_json or {}
        event_type = str(metadata.get('event_type') or '').strip().lower()
        if event_type == 'rollout_gate_deny':
            endpoint = str(metadata.get('endpoint') or '').strip().lower()
            deny_reason = str(metadata.get('deny_reason') or '').strip().lower()
            cohort_mode = str(metadata.get('cohort_mode') or '').strip().lower()

            if governance_endpoint_filter and endpoint != governance_endpoint_filter:
                continue
            if governance_reason_filter and deny_reason != governance_reason_filter:
                continue

            rollout_deny_total += 1
            if endpoint:
                rollout_deny_by_endpoint[endpoint] = rollout_deny_by_endpoint.get(endpoint, 0) + 1
            if deny_reason:
                rollout_deny_by_reason[deny_reason] = rollout_deny_by_reason.get(deny_reason, 0) + 1
            if cohort_mode:
                rollout_gate_cohort_modes.add(cohort_mode)

            created_at = log_item.created_at
            if created_at is not None:
                local_dt = timezone.localtime(created_at)
                if governance_bucket == 'day':
                    bucket_key = local_dt.strftime('%Y-%m-%d')
                else:
                    bucket_key = local_dt.strftime('%Y-%m-%d %H:00')

                bucket_payload = rollout_deny_trend.setdefault(
                    bucket_key,
                    {
                        'bucket': bucket_key,
                        'deny_total': 0,
                        'deny_by_endpoint': {},
                        'deny_by_reason': {},
                        'deny_by_cohort_mode': {},
                    },
                )
                bucket_payload['deny_total'] += 1
                if endpoint:
                    bucket_payload['deny_by_endpoint'][endpoint] = bucket_payload['deny_by_endpoint'].get(endpoint, 0) + 1
                if deny_reason:
                    bucket_payload['deny_by_reason'][deny_reason] = bucket_payload['deny_by_reason'].get(deny_reason, 0) + 1
                if cohort_mode:
                    bucket_payload['deny_by_cohort_mode'][cohort_mode] = bucket_payload['deny_by_cohort_mode'].get(cohort_mode, 0) + 1

        if str(metadata.get('event_type') or '') != 'frontend_retry_telemetry':
            continue

        telemetry_payload = metadata.get('telemetry') if isinstance(metadata.get('telemetry'), dict) else {}
        scheduled_count = _safe_int(telemetry_payload.get('scheduled_count') or 0)
        recovered_count = _safe_int(telemetry_payload.get('recovered_count') or 0)
        failed_count = _safe_int(telemetry_payload.get('failed_count') or 0)
        retry_scheduled_total += scheduled_count
        retry_recovered_total += recovered_count
        retry_failed_total += failed_count

        event_payload = {
            'log_id': log_item.id,
            'created_at': log_item.created_at.isoformat() if log_item.created_at else None,
            'outcome': str(metadata.get('outcome') or '').lower(),
            'reason': str(telemetry_payload.get('last_reason') or '').lower(),
            'scheduled_count': scheduled_count,
            'recovered_count': recovered_count,
            'failed_count': failed_count,
            'client_ts': metadata.get('client_ts') or '',
        }

        if retry_outcome_filter and event_payload['outcome'] != retry_outcome_filter:
            continue
        if retry_reason_filter and event_payload['reason'] != retry_reason_filter:
            continue
        retry_events.append(event_payload)

    if retry_sort == 'oldest':
        retry_events.sort(key=lambda item: str(item.get('created_at') or ''))
    elif retry_sort == 'most_failed':
        retry_events.sort(
            key=lambda item: (int(item.get('failed_count') or 0), str(item.get('created_at') or '')),
            reverse=True,
        )
    else:
        retry_events.sort(key=lambda item: str(item.get('created_at') or ''), reverse=True)

    retry_events = retry_events[:limit]

    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'window_hours': window_hours,
            'limit': limit,
            'retry_filters': {
                'outcome': retry_outcome_filter or None,
                'reason': retry_reason_filter or None,
                'sort': retry_sort,
            },
            'summary': {
                'current_severity': current_severity,
                'current_severity_score': current_severity_score,
                'baseline_severity_score': baseline_score,
                'severity_delta': severity_delta,
                'severity_drift_label': drift_label,
                'avg_aggregate_quality_score': avg_quality_score,
                'sample_size': len(timeline),
                'retry_scheduled_total': retry_scheduled_total,
                'retry_recovered_total': retry_recovered_total,
                'retry_failed_total': retry_failed_total,
                'rollout_gate_deny_total': rollout_deny_total,
            },
            'governance': {
                'rollout_gate_deny_total': rollout_deny_total,
                'rollout_gate_deny_by_endpoint': rollout_deny_by_endpoint,
                'rollout_gate_deny_by_reason': rollout_deny_by_reason,
                'cohort_modes_seen': sorted(rollout_gate_cohort_modes),
                'filters': {
                    'endpoint': governance_endpoint_filter or None,
                    'reason': governance_reason_filter or None,
                },
                'delta_thresholds': {
                    'warning': warning_threshold,
                    'critical': critical_threshold,
                    'cooldown': cooldown_threshold,
                },
                'trend_bucket': governance_bucket,
                'rollout_gate_deny_trend': [
                    rollout_deny_trend[key]
                    for key in sorted(rollout_deny_trend.keys())
                ],
            },
            'timeline': timeline,
            'retry_events': retry_events,
        },
        status=status.HTTP_200_OK,
    )
