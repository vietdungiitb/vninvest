import json
import os
from time import perf_counter

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import ai_advisory_helpers as advisory_helpers


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


def _timeframe_to_minutes(timeframe: str) -> int:
    timeframe_lower = str(timeframe or '').strip().lower()

    if timeframe_lower.endswith('m'):
        try:
            return max(int(timeframe_lower.rstrip('m')), 1)
        except (ValueError, TypeError):
            return 30
    if timeframe_lower.endswith('h'):
        try:
            hours = int(timeframe_lower.rstrip('h'))
            return max(hours * 60, 1)
        except (ValueError, TypeError):
            return 30
    if timeframe_lower.endswith('d'):
        try:
            days = int(timeframe_lower.rstrip('d'))
            return max(days * 24 * 60, 1)
        except (ValueError, TypeError):
            return 30

    return 30


def _build_component_generation_key(component) -> str:
    component_type = str(getattr(component, 'component_type', '') or 'component').strip().lower() or 'component'
    indicator_name = str(getattr(component, 'indicator_name', '') or '').strip().upper()
    if indicator_name:
        return f'{component_type}:{indicator_name}'
    return component_type


def _estimate_component_generation_confidence(*, dark_flow: dict | None, generated_by_ai: bool, created_count: int) -> float:
    strength = 0.0
    if isinstance(dark_flow, dict):
        try:
            strength = float(dark_flow.get('strength') or 0.0)
        except Exception:
            strength = 0.0
    if strength > 1.0:
        strength = strength / 100.0

    score = 0.40 + min(max(strength, 0.0), 0.35)
    if generated_by_ai:
        score += 0.12
    if created_count >= 3:
        score += 0.08
    return max(0.0, min(score, 0.99))


def _estimate_component_generation_actionability(created_components) -> float:
    created_components = list(created_components or [])
    if not created_components:
        return 0.0

    actionable_components = 0
    confidence_total = 0.0
    for component in created_components:
        suggested_action = str(getattr(component, 'suggested_action', '') or '').strip().lower()
        if suggested_action and suggested_action not in {'watch', 'hold', 'neutral'}:
            actionable_components += 1
        try:
            confidence_total += float(getattr(component, 'confidence_score', 0) or 0)
        except Exception:
            confidence_total += 0.0

    actionable_ratio = actionable_components / len(created_components)
    normalized_confidence = min(max((confidence_total / len(created_components)) / 10.0, 0.0), 1.0)
    score = 0.35 + (actionable_ratio * 0.40) + (normalized_confidence * 0.20)
    return max(0.0, min(score, 0.99))


def _persist_component_generation_metrics_audit_log(
    *,
    user,
    symbol: str,
    latest_advisory,
    created_components,
    timeframe: str,
    generated_by_ai: bool,
    chart_context_used: bool,
    chart_context_warnings: list[str],
    metrics: dict,
) -> None:
    legacy_views = _legacy_views_module()
    if user is None:
        return

    created_components = list(created_components or [])
    before_state = {}
    if latest_advisory is not None:
        before_state = {
            'advisory_id': latest_advisory.id,
            'severity': getattr(latest_advisory, 'severity', ''),
            'source': getattr(latest_advisory, 'source', ''),
            'threshold_source': getattr(latest_advisory, 'threshold_source', ''),
            'created_at': latest_advisory.created_at.isoformat() if latest_advisory.created_at else None,
        }

    after_state = {
        'operation': 'component_generation',
        'timeframe': timeframe,
        'generated_by_ai': bool(generated_by_ai),
        'component_count': len(created_components),
        'component_ids': [component.id for component in created_components],
    }

    metadata_payload = dict(metrics or {})
    metadata_payload.update(
        {
            'operation': 'component_generation',
            'symbol': symbol,
            'timeframe': timeframe,
            'generated_by_ai': bool(generated_by_ai),
            'chart_context_used': bool(chart_context_used),
            'chart_context_warning_count': len(chart_context_warnings or []),
            'created_count': len(created_components),
            'created_component_keys': [_build_component_generation_key(component) for component in created_components],
        }
    )

    try:
        legacy_views.AdvisoryAggregateAuditLog.objects.create(
            user=user,
            symbol=symbol,
            before_state_json=before_state,
            after_state_json=after_state,
            reason=legacy_views.AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=legacy_views.AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(user.id),
            metadata_json=metadata_payload,
        )
    except Exception as exc:
        legacy_views.logger.warning('Component generation metrics audit log persistence failed for %s: %s', symbol, exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_components_generate_api(request, symbol: str):
    from portfolio.observability import (
        end_advisory_phase,
        end_advisory_session,
        record_advisory_actionability,
        record_advisory_component,
        record_advisory_confidence,
        record_advisory_error_recovery,
        record_ai_chart_context_observation,
        start_advisory_phase,
        start_advisory_session,
    )
    from portfolio.order_flow import detect_dark_flow

    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_components_generate_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    latest = legacy_views.WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    if latest is None:
        return Response({'ok': False, 'message': 'Chua co advisory goc de tao components.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    ai_status = legacy_views._get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_components_generate_api')
    if quota_response is not None:
        return quota_response

    timeframe = str(request.data.get('timeframe', '30m')).strip().lower()
    valid_timeframes = {choice for choice, _ in legacy_views.AIAdvisoryComponentRecord.TimeframeChoice.choices}
    if timeframe not in valid_timeframes:
        timeframe = '30m'

    chart_context = None
    chart_context_used = False
    chart_context_warnings = []
    raw_chart_context = request.data.get('chart_context')
    chart_context_payload_bytes = 0
    chart_context_ohlcv_points = 0
    if raw_chart_context is not None:
        try:
            chart_context_payload_bytes = len(json.dumps(raw_chart_context, ensure_ascii=False).encode('utf-8'))
        except Exception:
            chart_context_payload_bytes = 0
        max_chart_context_bytes = int(os.getenv('MAX_CHART_CONTEXT_BYTES', '65536'))
        if chart_context_payload_bytes > max_chart_context_bytes:
            chart_context_warnings.append('chart_context_too_large')
        else:
            context_serializer = legacy_views.StockAIChartContextSerializer(
                data=raw_chart_context,
                context={'symbol': normalized_symbol, 'max_ohlcv_points': 300},
            )
            if context_serializer.is_valid():
                chart_context = dict(context_serializer.validated_data)
                chart_context_used = True
                chart_context_ohlcv_points = len(chart_context.get('ohlcv') or [])
            else:
                chart_context_warnings.append('chart_context_invalid')

    legacy_views.logger.info(
        'stock_ai_advisory_components_generate telemetry symbol=%s chart_context_present=%s chart_context_used=%s chart_context_ohlcv_points=%s chart_context_payload_bytes=%s chart_context_warning_count=%s',
        normalized_symbol,
        raw_chart_context is not None,
        chart_context_used,
        chart_context_ohlcv_points,
        chart_context_payload_bytes,
        len(chart_context_warnings),
    )
    record_ai_chart_context_observation(
        present=raw_chart_context is not None,
        used=chart_context_used,
        warning_count=len(chart_context_warnings),
        ohlcv_points=chart_context_ohlcv_points,
        payload_bytes=chart_context_payload_bytes,
    )

    start_advisory_session()
    session_closed = False
    try:
        window_minutes = _timeframe_to_minutes(timeframe)

        start_advisory_phase('component_dark_flow_detection')
        dark_flow_started = perf_counter()
        try:
            dark_flow = detect_dark_flow(normalized_symbol, window_minutes=window_minutes)
        finally:
            end_advisory_phase('component_dark_flow_detection')
        record_advisory_component('dark_flow_detection', (perf_counter() - dark_flow_started) * 1000)

        start_advisory_phase('component_template_generation')
        template_started = perf_counter()
        try:
            templates = legacy_views._sprint17_generate_component_templates_with_ai(
                user=request.user,
                symbol=normalized_symbol,
                latest_advisory=latest,
                dark_flow=dark_flow,
                timeframe=timeframe,
                chart_context=chart_context,
            )
            generated_by_ai = bool(templates)
            if not templates:
                templates = legacy_views._sprint17_build_component_templates(
                    normalized_symbol,
                    latest,
                    dark_flow,
                    timeframe,
                    chart_context=chart_context,
                )
        finally:
            end_advisory_phase('component_template_generation')
        record_advisory_component(
            'template_generation_ai' if generated_by_ai else 'template_generation_fallback',
            (perf_counter() - template_started) * 1000,
        )

        start_advisory_phase('component_record_persistence')
        persistence_started = perf_counter()
        try:
            created = [
                legacy_views.AIAdvisoryComponentRecord.objects.create(user=request.user, **payload)
                for payload in templates
            ]
        finally:
            end_advisory_phase('component_record_persistence')
        persistence_latency_ms = (perf_counter() - persistence_started) * 1000
        record_advisory_component('component_record_persistence', persistence_latency_ms)

        per_component_latency_ms = persistence_latency_ms / max(len(created), 1)
        for component in created:
            record_advisory_component(_build_component_generation_key(component), per_component_latency_ms)

        record_advisory_confidence(
            _estimate_component_generation_confidence(
                dark_flow=dark_flow,
                generated_by_ai=generated_by_ai,
                created_count=len(created),
            ),
            source='component_generation',
        )
        record_advisory_actionability(_estimate_component_generation_actionability(created))

        start_advisory_phase('component_response_serialization')
        serialization_started = perf_counter()
        try:
            components_payload = legacy_views.AIAdvisoryComponentRecordSerializer(created, many=True).data
        finally:
            end_advisory_phase('component_response_serialization')
        record_advisory_component('component_response_serialization', (perf_counter() - serialization_started) * 1000)

        metrics = end_advisory_session()
        session_closed = True
        _persist_component_generation_metrics_audit_log(
            user=request.user,
            symbol=normalized_symbol,
            latest_advisory=latest,
            created_components=created,
            timeframe=timeframe,
            generated_by_ai=generated_by_ai,
            chart_context_used=chart_context_used,
            chart_context_warnings=chart_context_warnings,
            metrics=metrics,
        )
    except Exception as exc:
        record_advisory_error_recovery(type(exc).__name__, 'component_generation_failed', success=False)
        if not session_closed:
            end_advisory_session()
        raise

    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_components_generate_api', status.HTTP_201_CREATED)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'created_count': len(created),
            'generated_by_ai': generated_by_ai,
            'chart_context_used': chart_context_used,
            'chart_context_warnings': chart_context_warnings,
            'components': components_payload,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_toggle_include_api(request, component_id: int):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_toggle_include_api')
    if denied_response is not None:
        return denied_response

    component = legacy_views.AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_toggle_include_api')
    if quota_response is not None:
        return quota_response

    component.include_in_summary = not component.include_in_summary
    component.save(update_fields=['include_in_summary', 'updated_at'])
    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_toggle_include_api', status.HTTP_200_OK)
    return Response({'ok': True, 'component': legacy_views.AIAdvisoryComponentRecordSerializer(component).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_refresh_api(request, component_id: int):
    from portfolio.order_flow import detect_dark_flow

    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_refresh_api')
    if denied_response is not None:
        return denied_response

    component = legacy_views.AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

    latest = legacy_views.WhaleAdvisory.objects.filter(symbol=component.symbol, user=request.user).order_by('-created_at').first()
    if latest is None:
        return Response({'ok': False, 'message': 'Chưa có advisory gốc để làm mới tab.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    ai_status = legacy_views._get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_refresh_api')
    if quota_response is not None:
        return quota_response

    timeframe = component.timeframe or legacy_views.AIAdvisoryComponentRecord.TimeframeChoice.M30
    dark_flow = detect_dark_flow(component.symbol)
    templates = legacy_views._sprint17_generate_component_templates_with_ai(
        user=request.user,
        symbol=component.symbol,
        latest_advisory=latest,
        dark_flow=dark_flow,
        timeframe=timeframe,
    )
    generated_by_ai = bool(templates)
    if not templates:
        templates = legacy_views._sprint17_build_component_templates(component.symbol, latest, dark_flow, timeframe)

    refreshed_payload = next((item for item in templates if item.get('component_type') == component.component_type), None)
    if refreshed_payload is None and templates:
        refreshed_payload = templates[0]
    if refreshed_payload is None:
        return Response({'ok': False, 'message': 'Không tạo được dữ liệu làm mới cho tab này.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    component.indicator_name = refreshed_payload.get('indicator_name') or component.indicator_name
    component.status = refreshed_payload.get('status') or component.status
    component.confidence_score = int(refreshed_payload.get('confidence_score') or component.confidence_score or 5)
    component.suggested_action = refreshed_payload.get('suggested_action') or component.suggested_action
    component.rationale_text = refreshed_payload.get('rationale_text') or component.rationale_text
    component.timeframe = refreshed_payload.get('timeframe') or component.timeframe
    component.save(update_fields=['indicator_name', 'status', 'confidence_score', 'suggested_action', 'rationale_text', 'timeframe', 'updated_at'])

    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_refresh_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'generated_by_ai': generated_by_ai,
            'component': legacy_views.AIAdvisoryComponentRecordSerializer(component).data,
            'message': 'Đã làm mới tab AI đang chọn.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_delete_api(request, component_id: int):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_delete_api')
    if denied_response is not None:
        return denied_response

    component = legacy_views.AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_delete_api')
    if quota_response is not None:
        return quota_response

    component.is_deleted = True
    component.include_in_summary = False
    component.save(update_fields=['is_deleted', 'include_in_summary', 'updated_at'])
    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_delete_api', status.HTTP_200_OK)
    return Response({'ok': True, 'message': 'Da xoa component (soft delete).'}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_clear_deleted_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_clear_deleted_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_clear_deleted_api')
    if quota_response is not None:
        return quota_response

    deleted_qs = legacy_views.AIAdvisoryComponentRecord.objects.filter(
        user=request.user,
        symbol=normalized_symbol,
        is_deleted=True,
    )
    deleted_count = deleted_qs.count()
    deleted_qs.delete()

    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_clear_deleted_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'deleted_count': deleted_count,
            'message': 'Da xoa toan bo deleted tabs.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_restore_api(request, component_id: int):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_restore_api')
    if denied_response is not None:
        return denied_response

    component = legacy_views.AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=True).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai hoac chua bi xoa.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_restore_api')
    if quota_response is not None:
        return quota_response

    component.is_deleted = False
    component.include_in_summary = True
    component.save(update_fields=['is_deleted', 'include_in_summary', 'updated_at'])
    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_restore_api', status.HTTP_200_OK)
    return Response({'ok': True, 'component': legacy_views.AIAdvisoryComponentRecordSerializer(component).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_summary_regenerate_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_summary_regenerate_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    def _tracked_response(payload: dict, response_status: int):
        legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_summary_regenerate_api', response_status)
        return Response(payload, status=response_status)

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    ai_status = legacy_views._get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return _tracked_response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status.HTTP_409_CONFLICT,
        )

    cooldown = max(int(getattr(settings, 'AI_ADVISORY_SUMMARY_REGEN_COOLDOWN_SECONDS', 30)), 5)
    lock_key = f'ai_advisory_summary_regen:{request.user.id}:{normalized_symbol}'
    if legacy_views._cache_get(lock_key):
        return _tracked_response(
            {
                'ok': False,
                'message': 'Ban vua regenerate gan day, vui long thu lai sau.',
                'retry_after_seconds': cooldown,
            },
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    component_ids = request.data.get('component_ids')
    synthesis_preference = str(request.data.get('synthesis_preference') or 'balanced').strip().lower()
    if synthesis_preference not in {'short_term_action', 'risk_management', 'balanced'}:
        synthesis_preference = 'balanced'
    raw_prompt_config = request.data.get('prompt_config')
    prompt_config = raw_prompt_config if isinstance(raw_prompt_config, dict) else None

    qs = legacy_views.AIAdvisoryComponentRecord.objects.filter(
        user=request.user,
        symbol=normalized_symbol,
        is_deleted=False,
        include_in_summary=True,
    )
    if isinstance(component_ids, list) and component_ids:
        qs = qs.filter(id__in=component_ids)

    components = list(qs.order_by('-created_at'))
    if not components:
        return _tracked_response({'ok': False, 'message': 'Khong co component active de tong hop.'}, status.HTTP_400_BAD_REQUEST)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_summary_regenerate_api')
    if quota_response is not None:
        return quota_response

    latest = legacy_views.AIAdvisoryExecutiveSummary.objects.filter(user=request.user, symbol=normalized_symbol).order_by('-summary_version').first()
    summary_payload = legacy_views._sprint17_compute_summary_from_components(components)
    
    # NEW (Sprint 35): Fetch AI news summary context if available
    news_context_str = advisory_helpers._fetch_news_context_for_advisory(
        symbol=normalized_symbol,
        user=request.user,
        max_headlines=4,
    )
    
    ai_synthesis_text = advisory_helpers._sprint17_generate_executive_synthesis_with_ai(
        user=request.user,
        symbol=normalized_symbol,
        components=components,
        summary_payload=summary_payload,
        synthesis_preference=synthesis_preference,
        news_context=news_context_str,  # NEW (Sprint 35): Include news context
        prompt_config=prompt_config,    # NEW: canonical runtime config from client
    )
    if ai_synthesis_text:
        summary_payload['synthesis_text'] = ai_synthesis_text
    summary_payload = legacy_views._sprint17_enforce_summary_narrative_policy(summary_payload, components)
    summary = legacy_views.AIAdvisoryExecutiveSummary.objects.create(
        user=request.user,
        symbol=normalized_symbol,
        summary_version=(latest.summary_version + 1) if latest else 1,
        **summary_payload,
    )
    legacy_views._cache_set(lock_key, timezone.now().isoformat(), timeout=cooldown)

    response_data = {
        'ok': True,
        'executive_summary': legacy_views.AIAdvisoryExecutiveSummarySerializer(summary).data,
        'prompt_config_version': (raw_prompt_config or {}).get('version', 2) if isinstance(raw_prompt_config, dict) else 2,
    }
    return _tracked_response(response_data, status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_summary_delete_api(request, symbol: str, summary_id: int):
    legacy_views = _legacy_views_module()
    denied_response = legacy_views._enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_summary_delete_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = legacy_views._enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_summary_delete_api')
    if quota_response is not None:
        return quota_response

    summary = legacy_views.AIAdvisoryExecutiveSummary.objects.filter(
        id=summary_id,
        user=request.user,
        symbol=normalized_symbol,
    ).first()
    if summary is None:
        return Response({'ok': False, 'message': 'Thong tin tong hop khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    summary.delete()
    legacy_views._track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_summary_delete_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'summary_id': summary_id,
            'message': 'Da xoa thong tin tong hop.',
        },
        status=status.HTTP_200_OK,
    )
