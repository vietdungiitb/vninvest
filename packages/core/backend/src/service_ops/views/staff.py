"""R5: Staff-switch A3 — staff "xem hộ" tenant (read-only, có audit).

POST /api/soc/staff/switch/ {tenant_id, reason>=5} → ký token (TTL 30 phút).
Header X-Staff-Switch (xử lý ở TenantResolutionMiddleware): validate chữ ký +
hạn + staff còn hiệu lực → request.tenant=target, role ép 'viewer',
request.staff_switch=True. Mọi write vẫn qua permission layer (viewer → chỉ đọc).
Không migration.
"""
import json
import time

from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from rest_framework.response import Response

from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent

from .base import SOCBaseView

SIGN_SALT = 'staff-switch-v1'
TOKEN_TTL_SECONDS = 30 * 60
REASON_MIN_LENGTH = 5


def _signer() -> TimestampSigner:
    return TimestampSigner(salt=SIGN_SALT)


def sign_staff_switch(*, staff_id: int, tenant_public_id: str) -> str:
    payload = json.dumps({'staff_id': staff_id, 'tenant_id': tenant_public_id,
                          'iat': int(time.time())})
    return _signer().sign(payload)


def verify_staff_switch(token: str):
    """Trả (staff_id, tenant_public_id) hoặc raise (BadSignature/SignatureExpired)."""
    raw = _signer().unsign(token, max_age=TOKEN_TTL_SECONDS)
    payload = json.loads(raw)
    return int(payload['staff_id']), str(payload['tenant_id'])


def _client_ip(request) -> str:
    return (request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR'))


class StaffSwitchView(SOCBaseView):
    def post(self, request):
        tenant_id = str(request.data.get('tenant_id') or '').strip()
        reason = str(request.data.get('reason') or '').strip()
        if len(reason) < REASON_MIN_LENGTH:
            return Response({'detail': 'Lý do hỗ trợ tối thiểu 5 ký tự.'}, status=400)
        try:
            tenant = CoreTenant.objects.get(public_id=tenant_id)
        except CoreTenant.DoesNotExist:
            return Response({'detail': 'Không tìm thấy tenant.'}, status=404)
        if tenant.status != CoreTenant.StatusChoices.ACTIVE:
            return Response({'detail': 'Chỉ xem hộ tenant đang hoạt động.'}, status=400)
        owned_ids = set(CoreTenant.objects.filter(owner_user=request.user)
                        .values_list('public_id', flat=True))
        if tenant.public_id in owned_ids:
            return Response(
                {'detail': 'Đang ở tenant của chính mình — không cần xem hộ.'},
                status=400)

        token = sign_staff_switch(staff_id=request.user.id,
                                  tenant_public_id=tenant.public_id)
        AuditEvent.objects.create(
            actor_user_id=request.user.id,
            actor_label=getattr(request.user, 'username', 'staff'),
            tenant_id=tenant.public_id,
            action='access',
            resource_type='staff_switch',
            resource_id=tenant.public_id,
            ip_address=_client_ip(request) or None,
            metadata={'reason': reason},
        )
        return Response({
            'token': token,
            'tenant': {'id': tenant.public_id, 'tenant_code': tenant.tenant_code,
                       'display_name': tenant.display_name},
            'role': 'viewer',
            'expires_in_seconds': TOKEN_TTL_SECONDS,
        })
