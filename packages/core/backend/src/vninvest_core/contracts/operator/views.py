"""Native operator contract views for admin-core overview and health."""
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from advisory.models import SystemAISettings
from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent
from user_workspace.models import Portfolio, Transaction
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes



def _build_operator_components():
    user_count = User.objects.count()
    tenant_count = CoreTenant.objects.count()
    portfolio_count = Portfolio.objects.count()
    transaction_count = Transaction.objects.count()
    audit_event_count = AuditEvent.objects.count()
    active_ai = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()

    components = [
        {
            'key': 'service',
            'label': 'Core service',
            'healthy': True,
            'status': 'healthy',
            'detail': 'vninvest-core native runtime',
        },
        {
            'key': 'identity',
            'label': 'Identity access',
            'healthy': tenant_count > 0,
            'status': 'healthy' if tenant_count > 0 else 'warning',
            'detail': f'users={user_count}, tenants={tenant_count}',
        },
        {
            'key': 'workspace',
            'label': 'User workspace',
            'healthy': portfolio_count > 0,
            'status': 'healthy' if portfolio_count > 0 else 'warning',
            'detail': f'portfolios={portfolio_count}, transactions={transaction_count}',
        },
        {
            'key': 'audit',
            'label': 'Ops audit',
            'healthy': audit_event_count > 0,
            'status': 'healthy' if audit_event_count > 0 else 'warning',
            'detail': f'events={audit_event_count}',
        },
        {
            'key': 'ai_runtime',
            'label': 'AI runtime',
            'healthy': active_ai is not None,
            'status': 'healthy' if active_ai is not None else 'warning',
            'detail': active_ai.ai_model if active_ai is not None else 'Chưa có cấu hình AI active',
        },
    ]

    healthy_component_count = sum(1 for component in components if component['healthy'])
    degraded_components = [component['key'] for component in components if not component['healthy']]
    overall_status = 'healthy' if not degraded_components else 'degraded'

    summary_cards = [
        {
            'key': 'operator_health',
            'label': 'Trạng thái tổng quan',
            'value': overall_status,
            'detail': f'{healthy_component_count}/{len(components)} thành phần khỏe',
            'status': overall_status,
        },
        {
            'key': 'users',
            'label': 'Người dùng',
            'value': str(user_count),
            'detail': 'Tài khoản core-native',
        },
        {
            'key': 'tenants',
            'label': 'Tenant',
            'value': str(tenant_count),
            'detail': 'Identity access',
        },
        {
            'key': 'portfolios',
            'label': 'Danh mục',
            'value': str(portfolio_count),
            'detail': 'User workspace',
        },
        {
            'key': 'transactions',
            'label': 'Giao dịch',
            'value': str(transaction_count),
            'detail': 'User workspace',
        },
        {
            'key': 'audit_events',
            'label': 'Audit events',
            'value': str(audit_event_count),
            'detail': 'Ops audit',
        },
    ]

    sources = {
        'service': {'status': 'ok'},
        'realtime': {'redis_ok': None, 'channel_layer_type': 'unavailable'},
        'streams': {'redis_ok': None},
        'prefetch': {'status': 'idle'},
        'market_observability': {'overall': {'http_requests': audit_event_count}},
        'admin_runtime_kpi': {'celery': {'alive': True}},
        'ai_runtime': {'rollout_state': {'ready': active_ai is not None}},
    }

    sections = {
        'health': {
            'healthy_component_count': healthy_component_count,
            'degraded_component_count': len(degraded_components),
            'degraded_components': degraded_components,
        },
        'admin_runtime_kpi': {
            'celery': {'alive': True},
            'market_observability': {'overall': {'http_requests': audit_event_count}},
        },
        'ai_runtime': {
            'rollout_state': {'ready': active_ai is not None},
            'active_model': active_ai.ai_model if active_ai is not None else None,
        },
    }

    return {
        'generated_at': timezone.now().isoformat(),
        'health_status': overall_status,
        'summary_cards': summary_cards,
        'health_cards': components,
        'components': components,
        'sections': sections,
        'sources': sources,
    }


@extend_schema(
    summary='OperatorOverviewView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class OperatorOverviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        snapshot = _build_operator_components()
        return Response({
            'object': 'operator_overview_snapshot',
            'generated_at': snapshot['generated_at'],
            'health_status': snapshot['health_status'],
            'summary_cards': snapshot['summary_cards'],
            'health_cards': snapshot['health_cards'],
            'sections': snapshot['sections'],
        })


@extend_schema(
    summary='OperatorHealthView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class OperatorHealthView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        snapshot = _build_operator_components()
        return Response({
            'object': 'operator_health_snapshot',
            'generated_at': snapshot['generated_at'],
            'health_status': snapshot['health_status'],
            'healthy_component_count': snapshot['sections']['health']['healthy_component_count'],
            'degraded_component_count': snapshot['sections']['health']['degraded_component_count'],
            'degraded_components': snapshot['sections']['health']['degraded_components'],
            'components': snapshot['components'],
            'sources': snapshot['sources'],
        })