import json
import re
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Count, Max, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.core.cache import cache
from django.utils import timezone

from config.health import healthcheck, market_observability_health, prefetch_health, realtime_health, streams_health
from .models import (
    AdvisoryAggregateAuditLog,
    CorePATCredential,
    CoreServiceAccount,
    CrawlAuditLog,
    CrawlRun,
    SignalServiceRun,
    SystemAISettingsAuditLog,
    WhaleConfigAuditLog,
)

try:
    from .models import CoreTenant
except ImportError:
    CoreTenant = None

try:
    from .partner_tenant_context import resolve_partner_tenant_context
except (ImportError, RuntimeError):
    resolve_partner_tenant_context = None
from .serializers import CrawlRunSerializer, SignalServiceRunSerializer
from .views_partner_admin import PARTNER_USAGE_METERS, _build_plan_lifecycle_summary, _build_quota_snapshot_row, _build_subscription_summary

from portfolio.tasks_prefetch import _read_offpeak_ingest_history
from portfolio.runtime_policy_helpers import (
    _get_runtime_governance_delta_thresholds,
    _get_runtime_prefetch_settings,
    _get_runtime_prefetch_time_policy,
    _prefetch_time_policy_rulebook,
    _set_runtime_governance_delta_thresholds,
    _set_runtime_prefetch_settings,
    _set_runtime_prefetch_time_policy,
)
from portfolio.tasks_whale_preflight_cache import (
    WHALE_PREFLIGHT_KPI_SCHEMA_VERSION,
    WHALE_PREFLIGHT_METRIC_NAMES,
    _build_preflight_metric_rates,
    _build_preflight_metric_summary,
    _read_preflight_metrics,
    _read_preflight_metrics_window,
    _sum_preflight_metrics_window,
)
from tenant_lifecycle.models import TenantLifecycleEvent


def _is_celery_worker_available() -> bool:
    try:
        from config.celery import app as celery_app

        inspect = celery_app.control.inspect(timeout=1.0)
        ping_result = inspect.ping() or {}
        return bool(ping_result)
    except Exception:
        return False


def _has_surface_write_permission(request, permission_codename: str) -> bool:
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_superuser', False):
        return True
    return bool(user.has_perm(f'portfolio.{permission_codename}'))


def _forbidden_surface_response(surface_name: str):
    return Response(
        {'detail': f'Tài khoản không có quyền ghi {surface_name}.'},
        status=status.HTTP_403_FORBIDDEN,
    )


def _response_payload(response):
    data = getattr(response, 'data', None)
    if isinstance(data, dict):
        return data
    if data is not None:
        return {'data': data}

    content = getattr(response, 'content', None)
    if content is None:
        return {}

    try:
        return json.loads(content.decode('utf-8'))
    except Exception:
        return {}


def _http_request(request):
    return getattr(request, '_request', request)


def _parse_multi_query_param(request, param_name: str) -> list[str]:
    values = [str(value).strip() for value in request.query_params.getlist(param_name) if str(value).strip()]
    if values:
        return values
    raw_value = str(request.query_params.get(param_name) or '').strip()
    if not raw_value:
        return []
    return [value.strip() for value in raw_value.split(',') if value.strip()]


def _worst_risk_state(risk_states) -> str:
    severity = {'normal': 0, 'warning': 1, 'critical': 2}
    worst_state = 'normal'
    for risk_state in risk_states:
        normalized = str(risk_state or 'normal').strip().lower()
        if severity.get(normalized, 0) > severity.get(worst_state, 0):
            worst_state = normalized
    return worst_state


def _build_operator_tenant_usage_snapshot(tenant: CoreTenant) -> dict:
    tenant_context = resolve_partner_tenant_context(tenant.owner_user)
    now = timezone.now()
    period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period_end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    usage_rows = [
        _build_quota_snapshot_row(tenant.owner_user, tenant_context, meter_definition, period_start, period_end)
        for meter_definition in PARTNER_USAGE_METERS
    ]
    current_usage_risk = _worst_risk_state(row.get('risk_state') for row in usage_rows)
    subscription_summary = _build_subscription_summary(tenant.owner_user, tenant_context)
    invoice_state = str(subscription_summary.get('invoice_state') or 'current')
    suspension_state = 'manual' if tenant.status == CoreTenant.StatusChoices.SUSPENDED else ('billing' if invoice_state in {'past_due', 'overdue', 'credit_hold'} else ('quota' if current_usage_risk == 'critical' else 'none'))

    return {
        'tenant_context': tenant_context,
        'usage_rows': usage_rows,
        'current_usage_risk': current_usage_risk,
        'invoice_state': invoice_state,
        'suspension_state': suspension_state,
        'subscription_summary': subscription_summary,
    }


def _build_recent_operator_actions(tenant: CoreTenant, tenant_context, service_accounts, pat_credentials) -> list[dict]:
    actions: list[dict] = []

    for service_account in service_accounts.order_by('-updated_at', '-pk')[:5]:
        actions.append({
            'object': 'operator_action',
            'action': 'service_account_created',
            'source': 'service_account',
            'id': service_account.public_id,
            'tenant_id': tenant_context.tenant_id,
            'summary': f'Tạo service account {service_account.name}',
            'at': service_account.created_at.isoformat() if service_account.created_at else None,
            'severity': 'info',
        })
        if service_account.last_rotated_at:
            actions.append({
                'object': 'operator_action',
                'action': 'service_account_rotated',
                'source': 'service_account',
                'id': service_account.public_id,
                'tenant_id': tenant_context.tenant_id,
                'summary': f'Luân chuyển PAT cho service account {service_account.name}',
                'at': service_account.last_rotated_at.isoformat(),
                'severity': 'info',
            })

    for credential in pat_credentials.order_by('-updated_at', '-pk')[:5]:
        actions.append({
            'object': 'operator_action',
            'action': 'pat_issued',
            'source': 'pat_credential',
            'id': credential.public_id,
            'tenant_id': tenant_context.tenant_id,
            'service_account_id': credential.service_account.public_id,
            'summary': f'Issue PAT {credential.display_name or credential.token_prefix}',
            'at': credential.created_at.isoformat() if credential.created_at else None,
            'severity': 'info',
        })
        if credential.last_used_at:
            actions.append({
                'object': 'operator_action',
                'action': 'pat_used',
                'source': 'pat_credential',
                'id': credential.public_id,
                'tenant_id': tenant_context.tenant_id,
                'service_account_id': credential.service_account.public_id,
                'summary': f'PAT {credential.display_name or credential.token_prefix} used',
                'at': credential.last_used_at.isoformat(),
                'severity': 'info',
            })
        if credential.revoked_at:
            actions.append({
                'object': 'operator_action',
                'action': 'pat_revoked',
                'source': 'pat_credential',
                'id': credential.public_id,
                'tenant_id': tenant_context.tenant_id,
                'service_account_id': credential.service_account.public_id,
                'summary': f'Revoke PAT {credential.display_name or credential.token_prefix}',
                'at': credential.revoked_at.isoformat(),
                'severity': 'warning',
            })
        if credential.status == CorePATCredential.StatusChoices.ROTATING and credential.grace_until:
            actions.append({
                'object': 'operator_action',
                'action': 'pat_rotated',
                'source': 'pat_credential',
                'id': credential.public_id,
                'tenant_id': tenant_context.tenant_id,
                'service_account_id': credential.service_account.public_id,
                'summary': f'Rotate PAT {credential.display_name or credential.token_prefix}',
                'at': credential.grace_until.isoformat(),
                'severity': 'info',
            })

    actions.sort(key=lambda item: str(item.get('at') or ''), reverse=True)
    return actions[:10]


def _build_operator_tenant_snapshot(tenant: CoreTenant) -> dict:
    tenant_context = resolve_partner_tenant_context(tenant.owner_user)
    plan_lifecycle = _build_plan_lifecycle_summary(tenant.owner_user)
    usage_snapshot = _build_operator_tenant_usage_snapshot(tenant)
    service_account_qs = CoreServiceAccount.objects.filter(owner_user=tenant.owner_user)
    pat_qs = CorePATCredential.objects.select_related('service_account').filter(owner_user=tenant.owner_user)

    active_service_account_count = getattr(tenant, 'active_service_account_count', None)
    if active_service_account_count is None:
        active_service_account_count = service_account_qs.filter(status=CoreServiceAccount.StatusChoices.ACTIVE).count()

    active_pat_count = getattr(tenant, 'active_pat_count', None)
    if active_pat_count is None:
        active_pat_count = pat_qs.filter(status__in=[CorePATCredential.StatusChoices.ACTIVE, CorePATCredential.StatusChoices.ROTATING]).count()

    latest_pat_last_used_at = pat_qs.order_by('-last_used_at', '-updated_at').values_list('last_used_at', flat=True).first()
    rotations_due_count = pat_qs.filter(
        status=CorePATCredential.StatusChoices.ACTIVE,
        expires_at__isnull=False,
        expires_at__lte=timezone.now() + timedelta(days=14),
    ).count()

    service_account_total_count = service_account_qs.count()
    anomaly_state = 'critical' if usage_snapshot['current_usage_risk'] == 'critical' or usage_snapshot['invoice_state'] in {'past_due', 'overdue', 'credit_hold'} else ('warning' if usage_snapshot['current_usage_risk'] == 'warning' else 'normal')

    return {
        'object': 'tenant_summary',
        'id': tenant.public_id,
        'tenant_code': tenant.tenant_code,
        'display_name': tenant.display_name,
        'status': tenant.status,
        'plan_code': tenant_context.plan_code,
        'plan_lifecycle': plan_lifecycle,
        'suspension_state': usage_snapshot['suspension_state'],
        'current_usage_risk': usage_snapshot['current_usage_risk'],
        'invoice_state': usage_snapshot['invoice_state'],
        'active_service_account_count': active_service_account_count,
        'active_pat_count': active_pat_count,
        'updated_at': tenant.updated_at.isoformat() if tenant.updated_at else None,
        'tenant_context': {
            'tenant_id': tenant_context.tenant_id,
            'plan_code': tenant_context.plan_code,
            'status': tenant_context.status,
            'default_environment': tenant_context.default_environment,
        },
        'commercial_summary': {
            'plan_code': usage_snapshot['subscription_summary']['plan_code'],
            'invoice_state': usage_snapshot['invoice_state'],
            'billing_cycle': usage_snapshot['subscription_summary']['billing_cycle'],
            'current_period_start': usage_snapshot['subscription_summary']['current_period_start'],
            'current_period_end': usage_snapshot['subscription_summary']['current_period_end'],
            'next_invoice_date': usage_snapshot['subscription_summary']['next_invoice_date'],
        },
        'security_summary': {
            'service_account_count': service_account_total_count,
            'active_service_account_count': active_service_account_count,
            'active_pat_count': active_pat_count,
            'rotations_due_count': rotations_due_count,
            'anomaly_state': anomaly_state,
            'latest_pat_last_used_at': latest_pat_last_used_at.isoformat() if latest_pat_last_used_at else None,
        },
        'usage_meters': usage_snapshot['usage_rows'],
        'recent_operator_actions': _build_recent_operator_actions(tenant, tenant_context, service_account_qs, pat_qs),
        'generated_at': timezone.now().isoformat(),
    }


def _build_operator_tenant_list_snapshot(request, tenants: list[CoreTenant]) -> dict:
    summary_rows = [_build_operator_tenant_snapshot(tenant) for tenant in tenants]
    status_filters = set(_parse_multi_query_param(request, 'status'))
    plan_filters = set(_parse_multi_query_param(request, 'plan_code'))
    suspension_filters = set(_parse_multi_query_param(request, 'suspension_state'))
    usage_risk_filters = set(_parse_multi_query_param(request, 'current_usage_risk'))
    invoice_state_filters = set(_parse_multi_query_param(request, 'invoice_state'))

    if status_filters:
        summary_rows = [row for row in summary_rows if row['status'] in status_filters]
    if plan_filters:
        summary_rows = [row for row in summary_rows if row['plan_code'] in plan_filters]
    if suspension_filters:
        summary_rows = [row for row in summary_rows if row['suspension_state'] in suspension_filters]
    if usage_risk_filters:
        summary_rows = [row for row in summary_rows if row['current_usage_risk'] in usage_risk_filters]
    if invoice_state_filters:
        summary_rows = [row for row in summary_rows if row['invoice_state'] in invoice_state_filters]

    search_term = str(request.query_params.get('search') or '').strip().lower()
    if search_term:
        summary_rows = [
            row for row in summary_rows
            if search_term in row['tenant_code'].lower()
            or search_term in row['display_name'].lower()
            or search_term in row['id'].lower()
            or search_term in str(row.get('tenant_context', {}).get('plan_code') or '').lower()
        ]

    limit = min(max(int(request.query_params.get('limit', 25) or 25), 1), 100)
    starting_after = str(request.query_params.get('starting_after') or '').strip()
    ending_before = str(request.query_params.get('ending_before') or '').strip()

    if starting_after:
        for index, row in enumerate(summary_rows):
            if row['id'] == starting_after:
                summary_rows = summary_rows[index + 1:]
                break
    elif ending_before:
        for index, row in enumerate(summary_rows):
            if row['id'] == ending_before:
                summary_rows = summary_rows[:index]
                break

    page_rows = summary_rows[:limit]
    has_more = len(summary_rows) > limit

    total_count = len(summary_rows)
    active_count = sum(1 for row in summary_rows if row['status'] == CoreTenant.StatusChoices.ACTIVE)
    suspended_count = sum(1 for row in summary_rows if row['status'] == CoreTenant.StatusChoices.SUSPENDED)
    critical_usage_count = sum(1 for row in summary_rows if row['current_usage_risk'] == 'critical')
    billing_risk_count = sum(1 for row in summary_rows if row['invoice_state'] in {'past_due', 'overdue', 'credit_hold'})

    return {
        'object': 'list',
        'url': request.path,
        'summary_cards': [
            {'key': 'tenant_total', 'label': 'Tổng tenant', 'value': total_count, 'detail': 'Matching current filters'},
            {'key': 'tenant_active', 'label': 'Tenant active', 'value': active_count, 'detail': 'Visible in current filter set'},
            {'key': 'tenant_suspended', 'label': 'Tenant suspended', 'value': suspended_count, 'detail': 'Manual suspension state'},
            {'key': 'tenant_critical_usage', 'label': 'Critical usage', 'value': critical_usage_count, 'detail': 'Quota risk critical'},
            {'key': 'tenant_billing_risk', 'label': 'Billing risk', 'value': billing_risk_count, 'detail': 'Past due or overdue invoices'},
        ],
        'data': [
            {
                'object': 'tenant_summary',
                'id': row['id'],
                'tenant_code': row['tenant_code'],
                'display_name': row['display_name'],
                'status': row['status'],
                'plan_code': row['plan_code'],
                'plan_lifecycle': row['plan_lifecycle'],
                'suspension_state': row['suspension_state'],
                'current_usage_risk': row['current_usage_risk'],
                'invoice_state': row['invoice_state'],
                'active_service_account_count': row['active_service_account_count'],
                'active_pat_count': row['active_pat_count'],
                'updated_at': row['updated_at'],
            }
            for row in page_rows
        ],
        'has_more': has_more,
        'next_cursor': page_rows[-1]['id'] if has_more and page_rows else None,
        'prev_cursor': page_rows[0]['id'] if page_rows and (starting_after or ending_before) else None,
        'generated_at': timezone.now().isoformat(),
    }


def _build_operator_tenant_detail_snapshot(tenant: CoreTenant) -> dict:
    tenant_snapshot = _build_operator_tenant_snapshot(tenant)
    return {
        'object': 'operator_tenant_detail',
        'tenant': tenant_snapshot,
        'commercial_summary': tenant_snapshot['commercial_summary'],
        'security_summary': tenant_snapshot['security_summary'],
        'recent_operator_actions': tenant_snapshot['recent_operator_actions'],
        'generated_at': timezone.now().isoformat(),
    }


def _paginate_operator_rows(request, rows: list[dict]):
    limit = min(max(int(request.query_params.get('limit', 25) or 25), 1), 100)
    starting_after = str(request.query_params.get('starting_after') or '').strip()
    ending_before = str(request.query_params.get('ending_before') or '').strip()

    if starting_after:
        for index, row in enumerate(rows):
            if row['id'] == starting_after:
                rows = rows[index + 1:]
                break
    elif ending_before:
        for index, row in enumerate(rows):
            if row['id'] == ending_before:
                rows = rows[:index]
                break

    page_rows = rows[:limit]
    has_more = len(rows) > limit
    return page_rows, has_more, starting_after, ending_before


def _resolve_operator_tenant(tenant_id: str):
    tenant = CoreTenant.objects.select_related('owner_user').filter(public_id=tenant_id).first()
    if tenant is None:
        return None, Response({'detail': 'Tenant operator không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
    return tenant, None


def _operator_actor_type(user) -> str:
    if user is None:
        return 'system'
    if user.is_superuser or user.is_staff:
        return 'operator'
    return 'tenant_user'


def _request_ip(request) -> str | None:
    forwarded_for = str(request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if forwarded_for:
        return forwarded_for.split(',')[0].strip() or None
    return str(request.META.get('REMOTE_ADDR') or '').strip() or None


def _normalize_tenant_plan(raw_plan) -> str | None:
    if raw_plan in (None, ''):
        return None
    normalized = str(raw_plan).strip().lower()
    valid_plans = {choice for choice, _ in CoreTenant.PlanChoices.choices}
    return normalized if normalized in valid_plans else None


def _normalize_tenant_status(raw_status) -> str | None:
    if raw_status in (None, ''):
        return None
    normalized = str(raw_status).strip().lower()
    valid_statuses = {choice for choice, _ in CoreTenant.StatusChoices.choices}
    return normalized if normalized in valid_statuses else None


def _coerce_features(raw_features):
    if raw_features in (None, ''):
        return None
    if not isinstance(raw_features, list):
        return 'invalid'
    return [str(item).strip() for item in raw_features if str(item).strip()]


def _build_operator_event_context(request):
    return {
        'actor_type': _operator_actor_type(request.user),
        'actor_user': request.user if getattr(request.user, 'is_authenticated', False) else None,
        'ip_address': _request_ip(request),
    }


def _log_plan_changed_event(*, tenant: CoreTenant, actor_type: str, actor_user, ip_address: str | None, old_plan: str, new_plan: str, reason: str = ''):
    TenantLifecycleEvent.objects.create(
        tenant=tenant,
        event_type=TenantLifecycleEvent.EventType.PLAN_CHANGED,
        actor_type=actor_type,
        actor_user=actor_user,
        ip_address=ip_address,
        old_value={'plan': old_plan},
        new_value={'plan': new_plan},
        metadata={'reason': reason or ''},
    )


def _build_tenant_action_response(tenant: CoreTenant, *, event_id: int | None = None):
    payload = {
        'tenant': {
            'object': 'tenant',
            'id': tenant.public_id,
            'tenant_code': tenant.tenant_code,
            'display_name': tenant.display_name,
            'status': tenant.status,
            'plan_code': tenant.plan,
            'features': list(tenant.features or []),
            'updated_at': tenant.updated_at.isoformat() if tenant.updated_at else None,
        },
        'tenant_id': tenant.public_id,
        'status': tenant.status,
        'plan': tenant.plan,
    }
    if event_id is not None:
        payload['event_id'] = event_id
    return payload


def _slugify_tenant_code_seed(seed: str) -> str:
    normalized = re.sub(r'[^a-z0-9]+', '-', str(seed or '').strip().lower()).strip('-')
    return normalized[:48] or 'tenant'


def _generate_unique_tenant_code(seed: str) -> str:
    base = _slugify_tenant_code_seed(seed)
    for suffix in range(1, 1000):
        candidate = f'{base}-{suffix:03d}'
        if not CoreTenant.objects.filter(tenant_code=candidate).exists():
            return candidate
    return f'{base}-{timezone.now().strftime("%Y%m%d%H%M%S")}'


def _resolve_or_create_owner_user(owner_email: str):
    email = str(owner_email or '').strip().lower()
    if not email or '@' not in email:
        return None, Response({'detail': 'owner_email không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email).first()
    if user is not None:
        return user, None

    base_username = re.sub(r'[^a-z0-9_]+', '_', email.split('@')[0].lower()).strip('_') or 'tenant_owner'
    username = base_username
    idx = 1
    while User.objects.filter(username=username).exists():
        idx += 1
        username = f'{base_username}_{idx}'

    user = User.objects.create_user(username=username, email=email)
    user.set_unusable_password()
    user.save(update_fields=['password'])
    return user, None


def _resolve_service_account_rotation_risk(service_account) -> str:
    now = timezone.now()
    if getattr(service_account, 'active_pat_count', 0) in (None, 0):
        return 'critical'
    last_rotated_at = getattr(service_account, 'last_rotated_at', None)
    latest_pat_last_used_at = getattr(service_account, 'latest_pat_last_used_at', None)
    if last_rotated_at and last_rotated_at <= now - timedelta(days=180):
        return 'warning'
    if latest_pat_last_used_at and latest_pat_last_used_at <= now - timedelta(days=30):
        return 'warning'
    return 'normal'


def _build_operator_service_account_snapshot(tenant: CoreTenant, service_account) -> dict:
    tenant_context = resolve_partner_tenant_context(tenant.owner_user)
    last_operator_action_at = max(
        [
            value for value in [
                service_account.updated_at,
                service_account.created_at,
                service_account.last_rotated_at,
                getattr(service_account, 'latest_pat_last_used_at', None),
            ]
            if value is not None
        ] or [timezone.now()]
    )

    return {
        'object': 'service_account',
        'id': service_account.public_id,
        'tenant_id': tenant_context.tenant_id,
        'name': service_account.name,
        'environment': service_account.environment,
        'status': service_account.status,
        'policy_ids': list(service_account.policy_ids or []),
        'pat_count': int(getattr(service_account, 'pat_count', 0) or 0),
        'active_pat_count': int(getattr(service_account, 'active_pat_count', 0) or 0),
        'latest_pat_last_used_at': getattr(service_account, 'latest_pat_last_used_at', None).isoformat() if getattr(service_account, 'latest_pat_last_used_at', None) else None,
        'rotation_risk': _resolve_service_account_rotation_risk(service_account),
        'last_operator_action_at': last_operator_action_at.isoformat() if last_operator_action_at else None,
        'created_at': service_account.created_at.isoformat() if service_account.created_at else None,
        'updated_at': service_account.updated_at.isoformat() if service_account.updated_at else None,
    }


def _build_operator_pat_snapshot(tenant: CoreTenant, credential) -> dict:
    tenant_context = resolve_partner_tenant_context(tenant.owner_user)
    issuer = credential.issued_by
    issuer_actor_type = 'system'
    if issuer is not None:
        issuer_actor_type = 'operator_user' if issuer.is_staff or issuer.is_superuser else 'tenant_user'
    now = timezone.now()
    anomaly_state = 'normal'
    if credential.status == CorePATCredential.StatusChoices.REVOKED:
        anomaly_state = 'warning'
    elif credential.expires_at and credential.expires_at <= now:
        anomaly_state = 'critical'
    elif credential.expires_at and credential.expires_at <= now + timedelta(days=7):
        anomaly_state = 'warning'
    elif credential.grace_until and credential.grace_until > now:
        anomaly_state = 'warning'
    elif credential.last_used_at and credential.last_used_at <= now - timedelta(days=30):
        anomaly_state = 'warning'

    metadata = credential.metadata if isinstance(credential.metadata, dict) else {}

    return {
        'object': 'pat_credential',
        'id': credential.public_id,
        'tenant_id': tenant_context.tenant_id,
        'service_account_id': credential.service_account.public_id,
        'token_prefix': credential.token_prefix,
        'scope_codes': list(credential.scope_codes or []),
        'status': credential.effective_status,
        'expires_at': credential.expires_at.isoformat() if credential.expires_at else None,
        'last_used_at': credential.last_used_at.isoformat() if credential.last_used_at else None,
        'last_ip': credential.last_ip,
        'revoked_at': credential.revoked_at.isoformat() if credential.revoked_at else None,
        'issuer_actor_type': issuer_actor_type,
        'issuer_actor_id': str(issuer.id) if issuer is not None else None,
        'anomaly_state': anomaly_state,
        'grace_period_active': bool(credential.status == CorePATCredential.StatusChoices.ROTATING and credential.grace_until and credential.grace_until > now),
        'last_used_ip_country': metadata.get('last_used_ip_country'),
        'last_audit_request_id': metadata.get('last_audit_request_id'),
        'created_at': credential.created_at.isoformat() if credential.created_at else None,
        'updated_at': credential.updated_at.isoformat() if credential.updated_at else None,
    }


def _build_operator_service_account_list_snapshot(request, tenant: CoreTenant, service_accounts) -> dict:
    service_account_rows = [
        _build_operator_service_account_snapshot(tenant, service_account)
        for service_account in service_accounts
    ]

    search_term = str(request.query_params.get('search') or '').strip().lower()
    if search_term:
        service_account_rows = [
            row for row in service_account_rows
            if search_term in row['id'].lower()
            or search_term in row['name'].lower()
            or search_term in row['environment'].lower()
            or search_term in ' '.join(row.get('policy_ids') or []).lower()
        ]

    status_filters = set(_parse_multi_query_param(request, 'status'))
    if status_filters:
        service_account_rows = [row for row in service_account_rows if row['status'] in status_filters]

    environment_filters = set(_parse_multi_query_param(request, 'environment'))
    if environment_filters:
        service_account_rows = [row for row in service_account_rows if row['environment'] in environment_filters]

    policy_id_filter = str(request.query_params.get('policy_id') or '').strip()
    if policy_id_filter:
        service_account_rows = [row for row in service_account_rows if policy_id_filter in (row.get('policy_ids') or [])]

    rotation_risk_filters = set(_parse_multi_query_param(request, 'rotation_risk'))
    if rotation_risk_filters:
        service_account_rows = [row for row in service_account_rows if row['rotation_risk'] in rotation_risk_filters]

    page_rows, has_more, starting_after, ending_before = _paginate_operator_rows(request, service_account_rows)

    total_count = len(service_account_rows)
    active_count = sum(1 for row in service_account_rows if row['status'] == CoreServiceAccount.StatusChoices.ACTIVE)
    disabled_count = sum(1 for row in service_account_rows if row['status'] == CoreServiceAccount.StatusChoices.DISABLED)
    pending_count = sum(1 for row in service_account_rows if row['status'] == CoreServiceAccount.StatusChoices.PENDING_APPROVAL)
    critical_count = sum(1 for row in service_account_rows if row['rotation_risk'] == 'critical')

    return {
        'object': 'list',
        'url': request.path,
        'summary_cards': [
            {'key': 'service_account_total', 'label': 'Tổng service account', 'value': total_count, 'detail': tenant.public_id},
            {'key': 'service_account_active', 'label': 'Active', 'value': active_count, 'detail': 'Visible in current filter set'},
            {'key': 'service_account_disabled', 'label': 'Disabled', 'value': disabled_count, 'detail': 'Dormant machine principals'},
            {'key': 'service_account_pending', 'label': 'Pending approval', 'value': pending_count, 'detail': 'Awaiting activation'},
            {'key': 'service_account_rotation_critical', 'label': 'Rotation critical', 'value': critical_count, 'detail': 'PAT posture needs review'},
        ],
        'data': page_rows,
        'has_more': has_more,
        'next_cursor': page_rows[-1]['id'] if has_more and page_rows else None,
        'prev_cursor': page_rows[0]['id'] if page_rows and (starting_after or ending_before) else None,
        'generated_at': timezone.now().isoformat(),
    }


def _build_operator_pat_list_snapshot(request, tenant: CoreTenant, credentials) -> dict:
    pat_rows = [
        _build_operator_pat_snapshot(tenant, credential)
        for credential in credentials
    ]

    search_term = str(request.query_params.get('search') or '').strip().lower()
    if search_term:
        pat_rows = [
            row for row in pat_rows
            if search_term in row['id'].lower()
            or search_term in row['token_prefix'].lower()
            or search_term in (row.get('service_account_id') or '').lower()
            or search_term in ' '.join(row.get('scope_codes') or []).lower()
        ]

    status_filters = set(_parse_multi_query_param(request, 'status'))
    if status_filters:
        pat_rows = [row for row in pat_rows if row['status'] in status_filters]

    service_account_id_filter = str(request.query_params.get('service_account_id') or '').strip()
    if service_account_id_filter:
        pat_rows = [row for row in pat_rows if row['service_account_id'] == service_account_id_filter]

    anomaly_filters = set(_parse_multi_query_param(request, 'anomaly_state'))
    if anomaly_filters:
        pat_rows = [row for row in pat_rows if row['anomaly_state'] in anomaly_filters]

    expires_within_days = request.query_params.get('expires_within_days')
    if expires_within_days not in (None, ''):
        try:
            expires_window_days = max(int(expires_within_days), 0)
        except (TypeError, ValueError):
            expires_window_days = None
        if expires_window_days is not None:
            threshold = timezone.now() + timedelta(days=expires_window_days)
            pat_rows = [
                row for row in pat_rows
                if row['expires_at'] is not None and row['expires_at'] <= threshold.isoformat()
            ]

    page_rows, has_more, starting_after, ending_before = _paginate_operator_rows(request, pat_rows)

    total_count = len(pat_rows)
    active_count = sum(1 for row in pat_rows if row['status'] == CorePATCredential.StatusChoices.ACTIVE)
    rotating_count = sum(1 for row in pat_rows if row['status'] == CorePATCredential.StatusChoices.ROTATING)
    revoked_count = sum(1 for row in pat_rows if row['status'] == CorePATCredential.StatusChoices.REVOKED)
    critical_count = sum(1 for row in pat_rows if row['anomaly_state'] == 'critical')

    return {
        'object': 'list',
        'url': request.path,
        'summary_cards': [
            {'key': 'pat_total', 'label': 'Tổng PAT', 'value': total_count, 'detail': tenant.public_id},
            {'key': 'pat_active', 'label': 'Active', 'value': active_count, 'detail': 'Visible in current filter set'},
            {'key': 'pat_rotating', 'label': 'Rotating', 'value': rotating_count, 'detail': 'Grace windows in effect'},
            {'key': 'pat_revoked', 'label': 'Revoked', 'value': revoked_count, 'detail': 'Non-secret projection only'},
            {'key': 'pat_anomaly_critical', 'label': 'Critical anomaly', 'value': critical_count, 'detail': 'Rotation or expiry posture'},
        ],
        'data': page_rows,
        'has_more': has_more,
        'next_cursor': page_rows[-1]['id'] if has_more and page_rows else None,
        'prev_cursor': page_rows[0]['id'] if page_rows and (starting_after or ending_before) else None,
        'generated_at': timezone.now().isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_tenant_service_accounts_api(request, tenant_id: str):
    """
    GET /api/core/v1/operator/tenants/{tenant_id}/service-accounts/
    Admin-only service-account projection for the tenant registry.
    """

    tenant, error_response = _resolve_operator_tenant(tenant_id)
    if error_response is not None:
        return error_response

    service_accounts = CoreServiceAccount.objects.filter(owner_user=tenant.owner_user).annotate(
        pat_count=Count('pat_credentials', distinct=True),
        active_pat_count=Count(
            'pat_credentials',
            filter=Q(pat_credentials__status__in=[CorePATCredential.StatusChoices.ACTIVE, CorePATCredential.StatusChoices.ROTATING]),
            distinct=True,
        ),
        latest_pat_last_used_at=Max('pat_credentials__last_used_at'),
    ).order_by('-updated_at', '-pk')

    return Response(_build_operator_service_account_list_snapshot(request, tenant, service_accounts), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_tenant_pats_api(request, tenant_id: str):
    """
    GET /api/core/v1/operator/tenants/{tenant_id}/pats/
    Admin-only PAT projection for the tenant registry.
    """

    tenant, error_response = _resolve_operator_tenant(tenant_id)
    if error_response is not None:
        return error_response

    credentials = CorePATCredential.objects.select_related('service_account', 'issued_by').filter(owner_user=tenant.owner_user).order_by('-created_at', '-pk')
    return Response(_build_operator_pat_list_snapshot(request, tenant, credentials), status=status.HTTP_200_OK)


def _build_operator_health_snapshot(request) -> dict:
    http_request = _http_request(request)

    service_payload = _response_payload(healthcheck(http_request))
    realtime_payload = _response_payload(realtime_health(http_request))
    streams_payload = _response_payload(streams_health(http_request))
    prefetch_response = prefetch_health(http_request)
    prefetch_payload = _response_payload(prefetch_response)
    market_payload = _response_payload(market_observability_health(http_request))

    admin_kpi_response = admin_runtime_kpi_api(http_request)
    admin_kpi_payload = getattr(admin_kpi_response, 'data', {}) or {}
    ai_runtime_response = operator_ai_runtime_api(http_request)
    ai_runtime_payload = getattr(ai_runtime_response, 'data', {}) or {}

    realtime_healthy = bool(realtime_payload.get('redis_ok')) or str(realtime_payload.get('channel_layer_type') or '').lower() == 'inmemory'
    streams_healthy = bool(streams_payload.get('redis_ok')) and not streams_payload.get('error')
    prefetch_healthy = bool(prefetch_payload.get('healthy'))
    market_overall = market_payload.get('overall') or {}
    market_freshness = market_payload.get('intraday_freshness') or {}
    market_pipeline = market_payload.get('whale_pipeline') or {}
    market_healthy = (
        int(market_overall.get('http_5xx') or 0) == 0
        and int(market_overall.get('external_timeouts') or 0) == 0
        and bool(market_pipeline.get('healthy', True))
        and bool(market_freshness.get('healthy', True))
    )
    celery_payload = admin_kpi_payload.get('celery') or {}
    celery_healthy = bool(celery_payload.get('alive'))
    ai_runtime_rollout = ai_runtime_payload.get('rollout_state') or {}
    ai_runtime_healthy = bool(ai_runtime_rollout.get('ready'))

    components = [
        {
            'key': 'service',
            'label': 'Core service',
            'healthy': str(service_payload.get('status') or '').lower() == 'ok',
            'status': str(service_payload.get('status') or 'unknown').lower(),
            'detail': service_payload.get('service') or 'vninvest-backend',
        },
        {
            'key': 'realtime',
            'label': 'Realtime layer',
            'healthy': realtime_healthy,
            'status': 'healthy' if realtime_healthy else 'degraded',
            'detail': realtime_payload,
        },
        {
            'key': 'streams',
            'label': 'Streams layer',
            'healthy': streams_healthy,
            'status': 'healthy' if streams_healthy else 'degraded',
            'detail': streams_payload,
        },
        {
            'key': 'prefetch',
            'label': 'Prefetch layer',
            'healthy': prefetch_healthy,
            'status': 'healthy' if prefetch_healthy else 'degraded',
            'detail': prefetch_payload,
        },
        {
            'key': 'market_observability',
            'label': 'Market observability',
            'healthy': market_healthy,
            'status': 'healthy' if market_healthy else 'degraded',
            'detail': market_overall,
        },
        {
            'key': 'celery',
            'label': 'Celery workers',
            'healthy': celery_healthy,
            'status': 'healthy' if celery_healthy else 'degraded',
            'detail': celery_payload,
        },
        {
            'key': 'ai_runtime',
            'label': 'AI runtime',
            'healthy': ai_runtime_healthy,
            'status': 'healthy' if ai_runtime_healthy else 'degraded',
            'detail': ai_runtime_rollout,
        },
    ]

    healthy_components = sum(1 for component in components if component['healthy'])
    degraded_components = [component['key'] for component in components if not component['healthy']]
    overall_healthy = healthy_components == len(components)

    return {
        'object': 'operator_health_snapshot',
        'generated_at': timezone.now().isoformat(),
        'healthy': overall_healthy,
        'health_status': 'healthy' if overall_healthy else 'degraded',
        'healthy_component_count': healthy_components,
        'degraded_component_count': len(degraded_components),
        'degraded_components': degraded_components,
        'components': components,
        'sources': {
            'service': service_payload,
            'realtime': realtime_payload,
            'streams': streams_payload,
            'prefetch': prefetch_payload,
            'market_observability': market_payload,
            'admin_runtime_kpi': admin_kpi_payload,
            'ai_runtime': ai_runtime_payload,
        },
    }


def _build_operator_overview_snapshot(request) -> dict:
    health_snapshot = _build_operator_health_snapshot(request)
    admin_kpi_payload = health_snapshot['sources']['admin_runtime_kpi']
    ai_runtime_payload = health_snapshot['sources']['ai_runtime']
    market_payload = health_snapshot['sources']['market_observability']
    prefetch_payload = health_snapshot['sources']['prefetch']
    realtime_payload = health_snapshot['sources']['realtime']

    ai_runtime_rollout = ai_runtime_payload.get('rollout_state') or {}
    health_cards = [
        {
            'key': component['key'],
            'label': component['label'],
            'value': 'Healthy' if component['healthy'] else 'Degraded',
            'detail': component.get('detail'),
            'status': component['status'],
        }
        for component in health_snapshot['components']
    ]

    summary_cards = [
        {
            'key': 'operator_health',
            'label': 'Trạng thái tổng quan',
            'value': health_snapshot['health_status'],
            'detail': f"{health_snapshot['healthy_component_count']}/{len(health_snapshot['components'])} thành phần khỏe",
        },
        {
            'key': 'realtime',
            'label': 'Realtime',
            'value': 'OK' if health_snapshot['sources']['realtime'].get('redis_ok') or str(health_snapshot['sources']['realtime'].get('channel_layer_type') or '').lower() == 'inmemory' else 'Degraded',
            'detail': f"layer={realtime_payload.get('channel_layer_type') or 'unknown'}",
        },
        {
            'key': 'prefetch',
            'label': 'Prefetch',
            'value': str(prefetch_payload.get('status') or 'unknown'),
            'detail': prefetch_payload.get('reason') or 'n/a',
        },
        {
            'key': 'market_observability',
            'label': 'Market observability',
            'value': 'healthy' if health_snapshot['components'][4]['healthy'] else 'degraded',
            'detail': f"{int((market_payload.get('overall') or {}).get('http_requests') or 0)} request(s)",
        },
        {
            'key': 'ai_runtime',
            'label': 'AI runtime',
            'value': 'ready' if ai_runtime_rollout.get('ready') else 'degraded',
            'detail': f"{ai_runtime_rollout.get('effective_provider') or 'n/a'} / {ai_runtime_rollout.get('effective_model') or 'n/a'}",
        },
    ]

    return {
        'object': 'operator_overview_snapshot',
        'generated_at': timezone.now().isoformat(),
        'health_status': health_snapshot['health_status'],
        'summary_cards': summary_cards,
        'health_cards': health_cards,
        'sections': {
            'health': health_snapshot,
            'admin_runtime_kpi': admin_kpi_payload,
            'ai_runtime': ai_runtime_payload,
        },
    }


def _operator_tenant_queryset(request):
    queryset = CoreTenant.objects.select_related('owner_user').annotate(
        active_service_account_count=Count(
            'owner_user__core_service_accounts',
            filter=Q(owner_user__core_service_accounts__status=CoreServiceAccount.StatusChoices.ACTIVE),
            distinct=True,
        ),
        active_pat_count=Count(
            'owner_user__core_pat_credentials',
            filter=Q(owner_user__core_pat_credentials__status__in=[CorePATCredential.StatusChoices.ACTIVE, CorePATCredential.StatusChoices.ROTATING]),
            distinct=True,
        ),
        latest_pat_last_used_at=Max('owner_user__core_pat_credentials__last_used_at'),
    ).order_by('-updated_at', '-pk')

    search_term = str(request.query_params.get('search') or '').strip()
    if search_term:
        queryset = queryset.filter(
            Q(public_id__icontains=search_term)
            | Q(tenant_code__icontains=search_term)
            | Q(display_name__icontains=search_term)
            | Q(owner_user__username__icontains=search_term)
            | Q(owner_user__email__icontains=search_term)
        )

    status_values = _parse_multi_query_param(request, 'status')
    if status_values:
        queryset = queryset.filter(status__in=status_values)

    plan_values = _parse_multi_query_param(request, 'plan_code')
    if plan_values:
        queryset = queryset.filter(plan__in=plan_values)

    return queryset


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def operator_tenants_api(request):
    """
    GET /api/core/v1/operator/tenants/
    Admin-only tenant registry projection for the operator console.
    """

    if request.method == 'GET':
        tenants = list(_operator_tenant_queryset(request))
        return Response(_build_operator_tenant_list_snapshot(request, tenants), status=status.HTTP_200_OK)

    display_name = str(request.data.get('display_name') or '').strip()
    owner_email = str(request.data.get('owner_email') or '').strip().lower()
    if not display_name:
        return Response({'detail': 'display_name là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)

    owner_user, owner_error = _resolve_or_create_owner_user(owner_email)
    if owner_error is not None:
        return owner_error

    if CoreTenant.objects.filter(owner_user=owner_user).exists():
        return Response({'detail': 'owner_email đã có tenant.'}, status=status.HTTP_409_CONFLICT)

    plan = _normalize_tenant_plan(request.data.get('plan')) or CoreTenant.PlanChoices.FREE
    status_value = _normalize_tenant_status(request.data.get('status')) or CoreTenant.StatusChoices.ACTIVE
    if plan is None:
        return Response({'detail': 'plan không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
    if status_value is None:
        return Response({'detail': 'status không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    features = _coerce_features(request.data.get('features'))
    if features == 'invalid':
        return Response({'detail': 'features phải là list.'}, status=status.HTTP_400_BAD_REQUEST)

    tenant_code = str(request.data.get('tenant_code') or '').strip().lower() or _generate_unique_tenant_code(display_name)
    if CoreTenant.objects.filter(tenant_code=tenant_code).exists():
        return Response({'detail': 'tenant_code đã tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)

    event_ctx = _build_operator_event_context(request)
    tenant = CoreTenant.objects.create(
        owner_user=owner_user,
        tenant_code=tenant_code,
        display_name=display_name,
        plan=plan,
        status=status_value,
        features=features or [],
    )
    event = TenantLifecycleEvent.objects.create(
        tenant=tenant,
        event_type=TenantLifecycleEvent.EventType.STATUS_CHANGED,
        actor_type=event_ctx['actor_type'],
        actor_user=event_ctx['actor_user'],
        ip_address=event_ctx['ip_address'],
        new_value={'status': tenant.status},
        metadata={'action': 'provision'},
    )
    return Response(_build_tenant_action_response(tenant, event_id=event.id), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminUser])
def operator_tenant_detail_api(request, tenant_id: str):
    """
    GET /api/core/v1/operator/tenants/{tenant_id}/
    Admin-only tenant detail projection for the operator console.
    """

    tenant, error_response = _resolve_operator_tenant(tenant_id)
    if error_response is not None:
        return error_response

    if request.method == 'GET':
        return Response(_build_operator_tenant_detail_snapshot(tenant), status=status.HTTP_200_OK)

    event_ctx = _build_operator_event_context(request)
    update_fields = []
    plan_event_id = None
    reason = str(request.data.get('reason') or '').strip()

    if 'status' in request.data:
        new_status = _normalize_tenant_status(request.data.get('status'))
        if not new_status:
            return Response({'detail': 'status không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_status != tenant.status:
            tenant._actor_type = event_ctx['actor_type']
            tenant._actor_user = event_ctx['actor_user']
            tenant.status = new_status
            if new_status == CoreTenant.StatusChoices.SUSPENDED:
                tenant.suspended_at = timezone.now()
                update_fields.append('suspended_at')
            elif new_status == CoreTenant.StatusChoices.ACTIVE:
                tenant.suspended_at = None
                tenant.activated_at = timezone.now()
                update_fields.extend(['suspended_at', 'activated_at'])
            update_fields.append('status')

    if 'plan' in request.data:
        new_plan = _normalize_tenant_plan(request.data.get('plan'))
        if not new_plan:
            return Response({'detail': 'plan không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_plan != tenant.plan:
            old_plan = tenant.plan
            tenant.plan = new_plan
            update_fields.append('plan')
            plan_event = TenantLifecycleEvent.objects.create(
                tenant=tenant,
                event_type=TenantLifecycleEvent.EventType.PLAN_CHANGED,
                actor_type=event_ctx['actor_type'],
                actor_user=event_ctx['actor_user'],
                ip_address=event_ctx['ip_address'],
                old_value={'plan': old_plan},
                new_value={'plan': new_plan},
                metadata={'reason': reason},
            )
            plan_event_id = plan_event.id

    if 'features' in request.data:
        features = _coerce_features(request.data.get('features'))
        if features == 'invalid':
            return Response({'detail': 'features phải là list.'}, status=status.HTTP_400_BAD_REQUEST)
        tenant.features = features or []
        update_fields.append('features')

    if update_fields:
        tenant.save(update_fields=sorted(set(update_fields + ['updated_at'])))

    return Response(_build_tenant_action_response(tenant, event_id=plan_event_id), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def operator_tenant_suspend_api(request, tenant_id: str):
    tenant, error_response = _resolve_operator_tenant(tenant_id)
    if error_response is not None:
        return error_response

    event_ctx = _build_operator_event_context(request)
    if tenant.status != CoreTenant.StatusChoices.SUSPENDED:
        tenant._actor_type = event_ctx['actor_type']
        tenant._actor_user = event_ctx['actor_user']
        tenant.status = CoreTenant.StatusChoices.SUSPENDED
        tenant.suspended_at = timezone.now()
        tenant.save(update_fields=['status', 'suspended_at', 'updated_at'])

    event = tenant.lifecycle_events.order_by('-created_at', '-id').first()
    return Response(_build_tenant_action_response(tenant, event_id=getattr(event, 'id', None)), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def operator_tenant_activate_api(request, tenant_id: str):
    tenant, error_response = _resolve_operator_tenant(tenant_id)
    if error_response is not None:
        return error_response

    event_ctx = _build_operator_event_context(request)
    if tenant.status != CoreTenant.StatusChoices.ACTIVE:
        tenant._actor_type = event_ctx['actor_type']
        tenant._actor_user = event_ctx['actor_user']
        tenant.status = CoreTenant.StatusChoices.ACTIVE
        tenant.suspended_at = None
        tenant.activated_at = timezone.now()
        tenant.save(update_fields=['status', 'suspended_at', 'activated_at', 'updated_at'])

    event = tenant.lifecycle_events.order_by('-created_at', '-id').first()
    return Response(_build_tenant_action_response(tenant, event_id=getattr(event, 'id', None)), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def operator_tenant_change_plan_api(request, tenant_id: str):
    tenant, error_response = _resolve_operator_tenant(tenant_id)
    if error_response is not None:
        return error_response

    new_plan = _normalize_tenant_plan(request.data.get('plan'))
    if not new_plan:
        return Response({'detail': 'plan không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    reason = str(request.data.get('reason') or '').strip()
    event_ctx = _build_operator_event_context(request)
    event_id = None
    if new_plan != tenant.plan:
        old_plan = tenant.plan
        tenant.plan = new_plan
        tenant.save(update_fields=['plan', 'updated_at'])
        event = TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.PLAN_CHANGED,
            actor_type=event_ctx['actor_type'],
            actor_user=event_ctx['actor_user'],
            ip_address=event_ctx['ip_address'],
            old_value={'plan': old_plan},
            new_value={'plan': new_plan},
            metadata={'reason': reason},
        )
        event_id = event.id

    return Response(_build_tenant_action_response(tenant, event_id=event_id), status=status.HTTP_200_OK)

def _parse_bool_query_param(raw_value, *, default: bool = False) -> bool:
    if raw_value in (None, ''):
        return default
    normalized = str(raw_value).strip().lower()
    if normalized in {'1', 'true', 'yes', 'y', 'on'}:
        return True
    if normalized in {'0', 'false', 'no', 'n', 'off'}:
        return False
    return default


def _parse_optional_positive_int(raw_value, field_name: str):
    if raw_value in (None, ''):
        return None
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} phai la so nguyen duong.')
    if value < 1:
        raise ValueError(f'{field_name} phai la so nguyen duong.')
    return value


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_api(request):
    """
    GET /api/admin-ops/runtime-kpi/
    Admin-only: runtime KPI snapshot cho trust-track S24-06..S24-10.
    Trả về observability market, prefetch health, celery alive status.
    """
    from time import time as _time
    from portfolio.observability import get_market_observability_snapshot
    from config.health import build_prefetch_health_snapshot
    from portfolio.tasks_prefetch import _metric_cache_key

    celery_alive = False
    celery_active_queues: list = []
    try:
        from config.celery import app as celery_app
        inspect = celery_app.control.inspect(timeout=1.5)
        ping_result = inspect.ping()
        celery_alive = bool(ping_result)
        active_qs = inspect.active_queues() or {}
        celery_active_queues = list(active_qs.keys())
    except Exception:
        pass

    obs_snapshot = get_market_observability_snapshot()
    prefetch_snapshot = build_prefetch_health_snapshot()

    def _read_prefetch_metric(metric_name: str) -> int:
        try:
            return int(cache.get(_metric_cache_key(metric_name)) or 0)
        except Exception:
            return 0

    prefetch_scheduler_metrics = {
        'runs_total': _read_prefetch_metric('scheduler_runs_total'),
        'enqueued_total': _read_prefetch_metric('scheduler_enqueued_total'),
        'skipped_due_to_interval_total': _read_prefetch_metric('scheduler_skipped_due_to_interval_total'),
        'empty_shard_total': _read_prefetch_metric('scheduler_empty_shard_total'),
        'disabled_tier_total': _read_prefetch_metric('scheduler_disabled_tier_total'),
        'stale_snapshot_total': _read_prefetch_metric('scheduler_stale_snapshot_total'),
        'estimated_upstream_calls_per_minute_total': _read_prefetch_metric('realtime_upstream_calls_per_minute'),
    }

    return Response(
        {
            'sampled_at': _time(),
            'market_observability': obs_snapshot,
            'prefetch_health': prefetch_snapshot,
            'prefetch_scheduler_metrics': prefetch_scheduler_metrics,
            'celery': {
                'alive': celery_alive,
                'active_workers': celery_active_queues,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_advisory_merge_api(request):
    """
    GET /api/admin-ops/runtime-kpi/advisory-merge/
    Admin-only: trả về nhanh chỉ số merge pipeline của advisory event.
    """
    from time import time as _time
    from portfolio.observability import get_market_observability_snapshot

    snapshot = get_market_observability_snapshot()
    merge_stats = snapshot.get('advisory_event_merge') or {}
    return Response(
        {
            'sampled_at': _time(),
            'advisory_event_merge': {
                'scheduled': int(merge_stats.get('scheduled', 0)),
                'merged': int(merge_stats.get('merged', 0)),
                'flushed': int(merge_stats.get('flushed', 0)),
                'skipped': int(merge_stats.get('skipped', 0)),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_whale_pipeline_api(request):
    """
    GET /api/admin-ops/runtime-kpi/whale-pipeline/
    Admin-only: trả về health summary cho whale pipeline observability.
    """
    from time import time as _time
    from portfolio.observability import get_whale_pipeline_health_summary

    return Response(
        {
            'sampled_at': _time(),
            'whale_pipeline': get_whale_pipeline_health_summary(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_whale_preflight_metrics_api(request):
    """
    GET /api/admin-ops/runtime-kpi/whale-preflight-metrics/
    Admin-only: trả về counters profiling cho whale preflight cache checks.
    Query params:
      - date=YYYY-MM-DD (optional, default=today localdate)
      - window_days=1..30 (optional, default=1)
            - compact=true|false (optional, default=false)
    """
    from time import time as _time
    from django.utils import timezone

    sampled_at = _time()
    requested_date = str(request.query_params.get('date') or '').strip()
    compact = _parse_bool_query_param(request.query_params.get('compact'), default=False)
    requested_window_days = request.query_params.get('window_days')
    if requested_window_days in (None, ''):
        window_days = 1
    else:
        try:
            window_days = int(requested_window_days)
        except (TypeError, ValueError):
            return Response(
                {
                    'detail': 'Invalid window_days. Use an integer from 1 to 30.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if window_days < 1 or window_days > 30:
            return Response(
                {
                    'detail': 'Invalid window_days. Use an integer from 1 to 30.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    target_date = timezone.localdate()
    if requested_date:
        try:
            target_date = timezone.datetime.strptime(requested_date, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {
                    'detail': 'Invalid date format. Use YYYY-MM-DD.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    day_key = target_date.isoformat()
    try:
        metrics = _read_preflight_metrics(day_key=day_key)
        trend = _read_preflight_metrics_window(end_date=target_date, window_days=window_days)
        totals = _sum_preflight_metrics_window(window_rows=trend)
        rates = _build_preflight_metric_rates(totals=totals)
        summary = _build_preflight_metric_summary(totals=totals, rates=rates)
    except Exception:
        metrics = {name: 0 for name in WHALE_PREFLIGHT_METRIC_NAMES}
        trend = [{'date': day_key, 'metrics': metrics}] if window_days == 1 else []
        totals = {name: 0 for name in WHALE_PREFLIGHT_METRIC_NAMES}
        rates = _build_preflight_metric_rates(totals=totals)
        summary = _build_preflight_metric_summary(totals=totals, rates=rates)

    payload = {
        'sampled_at': sampled_at,
        'updated_at': timezone.now().isoformat(),
        'schema_version': WHALE_PREFLIGHT_KPI_SCHEMA_VERSION,
        'date': day_key,
        'window_days': window_days,
        'compact': compact,
        'whale_preflight_metrics': metrics,
        'whale_preflight_metrics_totals': totals,
        'whale_preflight_metrics_rates': rates,
        'whale_preflight_metrics_summary': summary,
    }
    if not compact:
        payload['whale_preflight_metrics_trend'] = trend

    return Response(payload, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_advisory_metrics_api(request):
    """
    GET /api/admin-ops/runtime-kpi/advisory-metrics/

    Admin-only: monitoring metrics cho Advisory AI pipeline.
    Tổng hợp 5 chỉ số chính phục vụ Grafana / alerting:
      - p50 / p95 generation latency (từ AdvisoryAggregateAuditLog, window 24h)
      - Token burn today vs. tổng budget khả dụng
      - Provider distribution (7 ngày gần nhất)
      - Active 429 rate-limit cooldowns per provider
      - Advisory generation counts today by source

    Query-params:
      latency_window_hours=24  (default)   - cửa sổ tính latency, tối đa 168
      provider_window_days=7   (default)   - cửa sổ phân phối provider, tối đa 30
    """
    import statistics
    from time import time as _time
    from django.db.models import Sum
    from django.utils import timezone
    from django.core.cache import cache
    from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryTokenLog, UserConfig, WhaleAdvisory
    from portfolio.ai_options import MODEL_CATALOG

    sampled_at = _time()

    try:
        latency_window_hours = min(max(int(request.query_params.get('latency_window_hours', 24)), 1), 168)
    except (TypeError, ValueError):
        latency_window_hours = 24

    try:
        provider_window_days = min(max(int(request.query_params.get('provider_window_days', 7)), 1), 30)
    except (TypeError, ValueError):
        provider_window_days = 7

    latency_window_start = timezone.now() - timezone.timedelta(hours=latency_window_hours)
    audit_qs = AdvisoryAggregateAuditLog.objects.filter(
        created_at__gte=latency_window_start,
    ).values_list('metadata_json', flat=True)

    latencies_ms: list[float] = []
    for meta in audit_qs:
        if isinstance(meta, dict):
            val = meta.get('latency_ms')
            if val is not None:
                try:
                    latencies_ms.append(float(val))
                except (TypeError, ValueError):
                    pass

    latency_p50 = round(statistics.median(latencies_ms), 2) if latencies_ms else None
    if latencies_ms:
        sorted_lat = sorted(latencies_ms)
        p95_idx = max(0, int(len(sorted_lat) * 0.95) - 1)
        latency_p95 = round(sorted_lat[p95_idx], 2)
    else:
        latency_p95 = None

    today = timezone.localdate()
    token_burn_today = int(
        AdvisoryTokenLog.objects.filter(created_at__date=today).aggregate(t=Sum('tokens_used'))['t'] or 0
    )
    total_configured_budget = int(
        UserConfig.objects.filter(advisory_max_tokens_per_day__gt=0).aggregate(
            s=Sum('advisory_max_tokens_per_day')
        )['s'] or 0
    )
    burn_pct = round((token_burn_today / total_configured_budget * 100), 2) if total_configured_budget else None

    provider_window_start = timezone.now() - timezone.timedelta(days=provider_window_days)
    provider_dist: dict[str, int] = {}
    for meta in AdvisoryAggregateAuditLog.objects.filter(
        created_at__gte=provider_window_start,
    ).values_list('metadata_json', flat=True):
        if isinstance(meta, dict):
            prov = str(meta.get('ai_provider') or '').strip().lower()
            if prov:
                provider_dist[prov] = provider_dist.get(prov, 0) + 1

    known_providers = list(MODEL_CATALOG.keys())
    ratelimit_cooldowns: dict[str, bool] = {
        prov: bool(cache.get(f'advisory:provider-ratelimit:{prov}'))
        for prov in known_providers
    }
    today_iso = today.isoformat()
    ratelimit_429_counts_today: dict[str, int] = {
        prov: int(cache.get(f'advisory:429-count:{prov}:{today_iso}') or 0)
        for prov in known_providers
    }
    budget_downgrade_count_today = int(cache.get(f'advisory:budget-downgrade-count:{today_iso}') or 0)

    language_quality = {}
    for lang in ('vi', 'en'):
        checks = int(cache.get(f'advisory:language-check-count:{lang}:{today_iso}') or 0)
        mismatches = int(cache.get(f'advisory:language-mismatch-count:{lang}:{today_iso}') or 0)
        mismatch_rate = round((mismatches / checks) * 100.0, 2) if checks > 0 else None
        language_quality[lang] = {
            'checks_today': checks,
            'mismatches_today': mismatches,
            'mismatch_rate_pct': mismatch_rate,
        }

    failover_attempt_count_today = int(cache.get(f'advisory:failover-attempt-count:{today_iso}') or 0)
    failover_success_count_today = int(cache.get(f'advisory:failover-success-count:{today_iso}') or 0)
    failover_success_rate = (
        round(failover_success_count_today / failover_attempt_count_today, 4)
        if failover_attempt_count_today > 0
        else None
    )

    failover_by_source: dict[str, dict] = {}
    provider_health: dict[str, dict] = {}
    for prov in known_providers:
        failover_count = int(cache.get(f'advisory:failover-count:{prov}:{today_iso}') or 0)
        failover_success_for_source = int(cache.get(f'advisory:failover-success:{prov}:{today_iso}') or 0)

        primary_failures = {
            'rate_limited': int(cache.get(f'advisory:failover-reason:{prov}:rate_limited:{today_iso}') or 0),
            'service_down': int(cache.get(f'advisory:failover-reason:{prov}:service_down:{today_iso}') or 0),
            'timeout': int(cache.get(f'advisory:failover-reason:{prov}:timeout:{today_iso}') or 0),
            'missing_api_key': int(cache.get(f'advisory:failover-reason:{prov}:missing_api_key:{today_iso}') or 0),
            'unknown': int(cache.get(f'advisory:failover-reason:{prov}:unknown:{today_iso}') or 0),
        }

        fallback_targets_used = {
            target: int(cache.get(f'advisory:failover-target:{prov}:{target}:{today_iso}') or 0)
            for target in known_providers
            if target != prov
        }
        fallback_targets_used = {k: v for k, v in fallback_targets_used.items() if v > 0}

        failover_by_source[prov] = {
            'failover_count': failover_count,
            'success_after_failover_count': failover_success_for_source,
            'primary_failures': primary_failures,
            'fallback_targets_used': fallback_targets_used,
        }

        attempts_today = int(cache.get(f'advisory:provider-attempts:{prov}:{today_iso}') or 0)
        successful_attempts_today = int(cache.get(f'advisory:provider-success:{prov}:{today_iso}') or 0)
        success_rate_pct = round((successful_attempts_today / attempts_today) * 100.0, 2) if attempts_today else None
        last_failure = cache.get(f'advisory:provider-last-failure:{prov}')
        provider_health[prov] = {
            'success_rate_pct': success_rate_pct,
            'last_failure': last_failure.get('at') if isinstance(last_failure, dict) else None,
            'failure_type': last_failure.get('failure_type') if isinstance(last_failure, dict) else None,
            'attempts_today': attempts_today,
            'successful_attempts': successful_attempts_today,
        }

    source_counts: dict[str, int] = {}
    for entry in (
        AdvisoryTokenLog.objects.filter(created_at__date=today)
        .values('source')
        .annotate(cnt=Sum('tokens_used'))
        .order_by()
    ):
        source_counts[str(entry['source'])] = int(entry['cnt'] or 0)

    advisory_count_today = AdvisoryTokenLog.objects.filter(created_at__date=today).count()

    return Response(
        {
            'sampled_at': sampled_at,
            'windows': {
                'latency_hours': latency_window_hours,
                'provider_days': provider_window_days,
            },
            'latency': {
                'p50_ms': latency_p50,
                'p95_ms': latency_p95,
                'sample_count': len(latencies_ms),
            },
            'token_burn': {
                'today_tokens': token_burn_today,
                'total_configured_budget': total_configured_budget,
                'burn_pct': burn_pct,
            },
            'provider_distribution': provider_dist,
            'ratelimit_cooldowns_active': ratelimit_cooldowns,
            'ratelimit_429_counts_today': ratelimit_429_counts_today,
            'budget_downgrade_count_today': budget_downgrade_count_today,
            'language_quality': language_quality,
            'failover_tracking': {
                'failovers_today': failover_attempt_count_today,
                'by_source_provider': failover_by_source,
                'failover_success_rate': failover_success_rate,
            },
            'provider_health': provider_health,
            'advisory_counts_today': {
                'total': advisory_count_today,
                'by_source_tokens': source_counts,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def admin_system_ai_settings_api(request):
    """
    GET/PUT /api/admin-ops/system-ai-settings/
    Admin-only: quản trị System AI Settings cho fallback runtime.
    """
    from django.core.exceptions import ValidationError
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider
    from .models import SystemAISettings, SystemAISettingsAuditLog

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)

    def _serialize(obj):
        governance_thresholds = _get_runtime_governance_delta_thresholds()
        prefetch_runtime_settings = _get_runtime_prefetch_settings()
        prefetch_time_policy = _get_runtime_prefetch_time_policy()
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
            'governance_delta_thresholds': governance_thresholds,
            'governance_delta_rulebook': {
                'warning_min': 0,
                'critical_must_be_gte_warning': True,
                'cooldown_min': 0,
                'recommended': {
                    'warning': 2.0,
                    'critical': 4.0,
                    'cooldown': 2.0,
                },
            },
            'prefetch_runtime_settings': prefetch_runtime_settings,
            'prefetch_runtime_rulebook': {
                'batch_size_min': 1,
                'symbol_limit_min': 0,
                'max_retries_min': 0,
                'retry_base_seconds_min': 1,
                'retry_max_seconds_min': 1,
                'rate_limit_cooldown_seconds_min': 5,
                'circuit_window_seconds_min': 30,
                'circuit_breaker_timeout_threshold_min': 1,
                'circuit_breaker_cooldown_seconds_min': 60,
                'offhours_cache_ttl_seconds_min': 60,
                'session_close_retention_days_min': 1,
                'intraday_universe_group_ids_type': 'array<int>',
                'recommended': {
                    'batch_size': 20,
                    'symbol_limit': 40,
                    'max_retries': 4,
                    'retry_base_seconds': 15,
                    'retry_max_seconds': 120,
                    'rate_limit_cooldown_seconds': 30,
                    'circuit_window_seconds': 300,
                    'circuit_breaker_timeout_threshold': 3,
                    'circuit_breaker_cooldown_seconds': 1800,
                    'offhours_cache_ttl_seconds': 3600,
                    'session_close_retention_days': 7,
                    'include_group_symbols': False,
                    'intraday_universe_group_ids': [],
                    'intraday_universe_force_warm_tier': True,
                    'session_close_capture_enabled': True,
                },
            },
            'prefetch_time_policy': prefetch_time_policy,
            'prefetch_time_policy_rulebook': _prefetch_time_policy_rulebook(),
            'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
        }

    def _snapshot(obj):
        governance_thresholds = _get_runtime_governance_delta_thresholds()
        prefetch_runtime_settings = _get_runtime_prefetch_settings()
        prefetch_time_policy = _get_runtime_prefetch_time_policy()
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
            'governance_delta_thresholds': governance_thresholds,
            'prefetch_runtime_settings': prefetch_runtime_settings,
            'prefetch_time_policy': prefetch_time_policy,
        }

    if request.method == 'GET':
        return Response({'ok': True, 'settings': _serialize(settings_obj)}, status=status.HTTP_200_OK)

    before_snapshot = _snapshot(settings_obj)

    provider = str(request.data.get('ai_provider') or settings_obj.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or '').strip()
    notes = str(request.data.get('notes') or settings_obj.notes or '').strip()
    allow_env_fallback = bool(request.data.get('allow_env_fallback', settings_obj.allow_env_fallback))
    is_active = bool(request.data.get('is_active', settings_obj.is_active))
    raw_key = request.data.get('ai_api_key', None)
    governance_thresholds_payload = request.data.get('governance_delta_thresholds', None)
    prefetch_runtime_settings_payload = request.data.get('prefetch_runtime_settings', None)
    prefetch_time_policy_payload = request.data.get('prefetch_time_policy', None)

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    effective_model = model or settings_obj.get_effective_ai_model()
    if effective_model and not is_valid_model(provider, effective_model):
        return Response({'ok': False, 'message': 'AI model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if effective_model and not is_model_allowed_for_capability(provider, effective_model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'AI model này chưa được hỗ trợ cho advisory runtime hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj.ai_provider = provider
    settings_obj.ai_model = model
    settings_obj.notes = notes
    settings_obj.allow_env_fallback = allow_env_fallback
    settings_obj.is_active = is_active
    if raw_key is not None:
        settings_obj.set_ai_api_key(str(raw_key or '').strip())

    try:
        if governance_thresholds_payload is not None:
            _set_runtime_governance_delta_thresholds(governance_thresholds_payload)
        if prefetch_runtime_settings_payload is not None:
            _set_runtime_prefetch_settings(prefetch_runtime_settings_payload)
        if prefetch_time_policy_payload is not None:
            _set_runtime_prefetch_time_policy(prefetch_time_policy_payload)
        settings_obj.full_clean()
        settings_obj.save()
    except (ValidationError, ValueError) as exc:
        return Response({'ok': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    after_snapshot = _snapshot(settings_obj)
    if before_snapshot != after_snapshot:
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=request.user if request.user.is_authenticated else None,
            action='update_settings',
            reason='updated_via_admin_api',
            before_json=before_snapshot,
            after_json=after_snapshot,
        )

    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật System AI Settings.',
            'settings': _serialize(settings_obj),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_system_ai_test_connection_api(request):
    """
    POST /api/admin-ops/system-ai-settings/test-connection/
    Admin-only: kiểm tra kết nối theo System AI Settings hiện hành.
    """
    from .ai_runtime_config import resolve_ai_runtime_config
    from .ai_service import test_ai_connection
    from .models import SystemAISettings, SystemAISettingsAuditLog

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        return Response(
            {
                'ok': False,
                'message': 'Chưa có System AI Settings để test kết nối.',
                'reason': 'missing_system_ai_settings',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    runtime_cfg = resolve_ai_runtime_config(user=None, system_settings=settings_obj)
    if not runtime_cfg.get('ready'):
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=request.user if request.user.is_authenticated else None,
            action='test_connection_failed',
            reason=str(runtime_cfg.get('reason') or 'runtime_not_ready'),
            before_json={
                'provider': runtime_cfg.get('provider'),
                'model': runtime_cfg.get('model'),
            },
            after_json={'ready': False},
        )
        return Response(
            {
                'ok': False,
                'message': runtime_cfg.get('message') or 'System AI runtime chưa sẵn sàng.',
                'reason': runtime_cfg.get('reason') or 'runtime_not_ready',
                'provider': runtime_cfg.get('provider'),
                'model': runtime_cfg.get('model'),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = test_ai_connection(
        provider=str(runtime_cfg.get('provider') or ''),
        model=str(runtime_cfg.get('model') or ''),
        api_key=str(runtime_cfg.get('api_key') or ''),
    )
    SystemAISettingsAuditLog.objects.create(
        settings=settings_obj,
        actor=request.user if request.user.is_authenticated else None,
        action='test_connection_success' if payload.get('ok') else 'test_connection_failed',
        reason=str(payload.get('message') or ''),
        before_json={
            'provider': runtime_cfg.get('provider'),
            'model': runtime_cfg.get('model'),
        },
        after_json={
            'ok': bool(payload.get('ok')),
            'prompt_tokens': int(payload.get('prompt_tokens') or 0),
            'completion_tokens': int(payload.get('completion_tokens') or 0),
        },
    )
    status_code = status.HTTP_200_OK if payload.get('ok') else status.HTTP_400_BAD_REQUEST
    return Response(payload, status=status_code)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_ai_runtime_api(request):
    """
    GET /api/core/v1/operator/ai-runtime/
    Admin-only operator projection for AI runtime governance.
    """
    from django.utils import timezone

    from .ai_options import ADVISORY_CAPABILITY, get_default_model, is_model_allowed_for_capability, is_valid_provider
    from .ai_runtime_config import resolve_ai_runtime_config
    from .ai_service import _resolve_provider_api_key
    from .models import AICommandCenterConfig, SystemAISettings

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)

    command_center_cfg = None
    if getattr(request.user, 'is_authenticated', False):
        command_center_cfg = AICommandCenterConfig.objects.filter(user=request.user).first()

    def _resolve_row(*, source: str, cfg_provider: str, cfg_model: str, raw_key: str, allow_env_fallback: bool, config_present: bool, missing_config_code: str):
        provider = str(cfg_provider or '').strip().lower()
        model = str(cfg_model or '').strip()
        if provider and not model:
            model = str(get_default_model(provider) or '').strip()
        resolved_key = str(raw_key or '').strip()
        if provider and not resolved_key and allow_env_fallback:
            resolved_key = _resolve_provider_api_key(provider, '')

        if not config_present:
            warning_code = missing_config_code
        elif not is_valid_provider(provider):
            warning_code = f'invalid_{source}_provider'
        elif not model:
            warning_code = f'missing_{source}_model'
        elif not is_model_allowed_for_capability(provider, model, ADVISORY_CAPABILITY):
            warning_code = f'invalid_{source}_model'
        elif not resolved_key:
            warning_code = f'missing_{source}_ai_api_key'
        else:
            warning_code = None

        return {
            'provider': provider,
            'model': model,
            'ready': warning_code is None,
            'source': source,
            'warning_code': warning_code,
        }

    command_center_row = _resolve_row(
        source='command_center',
        cfg_provider=getattr(command_center_cfg, 'ai_provider', '') if command_center_cfg else '',
        cfg_model=command_center_cfg.get_effective_ai_model() if command_center_cfg else '',
        raw_key=command_center_cfg.get_ai_api_key() if command_center_cfg else '',
        allow_env_fallback=True,
        config_present=command_center_cfg is not None,
        missing_config_code='missing_command_center_ai_config',
    )

    system_row = _resolve_row(
        source='system',
        cfg_provider=getattr(settings_obj, 'ai_provider', ''),
        cfg_model=settings_obj.get_effective_ai_model(),
        raw_key=settings_obj.get_ai_api_key(),
        allow_env_fallback=bool(settings_obj.allow_env_fallback),
        config_present=settings_obj is not None,
        missing_config_code='missing_system_ai_settings',
    )

    effective_runtime = resolve_ai_runtime_config(user=getattr(request, 'user', None), system_settings=settings_obj)
    governance_thresholds = _get_runtime_governance_delta_thresholds()
    prefetch_runtime_settings = _get_runtime_prefetch_settings()
    prefetch_time_policy = _get_runtime_prefetch_time_policy()

    rollout_warnings = [row['warning_code'] for row in (command_center_row, system_row) if row.get('warning_code')]

    return Response(
        {
            'object': 'operator_ai_runtime_snapshot',
            'generated_at': timezone.now().isoformat(),
            'provider_rows': [command_center_row, system_row],
            'effective_policy_bundle': {
                'advisory_capability': ADVISORY_CAPABILITY,
                'governance_delta_thresholds': governance_thresholds,
                'prefetch_runtime_settings': prefetch_runtime_settings,
                'prefetch_time_policy': prefetch_time_policy,
                'runtime_source_priority': ['command_center', 'system'],
                'effective_ready': bool(effective_runtime.get('ready')),
                'effective_provider': effective_runtime.get('provider'),
                'effective_model': effective_runtime.get('model'),
                'effective_source': effective_runtime.get('source'),
                'effective_message': effective_runtime.get('message'),
            },
            'rollout_state': {
                'ready': bool(effective_runtime.get('ready')),
                'source': effective_runtime.get('source'),
                'provider': effective_runtime.get('provider'),
                'model': effective_runtime.get('model'),
                'reason': effective_runtime.get('reason'),
                'message': effective_runtime.get('message'),
                'command_center_configured': command_center_cfg is not None,
                'system_configured': settings_obj is not None,
                'warnings': rollout_warnings,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_health_api(request):
    """
    GET /api/core/v1/operator/health/
    Admin-only operator health projection for platform overview.
    """

    return Response(_build_operator_health_snapshot(request), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_overview_api(request):
    """
    GET /api/core/v1/operator/overview/
    Admin-only operator overview combining runtime health and AI runtime snapshots.
    """

    return Response(_build_operator_overview_snapshot(request), status=status.HTTP_200_OK)


def _parse_operator_limit(request, *, default: int = 25) -> int:
    try:
        parsed = int(request.query_params.get('limit', default) or default)
    except (TypeError, ValueError):
        parsed = default
    return min(max(parsed, 1), 100)


def _operator_request_id(kind: str, identifier) -> str:
    return f'{kind}:{identifier}'


def _split_operator_request_id(request_id: str) -> tuple[str | None, str | None]:
    kind, _, source_id = str(request_id or '').partition(':')
    kind = kind.strip().lower()
    source_id = str(source_id or '').strip()
    if not kind or not source_id:
        return None, None
    return kind, source_id


def _text_contains(search_term: str, *parts) -> bool:
    if not search_term:
        return True
    return any(search_term in str(part or '').strip().lower() for part in parts if str(part or '').strip())


def _build_operator_signal_job_row(run: SignalServiceRun) -> dict:
    payload = SignalServiceRunSerializer(run).data
    status = str(payload.get('status') or '').strip().lower() or 'unknown'
    summary = ' - '.join(
        part for part in [payload.get('service_domain_display') or payload.get('service_domain'), payload.get('run_type_display') or payload.get('run_type')] if part
    ) or 'Lệnh signal'
    return {
        'object': 'operator_job',
        'id': _operator_request_id('signal_run', run.id),
        'request_id': _operator_request_id('signal_run', run.id),
        'kind': 'signal_run',
        'source_model': 'SignalServiceRun',
        'service_domain': payload.get('service_domain'),
        'service_domain_display': payload.get('service_domain_display'),
        'run_type': payload.get('run_type'),
        'run_type_display': payload.get('run_type_display'),
        'status': payload.get('status'),
        'status_category': status,
        'status_display': payload.get('status_display') or status.title(),
        'task_id': payload.get('task_id') or '',
        'progress_pct': float(payload.get('progress_pct') or 0.0),
        'processed_items': int(payload.get('processed_items') or 0),
        'stored_items': int(payload.get('stored_items') or 0),
        'failed_items': int(payload.get('failed_items') or 0),
        'created_by_username': payload.get('created_by_username') or '',
        'summary': summary,
        'log_excerpt': str(payload.get('log') or '')[:240],
        'created_at': payload.get('created_at'),
        'updated_at': payload.get('updated_at'),
        'started_at': payload.get('started_at'),
        'finished_at': payload.get('finished_at'),
        'created_at_dt': run.created_at or timezone.now(),
    }


def _build_operator_crawl_job_row(run: CrawlRun) -> dict:
    status = str(run.status or '').strip().lower() or 'unknown'
    status_category = 'completed' if status == 'success' else status
    trigger_label = 'Thủ công' if str(run.trigger_type or '').strip().lower() == 'manual' else 'Lịch chạy'
    summary = f'{run.job.service_code} - {trigger_label}' if run.job_id else 'Lệnh crawl'
    return {
        'object': 'operator_job',
        'id': _operator_request_id('crawl_run', run.id),
        'request_id': _operator_request_id('crawl_run', run.id),
        'kind': 'crawl_run',
        'source_model': 'CrawlRun',
        'service_code': run.job.service_code if run.job_id else '',
        'job_id': run.job_id,
        'job_description': run.job.description if run.job_id else '',
        'trigger_type': run.trigger_type,
        'trigger_type_display': trigger_label,
        'task_id': run.task_id or '',
        'status': run.status,
        'status_category': status_category,
        'status_display': {
            'queued': 'Đang chờ',
            'running': 'Đang chạy',
            'success': 'Hoàn thành',
            'failed': 'Thất bại',
        }.get(status, status.title()),
        'summary': summary,
        'log_excerpt': str(run.log or '')[:240],
        'created_at': run.created_at.isoformat() if run.created_at else None,
        'updated_at': run.updated_at.isoformat() if run.updated_at else None,
        'started_at': run.started_at.isoformat() if run.started_at else None,
        'finished_at': run.finished_at.isoformat() if run.finished_at else None,
        'created_at_dt': run.created_at or timezone.now(),
    }


def _build_operator_jobs_snapshot(request) -> dict:
    limit = _parse_operator_limit(request, default=25)
    kind_filters = {value for value in _parse_multi_query_param(request, 'kind') if value and value != 'all'}
    status_filters = {value.lower() for value in _parse_multi_query_param(request, 'status') if value and value.lower() != 'all'}
    service_domain_filters = {value.lower() for value in _parse_multi_query_param(request, 'service_domain') if value}
    service_code_filters = {value.lower() for value in _parse_multi_query_param(request, 'service_code') if value}
    search_term = str(request.query_params.get('search') or '').strip().lower()

    rows = []
    if not kind_filters or 'signal_run' in kind_filters:
        signal_runs = SignalServiceRun.objects.select_related('created_by').order_by('-created_at', '-id')
        if service_domain_filters:
            signal_runs = signal_runs.filter(service_domain__in=service_domain_filters)
        for run in signal_runs:
            row = _build_operator_signal_job_row(run)
            if status_filters and row['status_category'] not in status_filters and str(row['status'] or '').strip().lower() not in status_filters:
                continue
            if search_term and not _text_contains(
                search_term,
                row['request_id'],
                row['summary'],
                row['created_by_username'],
                row['service_domain'],
                row['run_type'],
                row['task_id'],
                row['log_excerpt'],
            ):
                continue
            rows.append(row)

    if not kind_filters or 'crawl_run' in kind_filters:
        crawl_runs = CrawlRun.objects.select_related('job').order_by('-created_at', '-id')
        if service_code_filters:
            crawl_runs = crawl_runs.filter(job__service_code__in=service_code_filters)
        for run in crawl_runs:
            row = _build_operator_crawl_job_row(run)
            if status_filters and row['status_category'] not in status_filters and str(row['status'] or '').strip().lower() not in status_filters:
                continue
            if search_term and not _text_contains(
                search_term,
                row['request_id'],
                row['summary'],
                row['job_description'],
                row['service_code'],
                row['task_id'],
                row['log_excerpt'],
            ):
                continue
            rows.append(row)

    rows.sort(key=lambda row: (row['created_at_dt'], row['id']), reverse=True)
    total_count = len(rows)
    page_rows, has_more, starting_after, ending_before = _paginate_operator_rows(request, rows)

    signal_count = sum(1 for row in rows if row['kind'] == 'signal_run')
    crawl_count = sum(1 for row in rows if row['kind'] == 'crawl_run')
    running_count = sum(1 for row in rows if row['status_category'] == 'running')
    queued_count = sum(1 for row in rows if row['status_category'] == 'queued')
    failed_count = sum(1 for row in rows if row['status_category'] == 'failed')

    return {
        'object': 'list',
        'url': request.path,
        'summary_cards': [
            {'key': 'job_total', 'label': 'Tổng job', 'value': total_count, 'detail': 'Các lượt chạy operator đang hiển thị'},
            {'key': 'job_signal', 'label': 'Lệnh signal', 'value': signal_count, 'detail': 'Các dòng SignalServiceRun'},
            {'key': 'job_crawl', 'label': 'Lệnh crawl', 'value': crawl_count, 'detail': 'Các dòng CrawlRun'},
            {'key': 'job_running', 'label': 'Đang chạy', 'value': running_count, 'detail': 'Các lượt chạy đang hoạt động'},
            {'key': 'job_queued', 'label': 'Đang chờ', 'value': queued_count, 'detail': 'Các lượt chạy đang chờ'},
            {'key': 'job_failed', 'label': 'Thất bại', 'value': failed_count, 'detail': 'Các lượt chạy thất bại'},
        ],
        'data': [
            {key: value for key, value in row.items() if key != 'created_at_dt'}
            for row in page_rows
        ],
        'has_more': has_more,
        'next_cursor': page_rows[-1]['id'] if has_more and page_rows else None,
        'prev_cursor': page_rows[0]['id'] if page_rows and (starting_after or ending_before) else None,
        'generated_at': timezone.now().isoformat(),
    }


def _build_operator_system_ai_settings_audit_row(log: SystemAISettingsAuditLog) -> dict:
    actor = log.actor.username if log.actor_id else 'Hệ thống'
    return {
        'object': 'operator_audit_request',
        'id': _operator_request_id('system_ai_settings', log.id),
        'request_id': _operator_request_id('system_ai_settings', log.id),
        'kind': 'system_ai_settings',
        'source_model': 'SystemAISettingsAuditLog',
        'action': log.action,
        'actor': actor,
        'reason': log.reason,
        'settings_id': log.settings_id,
        'summary': f'{log.action} - {log.reason or actor}',
        'before_json': log.before_json,
        'after_json': log.after_json,
        'created_at': log.created_at.isoformat() if log.created_at else None,
        'created_at_dt': log.created_at or timezone.now(),
    }


def _build_operator_whale_config_audit_row(log: WhaleConfigAuditLog) -> dict:
    actor = log.actor.username if log.actor_id else 'Hệ thống'
    return {
        'object': 'operator_audit_request',
        'id': _operator_request_id('whale_config', log.id),
        'request_id': _operator_request_id('whale_config', log.id),
        'kind': 'whale_config',
        'source_model': 'WhaleConfigAuditLog',
        'action': log.action,
        'actor': actor,
        'reason': log.reason,
        'draft_id': log.draft_id,
        'version_id': log.version_id,
        'rollout_id': log.rollout_id,
        'ticket_ref': log.ticket_ref,
        'summary': f'{log.action} - {log.reason or log.ticket_ref or actor}',
        'before_json': log.before_json,
        'after_json': log.after_json,
        'created_at': log.created_at.isoformat() if log.created_at else None,
        'created_at_dt': log.created_at or timezone.now(),
    }


def _build_operator_advisory_audit_row(log: AdvisoryAggregateAuditLog) -> dict:
    return {
        'object': 'operator_audit_request',
        'id': _operator_request_id('advisory', log.id),
        'request_id': _operator_request_id('advisory', log.id),
        'kind': 'advisory',
        'source_model': 'AdvisoryAggregateAuditLog',
        'action': log.reason,
        'actor': log.actor,
        'actor_id': log.actor_id,
        'user_id': log.user_id,
        'symbol': log.symbol,
        'reason': log.reason,
        'summary': f'{log.reason} - {log.symbol}',
        'before_state_json': log.before_state_json,
        'after_state_json': log.after_state_json,
        'metadata_json': log.metadata_json,
        'created_at': log.created_at.isoformat() if log.created_at else None,
        'created_at_dt': log.created_at or timezone.now(),
    }


def _build_operator_crawl_audit_row(log: CrawlAuditLog) -> dict:
    service_code = log.run.job.service_code if log.run_id and log.run and log.run.job_id else ''
    return {
        'object': 'operator_audit_request',
        'id': _operator_request_id('crawl_audit', log.id),
        'request_id': _operator_request_id('crawl_audit', log.id),
        'kind': 'crawl_audit',
        'source_model': 'CrawlAuditLog',
        'event': log.event,
        'run_id': log.run_id,
        'job_id': log.run.job_id if log.run_id and log.run else None,
        'service_code': service_code,
        'summary': f'{log.event} - {service_code or "crawl"}',
        'payload': log.payload,
        'timestamp': log.timestamp.isoformat() if log.timestamp else None,
        'created_at': log.timestamp.isoformat() if log.timestamp else None,
        'created_at_dt': log.timestamp or timezone.now(),
    }


def _build_operator_audit_rows(request) -> list[dict]:
    kind_filters = {value for value in _parse_multi_query_param(request, 'kind') if value and value != 'all'}
    action_filters = {value.lower() for value in _parse_multi_query_param(request, 'action') if value and value.lower() != 'all'}
    actor_filters = {value.lower() for value in _parse_multi_query_param(request, 'actor') if value}
    reason_filters = {value.lower() for value in _parse_multi_query_param(request, 'reason') if value}
    symbol_filters = {value.lower() for value in _parse_multi_query_param(request, 'symbol') if value}
    service_code_filters = {value.lower() for value in _parse_multi_query_param(request, 'service_code') if value}
    search_term = str(request.query_params.get('search') or '').strip().lower()

    rows = []
    if not kind_filters or 'system_ai_settings' in kind_filters:
        for log in SystemAISettingsAuditLog.objects.select_related('actor', 'settings').order_by('-created_at', '-id'):
            row = _build_operator_system_ai_settings_audit_row(log)
            if action_filters and row['action'] not in action_filters:
                continue
            if actor_filters and str(row['actor'] or '').strip().lower() not in actor_filters:
                continue
            if reason_filters and str(row['reason'] or '').strip().lower() not in reason_filters:
                continue
            if search_term and not _text_contains(search_term, row['request_id'], row['action'], row['actor'], row['reason']):
                continue
            rows.append(row)

    if not kind_filters or 'whale_config' in kind_filters:
        for log in WhaleConfigAuditLog.objects.select_related('actor', 'draft', 'version', 'rollout').order_by('-created_at', '-id'):
            row = _build_operator_whale_config_audit_row(log)
            if action_filters and row['action'] not in action_filters:
                continue
            if actor_filters and str(row['actor'] or '').strip().lower() not in actor_filters:
                continue
            if reason_filters and str(row['reason'] or '').strip().lower() not in reason_filters:
                continue
            if search_term and not _text_contains(search_term, row['request_id'], row['action'], row['actor'], row['reason'], row['ticket_ref']):
                continue
            rows.append(row)

    if not kind_filters or 'advisory' in kind_filters:
        for log in AdvisoryAggregateAuditLog.objects.select_related('user').order_by('-created_at', '-id'):
            row = _build_operator_advisory_audit_row(log)
            if action_filters and row['action'] not in action_filters:
                continue
            if actor_filters and str(row['actor'] or '').strip().lower() not in actor_filters:
                continue
            if reason_filters and str(row['reason'] or '').strip().lower() not in reason_filters:
                continue
            if symbol_filters and str(row['symbol'] or '').strip().lower() not in symbol_filters:
                continue
            if search_term and not _text_contains(search_term, row['request_id'], row['action'], row['actor'], row['reason'], row['symbol'], row['actor_id']):
                continue
            rows.append(row)

    if not kind_filters or 'crawl_audit' in kind_filters:
        for log in CrawlAuditLog.objects.select_related('run', 'run__job').order_by('-timestamp', '-id'):
            row = _build_operator_crawl_audit_row(log)
            if action_filters and row['event'].strip().lower() not in action_filters:
                continue
            if service_code_filters and str(row['service_code'] or '').strip().lower() not in service_code_filters:
                continue
            if search_term and not _text_contains(search_term, row['request_id'], row['event'], row['service_code'], row['summary']):
                continue
            rows.append(row)

    rows.sort(key=lambda row: (row['created_at_dt'], row['id']), reverse=True)
    return rows


def _resolve_operator_audit_request_record(request_id: str):
    kind, source_id = _split_operator_request_id(request_id)
    if kind is None or source_id is None:
        return None, None

    if kind == 'system_ai_settings':
        log = SystemAISettingsAuditLog.objects.select_related('actor', 'settings').filter(id=source_id).first()
        if log is None:
            return None, None
        row = _build_operator_system_ai_settings_audit_row(log)
        return row, {
            'settings': {
                'id': log.settings_id,
                'name': log.settings.name if log.settings_id and log.settings else None,
                'provider': log.settings.ai_provider if log.settings_id and log.settings else None,
                'model': log.settings.get_effective_ai_model() if log.settings_id and log.settings else None,
            },
            'before_json': log.before_json,
            'after_json': log.after_json,
        }

    if kind == 'whale_config':
        log = WhaleConfigAuditLog.objects.select_related('actor', 'draft', 'version', 'rollout').filter(id=source_id).first()
        if log is None:
            return None, None
        row = _build_operator_whale_config_audit_row(log)
        return row, {
            'draft_id': log.draft_id,
            'version_id': log.version_id,
            'rollout_id': log.rollout_id,
            'ticket_ref': log.ticket_ref,
            'before_json': log.before_json,
            'after_json': log.after_json,
        }

    if kind == 'advisory':
        log = AdvisoryAggregateAuditLog.objects.select_related('user').filter(id=source_id).first()
        if log is None:
            return None, None
        row = _build_operator_advisory_audit_row(log)
        return row, {
            'before_state_json': log.before_state_json,
            'after_state_json': log.after_state_json,
            'metadata_json': log.metadata_json,
        }

    if kind == 'crawl_audit':
        log = CrawlAuditLog.objects.select_related('run', 'run__job').filter(id=source_id).first()
        if log is None:
            return None, None
        row = _build_operator_crawl_audit_row(log)
        return row, {
            'payload': log.payload,
            'run': {
                'id': log.run_id,
                'job_id': log.run.job_id if log.run_id and log.run else None,
                'service_code': log.run.job.service_code if log.run_id and log.run and log.run.job_id else None,
                'status': log.run.status if log.run_id and log.run else None,
            },
        }

    return None, None


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_jobs_api(request):
    """
    GET /api/core/v1/operator/jobs/
    Admin-only operator jobs table over current runtime signal and crawl runs.
    """

    return Response(_build_operator_jobs_snapshot(request), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_audit_requests_api(request):
    """
    GET /api/core/v1/operator/audit/requests/
    Admin-only operator audit trace table over current runtime audit logs.
    """

    limit = _parse_operator_limit(request, default=25)
    rows = _build_operator_audit_rows(request)
    total_count = len(rows)
    page_rows, has_more, starting_after, ending_before = _paginate_operator_rows(request, rows)

    kind_counts = {
        'system_ai_settings': sum(1 for row in rows if row['kind'] == 'system_ai_settings'),
        'whale_config': sum(1 for row in rows if row['kind'] == 'whale_config'),
        'advisory': sum(1 for row in rows if row['kind'] == 'advisory'),
        'crawl_audit': sum(1 for row in rows if row['kind'] == 'crawl_audit'),
    }

    return Response(
        {
            'object': 'list',
            'url': request.path,
            'summary_cards': [
                {'key': 'audit_total', 'label': 'Tổng audit', 'value': total_count, 'detail': 'Các audit trace operator đang hiển thị'},
                {'key': 'audit_system_ai_settings', 'label': 'AI cài đặt', 'value': kind_counts['system_ai_settings'], 'detail': 'Audit log cài đặt System AI'},
                {'key': 'audit_whale_config', 'label': 'Cấu hình whale', 'value': kind_counts['whale_config'], 'detail': 'Audit log cấu hình Whale'},
                {'key': 'audit_advisory', 'label': 'Advisory', 'value': kind_counts['advisory'], 'detail': 'Audit log Advisory aggregate'},
                {'key': 'audit_crawl', 'label': 'Crawl', 'value': kind_counts['crawl_audit'], 'detail': 'Audit log Crawl'},
            ],
            'data': [
                {key: value for key, value in row.items() if key != 'created_at_dt'}
                for row in page_rows
            ],
            'has_more': has_more,
            'next_cursor': page_rows[-1]['id'] if has_more and page_rows else None,
            'prev_cursor': page_rows[0]['id'] if page_rows and (starting_after or ending_before) else None,
            'generated_at': timezone.now().isoformat(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def operator_audit_request_detail_api(request, request_id: str):
    """
    GET /api/core/v1/operator/audit/requests/{request_id}/
    Admin-only operator audit trace detail.
    """

    row, source_record = _resolve_operator_audit_request_record(request_id)
    if row is None:
        return Response({'detail': 'Không tìm thấy operator audit trace.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(
        {
            'object': 'operator_audit_request_detail',
            'request_id': request_id,
            'request': {key: value for key, value in row.items() if key != 'created_at_dt'},
            'source_record': source_record,
            'generated_at': timezone.now().isoformat(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_system_ai_audit_logs_api(request):
    """
    GET /api/admin-ops/system-ai-settings/audit-logs/
    Admin-only: xem lịch sử thay đổi/test của System AI Settings.
    """
    from .models import SystemAISettingsAuditLog
    from django.utils.dateparse import parse_datetime

    limit = max(1, min(int(request.query_params.get('limit', 50)), 200))
    offset = max(0, int(request.query_params.get('offset', 0)))
    action = str(request.query_params.get('action') or '').strip().lower()
    actor_username = str(request.query_params.get('actor') or '').strip()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()
    order = str(request.query_params.get('order') or 'desc').strip().lower()
    if order not in {'asc', 'desc'}:
        return Response({'ok': False, 'message': 'order chỉ hỗ trợ asc hoặc desc.'}, status=status.HTTP_400_BAD_REQUEST)

    ordering = 'created_at' if order == 'asc' else '-created_at'
    logs_qs = SystemAISettingsAuditLog.objects.select_related('actor', 'settings').order_by(ordering)
    if action:
        logs_qs = logs_qs.filter(action=action)
    if actor_username:
        logs_qs = logs_qs.filter(actor__username__iexact=actor_username)

    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at không đúng định dạng ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
        logs_qs = logs_qs.filter(created_at__gte=start_at)

    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at không đúng định dạng ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
        logs_qs = logs_qs.filter(created_at__lte=end_at)

    total = logs_qs.count()
    logs = list(logs_qs[offset: offset + limit])

    payload = []
    for log in logs:
        payload.append(
            {
                'id': log.id,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'action': log.action,
                'reason': log.reason,
                'actor': log.actor.username if log.actor_id else None,
                'settings_id': log.settings_id,
                'before_json': log.before_json,
                'after_json': log.after_json,
            }
        )

    return Response(
        {
            'ok': True,
            'count': len(payload),
            'total': total,
            'offset': offset,
            'limit': limit,
            'order': order,
            'has_more': (offset + len(payload)) < total,
            'results': payload,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnbroker_runtime_config_current_api(request):
    """GET /api/admin-ops/vnbroker-config/current/"""
    from .models import RuntimeVnbrokerConfig
    from .serializers import RuntimeVnbrokerConfigSerializer
    from .vnbroker_runtime_config import coerce_vnbroker_runtime_settings, default_vnbroker_runtime_settings

    config = RuntimeVnbrokerConfig.get_or_create_singleton()
    defaults = default_vnbroker_runtime_settings()
    normalized = coerce_vnbroker_runtime_settings(config.to_runtime_dict(), fallback=defaults)
    for key, value in normalized.items():
        setattr(config, key, value)

    serializer = RuntimeVnbrokerConfigSerializer(config)
    return Response(
        {
            'ok': True,
            'settings': serializer.data,
            'rulebook': {
                'max_concurrency': {'min': 1, 'max': 50},
                'retry_attempts': {'min': 0, 'max': 5},
                'retry_backoff_seconds': {'min': 0.0, 'max': 5.0},
                'rate_limit_cooldown_seconds': {'min': 5, 'max': 120},
                'timeout_seconds': {'min': 1, 'max': 120},
                'allowed_sources': ['VCI', 'KBS', 'TCBS', 'SSI'],
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_vnbroker_runtime_config_update_api(request):
    """PATCH /api/admin-ops/vnbroker-config/update-config/"""
    from .models import RuntimeVnbrokerConfig
    from .serializers import RuntimeVnbrokerConfigSerializer
    from .vnbroker_runtime_config import invalidate_vnbroker_runtime_cache

    if not _has_surface_write_permission(request, 'change_runtimevnbrokerconfig'):
        return _forbidden_surface_response('Runtime Vnbroker Config')

    config = RuntimeVnbrokerConfig.get_or_create_singleton()
    before = config.to_runtime_dict()

    serializer = RuntimeVnbrokerConfigSerializer(config, data=request.data or {}, partial=True)
    if not serializer.is_valid():
        return Response(
            {
                'ok': False,
                'message': 'Dữ liệu cấu hình không hợp lệ.',
                'field_errors': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    updated_config = serializer.save(updated_by=request.user)
    after = updated_config.to_runtime_dict()

    changes = {}
    for key, old_value in before.items():
        new_value = after.get(key)
        if old_value != new_value:
            changes[key] = {'before': old_value, 'after': new_value}

    if changes:
        updated_config.append_changelog(actor=request.user, changes=changes, reason='update_config')
        updated_config.save(update_fields=['changelog', 'updated_at'])

    invalidate_vnbroker_runtime_cache()
    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật Runtime Vnbroker Config.',
            'settings': RuntimeVnbrokerConfigSerializer(updated_config).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_vnbroker_runtime_config_reset_api(request):
    """POST /api/admin-ops/vnbroker-config/reset-to-defaults/"""
    from .models import RuntimeVnbrokerConfig
    from .serializers import RuntimeVnbrokerConfigSerializer
    from .vnbroker_runtime_config import default_vnbroker_runtime_settings, invalidate_vnbroker_runtime_cache

    if not _has_surface_write_permission(request, 'change_runtimevnbrokerconfig'):
        return _forbidden_surface_response('Runtime Vnbroker Config')

    defaults = default_vnbroker_runtime_settings()
    config = RuntimeVnbrokerConfig.get_or_create_singleton()

    for key, value in defaults.items():
        setattr(config, key, value)
    config.updated_by = request.user
    config.full_clean()
    config.save()

    config.append_changelog(actor=request.user, changes={'reset': True}, reason='reset_to_defaults')
    config.save(update_fields=['changelog', 'updated_at'])
    invalidate_vnbroker_runtime_cache()

    return Response(
        {
            'ok': True,
            'message': 'Đã reset Runtime Vnbroker Config về mặc định.',
            'settings': RuntimeVnbrokerConfigSerializer(config).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnbroker_runtime_config_changelog_api(request):
    """GET /api/admin-ops/vnbroker-config/changelog/"""
    from .models import RuntimeVnbrokerConfig

    limit = max(1, min(int(request.query_params.get('limit', 30)), 200))
    offset = max(0, int(request.query_params.get('offset', 0)))

    config = RuntimeVnbrokerConfig.get_or_create_singleton()
    items = list(config.changelog or [])
    total = len(items)
    rows = items[offset: offset + limit]

    return Response(
        {
            'ok': True,
            'count': len(rows),
            'total': total,
            'offset': offset,
            'limit': limit,
            'has_more': offset + len(rows) < total,
            'results': rows,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def warm_ticker_prefetch_api(request):
    """
    POST /api/admin-ops/prefetch/warm/
    Trigger warm cache ticker thủ công từ giao diện admin/dashboard.

    Query/body:
      - mode=async (mặc định): queue Celery task ngay lập tức.
      - mode=sync: chạy ngay trong request để debug/verify.
    """
    from config.health import build_prefetch_health_snapshot
    from portfolio.tasks import (
        build_realtime_symbol_universe_snapshot,
        schedule_realtime_prefetch_shards,
    )

    mode = str(request.query_params.get('mode') or request.data.get('mode') or 'async').strip().lower()

    if mode == 'sync':
        universe_result = build_realtime_symbol_universe_snapshot.run()
        schedule_result = schedule_realtime_prefetch_shards.run()
        result = {
            'status': 'ok',
            'flow': 'canonical_realtime_prefetch',
            'universe': universe_result,
            'scheduler': schedule_result,
        }
        snapshot = build_prefetch_health_snapshot()
        ok = bool(
            result.get('status') == 'ok'
            and isinstance(schedule_result, dict)
            and schedule_result.get('status') in {'ok', 'skipped_lock'}
        )
        return Response(
            {
                'queued': False,
                'mode': 'sync',
                'ok': ok,
                'result': result,
                'prefetch': snapshot,
            },
            status=status.HTTP_200_OK,
        )

    task = schedule_realtime_prefetch_shards.apply_async(countdown=0, queue='manual_on_demand')
    return Response(
        {
            'queued': True,
            'mode': 'async',
            'task_id': task.id,
            'flow': 'canonical_realtime_prefetch',
            'prefetch': build_prefetch_health_snapshot(),
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def offpeak_vnbroker_ingest_api(request):
    """
    POST /api/admin-ops/prefetch/offpeak-ingest/
    Trigger ingest du lieu off-peak vao DB + refresh ticker cache Redis.

    Query/body:
      - mode=async (mac dinh) | sync
      - days (optional, int >= 1)
      - max_symbols (optional, int >= 1)
    """
    from config.health import build_prefetch_health_snapshot
    from portfolio.tasks import offpeak_vnbroker_ingest

    mode = str(request.query_params.get('mode') or request.data.get('mode') or 'async').strip().lower()
    try:
        days = _parse_optional_positive_int(request.query_params.get('days', request.data.get('days')), 'days')
        max_symbols = _parse_optional_positive_int(
            request.query_params.get('max_symbols', request.data.get('max_symbols')),
            'max_symbols',
        )
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    task_kwargs = {
        'days': days,
        'max_symbols': max_symbols,
        'trigger': 'admin_manual',
    }
    task_kwargs = {key: value for key, value in task_kwargs.items() if value is not None}

    if mode == 'sync':
        result = offpeak_vnbroker_ingest.run(**task_kwargs)
        ok = str(result.get('status') or '').lower() in {'ok', 'partial'}
        return Response(
            {
                'queued': False,
                'mode': 'sync',
                'ok': ok,
                'result': result,
                'prefetch': build_prefetch_health_snapshot(),
            },
            status=status.HTTP_200_OK,
        )

    task = offpeak_vnbroker_ingest.apply_async(kwargs=task_kwargs, queue='manual_on_demand')
    return Response(
        {
            'queued': True,
            'mode': 'async',
            'task_id': task.id,
            'kwargs': task_kwargs,
            'prefetch': build_prefetch_health_snapshot(),
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def offpeak_vnbroker_ingest_history_api(request):
    """
    GET /api/admin-ops/prefetch/offpeak-ingest/history/
    Tra ve latest run va history gan day cua offpeak ingest task.
    """
    limit_raw = request.query_params.get('limit', 20)
    try:
        limit = max(int(limit_raw), 1)
    except (TypeError, ValueError):
        return Response({'detail': 'limit phai la so nguyen duong.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = _read_offpeak_ingest_history(limit=limit)
    return Response(
        {
            'ok': True,
            'latest': payload.get('latest'),
            'history': payload.get('history', []),
            'total_entries': int(payload.get('total_entries', 0) or 0),
            'limit': int(payload.get('limit', limit) or limit),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_intraday_side_backfill_preview_api(request):
    """
    POST /api/admin-ops/intraday-side-backfill/preview/
    Admin-only: dry-run xem scope/changed/transitions trước khi apply.

    Body (JSON, tất cả optional):
      symbols       - danh sách mã (list[str]), mặc định tất cả
      start_date    - YYYY-MM-DD
      end_date      - YYYY-MM-DD
      threshold     - giá trị min matched_value (VND), 0 = tất cả
      batch_size    - chunk size iterator (mặc định 2000)
    """
    from portfolio.services_backfill import intraday_side_backfill_preview

    symbols_raw = request.data.get('symbols') or []
    if isinstance(symbols_raw, str):
        symbols_raw = [s.strip() for s in symbols_raw.split(',') if s.strip()]
    symbols = [str(s).strip().upper() for s in symbols_raw if str(s).strip()]

    start_date = str(request.data.get('start_date') or '').strip() or None
    end_date = str(request.data.get('end_date') or '').strip() or None

    try:
        threshold = int(request.data.get('threshold') or 0)
    except (TypeError, ValueError):
        return Response({'detail': 'threshold phai la so nguyen.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        batch_size = max(100, int(request.data.get('batch_size') or 2000))
    except (TypeError, ValueError):
        batch_size = 2000

    try:
        max_preview_rows = max(1000, int(request.data.get('max_preview_rows') or 100_000))
    except (TypeError, ValueError):
        max_preview_rows = 100_000

    try:
        result = intraday_side_backfill_preview(
            symbols=symbols,
            start_date=start_date,
            end_date=end_date,
            threshold=threshold,
            batch_size=batch_size,
            max_preview_rows=max_preview_rows,
        )
    except Exception as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'ok': True, **result}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_intraday_side_backfill_apply_api(request):
    """
    POST /api/admin-ops/intraday-side-backfill/apply/
    Admin-only: apply backfill IntradayTick.side vào DB.

    Body (JSON):
      confirm       - phải là true (safety gate)
      symbols       - danh sách mã (list[str])
      start_date    - YYYY-MM-DD
      end_date      - YYYY-MM-DD
      threshold     - giá trị min matched_value (VND), 0 = tất cả
      batch_size    - chunk size (mặc định 2000)
    """
    from django.utils import timezone
    from portfolio.tasks_maintenance import (
        run_intraday_side_backfill_apply,
        set_intraday_side_backfill_task_status,
    )

    if not _has_surface_write_permission(request, 'change_intradaytick'):
        return _forbidden_surface_response('Data Ops')

    confirm = request.data.get('confirm')
    if str(confirm).strip().lower() not in {'true', '1', 'yes'}:
        return Response(
            {'detail': 'Phai truyen confirm=true de thuc hien apply.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    symbols_raw = request.data.get('symbols') or []
    if isinstance(symbols_raw, str):
        symbols_raw = [s.strip() for s in symbols_raw.split(',') if s.strip()]
    symbols = [str(s).strip().upper() for s in symbols_raw if str(s).strip()]

    start_date = str(request.data.get('start_date') or '').strip() or None
    end_date = str(request.data.get('end_date') or '').strip() or None

    try:
        threshold = int(request.data.get('threshold') or 0)
    except (TypeError, ValueError):
        return Response({'detail': 'threshold phai la so nguyen.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        batch_size = max(100, int(request.data.get('batch_size') or 2000))
    except (TypeError, ValueError):
        batch_size = 2000

    if not _is_celery_worker_available():
        return Response(
            {
                'ok': False,
                'status': 'worker_unavailable',
                'message': 'Celery worker đang offline. Không thể chạy backfill nền lúc này.',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    task = run_intraday_side_backfill_apply.apply_async(
        kwargs={
            'symbols': symbols,
            'start_date': start_date,
            'end_date': end_date,
            'threshold': threshold,
            'batch_size': batch_size,
        },
        queue='manual_on_demand',
    )
    task_id = str(task.id)
    set_intraday_side_backfill_task_status(
        task_id,
        {
            'id': task_id,
            'status': 'queued',
            'queued_at': timezone.now().isoformat(),
            'started_at': None,
            'finished_at': None,
            'message': 'Backfill intraday side đã được đưa vào hàng chờ nền.',
            'result': None,
            'error': None,
            'params': {
                'symbols': symbols,
                'start_date': start_date,
                'end_date': end_date,
                'threshold': threshold,
                'batch_size': batch_size,
            },
        },
    )
    return Response(
        {
            'ok': True,
            'status': 'queued',
            'task_id': task_id,
            'message': 'Backfill intraday side đang chạy nền. Vui lòng theo dõi trạng thái tác vụ.',
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_intraday_side_backfill_status_api(request, task_id: str):
    from portfolio.tasks_maintenance import get_intraday_side_backfill_task_status

    payload = get_intraday_side_backfill_task_status(task_id)
    if not payload:
        return Response(
            {
                'ok': False,
                'status': 'not_found',
                'message': 'Không tìm thấy trạng thái backfill cho task_id đã cung cấp.',
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({'ok': True, 'task': payload}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_intraday_universe_warm_now_api(request):
    """
    POST /api/admin-ops/intraday-universe/warm-now/
    Admin-only: trigger warmup ngay lập tức cho tất cả symbol thuộc
    các group được chọn trong intraday_universe_group_ids (runtime settings).
    """
    from django.utils import timezone
    from portfolio.runtime_policy_helpers import _get_runtime_prefetch_settings
    from portfolio.models import SecuritiesItem
    from portfolio.tasks_symbol_engagement import warmup_symbol_intraday

    runtime = _get_runtime_prefetch_settings()
    raw_group_ids = runtime.get('intraday_universe_group_ids', [])
    group_ids = []
    for raw in raw_group_ids:
        try:
            gid = int(raw)
            if gid >= 1 and gid not in group_ids:
                group_ids.append(gid)
        except (TypeError, ValueError):
            continue

    if not group_ids:
        return Response(
            {
                'ok': False,
                'detail': 'Chưa cấu hình intraday_universe_group_ids. '
                          'Vui lòng chọn ít nhất 1 nhóm trong Admin Ops → Prefetch Settings.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    symbols = list(
        SecuritiesItem.objects.filter(group_id__in=group_ids)
        .values_list('symbol', flat=True)
        .distinct()
        .order_by('symbol')
    )

    if not symbols:
        return Response(
            {'ok': False, 'detail': 'Không tìm thấy mã nào trong các nhóm đã chọn.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    dispatched = []
    for symbol in symbols:
        warmup_symbol_intraday.apply_async(
            args=[symbol.upper()],
            kwargs={'reason': 'admin_warm_now'},
            queue='manual_on_demand',
        )
        dispatched.append(symbol.upper())

    return Response(
        {
            'ok': True,
            'dispatched_count': len(dispatched),
            'symbols': dispatched,
            'triggered_at': timezone.now().isoformat(),
        },
        status=status.HTTP_200_OK,
    )
