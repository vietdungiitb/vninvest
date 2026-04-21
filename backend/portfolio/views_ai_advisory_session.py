from datetime import timedelta

import pandas as pd
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


def _build_session_v2_decision_digest(advisory_obj, snapshot_obj) -> dict:
    legacy_views = _legacy_views_module()
    if advisory_obj is None:
        return {
            'score': 0.0,
            'score_band': 'neutral',
            'action': 'watch',
            'risk': 'medium',
        }

    state_json = snapshot_obj.state_json if snapshot_obj is not None and isinstance(snapshot_obj.state_json, dict) else {}
    quality = state_json.get('quality') if isinstance(state_json.get('quality'), dict) else {}

    score_value = quality.get('actionability')
    if score_value is None:
        threshold = float(advisory_obj.threshold or 0.0)
        ratio = (float(advisory_obj.matched_value or 0.0) / threshold) if threshold > 0 else 0.0
        score_value = max(0.0, min(ratio / 2.0, 1.0))
    score_value = max(0.0, min(float(score_value or 0.0), 1.0))

    if score_value >= 0.75:
        score_band = 'high'
    elif score_value >= 0.45:
        score_band = 'medium'
    else:
        score_band = 'low'

    action_map = {
        'BUY': 'accumulate',
        'SELL': 'reduce',
        'UNKNOWN': 'watch',
    }
    risk_map = {
        legacy_views.WhaleAdvisory.SeverityChoices.URGENT: 'high',
        legacy_views.WhaleAdvisory.SeverityChoices.WARNING: 'medium',
        legacy_views.WhaleAdvisory.SeverityChoices.INFO: 'low',
    }

    return {
        'score': round(score_value, 4),
        'score_band': score_band,
        'action': action_map.get(str(advisory_obj.side or '').upper(), 'watch'),
        'risk': risk_map.get(advisory_obj.severity, 'medium'),
    }


def _build_session_v2_benchmark_enrichment(symbol: str) -> dict:
    from .market_data_service import MarketDataService
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return {
            'vwap_deviation_pct': None,
            'rvol': None,
            'rvol_regime': 'unknown',
            'relative_strength_20d_pct': None,
            'mtf_confirmation_score': 0.0,
            'mtf_confirmation_label': 'unknown',
            'freshness': {'daily_price_date': None, 'intraday_tick_at': None},
        }

    # MDSU Canonical path: fetch both symbol and benchmark (VNINDEX) in parallel
    historical_data = MarketDataService.get_historical_indicators(
        [normalized_symbol, 'VNINDEX'], 
        lookback_days=80
    )
    
    recent_prices = historical_data.get(normalized_symbol, [])
    benchmark_prices = historical_data.get('VNINDEX', [])

    latest_price_obj = recent_prices[-1] if recent_prices else None
    latest_volume = float(latest_price_obj.get('volume') or 0) if latest_price_obj else 0.0
    
    # MarketDataService returns ascending by date. 
    # baseline_volumes should be previous 20 sessions before latest.
    baseline_volumes = [float(item.get('volume') or 0) for item in recent_prices[-21:-1] if float(item.get('volume') or 0) > 0]

    rvol = None
    if latest_volume > 0 and baseline_volumes:
        baseline_avg = sum(baseline_volumes) / max(len(baseline_volumes), 1)
        if baseline_avg > 0:
            rvol = round(latest_volume / baseline_avg, 2)

    if rvol is None:
        rvol_regime = 'unknown'
    elif rvol >= 2.0:
        rvol_regime = 'spike'
    elif rvol >= 1.2:
        rvol_regime = 'elevated'
    elif rvol >= 0.8:
        rvol_regime = 'normal'
    else:
        rvol_regime = 'dry'

    relative_strength_20d_pct = None
    if len(recent_prices) > 20 and len(benchmark_prices) > 20:
        # Ascending order: [-1] is newest, [-21] is 20 sessions ago
        stock_ret = (float(recent_prices[-1]['close_price']) / float(recent_prices[-21]['close_price'])) - 1.0
        benchmark_ret = (float(benchmark_prices[-1]['close_price']) / float(benchmark_prices[-21]['close_price'])) - 1.0
        relative_strength_20d_pct = round((stock_ret - benchmark_ret) * 100.0, 2)

    mtf_votes = []
    if len(recent_prices) > 5:
        mtf_votes.append(float(recent_prices[-1]['close_price']) >= float(recent_prices[-6]['close_price']))
    if len(recent_prices) > 20:
        mtf_votes.append(float(recent_prices[-1]['close_price']) >= float(recent_prices[-21]['close_price']))
    if len(recent_prices) > 60:
        mtf_votes.append(float(recent_prices[-1]['close_price']) >= float(recent_prices[-61]['close_price']))

    if mtf_votes:
        mtf_confirmation_score = round(sum(1.0 for vote in mtf_votes if vote) / len(mtf_votes), 2)
    else:
        mtf_confirmation_score = 0.0

    if mtf_confirmation_score >= 0.8:
        mtf_confirmation_label = 'strong'
    elif mtf_confirmation_score >= 0.5:
        mtf_confirmation_label = 'mixed'
    elif mtf_votes:
        mtf_confirmation_label = 'weak'
    else:
        mtf_confirmation_label = 'unknown'

    legacy_views = _legacy_views_module()
    latest_trade = (
        legacy_views.IntradayTick.objects.filter(symbol=normalized_symbol)
        .order_by('-trade_date', '-trade_time')
        .first()
    )
    vwap_deviation_pct = None
    intraday_tick_at = None
    if latest_trade is not None:
        intraday_tick_at = f'{latest_trade.trade_date}T{latest_trade.trade_time}'
        same_day_ticks = legacy_views.IntradayTick.objects.filter(
            symbol=normalized_symbol,
            trade_date=latest_trade.trade_date,
        ).values('price', 'volume')
        frame = pd.DataFrame.from_records(list(same_day_ticks))
        if not frame.empty:
            frame['price'] = pd.to_numeric(frame.get('price'), errors='coerce').fillna(0.0).astype(float)
            frame['volume'] = pd.to_numeric(frame.get('volume'), errors='coerce').fillna(0.0).astype(float)
            total_volume = float(frame['volume'].sum())
            if total_volume > 0 and latest_trade.price is not None:
                total_notional = float((frame['price'] * frame['volume']).sum())
                vwap_value = total_notional / total_volume
                if vwap_value > 0:
                    vwap_deviation_pct = round(((float(latest_trade.price) - vwap_value) / vwap_value) * 100.0, 2)

    daily_price_date = str(latest_price_obj['date']) if latest_price_obj else None
    return {
        'vwap_deviation_pct': vwap_deviation_pct,
        'rvol': rvol,
        'rvol_regime': rvol_regime,
        'relative_strength_20d_pct': relative_strength_20d_pct,
        'mtf_confirmation_score': mtf_confirmation_score,
        'mtf_confirmation_label': mtf_confirmation_label,
        'freshness': {
            'daily_price_date': daily_price_date,
            'intraday_tick_at': intraday_tick_at,
        },
    }


def _build_session_v2_aggregate_quality_metrics(advisory_obj, snapshot_obj) -> dict:
    state_json = snapshot_obj.state_json if snapshot_obj is not None and isinstance(snapshot_obj.state_json, dict) else {}
    quality = state_json.get('quality') if isinstance(state_json.get('quality'), dict) else {}
    actionability = quality.get('actionability')
    if actionability is None:
        actionability = _build_session_v2_decision_digest(advisory_obj, snapshot_obj).get('score', 0.0)
    actionability = max(0.0, min(float(actionability or 0.0), 1.0))

    noise_ratio = max(0.0, min(float(quality.get('noise_ratio', 0.5) or 0.5), 1.0))
    consistency = max(0.0, min(float(quality.get('consistency', 0.5) or 0.5), 1.0))
    quality_score = round(((actionability * 0.45) + ((1.0 - noise_ratio) * 0.25) + (consistency * 0.30)) * 100.0, 1)
    if quality_score >= 75:
        quality_label = 'high'
    elif quality_score >= 55:
        quality_label = 'medium'
    else:
        quality_label = 'low'

    return {
        'score': quality_score,
        'label': quality_label,
        'actionability': round(actionability, 4),
        'noise_ratio': round(noise_ratio, 4),
        'consistency': round(consistency, 4),
    }


def _build_session_v2_observability(user, symbol: str, advisory_obj, snapshot_obj) -> dict:
    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    severity_rank = {
        legacy_views.WhaleAdvisory.SeverityChoices.INFO: 1.0,
        legacy_views.WhaleAdvisory.SeverityChoices.WARNING: 2.0,
        legacy_views.WhaleAdvisory.SeverityChoices.URGENT: 3.0,
    }

    current_severity = str(getattr(advisory_obj, 'severity', legacy_views.WhaleAdvisory.SeverityChoices.INFO) or legacy_views.WhaleAdvisory.SeverityChoices.INFO)
    current_score = severity_rank.get(current_severity, 1.0)

    since_at = timezone.now() - timedelta(hours=24)
    recent_advisories = list(
        legacy_views.WhaleAdvisory.objects.filter(user=user, symbol=normalized_symbol, created_at__gte=since_at)
        .order_by('-created_at')[:40]
    )
    recent_scores = [severity_rank.get(str(item.severity or ''), 1.0) for item in recent_advisories]
    baseline_score = round(sum(recent_scores) / len(recent_scores), 2) if recent_scores else round(current_score, 2)
    severity_delta = round(current_score - baseline_score, 2)
    abs_delta = abs(severity_delta)
    if abs_delta >= 1.2:
        drift_label = 'high_drift'
    elif abs_delta >= 0.6:
        drift_label = 'moderate_drift'
    else:
        drift_label = 'stable'

    quality_metrics = _build_session_v2_aggregate_quality_metrics(advisory_obj, snapshot_obj)

    return {
        'severity_drift_24h': {
            'current': current_severity,
            'current_score': current_score,
            'baseline_score': baseline_score,
            'delta': severity_delta,
            'label': drift_label,
            'sample_size': len(recent_scores),
        },
        'aggregate_quality': {
            'score': quality_metrics['score'],
            'label': quality_metrics['label'],
            'actionability': quality_metrics['actionability'],
            'noise_ratio': quality_metrics['noise_ratio'],
            'consistency': quality_metrics['consistency'],
        },
    }


def _get_holistic_advisory_v1_gate_status(user) -> dict:
    if not bool(getattr(settings, 'HOLISTIC_ADVISORY_V1_ENABLED', True)):
        return {
            'enabled': False,
            'reason': 'global_disabled',
            'cohort_mode': str(getattr(settings, 'HOLISTIC_ADVISORY_V1_COHORT_MODE', 'all') or 'all').strip().lower(),
        }

    cohort_mode = str(getattr(settings, 'HOLISTIC_ADVISORY_V1_COHORT_MODE', 'all') or 'all').strip().lower()
    if cohort_mode == 'all':
        return {'enabled': True, 'reason': 'all', 'cohort_mode': cohort_mode}

    if cohort_mode == 'staff':
        is_staff = bool(getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False))
        return {
            'enabled': is_staff,
            'reason': 'staff' if is_staff else 'staff_only',
            'cohort_mode': cohort_mode,
        }

    if cohort_mode == 'allowlist':
        allowlist = getattr(settings, 'HOLISTIC_ADVISORY_V1_COHORT_USERNAMES', []) or []
        normalized_allowlist = {str(item).strip().lower() for item in allowlist if str(item).strip()}
        in_allowlist = str(getattr(user, 'username', '')).strip().lower() in normalized_allowlist
        return {
            'enabled': in_allowlist,
            'reason': 'allowlist' if in_allowlist else 'allowlist_blocked',
            'cohort_mode': cohort_mode,
        }

    return {'enabled': True, 'reason': 'unknown_mode_fallback', 'cohort_mode': cohort_mode}


def _is_holistic_advisory_v1_enabled_for_user(user) -> bool:
    return bool(_get_holistic_advisory_v1_gate_status(user).get('enabled'))


def _log_holistic_rollout_gate_deny(*, user, symbol: str, endpoint: str, gate_status: dict) -> None:
    legacy_views = _legacy_views_module()
    try:
        legacy_views.AdvisoryAggregateAuditLog.objects.create(
            user=user,
            symbol=symbol,
            before_state_json={},
            after_state_json={
                'operation': 'holistic_rollout_gate',
                'outcome': 'denied',
                'endpoint': endpoint,
            },
            reason=legacy_views.AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY,
            actor=legacy_views.AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='holistic_rollout_gate',
            metadata_json={
                'event_type': 'rollout_gate_deny',
                'endpoint': endpoint,
                'deny_reason': str(gate_status.get('reason') or '').strip().lower(),
                'cohort_mode': str(gate_status.get('cohort_mode') or '').strip().lower(),
            },
        )
    except Exception:
        legacy_views.logger.exception('Failed to persist holistic rollout deny audit log for %s/%s', user.id, symbol)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_session_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_session_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_session_api')
    if quota_response is not None:
        return quota_response

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    threshold_m = float(user_cfg.whale_alert_threshold or 500)
    threshold_vnd = threshold_m * 1_000_000
    holistic_gate_status = _get_holistic_advisory_v1_gate_status(request.user)
    holistic_v1_enabled = bool(holistic_gate_status.get('enabled'))
    session_v2_enabled = bool(getattr(settings, 'STOCK_AI_ADVISORY_SESSION_V2_ENABLED', False))
    benchmark_enrichment_enabled = bool(getattr(settings, 'STOCK_AI_ADVISORY_BENCHMARKS_ENABLED', False))
    contract_raw = str(request.query_params.get('contract') or '').strip().lower()
    include_benchmarks_raw = str(request.query_params.get('include_benchmarks') or '').strip().lower()
    include_benchmarks = include_benchmarks_raw in {'1', 'true', 'yes', 'on'}
    if contract_raw and contract_raw not in {'v1', 'v2'}:
        return Response({'ok': False, 'message': 'contract khong hop le. Ho tro: v1, v2.'}, status=status.HTTP_400_BAD_REQUEST)
    if contract_raw == 'v2' and not holistic_v1_enabled:
        _log_holistic_rollout_gate_deny(
            user=request.user,
            symbol=normalized_symbol,
            endpoint='stock_ai_advisory_session_api',
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
    if not holistic_v1_enabled:
        session_v2_enabled = False
        benchmark_enrichment_enabled = False
    if contract_raw == 'v1':
        session_v2_enabled = False
    elif contract_raw == 'v2':
        session_v2_enabled = True

    def _should_use_sync_fallback() -> bool:
        return bool(getattr(settings, 'STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER', True))

    def _queue_or_run(payload_kwargs: dict, *, force_sync: bool = False) -> dict:
        return legacy_views._submit_advisory_generation_with_fallback(
            payload_kwargs=payload_kwargs,
            prefer_sync_fallback=_should_use_sync_fallback(),
            force_sync=force_sync,
            context_label=f'stock_ai_advisory_session_api:{normalized_symbol}',
        )

    def _build_session_payload(latest_advisory):
        payload = legacy_views._sprint17_serialize_stock_advisory_session(request.user, normalized_symbol, latest_advisory)
        advisory_data = payload.get('advisory')
        if advisory_data and legacy_views._get_plan(request.user) not in ('premium', 'admin'):
            advisory_data['ai_detail'] = ''
        payload['user_ai_provider'] = str(user_cfg.ai_provider or 'openclaw').strip().lower()
        payload['effective_ai_provider'] = ai_status.get('provider')
        payload['effective_ai_model'] = ai_status.get('model')
        payload['effective_ai_source'] = ai_status.get('source')
        payload['contract_version'] = 'v1'

        if session_v2_enabled:
            trace_payload = legacy_views._build_advisory_trace_payload_for_user(
                user=request.user,
                symbol=normalized_symbol,
                advisory_id=latest_advisory.id if latest_advisory is not None else None,
                snapshot_id=(latest_advisory.aggregate_snapshot_id if latest_advisory is not None else None),
                max_logs=1,
                strict_after_state=True,
            )
            latest_log = (trace_payload.get('audit_logs') or [None])[0] if trace_payload.get('ok') else None
            snapshot_obj = latest_advisory.aggregate_snapshot if latest_advisory is not None else None
            decision_digest = _build_session_v2_decision_digest(latest_advisory, snapshot_obj)
            payload['contract_version'] = 'v2'
            payload['aggregate'] = {
                'advisory_id': latest_advisory.id if latest_advisory is not None else None,
                'snapshot_id': latest_advisory.aggregate_snapshot_id if latest_advisory is not None else None,
                'snapshot_seq': snapshot_obj.snapshot_seq if snapshot_obj is not None else None,
                'last_audit_reason': latest_log.get('reason') if latest_log else None,
                'last_audit_actor': latest_log.get('actor') if latest_log else None,
                'last_audit_at': latest_log.get('created_at') if latest_log else None,
                'decision': decision_digest,
                'observability': _build_session_v2_observability(request.user, normalized_symbol, latest_advisory, snapshot_obj),
            }
            if benchmark_enrichment_enabled or include_benchmarks:
                payload['aggregate']['benchmarks'] = _build_session_v2_benchmark_enrichment(normalized_symbol)
        return payload

    def _tracked_response(payload: dict, response_status: int):
        legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_session_api', response_status)
        return Response(payload, status=response_status)

    latest = legacy_views.WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    ai_status = legacy_views._get_ai_runtime_config_status(user_cfg)

    if request.method == 'GET':
        if latest is not None:
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    **_build_session_payload(latest),
                },
                status.HTTP_200_OK,
            )

        auto_cooldown = max(int(getattr(settings, 'STOCK_AI_ADVISORY_AUTOGEN_COOLDOWN_SECONDS', 45)), 10)
        auto_lock_key = f'stock_ai_advisory_autogen_lock:{request.user.id}:{normalized_symbol}'
        if not ai_status['ready']:
            return _tracked_response(
                {
                    'ok': False,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'components_count': 0,
                    'active_components_count': 0,
                    'message': ai_status['message'],
                    'reason': 'ai_not_configured',
                    'config_issue': ai_status['reason'],
                },
                status.HTTP_200_OK,
            )
        if legacy_views._cache_get(auto_lock_key):
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'message': 'Đang chờ advisory AI được tạo, vui lòng tải lại sau ít giây.',
                },
                status.HTTP_202_ACCEPTED,
            )

        resolved_threshold_vnd, threshold_source = legacy_views._resolve_first_create_threshold_vnd(
            request.user,
            normalized_symbol,
            threshold_vnd,
        )

        payload_kwargs = {
            'symbol': normalized_symbol,
            'matched_value_vnd': resolved_threshold_vnd,
            'side': 'UNKNOWN',
            'threshold': resolved_threshold_vnd,
            'threshold_source': threshold_source,
            'force_refresh': False,
            'user_id': request.user.id,
        }
        force_sync_first_create = bool(getattr(settings, 'STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE', True))
        submit_result = _queue_or_run(payload_kwargs, force_sync=force_sync_first_create)
        if submit_result.get('queue_error'):
            return _tracked_response(
                {
                    'ok': False,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'components_count': 0,
                    'active_components_count': 0,
                    'message': 'Khong the tao advisory luc nay (queue service tam thoi khong san sang). Vui long thu lai sau.',
                },
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        legacy_views._cache_set(auto_lock_key, timezone.now().isoformat(), timeout=auto_cooldown)

        latest_after_submit = legacy_views.WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
        if submit_result.get('sync') and latest_after_submit is not None:
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    **_build_session_payload(latest_after_submit),
                    'message': 'Đã tạo AI Advisory trực tiếp trong phiên hiện tại.',
                },
                status.HTTP_200_OK,
            )

        return _tracked_response(
            {
                'ok': True,
                'queued': bool(submit_result.get('queued')),
                'symbol': normalized_symbol,
                'task_id': submit_result.get('task_id'),
                'advisory': None,
                'components': [],
                'executive_summary': None,
                'components_count': 0,
                'active_components_count': 0,
                'message': 'Đã gửi yêu cầu tạo AI Advisory cho mã này.' if submit_result.get('queued') else 'Đang xử lý AI Advisory trực tiếp.',
            },
            status.HTTP_202_ACCEPTED,
        )

    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'stock_ai_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'
    if not ai_status['ready']:
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                **_build_session_payload(latest),
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status.HTTP_409_CONFLICT,
        )
    if legacy_views._cache_get(refresh_lock_key):
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Bạn vừa refresh gần đây, vui lòng thử lại sau.',
                'retry_after_seconds': refresh_cooldown,
            },
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    matched_value_vnd = float(latest.matched_value) if latest else threshold_vnd
    advisory_side = latest.side if latest else 'UNKNOWN'
    advisory_threshold = float(latest.threshold or 0) if latest else threshold_vnd
    payload_kwargs = {
        'symbol': normalized_symbol,
        'matched_value_vnd': matched_value_vnd,
        'side': advisory_side,
        'threshold': advisory_threshold,
        'force_refresh': True,
        'user_id': request.user.id,
        'source': legacy_views.WhaleAdvisory.SourceChoices.USER_REFRESH,
    }
    submit_result = _queue_or_run(payload_kwargs)
    if submit_result.get('queue_error'):
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                **_build_session_payload(latest),
                'message': 'Khong the refresh advisory luc nay (queue service tam thoi khong san sang). Vui long thu lai sau.',
            },
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    legacy_views._cache_set(refresh_lock_key, timezone.now().isoformat(), timeout=refresh_cooldown)

    latest_after_refresh = legacy_views.WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    if submit_result.get('sync') and latest_after_refresh is not None:
        return _tracked_response(
            {
                'ok': True,
                'queued': False,
                'symbol': normalized_symbol,
                'task_id': None,
                **_build_session_payload(latest_after_refresh),
                'message': 'Đã refresh AI Advisory trực tiếp trong phiên hiện tại.',
            },
            status.HTTP_200_OK,
        )

    return _tracked_response(
        {
            'ok': True,
            'queued': bool(submit_result.get('queued')),
            'symbol': normalized_symbol,
            'task_id': submit_result.get('task_id'),
            **_build_session_payload(latest),
            'message': 'Đã gửi yêu cầu refresh AI Advisory cho mã này.' if submit_result.get('queued') else 'Đang refresh AI Advisory trực tiếp.',
        },
        status.HTTP_202_ACCEPTED,
    )