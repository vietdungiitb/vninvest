"""R4: SOC audit-events viewer cross-tenant (staff-only, read-only).

GET /api/soc/audit-events/ — filter tenant/actor/action/resource/date + paginate.
Đọc AuditEvent trực tiếp, KHÔNG bóp theo core_tenant (khác /core/v1/audit-log).
Không migration.
"""
from django.db.models import Q
from rest_framework.response import Response

from ops_audit.models import AuditEvent
from vninvest_core.pagination import StandardPageNumberPagination

from .base import SOCBaseView

VALID_ACTIONS = {c for c, _ in AuditEvent.ActionChoices.choices}


def _serialize_event(e: AuditEvent) -> dict:
    return {
        'event_id': str(e.event_id),
        'actor_user_id': e.actor_user_id,
        'actor_label': e.actor_label,
        'tenant_id': e.tenant_id,
        'action': e.action,
        'resource_type': e.resource_type,
        'resource_id': e.resource_id,
        'request_id': e.request_id,
        'ip_address': e.ip_address,
        'occurred_at': e.occurred_at.isoformat() if e.occurred_at else None,
    }


class AuditEventsView(SOCBaseView):
    def get(self, request):
        qs = AuditEvent.objects.all().order_by('-occurred_at', '-pk')
        tenant_id = (request.query_params.get('tenant_id') or '').strip()
        actor = (request.query_params.get('actor') or '').strip()
        action = (request.query_params.get('action') or '').strip()
        resource_type = (request.query_params.get('resource_type') or '').strip()
        resource_id = (request.query_params.get('resource_id') or '').strip()
        date_from = (request.query_params.get('from') or '').strip()
        date_to = (request.query_params.get('to') or '').strip()
        search = (request.query_params.get('search') or '').strip()

        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        if actor:
            qs = qs.filter(
                Q(actor_label__icontains=actor)
                | Q(resource_id__icontains=actor)
            ) if not actor.isdigit() else qs.filter(
                Q(actor_user_id=int(actor)) | Q(actor_label__icontains=actor)
            )
        if action:
            if action not in VALID_ACTIONS:
                return Response({'detail': 'Hành động audit không hợp lệ.'},
                                status=400)
            qs = qs.filter(action=action)
        if resource_type:
            qs = qs.filter(resource_type__icontains=resource_type)
        if resource_id:
            qs = qs.filter(resource_id__icontains=resource_id)
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(actor_label__icontains=search)
                | Q(resource_type__icontains=search)
                | Q(resource_id__icontains=search)
            )
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response([_serialize_event(e) for e in page])
