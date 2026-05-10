from uuid import uuid4

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .authentication_partner import CorePartnerPATAuthentication
from .opencore_revenue import DPIInvoice, DPISubscription
from .models import CorePATCredential, CoreServiceAccount, CoreTenant, UserConfig
from .partner_tenant_context import resolve_partner_tenant_context
from .permissions import IsProPlan
from .quota_service import get_usage


PARTNER_AUTH_CLASSES = [CorePartnerPATAuthentication, JWTAuthentication]
partner_authentication_classes = authentication_classes(PARTNER_AUTH_CLASSES)


def _request_ip(request) -> str:
    forwarded = str(request.META.get('HTTP_X_FORWARDED_FOR', '') or '').strip()
    if forwarded:
        return forwarded.split(',')[0].strip()
    return str(request.META.get('REMOTE_ADDR', '') or '').strip()


def _request_id() -> str:
    return uuid4().hex


def _response(payload, *, status_code=status.HTTP_200_OK, request_id=None):
    trace_id = request_id or _request_id()
    response = Response(payload, status=status_code)
    response['X-Core-Request-Id'] = trace_id
    return response


def _error(*, code: str, message: str, status_code: int, request_id: str, param: str | None = None, retryable: bool = False):
    payload = {
        'error': {
            'code': code,
            'message': message,
            'param': param,
            'request_id': request_id,
            'retryable': retryable,
        },
    }
    return _response(payload, status_code=status_code, request_id=request_id)


def _require_idempotency_key(request, request_id: str):
    key = str(request.headers.get('Idempotency-Key') or '').strip()
    if key:
        return key, None
    return None, _error(
        code='missing_idempotency_key',
        message='Thiếu header Idempotency-Key cho thao tác ghi.',
        status_code=status.HTTP_400_BAD_REQUEST,
        request_id=request_id,
        param='Idempotency-Key',
    )


def _request_auth_context(request) -> dict:
    auth = getattr(request, 'auth', None)
    if isinstance(auth, CorePATCredential):
        return {
            'auth_mode': 'pat',
            'auth_credential_id': auth.public_id,
            'auth_service_account_id': auth.service_account.public_id,
        }

    return {'auth_mode': 'session'}


def _build_audit_metadata(request, *, action: str, audit_reason: str, extra: dict | None = None) -> dict:
    metadata = {
        'audit_action': action,
        'audit_reason': str(audit_reason or '').strip(),
    }
    metadata.update(_request_auth_context(request))
    if extra:
        metadata.update(extra)
    return metadata


def _resolve_user_config(user) -> UserConfig:
    user_config, _ = UserConfig.objects.get_or_create(user=user)
    return user_config


def _build_plan_lifecycle_summary(user) -> dict:
    user_config = _resolve_user_config(user)
    now = timezone.now()

    if user_config.plan_locked_by_admin:
        lifecycle_state = 'locked'
    elif user_config.downgraded_at:
        lifecycle_state = 'downgraded'
    elif user_config.plan_expires_at and user_config.plan_expires_at <= now:
        lifecycle_state = 'auto_downgrade_due' if user_config.auto_downgrade_enabled else 'expired'
    elif user_config.plan_source == UserConfig.PlanSourceChoices.PAID:
        lifecycle_state = 'paid'
    elif user_config.plan_source == UserConfig.PlanSourceChoices.ONBOARDING_TRIAL:
        lifecycle_state = 'trial'
    else:
        lifecycle_state = 'system_default'

    return {
        'plan': user_config.plan,
        'plan_source': user_config.plan_source,
        'plan_assigned_at': user_config.plan_assigned_at.isoformat() if user_config.plan_assigned_at else None,
        'plan_expires_at': user_config.plan_expires_at.isoformat() if user_config.plan_expires_at else None,
        'auto_downgrade_enabled': bool(user_config.auto_downgrade_enabled),
        'plan_locked_by_admin': bool(user_config.plan_locked_by_admin),
        'downgraded_at': user_config.downgraded_at.isoformat() if user_config.downgraded_at else None,
        'lifecycle_state': lifecycle_state,
    }


def _serialize_service_account(service_account: CoreServiceAccount, *, tenant_context=None) -> dict:
    context = tenant_context or resolve_partner_tenant_context(service_account.owner_user)
    return {
        'object': 'service_account',
        'id': service_account.public_id,
        'tenant_id': context.tenant_id,
        'name': service_account.name,
        'environment': service_account.environment,
        'status': service_account.status,
        'policy_ids': list(service_account.policy_ids or []),
        'last_rotated_at': service_account.last_rotated_at.isoformat() if service_account.last_rotated_at else None,
        'created_at': service_account.created_at.isoformat(),
        'updated_at': service_account.updated_at.isoformat(),
    }


def _serialize_pat_credential(credential: CorePATCredential, *, secret: str | None = None, tenant_context=None) -> dict:
    context = tenant_context or resolve_partner_tenant_context(credential.owner_user)
    payload = {
        'object': 'pat_credential',
        'id': credential.public_id,
        'tenant_id': context.tenant_id,
        'service_account_id': credential.service_account.public_id,
        'token_prefix': credential.token_prefix,
        'scope_codes': list(credential.scope_codes or []),
        'status': credential.effective_status,
        'expires_at': credential.expires_at.isoformat() if credential.expires_at else None,
        'last_used_at': credential.last_used_at.isoformat() if credential.last_used_at else None,
        'last_ip': credential.last_ip,
        'revoked_at': credential.revoked_at.isoformat() if credential.revoked_at else None,
        'created_at': credential.created_at.isoformat(),
    }
    if secret:
        payload['secret'] = secret
    return payload


def _apply_cursor(queryset, *, cursor_value: str | None, is_before: bool = False):
    cursor = str(cursor_value or '').strip()
    if not cursor:
        return queryset

    cursor_row = queryset.model.objects.filter(public_id=cursor).only('created_at', 'pk').first()
    if cursor_row is None:
        return queryset

    if is_before:
        return queryset.filter(
            Q(created_at__gt=cursor_row.created_at)
            | Q(created_at=cursor_row.created_at, pk__gt=cursor_row.pk)
        )

    return queryset.filter(
        Q(created_at__lt=cursor_row.created_at)
        | Q(created_at=cursor_row.created_at, pk__lt=cursor_row.pk)
    )


def _paginate_list(request, queryset, serializer_fn):
    limit = min(max(int(request.query_params.get('limit', 20) or 20), 1), 100)
    paged_queryset = _apply_cursor(queryset, cursor_value=request.query_params.get('starting_after'))
    paged_queryset = _apply_cursor(paged_queryset, cursor_value=request.query_params.get('ending_before'), is_before=True)
    rows = list(paged_queryset[: limit + 1])
    has_more = len(rows) > limit
    page_rows = rows[:limit]
    return {
        'object': 'list',
        'url': request.path,
        'data': [serializer_fn(row) for row in page_rows],
        'has_more': has_more,
        'next_cursor': page_rows[-1].public_id if has_more and page_rows else None,
        'prev_cursor': page_rows[0].public_id if page_rows and (request.query_params.get('starting_after') or request.query_params.get('ending_before')) else None,
    }


def _build_list_payload(request, data: list[dict]):
    return {
        'object': 'list',
        'url': request.path,
        'data': data,
        'has_more': False,
        'next_cursor': None,
        'prev_cursor': None,
    }


PARTNER_USAGE_METERS = [
    {
        'meter_code': 'api_calls_per_day',
        'display_name': 'API calls per day',
        'unit': 'request',
        'aggregation_window': 'daily',
        'billable': False,
        'quota_enforced': True,
    },
    {
        'meter_code': 'ai_regenerate_per_day',
        'display_name': 'AI regenerate per day',
        'unit': 'request',
        'aggregation_window': 'daily',
        'billable': False,
        'quota_enforced': True,
    },
    {
        'meter_code': 'whale_symbols_max',
        'display_name': 'Whale symbols max',
        'unit': 'symbol',
        'aggregation_window': 'daily',
        'billable': False,
        'quota_enforced': True,
    },
    {
        'meter_code': 'exports_per_day',
        'display_name': 'Exports per day',
        'unit': 'file_unit',
        'aggregation_window': 'daily',
        'billable': False,
        'quota_enforced': True,
    },
]


def _resolve_period_bounds():
    now = timezone.now()
    period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period_end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    return period_start, period_end


def _resolve_risk_state(limit: int, used: int, remaining: int) -> str:
    if limit < 0:
        return 'normal'
    if remaining <= 0:
        return 'critical'
    if limit == 0:
        return 'critical'
    used_ratio = used / max(limit, 1)
    if used_ratio >= 0.9:
        return 'critical'
    if used_ratio >= 0.75:
        return 'warning'
    return 'normal'


def _build_usage_meter_row(user, tenant_context, meter_definition: dict, period_start, period_end) -> dict:
    usage = get_usage(user, meter_definition['meter_code'])
    used = int(usage.get('used', 0) or 0)
    limit = int(usage.get('limit', 0) or 0)
    remaining = int(usage.get('remaining', 0) or 0)
    overage_amount = max(used - limit, 0) if limit >= 0 else 0
    return {
        'object': 'usage_meter_row',
        'tenant_id': tenant_context.tenant_id,
        'meter_code': meter_definition['meter_code'],
        'display_name': meter_definition['display_name'],
        'unit': meter_definition['unit'],
        'aggregation_window': meter_definition['aggregation_window'],
        'billable': meter_definition['billable'],
        'quota_enforced': meter_definition['quota_enforced'],
        'status': 'active',
        'period_start': period_start.isoformat(),
        'period_end': period_end.isoformat(),
        'consumed_amount': used,
        'remaining_amount': remaining,
        'overage_amount': overage_amount,
        'risk_state': _resolve_risk_state(limit, used, remaining),
        'reset_at': usage.get('reset_at'),
    }


def _build_quota_snapshot_row(user, tenant_context, meter_definition: dict, period_start, period_end) -> dict:
    usage = get_usage(user, meter_definition['meter_code'])
    entitled_amount = int(usage.get('limit', 0) or 0)
    consumed_amount = int(usage.get('used', 0) or 0)
    remaining_amount = int(usage.get('remaining', 0) or 0)
    overage_amount = max(consumed_amount - entitled_amount, 0) if entitled_amount >= 0 else 0
    return {
        'object': 'quota_snapshot',
        'tenant_id': tenant_context.tenant_id,
        'meter_code': meter_definition['meter_code'],
        'display_name': meter_definition['display_name'],
        'unit': meter_definition['unit'],
        'period_start': period_start.isoformat(),
        'period_end': period_end.isoformat(),
        'entitled_amount': entitled_amount,
        'consumed_amount': consumed_amount,
        'remaining_amount': remaining_amount,
        'overage_amount': overage_amount,
        'hard_stop': entitled_amount >= 0 and remaining_amount <= 0,
        'reset_at': usage.get('reset_at'),
        'warning_threshold_pct': 75,
        'projected_exhaustion_at': None,
        'risk_state': _resolve_risk_state(entitled_amount, consumed_amount, remaining_amount),
    }


def _resolve_subscription_status(subscription, has_overdue_invoice: bool, trial_state: str) -> str:
    if has_overdue_invoice:
        return 'past_due'
    if trial_state == 'trial_active':
        return 'trialing'
    if subscription is None:
        return 'active'
    if not subscription.is_active():
        return 'canceled'
    return 'active'


def _serialize_invoice_summary(invoice: DPIInvoice, tenant_context) -> dict:
    return {
        'object': 'invoice_summary',
        'id': invoice.invoice_number,
        'tenant_id': tenant_context.tenant_id,
        'invoice_number': invoice.invoice_number,
        'status': invoice.status,
        'issue_date': invoice.issue_date.isoformat() if invoice.issue_date else None,
        'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
        'paid_date': invoice.paid_date.isoformat() if invoice.paid_date else None,
        'currency': 'USD',
        'subscription_amount': invoice.subscription_amount,
        'usage_based_amount': invoice.usage_based_amount,
        'discount_amount': invoice.discount_amount,
        'tax_amount': invoice.tax_amount,
        'total_amount': invoice.total_amount,
        'payment_method': invoice.payment_method,
        'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
    }


def _build_subscription_summary(user, tenant_context) -> dict:
    subscription = DPISubscription.objects.select_related('plan').filter(user=user).first()
    overdue_exists = DPIInvoice.objects.filter(user=user, status='overdue').exists()
    trial_state = str(getattr(getattr(user, 'plan_lifecycle', None), 'trial_state', '') or '')
    current_period_start = subscription.start_date.isoformat() if subscription and subscription.start_date else None
    current_period_end = subscription.renewal_date.isoformat() if subscription and subscription.renewal_date else None
    next_invoice_date = subscription.renewal_date.isoformat() if subscription and subscription.renewal_date else None
    return {
        'object': 'subscription_summary',
        'tenant_id': tenant_context.tenant_id,
        'plan_code': subscription.plan.plan if subscription and subscription.plan_id else tenant_context.plan_code,
        'status': _resolve_subscription_status(subscription, overdue_exists, trial_state),
        'billing_cycle': subscription.billing_cycle if subscription else 'monthly',
        'currency': 'USD',
        'current_period_start': current_period_start,
        'current_period_end': current_period_end,
        'auto_renew': bool(subscription.auto_renew) if subscription else False,
        'invoice_state': 'past_due' if overdue_exists else ('issued' if DPIInvoice.objects.filter(user=user, status='issued').exists() else 'current'),
        'credit_balance': 0,
        'next_invoice_date': next_invoice_date,
    }


def _serialize_tenant_summary(tenant: CoreTenant, *, plan_lifecycle: dict | None = None) -> dict:
    return {
        'object': 'tenant',
        'id': tenant.public_id,
        'tenant_code': tenant.tenant_code,
        'display_name': tenant.display_name,
        'status': tenant.status,
        'plan_code': tenant.plan_code,
        'plan_lifecycle': plan_lifecycle or _build_plan_lifecycle_summary(tenant.owner_user),
        'billing_account_id': None,
        'default_environment': tenant.default_environment,
        'created_at': tenant.created_at.isoformat() if tenant.created_at else None,
        'updated_at': tenant.updated_at.isoformat() if tenant.updated_at else None,
    }


class PartnerServiceAccountCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    environment = serializers.ChoiceField(choices=CoreServiceAccount.EnvironmentChoices.choices)
    policy_ids = serializers.ListField(child=serializers.CharField(max_length=80), required=False, allow_empty=True)
    metadata = serializers.DictField(required=False)
    audit_reason = serializers.CharField(max_length=160, required=False, allow_blank=True)


class PartnerPATIssueSerializer(serializers.Serializer):
    service_account_id = serializers.CharField(max_length=32)
    scope_codes = serializers.ListField(child=serializers.CharField(max_length=80), allow_empty=False)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    audit_reason = serializers.CharField(max_length=160, required=False, allow_blank=True)


class PartnerPATRotateSerializer(serializers.Serializer):
    grace_period_seconds = serializers.IntegerField(required=False, min_value=0, default=3600)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    audit_reason = serializers.CharField(max_length=160, required=False, allow_blank=True)


class PartnerPATRevokeSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=160)
    audit_reason = serializers.CharField(required=False, allow_blank=True, max_length=160)


def _resolve_owned_service_account(tenant_context, public_id: str) -> CoreServiceAccount | None:
    return CoreServiceAccount.objects.filter(owner_user=tenant_context.owner_user, public_id=public_id).first()


def _resolve_owned_pat(tenant_context, public_id: str) -> CorePATCredential | None:
    return CorePATCredential.objects.select_related('service_account').filter(owner_user=tenant_context.owner_user, public_id=public_id).first()


@api_view(['GET'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_tenant_api(request):
    request_id = _request_id()
    tenant = CoreTenant.ensure_for_user(request.user)
    return _response(
        _serialize_tenant_summary(tenant, plan_lifecycle=_build_plan_lifecycle_summary(tenant.owner_user)),
        request_id=request_id,
    )


@api_view(['GET', 'POST'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_service_accounts_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)

    if request.method == 'GET':
        queryset = CoreServiceAccount.objects.filter(owner_user=tenant_context.owner_user).order_by('-created_at', '-pk')
        status_filter = str(request.query_params.get('status') or '').strip()
        environment_filter = str(request.query_params.get('environment') or '').strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if environment_filter:
            queryset = queryset.filter(environment=environment_filter)
        return _response(
            _paginate_list(request, queryset, lambda row: _serialize_service_account(row, tenant_context=tenant_context)),
            request_id=request_id,
        )

    _idempotency_key, error_response = _require_idempotency_key(request, request_id)
    if error_response is not None:
        return error_response

    serializer = PartnerServiceAccountCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    audit_reason = str(serializer.validated_data.get('audit_reason') or 'tenant_admin_create_service_account').strip()
    metadata = dict(serializer.validated_data.get('metadata') or {})
    metadata.update(_build_audit_metadata(request, action='service_account_create', audit_reason=audit_reason))
    service_account = CoreServiceAccount.objects.create(
        owner_user=tenant_context.owner_user,
        created_by=request.user,
        name=serializer.validated_data['name'].strip(),
        environment=serializer.validated_data['environment'],
        policy_ids=list(serializer.validated_data.get('policy_ids') or []),
        metadata=metadata,
    )
    return _response(
        _serialize_service_account(service_account, tenant_context=tenant_context),
        status_code=status.HTTP_201_CREATED,
        request_id=request_id,
    )


@api_view(['GET'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_pat_list_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    queryset = CorePATCredential.objects.select_related('service_account').filter(owner_user=tenant_context.owner_user).order_by('-created_at', '-pk')

    service_account_id = str(request.query_params.get('service_account_id') or '').strip()
    status_filter = str(request.query_params.get('status') or '').strip()
    if service_account_id:
        queryset = queryset.filter(service_account__public_id=service_account_id)

    if status_filter:
        now = timezone.now()
        if status_filter == CorePATCredential.StatusChoices.EXPIRED:
            queryset = queryset.exclude(status=CorePATCredential.StatusChoices.REVOKED).filter(expires_at__isnull=False, expires_at__lte=now)
        elif status_filter == CorePATCredential.StatusChoices.ACTIVE:
            queryset = queryset.filter(status=CorePATCredential.StatusChoices.ACTIVE).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        else:
            queryset = queryset.filter(status=status_filter)

    return _response(
        _paginate_list(request, queryset, lambda row: _serialize_pat_credential(row, tenant_context=tenant_context)),
        request_id=request_id,
    )


@api_view(['POST'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_pat_issue_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    _idempotency_key, error_response = _require_idempotency_key(request, request_id)
    if error_response is not None:
        return error_response

    serializer = PartnerPATIssueSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    service_account = _resolve_owned_service_account(tenant_context, serializer.validated_data['service_account_id'])
    if service_account is None:
        return _error(
            code='service_account_not_found',
            message='Không tìm thấy service account trong tenant hiện tại.',
            status_code=status.HTTP_404_NOT_FOUND,
            request_id=request_id,
            param='service_account_id',
        )

    audit_reason = str(serializer.validated_data.get('audit_reason') or 'tenant_admin_issue_pat').strip()
    credential, raw_secret = CorePATCredential.issue_for_service_account(
        service_account=service_account,
        scope_codes=list(serializer.validated_data['scope_codes']),
        expires_at=serializer.validated_data.get('expires_at'),
        display_name=serializer.validated_data.get('display_name', ''),
        issued_by=request.user,
        metadata=_build_audit_metadata(
            request,
            action='pat_issue',
            audit_reason=audit_reason,
            extra={'issued_from_ip': _request_ip(request)},
        ),
    )
    return _response(
        _serialize_pat_credential(credential, secret=raw_secret, tenant_context=tenant_context),
        status_code=status.HTTP_201_CREATED,
        request_id=request_id,
    )


@api_view(['POST'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_pat_rotate_api(request, token_id: str):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    _idempotency_key, error_response = _require_idempotency_key(request, request_id)
    if error_response is not None:
        return error_response

    serializer = PartnerPATRotateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    credential = _resolve_owned_pat(tenant_context, token_id)
    if credential is None:
        return _error(
            code='pat_not_found',
            message='Không tìm thấy PAT trong tenant hiện tại.',
            status_code=status.HTTP_404_NOT_FOUND,
            request_id=request_id,
            param='token_id',
        )

    if credential.effective_status == CorePATCredential.StatusChoices.REVOKED:
        return _error(
            code='pat_revoked',
            message='PAT đã bị revoke và không thể rotate.',
            status_code=status.HTTP_409_CONFLICT,
            request_id=request_id,
            param='token_id',
        )

    audit_reason = str(serializer.validated_data.get('audit_reason') or 'tenant_admin_rotate_pat').strip()
    with transaction.atomic():
        new_token, raw_secret, grace_until = credential.rotate(
            grace_period_seconds=serializer.validated_data.get('grace_period_seconds', 3600),
            expires_at=serializer.validated_data.get('expires_at'),
            issued_by=request.user,
            metadata=_build_audit_metadata(
                request,
                action='pat_rotate',
                audit_reason=audit_reason,
                extra={'rotated_token_id': credential.public_id},
            ),
        )

    payload = {
        'object': 'pat_rotation',
        'old_token_id': credential.public_id,
        'new_token': _serialize_pat_credential(new_token, secret=raw_secret, tenant_context=tenant_context),
        'old_token_grace_until': grace_until.isoformat() if grace_until else None,
    }
    return _response(payload, status_code=status.HTTP_200_OK, request_id=request_id)


@api_view(['POST'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_pat_revoke_api(request, token_id: str):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    _idempotency_key, error_response = _require_idempotency_key(request, request_id)
    if error_response is not None:
        return error_response

    serializer = PartnerPATRevokeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    credential = _resolve_owned_pat(tenant_context, token_id)
    if credential is None:
        return _error(
            code='pat_not_found',
            message='Không tìm thấy PAT trong tenant hiện tại.',
            status_code=status.HTTP_404_NOT_FOUND,
            request_id=request_id,
            param='token_id',
        )

    audit_reason = str(
        serializer.validated_data.get('audit_reason')
        or serializer.validated_data.get('reason')
        or 'tenant_admin_revoke_pat'
    ).strip()
    revoke_reason = str(serializer.validated_data.get('reason') or audit_reason).strip()
    credential.revoke(
        reason=revoke_reason,
        metadata=_build_audit_metadata(
            request,
            action='pat_revoke',
            audit_reason=audit_reason,
            extra={'revoked_token_id': credential.public_id},
        ),
    )
    return _response(
        {
            'object': 'pat_revocation',
            'token_id': credential.public_id,
            'status': credential.status,
            'revoked_at': credential.revoked_at.isoformat() if credential.revoked_at else None,
        },
        status_code=status.HTTP_200_OK,
        request_id=request_id,
    )


@api_view(['GET'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_usage_meters_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    period_start, period_end = _resolve_period_bounds()
    data = [
        _build_usage_meter_row(request.user, tenant_context, meter_definition, period_start, period_end)
        for meter_definition in PARTNER_USAGE_METERS
    ]
    return _response(_build_list_payload(request, data), request_id=request_id)


@api_view(['GET'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_usage_quotas_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    period_start, period_end = _resolve_period_bounds()
    data = [
        _build_quota_snapshot_row(request.user, tenant_context, meter_definition, period_start, period_end)
        for meter_definition in PARTNER_USAGE_METERS
    ]
    return _response(_build_list_payload(request, data), request_id=request_id)


@api_view(['GET'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_billing_subscription_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    return _response(_build_subscription_summary(request.user, tenant_context), request_id=request_id)


@api_view(['GET'])
@partner_authentication_classes
@permission_classes([IsAuthenticated, IsProPlan])
def partner_billing_invoices_api(request):
    request_id = _request_id()
    tenant_context = resolve_partner_tenant_context(request.user)
    invoices = DPIInvoice.objects.filter(user=tenant_context.owner_user).order_by('-issue_date', '-pk')[:50]
    data = [_serialize_invoice_summary(invoice, tenant_context) for invoice in invoices]
    return _response(_build_list_payload(request, data), request_id=request_id)
