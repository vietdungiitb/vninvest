"""A2: SOC quản trị Users toàn hệ thống (staff-only).

GET /api/soc/users/ — search/filter/paginate (không N+1, có assertNumQueries trong test)
POST /api/soc/users/<id>/set-active/ — khóa/mở (chặn tự khóa, chặn khóa superuser)
POST /api/soc/users/<id>/set-plan/ — đổi plan tenant sở hữu
Mọi write ghi ops_audit.AuditEvent. Không migration, không đụng B+A/abilities.
"""
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from vninvest_core.client_ip import get_client_ip

from rest_framework.response import Response

from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent
from vninvest_core.pagination import StandardPageNumberPagination

from ..envelope import envelope, paginated_envelope
from .base import SOCBaseView

VALID_PLANS = {c for c, _ in CoreTenant.PlanChoices.choices}
VALID_STATUSES = {'active', 'suspended', 'deprovisioned'}


def _client_ip(request) -> str:
    return get_client_ip(request)


def _write_user_audit(request, action: str, resource_type: str,
                      resource_id: str, metadata: dict) -> None:
    AuditEvent.objects.create(
        actor_user_id=request.user.id,
        actor_label=getattr(request.user, 'username', 'staff'),
        tenant_id='',
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=_client_ip(request) or None,
        metadata=metadata,
    )


def _serialize_user(user: User) -> dict:
    tenant = getattr(user, 'core_tenant', None)
    memberships = [
        {'tenant_code': m.tenant.tenant_code, 'role': m.role}
        for m in getattr(user, '_prefetched_memberships', None)
        or list(user.tenant_memberships.all())
    ]
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': f'{user.first_name} {user.last_name}'.strip(),
        'is_active': user.is_active,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'date_joined': user.date_joined,
        'last_login': user.last_login,
        'tenant': ({
            'tenant_code': tenant.tenant_code,
            'display_name': tenant.display_name,
            'plan': tenant.plan,
            'status': tenant.status,
        } if tenant else None),
        'member_of': memberships,
    }


class SocUsersPagination(StandardPageNumberPagination):
    pass


class SocUsersView(SOCBaseView):
    """GET danh sách users toàn hệ thống (staff-only)."""

    def get(self, request):
        search = str(request.query_params.get('search', '') or '').strip()
        plan = str(request.query_params.get('plan', '') or '').strip()
        status_filter = str(request.query_params.get('status', '') or '').strip()
        is_staff = request.query_params.get('is_staff')
        is_active = request.query_params.get('is_active')
        ordering = str(request.query_params.get('ordering', '-date_joined') or '')

        qs = (User.objects.all()
              .prefetch_related('core_tenant', 'tenant_memberships__tenant')
              .order_by())
        if search:
            qs = qs.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
                | Q(first_name__icontains=search) | Q(last_name__icontains=search))
        if plan:
            if plan not in VALID_PLANS:
                return Response({'detail': f'plan không hợp lệ: {plan}',
                                 'code': 'invalid_plan'},
                                status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(core_tenant__plan=plan)
        if status_filter:
            if status_filter == 'none':
                qs = qs.filter(core_tenant__isnull=True)
            elif status_filter in VALID_STATUSES:
                qs = qs.filter(core_tenant__status=status_filter)
            else:
                return Response({'detail': f'status không hợp lệ: {status_filter}',
                                 'code': 'invalid_status'},
                                status=status.HTTP_400_BAD_REQUEST)
        if is_staff in ('true', 'false'):
            qs = qs.filter(is_staff=(is_staff == 'true'))
        if is_active in ('true', 'false'):
            qs = qs.filter(is_active=(is_active == 'true'))

        allowed_ordering = {'date_joined', '-date_joined', 'username', '-username'}
        qs = qs.order_by(ordering if ordering in allowed_ordering else '-date_joined')

        paginator = SocUsersPagination()
        page = paginator.paginate_queryset(qs, request)
        rows = []
        for user in page:
            # gán memberships đã prefetch để serializer không query thêm
            user._prefetched_memberships = list(user.tenant_memberships.all())
            rows.append(_serialize_user(user))
        paged = paginator.get_paginated_response(rows)
        # Bọc cả khối phân trang (count/next/previous/results) trong `data`.
        return paginated_envelope(dict(paged.data))


class SocUserSetActiveView(SOCBaseView):
    """POST khóa/mở tài khoản (staff-only, có audit, chặn tự khóa/khóa superuser)."""

    def post(self, request, user_id: int):
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Không tìm thấy user.', 'code': 'not_found'},
                            status=status.HTTP_404_NOT_FOUND)
        data = request.data if isinstance(request.data, dict) else {}
        if 'is_active' not in data:
            return Response({'detail': 'Thiếu is_active.', 'code': 'validation_error'},
                            status=status.HTTP_400_BAD_REQUEST)
        reason = str(data.get('reason', '') or '').strip()
        if len(reason) < 5:
            return Response({'detail': 'Lý do bắt buộc (≥5 ký tự).', 'code': 'validation_error'},
                            status=status.HTTP_400_BAD_REQUEST)
        if target.id == request.user.id:
            return Response({'detail': 'Không thể tự khóa/mở chính mình.', 'code': 'self_lock'},
                            status=status.HTTP_400_BAD_REQUEST)
        new_state = bool(data['is_active'])
        if target.is_superuser and not new_state and not request.user.is_superuser:
            return Response({'detail': 'Chỉ superuser được khóa superuser.', 'code': 'forbidden'},
                            status=status.HTTP_403_FORBIDDEN)
        before = target.is_active
        target.is_active = new_state
        target.save(update_fields=['is_active'])
        _write_user_audit(request, 'update', 'core_user', str(target.id), {
            'reason': reason, 'from': before, 'to': new_state,
            'username': target.username,
        })
        return envelope({'id': target.id, 'is_active': target.is_active})


class SocUserSetPlanView(SOCBaseView):
    """POST đổi plan tenant sở hữu (staff-only, có audit)."""

    def post(self, request, user_id: int):
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Không tìm thấy user.', 'code': 'not_found'},
                            status=status.HTTP_404_NOT_FOUND)
        data = request.data if isinstance(request.data, dict) else {}
        plan = str(data.get('plan', '') or '').strip()
        reason = str(data.get('reason', '') or '').strip()
        if plan not in VALID_PLANS:
            return Response({'detail': f'plan không hợp lệ: {plan}.', 'code': 'invalid_plan'},
                            status=status.HTTP_400_BAD_REQUEST)
        tenant = getattr(target, 'core_tenant', None)
        if tenant is None:
            return Response({'detail': 'User không sở hữu tenant nào.',
                             'code': 'no_owned_tenant'},
                            status=status.HTTP_404_NOT_FOUND)
        before = tenant.plan
        tenant.plan = plan
        tenant.save(update_fields=['plan', 'updated_at'])
        _write_user_audit(request, 'update', 'tenant', tenant.tenant_code, {
            'reason': reason, 'from_plan': before, 'to_plan': plan,
            'username': target.username,
        })
        return envelope({'tenant_code': tenant.tenant_code, 'plan': tenant.plan})
