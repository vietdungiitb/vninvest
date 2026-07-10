"""Security utilities: LoginRecorder for audit-logging login attempts."""
from django.utils import timezone


def get_client_ip(request):
    """Extract client IP from request, respecting X-Forwarded-For."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


class LoginRecorder:
    @staticmethod
    def record_login(request, user, tenant, success, failure_reason=''):
        from identity_access.models import LoginAttempt
        LoginAttempt.objects.create(
            tenant=tenant,
            user=user if success else None,
            username=str(request.data.get('username', '')),
            email=user.email if user else '',
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=success,
            failure_reason=failure_reason,
        )

    @staticmethod
    def get_active_sessions(tenant):
        from identity_access.models import CorePATCredential, CoreServiceAccount
        return CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=True,
            status='active',
            expires_at__gt=timezone.now(),
        ).select_related('service_account', 'service_account__tenant')

    @staticmethod
    def revoke_session(session_id, tenant):
        from identity_access.models import CorePATCredential
        CorePATCredential.objects.filter(
            id=session_id,
            service_account__tenant=tenant,
            is_human_session=True,
        ).update(status='revoked', revoked_at=timezone.now(), revoked_reason='Revoked via Security Dashboard')

    @staticmethod
    def revoke_all_sessions_except(tenant, exclude_session_id):
        from identity_access.models import CorePATCredential
        CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=True,
            status='active',
        ).exclude(id=exclude_session_id).update(status='revoked', revoked_at=timezone.now(), revoked_reason='Revoked via Security Dashboard (revoke all)')
