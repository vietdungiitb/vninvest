"""
Advisory domain REST API views.

Endpoints:
  GET  /core/v1/advisory/latest/<symbol>/   — latest AdvisoryRecord for symbol+date
  POST /core/v1/advisory/refresh/<symbol>/  — request advisory generation
  GET  /core/v1/advisory/history/<symbol>/  — paginated AdvisoryRecord history
"""
import logging
import re
from decimal import Decimal
from calendar import monthrange
from datetime import date as _date, timedelta

from django.conf import settings as django_settings
from django.core.cache import cache
from django.db import models, transaction
from django.utils import timezone
from rest_framework import permissions, status, throttling
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from vninvest_core.api_envelope import envelope_response

# Đặt TRƯỚC `logger = ...` để không cộng thêm một E402: các import còn lại dưới
# đây (commercial / identity_access / ops_audit / .models) đã nằm sau `logger` từ
# trước B5 nên ruff đã báo E402 cho chúng — không cần nhân thêm lỗi của chính
# dòng mình thêm vào.
from .envelope import envelope, paginated_envelope

logger = logging.getLogger(__name__)

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent

from .models import AdvisoryRecord, AdvisorySession, SystemAISettings
from .serializers import AdvisoryRecordSerializer
from .signal_norm import (
    SIGNAL_BUY,
    SIGNAL_SELL,
    normalize_signal,
    signal_to_side,
)
from .tasks import _sanitize_effective_context_for_session
from market_data.models import DailyPrice


_SYMBOL_RE = re.compile(r'^[A-Z0-9]{2,10}$')


def _validate_symbol(symbol: str) -> str:
    """Normalize to uppercase and validate VN stock symbol format."""
    symbol = symbol.strip().upper()
    if not _SYMBOL_RE.match(symbol):
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'symbol': ['Mã chứng khoán không hợp lệ. Chỉ chấp nhận 2–10 ký tự chữ và số.']})
    return symbol


def _get_or_create_active_ai_settings() -> SystemAISettings:
    active = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
    if active:
        return active
    existing = SystemAISettings.objects.order_by('-updated_at').first()
    if existing:
        existing.is_active = True
        existing.save(update_fields=['is_active'])
        return existing
    return SystemAISettings.objects.create(
        name='Default Production Config',
        is_active=True,
        ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
        max_tokens=1500,
        temperature=0.3,
        prompt_template='Default template for {symbol}',
    )



_MANUAL_TRIGGER_PLAN_LIMITS = {
    CoreTenant.PlanChoices.FREE: 3,
    CoreTenant.PlanChoices.STARTER: 10,
    CoreTenant.PlanChoices.PRO: 25,
    CoreTenant.PlanChoices.ENTERPRISE: -1,
    CoreTenant.PlanChoices.CUSTOM: -1,
    CoreTenant.PlanChoices.INTERNAL: -1,
}

_MANUAL_TRIGGER_PRIORITY = {
    CoreTenant.PlanChoices.FREE: 'community',
    CoreTenant.PlanChoices.STARTER: 'team',
    CoreTenant.PlanChoices.PRO: 'pro',
    CoreTenant.PlanChoices.ENTERPRISE: 'team',
    CoreTenant.PlanChoices.CUSTOM: 'team',
    CoreTenant.PlanChoices.INTERNAL: 'operator',
}

_MANUAL_TRIGGER_BLOCKED_STATUSES = {
    CoreTenant.StatusChoices.SUSPENDED,
    CoreTenant.StatusChoices.DEPROVISIONED,
    CoreTenant.StatusChoices.PENDING_ACTIVATION,
}


def _get_tenant(user):
    try:
        return user.core_tenant
    except CoreTenant.DoesNotExist:
        return None


def _manual_trigger_period(tenant: CoreTenant, session_date: _date) -> tuple[_date, _date]:
    if tenant.billing_period_start and tenant.billing_period_end:
        if tenant.billing_period_start <= session_date <= tenant.billing_period_end:
            return tenant.billing_period_start, tenant.billing_period_end

    period_start = _date(session_date.year, session_date.month, 1)
    period_end = _date(session_date.year, session_date.month, monthrange(session_date.year, session_date.month)[1])
    return period_start, period_end


def _manual_trigger_quota_limit(tenant: CoreTenant) -> int:
    return int(_MANUAL_TRIGGER_PLAN_LIMITS.get(str(tenant.plan), 3))


def _manual_trigger_priority(tenant: CoreTenant) -> str:
    return str(_MANUAL_TRIGGER_PRIORITY.get(str(tenant.plan), 'community'))


def _record_manual_trigger_audit(*, request, tenant: CoreTenant | None, symbol: str, session_date: _date, action: str, metadata: dict) -> None:
    try:
        AuditEvent.objects.create(
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_label=request.user.username if request.user.is_authenticated else '',
            tenant_id=str(getattr(tenant, 'public_id', '') or ''),
            action=action,
            resource_type='manual_trigger',
            resource_id=f'{symbol}:{session_date.isoformat()}',
            metadata=metadata,
        )
    except Exception as e:
        # Audit must not block manual trigger flows, but log the failure.
        logger.error(f'Audit log write failed: {e}')


def _resolve_advisory_token_budget(user) -> tuple[int, str]:
    """
    F3: resolve effective daily token budget for user.
    Prefer UserAICredential.max_tokens_per_day (per-user override, Slice C);
    fallback to system ADVISORY_TOKEN_BUDGET.
    Returns (budget, source) where source is 'user' | 'system'.
    """
    system_budget = int(getattr(django_settings, 'ADVISORY_TOKEN_BUDGET', 2000))
    try:
        from .models import UserAICredential
        cred = UserAICredential.objects.filter(user=user).first()
        if cred is not None and cred.max_tokens_per_day is not None:
            user_budget = int(cred.max_tokens_per_day)
            if user_budget > 0:
                return user_budget, 'user'
    except Exception:
        logger.exception('resolve user token budget failed; falling back to system')
    return max(1, system_budget), 'system'


def _advisory_budget_state(user, session_date: _date, tenant=None, model: str = '', provider: str = '') -> dict:
    """
    F3: compute today's token usage vs effective budget.
    soft_warning when used >= 80% of budget (and < budget);
    hard_exceeded when used >= budget (block trigger).

    R2.8: neu co dong `AIBudget` khop (4 tang x 3 chieu) thi **do hoa chinh**.
    Khong co dong nao khop => giu nguyen han vi cu (AC9 - migration khong backfill).
    """
    ai_budget = _resolve_ai_budget(user, tenant=tenant, model=model, provider=provider)
    if ai_budget['matched']:
        return {
            'tokens_used': int(ai_budget['used']) if ai_budget['dimension'] == 'tokens' else 0,
            'token_budget': int(ai_budget['limit']) if ai_budget['dimension'] == 'tokens' else 0,
            'budget_source': ai_budget['source'],
            'remaining': _budget_remaining(ai_budget),
            'pct_used': ai_budget['pct'],
            'soft_threshold': 0,
            'soft_warning': ai_budget['soft_warning'],
            'hard_exceeded': ai_budget['hard_exceeded'],
            # R2.8 - chi tiet cho client (AC3): used/limit/pct/source/dimension
            'dimension': ai_budget['dimension'],
            'used': ai_budget['used'],
            'limit': ai_budget['limit'],
            'budget_period': ai_budget['period'],
        }

    budget, source = _resolve_advisory_token_budget(user)
    total_tokens = AdvisorySession.objects.filter(user=user, session_date=session_date).aggregate(total=models.Sum('tokens_used'))['total'] or 0
    soft_threshold = int(budget * 0.8)
    remaining = max(0, int(budget) - int(total_tokens))
    soft_warning = budget > 0 and int(total_tokens) >= soft_threshold and int(total_tokens) < budget
    hard_exceeded = int(total_tokens) >= budget
    return {
        'tokens_used': int(total_tokens),
        'token_budget': int(budget),
        'budget_source': source,
        'remaining': remaining,
        'pct_used': round((int(total_tokens) / budget) * 100, 1) if budget > 0 else 0.0,
        'soft_threshold': soft_threshold,
        'soft_warning': soft_warning,
        'hard_exceeded': hard_exceeded,
        'dimension': 'tokens',
        'used': int(total_tokens),
        'limit': int(budget),
        'budget_period': 'daily',
    }


def _resolve_ai_budget(user, *, tenant=None, model: str = '', provider: str = '') -> dict:
    """R2.8 - tra trang thai rong neu khong co dong AIBudget nao khop."""
    try:
        from advisory.budget import resolve_budget

        return resolve_budget(user=user, tenant=tenant, model=model, provider=provider)
    except Exception:
        # Bang han muc khong doc duoc (chua migrate / DB het) => giu han vi cu.
        logger.exception('resolve AI budget failed; falling back to legacy token budget')
        return {'matched': False}


def _budget_scope(user, tenant=None) -> dict:
    """R2.8 - pham vi model/provider de tang 'model' va AC8 co y nghia.

    Doc **khong** giai ma khoa: chi can provider + model de chon dung hang muc.
    """
    provider, model = '', ''
    try:
        from advisory.models import UserAICredential

        cred = UserAICredential.objects.filter(user=user).only('ai_provider', 'ai_model').first()
        if cred is not None:
            provider = str(cred.ai_provider or '').strip()
            model = str(cred.ai_model or '').strip()
    except Exception:
        logger.warning('budget scope resolution failed', exc_info=True)
    return {'tenant': tenant, 'model': model, 'provider': provider}


def _budget_remaining(ai_budget: dict):
    remaining = ai_budget['limit'] - ai_budget['used']
    return remaining if remaining > 0 else Decimal('0')


def _budget_payload(budget_state: dict) -> dict:
    """R2.8 AC3 - body chuan {used, limit, pct, source, dimension} cho moi response."""
    return {
        'used': budget_state.get('used', 0),
        'limit': budget_state.get('limit', 0),
        'pct': budget_state.get('pct_used', 0.0),
        'source': budget_state.get('budget_source'),
        'dimension': budget_state.get('dimension'),
        'remaining': budget_state.get('remaining', 0),
    }


@extend_schema(
    summary='Advisory moi nhat cho mot ma',
    responses={
        200: envelope_response(),
        404: OpenApiTypes.OBJECT,
    },
)
class AdvisoryLatestView(APIView):
    """Return the latest generated advisory for a symbol on a session date."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        session_date = request.query_params.get('date') or str(_date.today())
        advisory = (
            AdvisoryRecord.objects
            .filter(user=request.user, symbol=symbol, session_date=session_date, status='generated')
            .order_by('-generated_at', '-created_at')
            .first()
        )
        if advisory is None:
            return Response(
                {'detail': f'Chưa có advisory cho {symbol} ngày {session_date}.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return envelope(AdvisoryRecordSerializer(advisory).data)

    def delete(self, request, symbol):
        symbol = _validate_symbol(symbol)
        session_date = request.query_params.get('date') or str(_date.today())
        deleted, _ = AdvisoryRecord.objects.filter(
            user=request.user,
            symbol=symbol,
            session_date=session_date,
        ).delete()
        if not deleted:
            return Response(
                {'detail': f'Không có advisory cho {symbol} ngày {session_date}.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return envelope({'symbol': symbol, 'session_date': session_date, 'deleted': True}, status=status.HTTP_200_OK)


@extend_schema(
    summary='Trang thai advisory theo id',
    # FLAT payload: this view returns bare `Response({...})`, so documenting it
    # with `envelope_response()` would claim a `{data, meta}` shape it never
    # sends. See `test_flat_views_are_not_documented_as_envelope`
    # (vninvest_core/tests/test_api_envelope_schema.py:528).
    responses={
        200: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AdvisoryStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, advisory_id):
        record = AdvisoryRecord.objects.filter(user=request.user, advisory_id=advisory_id).first()
        if record is None:
            return Response({'detail': 'Không tìm thấy advisory.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'advisory_id': str(record.advisory_id),
            'symbol': record.symbol,
            'status': record.status,
            'generated_at': record.generated_at,
            'error_message': record.error_message if record.status == record.StatusChoices.FAILED else '',
        })


@extend_schema(
    summary='Yeu cau refresh advisory cho mot ma',
    request=OpenApiTypes.OBJECT,
    responses={
        202: envelope_response(),
        400: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
        429: OpenApiTypes.OBJECT,
    },
)
class AdvisoryRefreshView(APIView):
    """
    Create a pending AdvisoryRecord to trigger async generation.

    The endpoint acts as the manual trigger API for advisory generation and
    enforces tenant entitlement, quota, cooldown, and audit logging.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [throttling.ScopedRateThrottle]
    throttle_scope = 'advisory_refresh'

    def post(self, request, symbol):
        symbol = _validate_symbol(symbol)
        prompt_config = request.data.get('prompt_config') if isinstance(request.data, dict) else None
        session_date = str(_date.today())
        session_date_obj = _date.today()
        tenant = _get_tenant(request.user)

        if tenant is None:
            return Response(
                {'detail': 'Không tìm thấy tenant của người dùng hiện tại.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if tenant.status in _MANUAL_TRIGGER_BLOCKED_STATUSES:
            _record_manual_trigger_audit(
                request=request,
                tenant=tenant,
                symbol=symbol,
                session_date=session_date_obj,
                action='access',
                metadata={
                    'job_key': 'advisory_refresh',
                    'decision': 'blocked',
                    'reason': 'tenant_status',
                    'tenant_status': tenant.status,
                    'tenant_plan': tenant.plan,
                },
            )
            return Response(
                {'detail': 'Tenant hiện tại chưa đủ điều kiện để trigger manual job.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        priority_tier = _manual_trigger_priority(tenant)
        cooldown_seconds = max(0, int(getattr(django_settings, 'ADVISORY_MANUAL_TRIGGER_COOLDOWN_SECONDS', 60)))
        user_cooldown_seconds = max(0, int(getattr(django_settings, 'ADVISORY_MANUAL_TRIGGER_USER_COOLDOWN_SECONDS', 10)))
        if user_cooldown_seconds > 0:
            _user_cd_cutoff = timezone.now() - timedelta(seconds=user_cooldown_seconds)
            _recent_user_trigger = (
                AdvisoryRecord.objects
                .filter(user=request.user)
                .order_by('-created_at', '-pk')
                .first()
            )
            if (_recent_user_trigger is not None and _recent_user_trigger.created_at
                    and _recent_user_trigger.created_at >= _user_cd_cutoff):
                _retry_after = max(1, int(user_cooldown_seconds - (timezone.now() - _recent_user_trigger.created_at).total_seconds()))
                _record_manual_trigger_audit(
                    request=request, tenant=tenant, symbol=symbol, session_date=session_date_obj,
                    action='access',
                    metadata={'job_key': 'advisory_refresh', 'decision': 'blocked', 'reason': 'user_cooldown', 'scope': 'user', 'retry_after_seconds': _retry_after},
                )
                return Response({'detail': f'Vui lòng chờ {_retry_after} giây giữa các lần refresh.', 'retry_after_seconds': _retry_after, 'scope': 'user'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        _lock_key = f'advisory:refresh:lock:{request.user.id}'
        _lock_acquired = cache.add(_lock_key, 1, timeout=15)
        if not _lock_acquired:
            _record_manual_trigger_audit(
                request=request, tenant=tenant, symbol=symbol, session_date=session_date_obj,
                action='access',
                metadata={'job_key': 'advisory_refresh', 'decision': 'blocked', 'reason': 'concurrent_refresh'},
            )
            return Response({'detail': 'Có yêu cầu refresh đang xử lý. Vui lòng thử lại.', 'retry_after_seconds': 1, 'scope': 'concurrent'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        if cooldown_seconds > 0:
            cooldown_cutoff = timezone.now() - timedelta(seconds=cooldown_seconds)
            recent_trigger = (
                AdvisoryRecord.objects
                .filter(user=request.user, symbol=symbol, session_date=session_date)
                .order_by('-created_at', '-pk')
                .first()
            )
            if recent_trigger is not None and recent_trigger.created_at and recent_trigger.created_at >= cooldown_cutoff:
                retry_after = max(1, int(cooldown_seconds - (timezone.now() - recent_trigger.created_at).total_seconds()))
                _record_manual_trigger_audit(
                    request=request, tenant=tenant, symbol=symbol, session_date=session_date_obj, action='access',
                    metadata={'job_key': 'advisory_refresh', 'decision': 'blocked', 'reason': 'cooldown', 'retry_after_seconds': retry_after, 'priority_tier': priority_tier},
                )
                cache.delete(_lock_key)
                return Response({'detail': f'Vui lòng chờ {retry_after} giây trước khi trigger lại {symbol}.', 'retry_after_seconds': retry_after, 'cooldown_seconds': cooldown_seconds}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # F3: Token budget check — hard block at 100%; soft warning at 80% rides on 201.
        budget_state = _advisory_budget_state(
            request.user, session_date_obj, **_budget_scope(request.user, tenant),
        )
        if budget_state['hard_exceeded']:
            _record_manual_trigger_audit(
                request=request,
                tenant=tenant,
                symbol=symbol,
                session_date=session_date_obj,
                action='access',
                metadata={
                    'job_key': 'advisory_refresh',
                    'decision': 'blocked',
                    'reason': 'token_budget',
                    'tokens_used': budget_state['tokens_used'],
                    'token_budget': budget_state['token_budget'],
                    'budget_source': budget_state['budget_source'],
                    'priority_tier': priority_tier,
                    'tenant_plan': tenant.plan,
                },
            )
            cache.delete(_lock_key)
            return Response(
                {
                    'detail': 'Ngân sách AI đã dùng hết trong kỳ này.',
                    'error_code': 'ai_budget_exhausted',
                    'tokens_used': budget_state['tokens_used'],
                    'token_budget': budget_state['token_budget'],
                    'budget_source': budget_state['budget_source'],
                    'budget_hard_exceeded': True,
                    'budget_soft_warning': False,
                    'budget': _budget_payload(budget_state),
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Fetch active SystemAISettings and UserProfile for Effective AI Context
        ai_settings = _get_or_create_active_ai_settings()
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)

        from advisory.models import UserAICredential
        from identity_access.security import decrypt_user_api_key

        # Try to resolve API key: 1) UserAICredential BYOK → 2) legacy preferences → 3) system key
        decrypted_key = ""
        personal_key_failed = False
        using_system_fallback = False
        personal_key_error = ""
        fallback_remaining = 0
        provider = 'openai'
        custom_endpoint = ''

        # R0.1 (D-01: self-service): model user chon thang, system lam fallback.
        user_ai_model = ''
        try:
            user_cred = UserAICredential.objects.get(user=request.user)
            provider = user_cred.ai_provider or 'openai'
            custom_endpoint = user_cred.custom_endpoint or ''
            user_ai_model = str(user_cred.ai_model or '').strip()

            if user_cred.encrypted_api_key:
                try:
                    # R4.2 AC1: khoá scope `management` (cấp để kiểm tra cấu
                    # hình) KHÔNG được chạy suy luận — nó sẽ tiêu hao tiền/token
                    # ngoài ý muốn và ngoài audit dự kiến. Ở đây ta **bỏ khoá** và
                    # rơi về khoá hệ thống trong hạn mức fallback, thay vì chặn
                    # cả request: chặn cả request biến một cấu hình sai thành mất
                    # dịch vụ, còn khoá hệ thống vẫn audit được.
                    from advisory.key_scope import resolve_user_key_for_inference

                    decrypted_key, scope_reason = resolve_user_key_for_inference(
                        user_cred, decrypt_user_api_key,
                    )
                    if scope_reason == 'key_scope_management':
                        personal_key_failed = True
                        personal_key_error = 'Khoá API đang để ở phạm vi "quản trị", không dùng cho suy luận.'
                        logger.warning(
                            'R4.2: user=%s có khoá scope=management, bo qua cho suy luan.',
                            getattr(request.user, 'id', None),
                        )
                except Exception as e:
                    personal_key_failed = True
                    personal_key_error = str(e)
                    logger.warning(f"BYOK decryption failed for user {request.user.id}: {e}")

            if not decrypted_key and user_cred.ai_provider not in ('local', 'openclaw'):
                personal_key_failed = True
                personal_key_error = personal_key_error or "API Key không được cấu hình."

            # Fallback: user key failed or missing → use system key
            if personal_key_failed or not decrypted_key:
                if user_cred.ai_provider in ('local', 'openclaw') and not decrypted_key:
                    pass  # local/openclaw don't need a key
                elif user_cred.consume_fallback_quota():
                    using_system_fallback = True
                    fallback_remaining = user_cred.fallback_quota_remaining
                    if ai_settings.metadata:
                        sys_encrypted_key = ai_settings.metadata.get('encrypted_api_key') or ""
                        if sys_encrypted_key:
                            try:
                                decrypted_key = decrypt_user_api_key(sys_encrypted_key)
                            except Exception as e:
                                logger.error(f"System key decryption failed: {e}")
                                decrypted_key = ""
                else:
                    # Fallback quota exhausted — block
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({
                        'detail': 'Hết lượt fallback sao lưu AI trong ngày hôm nay. Vui lòng cấu hình lại API Key cá nhân tại AI Command Center.',
                        'fallback_quota_remaining': 0,
                        'personal_key_error': personal_key_error,
                    })
            else:
                fallback_remaining = user_cred.fallback_quota_remaining

        except UserAICredential.DoesNotExist:
            # Legacy path: read from UserProfile.preferences
            encrypted_key = ""
            if profile.preferences and isinstance(profile.preferences, dict):
                encrypted_key = profile.preferences.get('api_key') or ""

            try:
                decrypted_key = decrypt_user_api_key(encrypted_key) if encrypted_key else ""
                if not decrypted_key and ai_settings.metadata:
                    sys_encrypted_key = ai_settings.metadata.get('encrypted_api_key') or ""
                    if sys_encrypted_key:
                        decrypted_key = decrypt_user_api_key(sys_encrypted_key)
            except Exception as e:
                logger.error(f"BYOK key decryption failed (legacy): {e}")
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'preferences': [f"Giải mã khóa API thất bại: {str(e)}"]})

        effective_context = {
            'ai_model': user_ai_model or ai_settings.ai_model,
            'max_tokens': ai_settings.max_tokens,
            'temperature': ai_settings.temperature,
            'prompt_template': ai_settings.prompt_template,
            'language': profile.language,
            'api_key': decrypted_key,
            'prompt_config': prompt_config,
            'metadata': ai_settings.metadata,
            'ai_provider': provider,
            'custom_endpoint': custom_endpoint,
            'personal_key_failed': personal_key_failed,
            'using_system_fallback': using_system_fallback,
            'personal_key_error': personal_key_error,
        }

        _user_cred = None
        try:
            from advisory.models import UserAICredential as _UIC
            _user_cred = _UIC.objects.filter(user=request.user).first()
        except Exception:
            pass
        if _user_cred is not None:
            if _user_cred.max_tokens_per_day is not None:
                _remaining = budget_state['remaining']
                effective_max = min(int(ai_settings.max_tokens or 2000), max(1, _remaining))
                effective_context['max_tokens'] = effective_max
            if _user_cred.temperature is not None:
                effective_context['temperature'] = round(max(0.0, min(1.0, float(_user_cred.temperature))), 4)
        effective_context['token_budget'] = budget_state['token_budget']
        effective_context['budget_source'] = budget_state['budget_source']

        _snapshot_context = _sanitize_effective_context_for_session(effective_context)

        quota_start, quota_end = _manual_trigger_period(tenant, session_date_obj)
        quota_defaults = {
            'api_calls_used': 0,
            'api_calls_limit': _manual_trigger_quota_limit(tenant),
            'symbols_used': 0,
            'symbols_limit': -1,
            'users_used': 0,
            'users_limit': -1,
            'storage_mb_used': 0,
            'storage_mb_limit': -1,
        }

        with transaction.atomic():
            quota_record, _created = QuotaRecord.objects.get_or_create(
                tenant=tenant,
                period_start=quota_start,
                period_end=quota_end,
                defaults=quota_defaults,
            )
            # `get_or_create` does NOT lock the row. Two concurrent requests can
            # both read `api_calls_used` here, both pass the limit check below,
            # and both increment - letting a tenant exceed its allowance, which
            # then feeds metered billing.
            #
            # Re-read under a row lock when the row already existed. A row this
            # transaction just created needs no lock: we hold it exclusively.
            if not _created:
                quota_record = QuotaRecord.objects.select_for_update().get(
                    pk=quota_record.pk,
                )
            quota_limit = quota_record.api_calls_limit
            if quota_limit < 0:
                quota_limit = _manual_trigger_quota_limit(tenant)

            if quota_limit >= 0 and quota_record.api_calls_used >= quota_limit:
                _record_manual_trigger_audit(
                    request=request,
                    tenant=tenant,
                    symbol=symbol,
                    session_date=session_date_obj,
                    action='access',
                    metadata={
                        'job_key': 'advisory_refresh',
                        'decision': 'blocked',
                        'reason': 'quota_exhausted',
                        'quota_period_start': quota_start.isoformat(),
                        'quota_period_end': quota_end.isoformat(),
                        'quota_used': quota_record.api_calls_used,
                        'quota_limit': quota_limit,
                        'priority_tier': priority_tier,
                        'tenant_plan': tenant.plan,
                    },
                )
                cache.delete(_lock_key)
                return Response(
                    {
                        'detail': 'Quota manual trigger đã hết cho chu kỳ hiện tại.',
                        'quota': {
                            'period_start': quota_start.isoformat(),
                            'period_end': quota_end.isoformat(),
                            'used': quota_record.api_calls_used,
                            'limit': quota_limit,
                        },
                    },
                    status=status.HTTP_402_PAYMENT_REQUIRED,
                )

            context_snapshot = {
                'manual_trigger': {
                    'job_key': 'advisory_refresh',
                    'tenant_plan': tenant.plan,
                    'tenant_status': tenant.status,
                    'priority_tier': priority_tier,
                },
                'effective_ai_context': _snapshot_context,
            }

            # R0.8 — chặn tạo trùng (user, symbol, session_date). Đây là view
            # duy nhất sinh record, nên check ở đây là cổng chặn duy nhất cần
            # có; unique constraint trên AdvisorySession chỉ bảo vệ bảng
            # session, không bảo vệ AdvisoryRecord.
            _existing = (
                AdvisoryRecord.objects
                .filter(user=request.user, symbol=symbol, session_date=session_date)
                .order_by('-created_at')
                .first()
            )
            if _existing is not None:
                quota_record.api_calls_used += 1
                quota_record.save(update_fields=['api_calls_used', 'updated_at'])
                return Response(
                    {
                        'detail': 'Đã có tư vấn cho mã này trong phiên hiện tại.',
                        'error_code': 'advisory_already_exists',
                        'advisory_id': str(_existing.advisory_id),
                        'status': _existing.status,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            record = AdvisoryRecord.objects.create(
                symbol=symbol,
                session_date=session_date,
                user=request.user,
                status='pending',
                ai_model=effective_context['ai_model'],
                advisory_text='',
                context_snapshot=context_snapshot,
                tokens_used=0,
            )

            quota_record.api_calls_used += 1
            quota_record.save(update_fields=['api_calls_used', 'updated_at'])

        audit_metadata = {
            'job_key': 'advisory_refresh',
            'decision': 'accepted',
            'task_id': str(record.advisory_id),
            'priority_tier': priority_tier,
            'tenant_plan': tenant.plan,
            'tenant_status': tenant.status,
            'quota_period_start': quota_start.isoformat(),
            'quota_period_end': quota_end.isoformat(),
            'quota_used_after': quota_record.api_calls_used,
            'quota_limit': quota_limit,
            'cooldown_seconds': cooldown_seconds,
            'budget_soft_warning': budget_state['soft_warning'],
            'budget_tokens_used': budget_state['tokens_used'],
            'budget_token_budget': budget_state['token_budget'],
            'budget_source': budget_state['budget_source'],
        }
        _record_manual_trigger_audit(
            request=request,
            tenant=tenant,
            symbol=symbol,
            session_date=session_date_obj,
            action='create',
            metadata=audit_metadata,
        )

        # Trigger Celery task outside atomic transaction block to avoid race conditions
        from advisory.tasks import generate_advisory_task
        generate_advisory_task.delay(str(record.advisory_id), effective_context, symbol)

        response_data = AdvisoryRecordSerializer(record).data
        response_data['task_id'] = str(record.advisory_id)
        # F3: soft 80% warning on accepted (201) responses.
        response_data['budget_soft_warning'] = bool(budget_state['soft_warning'])
        response_data['budget'] = {
            'tokens_used': budget_state['tokens_used'],
            'token_budget': budget_state['token_budget'],
            'budget_source': budget_state['budget_source'],
            'remaining': budget_state['remaining'],
            'pct_used': budget_state['pct_used'],
            'soft_threshold': budget_state['soft_threshold'],
            # R2.8 AC3/AC4 - bo sung khoa chuan de client doc mot noi.
            **_budget_payload(budget_state),
        }
        response_data['manual_trigger'] = {
            'job_key': 'advisory_refresh',
            'priority_tier': priority_tier,
            'quota': {
                'period_start': quota_start.isoformat(),
                'period_end': quota_end.isoformat(),
                'used': quota_record.api_calls_used,
                'limit': quota_limit,
            },
            'cooldown_seconds': cooldown_seconds,
            'tenant_plan': tenant.plan,
            'tenant_status': tenant.status,
        }
        # Fallback flags
        if personal_key_failed:
            response_data['personal_key_failed'] = True
            response_data['using_system_fallback'] = using_system_fallback
            response_data['personal_key_error'] = personal_key_error
            response_data['fallback_quota_remaining'] = fallback_remaining
        cache.delete(_lock_key)
        return envelope(response_data, status=status.HTTP_201_CREATED)


from vninvest_core.pagination import CoreCursorPagination

class AdvisoryRecordCursorPagination(CoreCursorPagination):
    ordering = ('-generated_at', '-id')
    page_size = 20


@extend_schema(
    summary='Lich su advisory cua mot ma',
    responses={
        200: envelope_response(),
        404: OpenApiTypes.OBJECT,
    },
)
class AdvisoryHistoryView(APIView):
    """Paginated list of advisory records for a symbol (newest first)."""
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AdvisoryRecordCursorPagination

    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        qs = (
            AdvisoryRecord.objects
            .filter(user=request.user, symbol=symbol, status='generated')
            .order_by('-generated_at', '-id')
        )
        session_date = request.query_params.get('session_date')
        if session_date:
            qs = qs.filter(session_date=session_date)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AdvisoryRecordSerializer(page, many=True)
            paged = paginator.get_paginated_response(serializer.data)
            # Bọc cả khối phân trang (next/previous/results của cursor) trong
            # `data`. `dict(paged.data)` vì paginator trả `Response`, không trả dict.
            # `AdvisoryRecordCursorPagination` kế thừa `CoreCursorPagination` nên
            # **không** có `count` — giữ nguyên, không tự thêm.
            return paginated_envelope(dict(paged.data))

        # Nhánh fallback: `paginate_queryset` trả `None` (pagination tắt). Phải
        # bọc **giống hệt** nhánh trên, nếu không endpoint này có HAI shape
        # cùng lúc — đúng lỗi `service_ops` từng mắc và không test nào bắt được.
        serializer = AdvisoryRecordSerializer(qs, many=True)
        return paginated_envelope({'results': serializer.data})


@extend_schema(
    summary='Thong tin tu dong refresh advisory',
    responses={
        200: envelope_response(),
        404: OpenApiTypes.OBJECT,
    },
)
class AdvisoryRefreshInfoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        session_date = timezone.localdate()
        try:
            from identity_access.utils.resolve_tenant import resolve_tenant

            status_tenant = resolve_tenant(request)
        except Exception:
            status_tenant = None
        budget_state = _advisory_budget_state(
            request.user, session_date, **_budget_scope(request.user, status_tenant),
        )

        max_auto = 24
        try:
            from .models import SystemAISettings, UserAICredential
            system_settings = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
            metadata = system_settings.metadata if system_settings and isinstance(system_settings.metadata, dict) else {}
            if metadata.get('advisory_max_auto_refreshes_per_day') is not None:
                max_auto = int(metadata['advisory_max_auto_refreshes_per_day'])
            credential = UserAICredential.objects.filter(user=request.user).first()
            if credential is not None and credential.max_auto_refreshes_per_day is not None:
                max_auto = int(credential.max_auto_refreshes_per_day)
        except Exception:
            logger.exception('resolve advisory max auto refreshes failed')
            max_auto = 24
        max_auto = max(0, max_auto)

        refreshes_used_today = AdvisoryRecord.objects.filter(
            user=request.user,
            created_at__date=session_date,
        ).count()

        return envelope({
            'symbol': symbol,
            'session_date': session_date.isoformat(),
            'auto_refresh': False,
            'next_refresh_at': None,
            'tokens_used': budget_state['tokens_used'],
            'token_budget': budget_state['token_budget'],
            'tokens_remaining_today': budget_state['remaining'],
            'pct_used': budget_state['pct_used'],
            'budget_source': budget_state['budget_source'],
            'budget_soft_warning': budget_state['soft_warning'],
            'budget_hard_exceeded': budget_state['hard_exceeded'],
            'advisory_max_auto_refreshes_per_day': max_auto,
            'auto_refreshes_used_today': refreshes_used_today,
            'user_cooldown_seconds': int(getattr(django_settings, 'ADVISORY_MANUAL_TRIGGER_USER_COOLDOWN_SECONDS', 10)),
        })


_BACKTEST_WINDOWS = (30, 90)
_BACKTEST_MIN_SAMPLES = 5
_BACKTEST_RELIABLE_SAMPLES = 30
_BACKTEST_MAX_SAMPLES = 200


def _extract_backtest_side(record: AdvisoryRecord):
    """R0.1 — dùng SSOT `signal_norm.normalize_signal` thay vì regex tại chỗ.

    Regex cũ `re.compile(r'[^A-Z ]')` xoá dấu tiếng Việt nên `BÁN` thành
    `B N` -> `None` (mất sạch tín hiệu SELL tiếng Việt) và `KHÔNG MUA` thành
    `KHNG MUA` -> khớp BUY (ngược chiều). Đã kiểm chứng 5/14 case MISMATCH.
    """
    structured = getattr(record, 'structured_output', None) or {}
    if not isinstance(structured, dict):
        return None
    for key in ('signal', 'recommendation'):
        value = structured.get(key)
        if not isinstance(value, str) or not value.strip():
            continue
        signal = normalize_signal(value)
        if signal in (SIGNAL_BUY, SIGNAL_SELL):
            return signal_to_side(signal)
    return None



@extend_schema(
    summary='Backtest advisory theo cua so',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AdvisoryBacktestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        try:
            window_days = int(request.query_params.get('window', 30))
        except (TypeError, ValueError):
            window_days = -1
        if window_days not in _BACKTEST_WINDOWS:
            return Response(
                {'detail': f'Tham số window phải là một trong {_BACKTEST_WINDOWS}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        cutoff = today - timedelta(days=window_days)
        raw_records = list(
            AdvisoryRecord.objects
            .filter(user=request.user, symbol=symbol, status='generated', session_date__gte=cutoff)
            .order_by('session_date', '-created_at', '-id')
        )
        records_considered = len(raw_records)
        deduped_by_date = {}
        for record in raw_records:
            deduped_by_date.setdefault(record.session_date, record)
        duplicate_signals_skipped = records_considered - len(deduped_by_date)
        records = sorted(deduped_by_date.values(), key=lambda r: (r.session_date, r.id))

        price_rows = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__gte=cutoff - timedelta(days=10))
            .order_by('date')
            .values_list('date', 'close')
        )
        closes = [(d, float(c)) for d, c in price_rows]
        close_by_date = {d: c for d, c in closes}

        samples = []
        skipped_unscorable = 0
        skipped_missing_price = 0
        for record in records:
            side = _extract_backtest_side(record)
            if side not in ('BUY', 'SELL'):
                skipped_unscorable += 1
                continue
            base_date = record.session_date
            base_close = close_by_date.get(base_date)
            if base_close is None:
                prior = [d for d, _ in closes if d <= base_date]
                if not prior:
                    skipped_missing_price += 1
                    continue
                base_date = prior[-1]
                base_close = close_by_date[base_date]
            if not base_close or base_close <= 0:
                skipped_missing_price += 1
                continue
            later = [c for d, c in closes if d > base_date]
            if len(later) < 5:
                skipped_missing_price += 1
                continue
            fwd = {'t1': later[0], 't3': later[2], 't5': later[4]}
            rets = {k: (v - base_close) / base_close for k, v in fwd.items()}
            direction = 1.0 if side == 'BUY' else -1.0
            hits = {k: (r * direction) > 0 for k, r in rets.items()}
            samples.append({
                'session_date': record.session_date.isoformat(),
                'side': side,
                'base_close': round(base_close, 2),
                'r_t1': round(rets['t1'], 4),
                'r_t3': round(rets['t3'], 4),
                'r_t5': round(rets['t5'], 4),
                'hit_t1': hits['t1'],
                'hit_t3': hits['t3'],
                'hit_t5': hits['t5'],
            })
            if len(samples) >= _BACKTEST_MAX_SAMPLES * 2:
                break

        truncated = len(samples) > _BACKTEST_MAX_SAMPLES
        if truncated:
            samples = samples[-_BACKTEST_MAX_SAMPLES:]

        n = len(samples)
        aggregates_ok = n >= _BACKTEST_MIN_SAMPLES

        def _avg(key):
            if not aggregates_ok:
                return None
            return round(sum(s[key] for s in samples) / n, 4) if n else None

        def _rate(key):
            if not aggregates_ok:
                return None
            return round(sum(1 for s in samples if s[key]) / n, 4) if n else None

        hit_t5 = _rate('hit_t5')
        return envelope({
            'symbol': symbol,
            'window_days': window_days,
            'n_samples': n,
            'records_considered': records_considered,
            'duplicate_signals_skipped': duplicate_signals_skipped,
            'truncated': truncated,
            'reliable': aggregates_ok and n >= _BACKTEST_RELIABLE_SAMPLES,
            'enough_data': aggregates_ok,
            'hit_rate': hit_t5,
            'hit_rate_t1': _rate('hit_t1'),
            'hit_rate_t3': _rate('hit_t3'),
            'hit_rate_t5': hit_t5,
            'avg_return_t1': _avg('r_t1'),
            'avg_return_t3': _avg('r_t3'),
            'avg_return_t5': _avg('r_t5'),
            'skipped_unscorable': skipped_unscorable,
            'skipped_missing_price': skipped_missing_price,
            'samples': samples,
        })
