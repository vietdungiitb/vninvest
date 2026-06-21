"""
Advisory domain REST API views.

Endpoints:
  GET  /core/v1/advisory/latest/<symbol>/   — latest AdvisoryRecord for symbol+date
  POST /core/v1/advisory/refresh/<symbol>/  — request advisory generation
  GET  /core/v1/advisory/history/<symbol>/  — paginated AdvisoryRecord history
"""
import logging
import re
from calendar import monthrange
from datetime import date as _date, timedelta

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent

from .models import AdvisoryRecord, AdvisorySession, SystemAISettings
from .serializers import AdvisoryRecordSerializer


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


class AdvisoryLatestView(APIView):
    """Return the latest generated advisory for a symbol on a session date."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        session_date = request.query_params.get('date') or str(_date.today())
        advisory = (
            AdvisoryRecord.objects
            .filter(symbol=symbol, session_date=session_date, status='generated')
            .order_by('-generated_at', '-created_at')
            .first()
        )
        if advisory is None:
            return Response(
                {'detail': f'Chưa có advisory cho {symbol} ngày {session_date}.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(AdvisoryRecordSerializer(advisory).data)


class AdvisoryRefreshView(APIView):
    """
    Create a pending AdvisoryRecord to trigger async generation.

    The endpoint acts as the manual trigger API for advisory generation and
    enforces tenant entitlement, quota, cooldown, and audit logging.
    """
    permission_classes = [permissions.IsAuthenticated]

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
                    request=request,
                    tenant=tenant,
                    symbol=symbol,
                    session_date=session_date_obj,
                    action='access',
                    metadata={
                        'job_key': 'advisory_refresh',
                        'decision': 'blocked',
                        'reason': 'cooldown',
                        'retry_after_seconds': retry_after,
                        'priority_tier': priority_tier,
                        'tenant_plan': tenant.plan,
                    },
                )
                return Response(
                    {
                        'detail': f'Vui lòng chờ {retry_after} giây trước khi trigger lại {symbol}.',
                        'retry_after_seconds': retry_after,
                        'cooldown_seconds': cooldown_seconds,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        # SFI-B5: Token budget check — block request if today's sessions have exceeded budget.
        token_budget = getattr(django_settings, 'ADVISORY_TOKEN_BUDGET', 2000)
        tokens_used_today = (
            AdvisorySession.objects
            .filter(user=request.user, session_date=session_date)
            .values_list('tokens_used', flat=True)
        )
        total_tokens = sum(tokens_used_today)
        if total_tokens >= token_budget:
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
                    'tokens_used': total_tokens,
                    'token_budget': token_budget,
                    'priority_tier': priority_tier,
                    'tenant_plan': tenant.plan,
                },
            )
            return Response(
                {
                    'detail': f'Token budget ({token_budget}) đã được sử dụng hết trong ngày hôm nay.',
                    'tokens_used': total_tokens,
                    'token_budget': token_budget,
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

        try:
            user_cred = UserAICredential.objects.get(user=request.user)
            provider = user_cred.ai_provider or 'openai'
            custom_endpoint = user_cred.custom_endpoint or ''

            if user_cred.encrypted_api_key:
                try:
                    decrypted_key = decrypt_user_api_key(user_cred.encrypted_api_key)
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
            'ai_model': ai_settings.ai_model,
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
            quota_record, _ = QuotaRecord.objects.get_or_create(
                tenant=tenant,
                period_start=quota_start,
                period_end=quota_end,
                defaults=quota_defaults,
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
                'effective_ai_context': effective_context,
            }

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
        return Response(response_data, status=status.HTTP_201_CREATED)


from vninvest_core.pagination import CoreCursorPagination

class AdvisoryRecordCursorPagination(CoreCursorPagination):
    ordering = ('-generated_at', '-id')
    page_size = 20


class AdvisoryHistoryView(APIView):
    """Paginated list of advisory records for a symbol (newest first)."""
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AdvisoryRecordCursorPagination

    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        qs = (
            AdvisoryRecord.objects
            .filter(symbol=symbol, status='generated')
            .order_by('-generated_at', '-id')
        )
        session_date = request.query_params.get('session_date')
        if session_date:
            qs = qs.filter(session_date=session_date)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AdvisoryRecordSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AdvisoryRecordSerializer(qs, many=True)
        return Response({'results': serializer.data})
