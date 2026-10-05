"""Operator tenant admin views — serves AdminCore* pages."""
from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant
from ops_audit.models import AuditEvent
from vninvest_core.pagination import StandardPageNumberPagination
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response



def _envelope(data, summary_cards=None, object_label='operator_response'):
    return {
        'object': object_label,
        'generated_at': timezone.now().isoformat(),
        'summary_cards': summary_cards or [],
        'data': data,
    }


def _compute_usage_risk(tenant):
    if tenant.status == CoreTenant.StatusChoices.SUSPENDED:
        return 'critical'
    return 'normal'


def _compute_invoice_state(tenant):
    if tenant.status == CoreTenant.StatusChoices.SUSPENDED:
        return 'overdue'
    if tenant.billing_period_end and tenant.billing_period_end < timezone.now().date():
        return 'due'
    return 'current'


def _compute_rotation_risk(sa):
    if not sa.last_rotated_at:
        return 'critical'
    days_since_rotation = (timezone.now() - sa.last_rotated_at).days
    if days_since_rotation > 180:
        return 'critical'
    if days_since_rotation > 90:
        return 'warning'
    return 'normal'


def _compute_anomaly_state(pat):
    if pat.status == CorePATCredential.StatusChoices.REVOKED:
        return 'critical'
    if pat.status == CorePATCredential.StatusChoices.ROTATING:
        return 'warning'
    if pat.effective_status == CorePATCredential.StatusChoices.EXPIRED:
        return 'warning'
    return 'normal'


def _serialize_tenant(tenant):
    return {
        'id': tenant.public_id,
        'display_name': tenant.display_name,
        'tenant_code': tenant.tenant_code,
        'plan_code': tenant.plan,
        'status': tenant.status,
        'current_usage_risk': _compute_usage_risk(tenant),
        'invoice_state': _compute_invoice_state(tenant),
        'suspension_state': tenant.suspended_at.isoformat() if tenant.suspended_at else None,
        'updated_at': tenant.updated_at.isoformat() if tenant.updated_at else None,
    }


def _serialize_service_account(sa):
    metadata = dict(sa.metadata or {})
    policy_ids = metadata.get('policy_ids') or []
    pat_qs = sa.pat_credentials.all()
    total_pats = pat_qs.count()
    active_pats = pat_qs.filter(status=CorePATCredential.StatusChoices.ACTIVE).count()

    last_used = pat_qs.filter(last_used_at__isnull=False).order_by('-last_used_at').first()

    recent_audit = AuditEvent.objects.filter(
        resource_type='service_account',
        resource_id=sa.public_id,
    ).order_by('-occurred_at').first()

    return {
        'id': sa.public_id,
        'name': sa.name,
        'status': sa.status,
        'environment': metadata.get('environment', 'prod'),
        'policy_ids': policy_ids,
        'pat_count': total_pats,
        'active_pat_count': active_pats,
        'rotation_risk': _compute_rotation_risk(sa),
        'latest_pat_last_used_at': last_used.last_used_at.isoformat() if last_used else None,
        'last_operator_action_at': recent_audit.occurred_at.isoformat() if recent_audit else None,
        'created_at': sa.created_at.isoformat() if sa.created_at else None,
        'updated_at': sa.updated_at.isoformat() if sa.updated_at else None,
    }


def _serialize_pat(pat):
    return {
        'id': pat.public_id,
        'token_prefix': pat.token_prefix,
        'service_account_id': pat.service_account.public_id,
        'status': pat.effective_status,
        'expires_at': pat.expires_at.isoformat() if pat.expires_at else None,
        'anomaly_state': _compute_anomaly_state(pat),
        'last_used_at': pat.last_used_at.isoformat() if pat.last_used_at else None,
        'scope_codes': list(pat.scopes or []),
        'grace_period_active': pat.grace_until is not None and pat.grace_until > timezone.now(),
        'issuer_actor_type': 'system',
        'issuer_actor_id': None,
        'last_ip': None,
        'last_used_ip_country': None,
        'last_audit_request_id': None,
        'revoked_at': pat.revoked_at.isoformat() if pat.revoked_at else None,
        'created_at': pat.created_at.isoformat() if pat.created_at else None,
        'updated_at': pat.updated_at.isoformat() if pat.updated_at else None,
    }


def _build_summary_cards(tenant=None):
    total = CoreTenant.objects.count()
    active = CoreTenant.objects.filter(status=CoreTenant.StatusChoices.ACTIVE).count()
    suspended = CoreTenant.objects.filter(status=CoreTenant.StatusChoices.SUSPENDED).count()
    trial = CoreTenant.objects.filter(status=CoreTenant.StatusChoices.TRIAL).count()
    return [
        {'key': 'total_tenants', 'label': 'Tổng tenant', 'value': str(total), 'detail': 'Toàn bộ tenant', 'status': 'normal'},
        {'key': 'active_tenants', 'label': 'Đang hoạt động', 'value': str(active), 'detail': 'Tenant active', 'status': 'active'},
        {'key': 'suspended_tenants', 'label': 'Đã tạm ngưng', 'value': str(suspended), 'detail': 'Tenant suspended', 'status': 'suspended'},
        {'key': 'trial_tenants', 'label': 'Dùng thử', 'value': str(trial), 'detail': 'Tenant trial', 'status': 'warning'},
    ]


def _build_security_summary(tenant):
    sas = tenant.service_accounts.all()
    total_sa = sas.count()
    all_pats = CorePATCredential.objects.filter(service_account__in=sas)
    active_pats = all_pats.filter(status=CorePATCredential.StatusChoices.ACTIVE).count()
    rotating = all_pats.filter(status=CorePATCredential.StatusChoices.ROTATING).count()
    latest_pat = all_pats.filter(last_used_at__isnull=False).order_by('-last_used_at').first()
    return {
        'service_account_count': total_sa,
        'active_pat_count': active_pats,
        'rotations_due_count': rotating,
        'anomaly_state': 'normal' if rotating == 0 else 'warning',
        'latest_pat_last_used_at': latest_pat.last_used_at.isoformat() if latest_pat else None,
    }


def _build_commercial_summary(tenant):
    return {
        'billing_cycle': 'monthly',
        'next_invoice_date': tenant.billing_period_end.isoformat() if tenant.billing_period_end else None,
        'plan': tenant.plan,
    }


def _build_recent_actions(tenant, limit=10):
    resource_ids = [tenant.public_id]
    sas = tenant.service_accounts.values_list('public_id', flat=True)
    resource_ids.extend(sas)
    pats = CorePATCredential.objects.filter(service_account__in=tenant.service_accounts.all()).values_list('public_id', flat=True)
    resource_ids.extend(pats)

    events = AuditEvent.objects.filter(
        resource_id__in=resource_ids,
    ).order_by('-occurred_at')[:limit]

    return [
        {
            'action': e.action,
            'summary': f'{e.action} {e.resource_type}',
            'at': e.occurred_at.isoformat() if e.occurred_at else None,
        }
        for e in events
    ]


@extend_schema(
    summary='OperatorTenantListView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class OperatorTenantListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = CoreTenant.objects.all().order_by('display_name')
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()

        if search:
            qs = qs.filter(
                display_name__icontains=search
            ) | qs.filter(tenant_code__icontains=search)
        if status_filter:
            qs = qs.filter(status=status_filter)

        cards = _build_summary_cards()
        # R1: paginate (StandardPageNumberPagination, ?page=&page_size=, max 100),
        # giữ summary_cards trong envelope.
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        items = [_serialize_tenant(t) for t in page]
        payload = _envelope(items, summary_cards=cards, object_label='operator_tenant_list')
        payload['count'] = paginator.page.paginator.count
        payload['next'] = paginator.get_next_link()
        payload['previous'] = paginator.get_previous_link()
        return Response(payload)


@extend_schema(
    summary='OperatorTenantDetailView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class OperatorTenantDetailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tenant_id):
        try:
            tenant = CoreTenant.objects.get(public_id=tenant_id)
        except CoreTenant.DoesNotExist:
            return Response({'error': 'Không tìm thấy tenant.'}, status=404)

        data = {
            'tenant': _serialize_tenant(tenant),
            'commercial_summary': _build_commercial_summary(tenant),
            'security_summary': _build_security_summary(tenant),
            'recent_operator_actions': _build_recent_actions(tenant),
        }
        return Response(_envelope(data, object_label='operator_tenant_detail'))


@extend_schema(
    summary='OperatorTenantServiceAccountListView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class OperatorTenantServiceAccountListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tenant_id):
        try:
            tenant = CoreTenant.objects.get(public_id=tenant_id)
        except CoreTenant.DoesNotExist:
            return Response({'error': 'Không tìm thấy tenant.'}, status=404)

        qs = tenant.service_accounts.all().order_by('-created_at')
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()
        environment = request.query_params.get('environment', '').strip()
        rotation_risk = request.query_params.get('rotation_risk', '').strip()
        policy_id = request.query_params.get('policy_id', '').strip()

        if search:
            qs = qs.filter(name__icontains=search)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if rotation_risk == 'critical':
            qs = [sa for sa in qs if _compute_rotation_risk(sa) == 'critical']
        elif rotation_risk == 'warning':
            qs = [sa for sa in qs if _compute_rotation_risk(sa) == 'warning']
        if policy_id:
            qs = [sa for sa in qs if policy_id in dict(sa.metadata or {}).get('policy_ids', [])]

        items = [_serialize_service_account(sa) for sa in qs]
        if environment:
            items = [sa for sa in items if sa['environment'] == environment]

        total = len(items)
        active = sum(1 for sa in items if sa['status'] == 'active')
        critical_rotation = sum(1 for sa in items if sa['rotation_risk'] == 'critical')
        cards = [
            {'key': 'total', 'label': 'Tổng SA', 'value': str(total), 'detail': 'Service accounts', 'status': 'normal'},
            {'key': 'active', 'label': 'Đang hoạt động', 'value': str(active), 'detail': 'SA active', 'status': 'active'},
            {'key': 'rotation_critical', 'label': 'Xoay vòng quá hạn', 'value': str(critical_rotation), 'detail': 'Cần rotate', 'status': 'critical' if critical_rotation > 0 else 'normal'},
        ]
        return Response(_envelope(items, summary_cards=cards, object_label='operator_service_account_list'))


@extend_schema(
    summary='OperatorTenantPATListView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class OperatorTenantPATListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tenant_id):
        try:
            tenant = CoreTenant.objects.get(public_id=tenant_id)
        except CoreTenant.DoesNotExist:
            return Response({'error': 'Không tìm thấy tenant.'}, status=404)

        sa_ids = tenant.service_accounts.values_list('id', flat=True)
        qs = CorePATCredential.objects.filter(service_account_id__in=sa_ids).order_by('-created_at')

        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()
        sa_filter = request.query_params.get('service_account_id', '').strip()
        anomaly = request.query_params.get('anomaly_state', '').strip()
        expires_within = request.query_params.get('expires_within_days', '').strip()

        if search:
            qs = qs.filter(token_prefix__icontains=search)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if sa_filter:
            qs = qs.filter(service_account__public_id=sa_filter)

        items = [_serialize_pat(pat) for pat in qs]

        if anomaly:
            items = [p for p in items if p['anomaly_state'] == anomaly]
        if expires_within:
            try:
                days = int(expires_within)
                cutoff = timezone.now() + timedelta(days=days)
                items = [p for p in items if p['expires_at'] and p['expires_at'] <= cutoff.isoformat()]
            except (ValueError, TypeError):
                pass

        total = len(items)
        active_count = sum(1 for p in items if p['status'] == 'active')
        critical_count = sum(1 for p in items if p['anomaly_state'] == 'critical')
        cards = [
            {'key': 'total', 'label': 'Tổng PAT', 'value': str(total), 'detail': 'PAT credentials', 'status': 'normal'},
            {'key': 'active', 'label': 'Còn hiệu lực', 'value': str(active_count), 'detail': 'PAT active', 'status': 'active'},
            {'key': 'critical', 'label': 'Có vấn đề', 'value': str(critical_count), 'detail': 'Anomaly', 'status': 'critical' if critical_count > 0 else 'normal'},
        ]
        return Response(_envelope(items, summary_cards=cards, object_label='operator_pat_list'))
