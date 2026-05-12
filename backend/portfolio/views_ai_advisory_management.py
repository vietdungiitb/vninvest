import re
from datetime import timedelta

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


_MANUAL_QUEUE_PRIORITY_BY_TIER = {
    'community': 0,
    'pro': 6,
    'team': 9,
}


def _manual_queue_priority_for_plan(plan: str) -> int:
    normalized_plan = str(plan or '').strip().lower()
    if normalized_plan in {'premium', 'admin'}:
        return _MANUAL_QUEUE_PRIORITY_BY_TIER['team']
    if normalized_plan == 'pro':
        return _MANUAL_QUEUE_PRIORITY_BY_TIER['pro']
    return _MANUAL_QUEUE_PRIORITY_BY_TIER['community']


class WhaleAdvisoryListView(generics.ListAPIView):
    """
    GET /api/portfolio/ai-advisory/
    Pro+: trả về danh sách advisory (ẩn ai_detail nếu chưa Premium).
    """

    def get_permissions(self):
        legacy_views = _legacy_views_module()
        return [IsAuthenticated(), legacy_views.IsProPlan()]

    def get_serializer_class(self):
        legacy_views = _legacy_views_module()
        return legacy_views.WhaleAdvisorySerializer

    def get_queryset(self):
        legacy_views = _legacy_views_module()
        qs = (
            legacy_views.WhaleAdvisory.objects
            .filter(user=self.request.user)
            .order_by('-created_at')
        )

        refresh_status = str(self.request.query_params.get('refresh_status') or '').strip().lower()
        now = timezone.now()
        if refresh_status == 'ready':
            qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__lte=now)
        elif refresh_status == 'pending':
            qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__gt=now)
        elif refresh_status == 'recent':
            cutoff = now - timedelta(hours=4)
            qs = qs.filter(created_at__gte=cutoff)

        watchlist_only = str(self.request.query_params.get('watchlist_only') or '').strip().lower()
        if watchlist_only == 'true':
            tracked_symbols = legacy_views.TrackedSymbol.objects.filter(user=self.request.user).values_list('symbol', flat=True)
            qs = qs.filter(symbol__in=tracked_symbols)

        seen_symbols = set()
        result = []
        for advisory in qs:
            symbol = str(advisory.symbol or '').strip().upper()
            if symbol and symbol not in seen_symbols:
                seen_symbols.add(symbol)
                result.append(advisory)
                if len(result) >= 100:
                    break
        return result

    def list(self, request, *args, **kwargs):
        legacy_views = _legacy_views_module()
        qs = self.get_queryset()
        plan = legacy_views._get_plan(request.user)
        contract = str(request.query_params.get('contract') or '').strip().lower()

        if contract == 'canonical':
            user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
            items = []
            for advisory in qs:
                items.append(_build_advisory_canonical_payload(request.user, advisory, user_cfg=user_cfg))
            return Response({'ok': True, 'contract_version': 'canonical_v1', 'items': items})

        data = legacy_views.WhaleAdvisorySerializer(qs, many=True).data
        if plan not in ('premium', 'admin'):
            for item in data:
                item['ai_detail'] = ''
        return Response(data)


def _extract_confidence_from_summary(ai_summary: str) -> float | None:
    summary_text = str(ai_summary or '')
    matched = re.search(r'(\d{1,3})\s*%', summary_text)
    if not matched:
        return None
    try:
        value = float(matched.group(1))
    except (TypeError, ValueError):
        return None
    return max(0.0, min(value, 100.0))


def _build_advisory_canonical_payload(user, advisory, *, user_cfg=None) -> dict:
    legacy_views = _legacy_views_module()
    if advisory is None:
        return {
            'advisory_id': None,
            'symbol': None,
            'created_at': None,
            'source': None,
            'ai_provider': None,
            'ai_model': None,
            'summary_text': '',
            'detail_text': '',
            'confidence': None,
            'risk_level': None,
            'recommendation': None,
            'output_language': str(getattr(user_cfg, 'language', 'vi') or 'vi').strip().lower(),
            'freshness': {'next_refresh_at': None, 'is_stale': False},
        }

    if user_cfg is None:
        user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=user)

    plan = legacy_views._get_plan(user)
    detail_text = str(advisory.ai_detail or '') if plan in ('premium', 'admin') else ''
    next_refresh_at = advisory.next_refresh_at
    if next_refresh_at is None:
        interval_hours = max(int(getattr(user_cfg, 'advisory_refresh_interval_hours', 24) or 24), 1)
        next_refresh_at = advisory.created_at + timedelta(hours=interval_hours)
    now = timezone.now()

    return {
        'advisory_id': advisory.id,
        'symbol': advisory.symbol,
        'created_at': advisory.created_at,
        'source': advisory.source,
        'ai_provider': advisory.ai_provider,
        'ai_model': advisory.ai_model,
        'summary_text': str(advisory.ai_summary or ''),
        'detail_text': detail_text,
        'confidence': _extract_confidence_from_summary(advisory.ai_summary),
        'risk_level': str(advisory.severity or ''),
        'recommendation': str(advisory.side or ''),
        'output_language': str(getattr(user_cfg, 'language', 'vi') or 'vi').strip().lower(),
        'freshness': {
            'next_refresh_at': next_refresh_at,
            'is_stale': bool(next_refresh_at and next_refresh_at <= now),
        },
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_advisory_canonical_symbol_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    entitlement_check = legacy_views.IsProPlan()
    denied_response = entitlement_check.has_permission(request, ai_advisory_canonical_symbol_api)
    if not denied_response:
        return Response({'detail': 'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    latest = (
        legacy_views.WhaleAdvisory.objects
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-created_at')
        .first()
    )

    return Response(
        {
            'ok': True,
            'contract_version': 'canonical_v1',
            'symbol': normalized_symbol,
            'advisory': _build_advisory_canonical_payload(request.user, latest, user_cfg=user_cfg),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whale_advisory_auto_refresh_info_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    entitlement_check = legacy_views.IsProPlan()
    if not entitlement_check.has_permission(request, whale_advisory_auto_refresh_info_api):
        return Response({'detail': 'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    tracked = legacy_views.TrackedSymbol.objects.filter(user=request.user, symbol=normalized_symbol).first()
    if tracked is None:
        return Response(
            {'ok': False, 'symbol': normalized_symbol, 'message': 'Symbol chưa nằm trong danh sách theo dõi.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    latest = legacy_views.WhaleAdvisory.objects.filter(user=request.user, symbol=normalized_symbol).order_by('-created_at').first()
    tokens_today = legacy_views.AdvisoryTokenLog.objects.filter(
        user=request.user,
        created_at__date=timezone.localdate(),
    ).aggregate(total=Sum('tokens_used'))['total'] or 0
    auto_refreshes_today = legacy_views.AdvisoryTokenLog.objects.filter(
        user=request.user,
        source=legacy_views.AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
        created_at__date=timezone.localdate(),
    ).count()

    response_payload = {
        'ok': True,
        'symbol': normalized_symbol,
        'tracked_since': tracked.added_at,
        'advisory_auto_generation_enabled': bool(user_cfg.advisory_auto_generation_enabled),
        'advisory_manual_refresh_enabled': bool(user_cfg.advisory_manual_refresh_enabled),
        'advisory_refresh_interval_hours': int(user_cfg.advisory_refresh_interval_hours or 24),
        'advisory_max_auto_refreshes_per_day': int(user_cfg.advisory_max_auto_refreshes_per_day or 0),
        'auto_refreshes_used_today': int(auto_refreshes_today),
        'auto_refreshes_remaining_today': max(int(user_cfg.advisory_max_auto_refreshes_per_day or 0) - int(auto_refreshes_today), 0),
        'daily_token_budget': int(user_cfg.advisory_max_tokens_per_day or 0),
        'tokens_used_today': int(tokens_today),
        'tokens_remaining_today': max(int(user_cfg.advisory_max_tokens_per_day or 0) - int(tokens_today), 0),
    }

    if latest is None:
        response_payload.update({
            'status': 'no_advisory',
            'advisory_id': None,
            'last_refreshed_at': None,
            'next_refresh_at': None,
            'refresh_count': 0,
            'is_stale': False,
            'is_auto_generated': False,
            'source': None,
        })
        return Response(response_payload, status=status.HTTP_200_OK)

    next_refresh_at = latest.next_refresh_at or (
        latest.created_at + timedelta(hours=max(int(user_cfg.advisory_refresh_interval_hours or 24), 1))
    )
    response_payload.update({
        'status': 'ready' if next_refresh_at <= timezone.now() else 'scheduled',
        'advisory_id': latest.id,
        'last_refreshed_at': latest.created_at,
        'next_refresh_at': next_refresh_at,
        'refresh_count': int(latest.refresh_count or 0),
        'is_stale': next_refresh_at <= timezone.now(),
        'is_auto_generated': bool(latest.is_auto_generated),
        'source': latest.source,
    })
    return Response(response_payload, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whale_advisory_manual_refresh_status_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    tracked = legacy_views.TrackedSymbol.objects.filter(user=request.user, symbol=normalized_symbol).first()
    if tracked is None:
        return Response(
            {'ok': False, 'symbol': normalized_symbol, 'message': 'Symbol chưa nằm trong danh sách theo dõi.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'whale_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'
    refresh_lock_value = legacy_views._cache_get(refresh_lock_key)

    latest_manual = (
        legacy_views.WhaleAdvisory.objects
        .filter(user=request.user, symbol=normalized_symbol, source=legacy_views.WhaleAdvisory.SourceChoices.USER_REFRESH)
        .order_by('-created_at')
        .first()
    )

    entitlements = legacy_views.resolve_user_entitlements(request.user)
    manual_enabled = bool(user_cfg.advisory_manual_refresh_enabled)
    locked = bool(refresh_lock_value) and manual_enabled
    retry_after_seconds = refresh_cooldown if locked else 0

    response_payload = {
        'ok': True,
        'symbol': normalized_symbol,
        'queue_name': 'manual_on_demand',
        'plan': entitlements.get('plan'),
        'tier': entitlements.get('tier'),
        'can_request_manual_refresh': bool(entitlements.get('can_read_whale_advisory', False)),
        'manual_refresh_enabled': manual_enabled,
        'manual_refresh_cooldown_seconds': refresh_cooldown,
        'status': 'disabled' if not manual_enabled else ('cooldown' if locked else 'ready'),
        'retry_after_seconds': retry_after_seconds,
        'next_retry_at': timezone.now() + timedelta(seconds=refresh_cooldown) if locked else None,
        'is_locked': locked,
        'last_manual_refresh_at': latest_manual.created_at if latest_manual is not None else None,
        'last_manual_refresh_id': latest_manual.id if latest_manual is not None else None,
        'last_manual_refresh_count': int(latest_manual.refresh_count or 0) if latest_manual is not None else 0,
        'last_manual_refresh_source': latest_manual.source if latest_manual is not None else None,
    }
    return Response(response_payload, status=status.HTTP_200_OK)


def _is_celery_worker_available() -> bool:
    try:
        from config.celery import app as celery_app

        inspect = celery_app.control.inspect(timeout=1.0)
        ping_result = inspect.ping() or {}
        return bool(ping_result)
    except Exception:
        return False


def _submit_advisory_generation_with_fallback(
    *,
    payload_kwargs: dict,
    prefer_sync_fallback: bool,
    force_sync: bool = False,
    context_label: str = 'advisory_generation',
) -> dict:
    legacy_views = _legacy_views_module()
    from portfolio.tasks import generate_whale_advisory_task
    task_queue = None
    task_priority = None
    source_key = str(payload_kwargs.get('source') or '').strip().lower()
    if source_key == legacy_views.WhaleAdvisory.SourceChoices.USER_REFRESH:
        task_queue = 'manual_on_demand'
        user_id = payload_kwargs.get('user_id')
        if user_id is not None:
            try:
                from django.contrib.auth.models import User

                user = User.objects.select_related('user_config').get(pk=int(user_id))
                task_priority = _manual_queue_priority_for_plan(legacy_views._get_plan(user))
            except Exception:
                task_priority = None

    if force_sync:
        try:
            result = generate_whale_advisory_task.run(**payload_kwargs)
            return {'queued': False, 'task_id': None, 'sync': True, 'result': result}
        except Exception as exc:
            legacy_views.logger.warning('%s force sync failed: %s', context_label, exc)

    worker_available = legacy_views._is_celery_worker_available()
    if worker_available:
        try:
            async_kwargs = {'kwargs': payload_kwargs, 'countdown': 0}
            if task_queue:
                async_kwargs['queue'] = task_queue
            if task_priority is not None:
                async_kwargs['priority'] = task_priority
            task = generate_whale_advisory_task.apply_async(**async_kwargs)
            return {'queued': True, 'task_id': task.id, 'sync': False}
        except Exception as exc:
            legacy_views.logger.warning('%s queue submit failed (fallback=%s): %s', context_label, prefer_sync_fallback, exc)
            if not prefer_sync_fallback:
                return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': str(exc)}
    elif not prefer_sync_fallback:
        return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': 'no_worker_available'}

    if not prefer_sync_fallback:
        return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': 'sync_fallback_disabled'}

    try:
        result = generate_whale_advisory_task.run(**payload_kwargs)
        return {'queued': False, 'task_id': None, 'sync': True, 'result': result}
    except Exception as exc:
        legacy_views.logger.exception('%s sync fallback failed: %s', context_label, exc)
        return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': str(exc)}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_whale_advisory_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'queued': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    entitlements = legacy_views.resolve_user_entitlements(request.user)
    if not entitlements.get('can_read_whale_advisory', False):
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'reason': 'plan_upgrade_required',
                'message': 'Gói hiện tại chưa hỗ trợ Refresh AI Advisory. Vui lòng nâng cấp lên Pro để sử dụng tính năng này.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
    ai_status = legacy_views._get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'whale_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'

    last_refresh_ts = legacy_views._cache_get(refresh_lock_key)
    if last_refresh_ts:
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Bạn vừa refresh gần đây, vui lòng thử lại sau.',
                'retry_after_seconds': refresh_cooldown,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    latest = legacy_views.WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    latest_symbol_side = (
        legacy_views.WhaleAdvisory.objects
        .filter(symbol=normalized_symbol)
        .exclude(side__iexact='UNKNOWN')
        .order_by('-created_at')
        .values_list('side', flat=True)
        .first()
    )

    regenerate_quota = legacy_views.consume_quota(
        request.user,
        quota_key='ai_regenerate_per_day',
        entitlements=entitlements,
    )
    if not regenerate_quota.get('allowed', True):
        return Response(
            legacy_views.build_quota_exceeded_payload(regenerate_quota, 'Ban da dung het quota refresh AI trong ngay.'),
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    matched_value_vnd = float(latest.matched_value) if latest else float(user_cfg.whale_alert_threshold or 500) * 1_000_000
    advisory_side = latest.side if latest else str(latest_symbol_side or 'UNKNOWN').upper()
    advisory_threshold = float(latest.threshold or 0) if latest else float(user_cfg.whale_alert_threshold or 500) * 1_000_000

    task_kwargs = {
        'symbol': normalized_symbol,
        'matched_value_vnd': matched_value_vnd,
        'side': advisory_side,
        'threshold': advisory_threshold,
        'force_refresh': True,
        'user_id': request.user.id,
        'source': legacy_views.WhaleAdvisory.SourceChoices.USER_REFRESH,
    }

    prefer_sync_fallback = bool(getattr(settings, 'WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER', True))
    should_force_sync_first_create = latest is None and prefer_sync_fallback

    if should_force_sync_first_create:
        legacy_views.logger.info(
            'Force sync first advisory creation for user=%s symbol=%s to avoid queue-only bootstrap',
            request.user.id,
            normalized_symbol,
        )

    submit_result = _submit_advisory_generation_with_fallback(
        payload_kwargs=task_kwargs,
        prefer_sync_fallback=prefer_sync_fallback,
        force_sync=should_force_sync_first_create,
        context_label='refresh_whale_advisory_api',
    )

    if submit_result.get('queue_error'):
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Không thể xử lý advisory lúc này. Vui lòng thử lại sau.',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    legacy_views._cache_set(refresh_lock_key, timezone.now().isoformat(), timeout=refresh_cooldown)
    if submit_result.get('queued'):
        return Response(
            {
                'queued': True,
                'symbol': normalized_symbol,
                'task_id': submit_result.get('task_id'),
                'runtime_ai_source': ai_status.get('source'),
                'runtime_ai_provider': ai_status.get('provider'),
                'runtime_ai_model': ai_status.get('model'),
                'message': 'Đã nhận yêu cầu refresh advisory.' if latest else 'Đã nhận yêu cầu tạo advisory đầu tiên cho mã này.',
            },
            status=status.HTTP_202_ACCEPTED,
        )

    result = submit_result.get('result')
    if isinstance(result, dict) and result.get('status') == 'ok':
        return Response(
            {
                'queued': False,
                'fallback_sync': True,
                'symbol': normalized_symbol,
                'advisory_id': result.get('advisory_id'),
                'runtime_ai_source': result.get('ai_source') or ai_status.get('source'),
                'runtime_ai_provider': result.get('ai_provider') or ai_status.get('provider'),
                'runtime_ai_model': result.get('ai_model') or ai_status.get('model'),
                'message': 'Đã tạo advisory ngay lập tức (fallback đồng bộ).',
            },
            status=status.HTTP_200_OK,
        )

    reason = result.get('reason') if isinstance(result, dict) else 'unknown'
    return Response(
        {
            'queued': False,
            'fallback_sync': True,
            'symbol': normalized_symbol,
            'runtime_ai_source': ai_status.get('source'),
            'runtime_ai_provider': ai_status.get('provider'),
            'runtime_ai_model': ai_status.get('model'),
            'message': f'Đã xử lý fallback đồng bộ nhưng chưa tạo advisory mới (reason={reason}).',
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_current_whale_advisory_api(request, symbol: str):
    legacy_views = _legacy_views_module()
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    entitlements = legacy_views.resolve_user_entitlements(request.user)
    if not entitlements.get('can_read_whale_advisory', False):
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'reason': 'plan_upgrade_required',
                'message': 'Gói hiện tại chưa hỗ trợ thao tác này. Vui lòng nâng cấp lên Pro.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    latest = (
        legacy_views.WhaleAdvisory.objects
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-created_at')
        .first()
    )
    if latest is None:
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'message': 'Không tìm thấy advisory hiện tại để xóa.',
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    deleted_id = latest.id
    latest.delete()
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'deleted_id': deleted_id,
            'message': 'Đã xóa advisory hiện tại.',
        },
        status=status.HTTP_200_OK,
    )
