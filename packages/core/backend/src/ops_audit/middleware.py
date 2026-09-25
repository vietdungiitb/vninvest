"""
RequestTraceMiddleware — injects X-Request-ID into every request/response.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import logging
import time
import uuid

from .models import AuditEvent

logger = logging.getLogger(__name__)


class RequestTraceMiddleware:
    """
    Reads X-Request-ID from incoming request; generates one if absent.
    Attaches request_id to request.META['X_REQUEST_ID'], echoes it in the
    response header, and records a lightweight access audit event.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get('HTTP_X_REQUEST_ID', '').strip() or str(uuid.uuid4())
        request.META['X_REQUEST_ID'] = request_id
        # BL-15: propagate to JSON log formatter (stdlib ContextVar, no dep).
        try:
            from vninvest_core.json_logging import request_id_var
            request_id_var.set(request_id)
        except Exception:
            pass
        started_at = time.perf_counter()
        response = self.get_response(request)
        self._record_access_event(request, response, request_id, started_at)
        response['X-Request-ID'] = request_id
        return response

    def _record_access_event(self, request, response, request_id, started_at):
        path = getattr(request, 'path', '') or ''
        if path.startswith('/core/v1/audit-log'):
            return

        try:
            user = getattr(request, 'user', None)
            tenant = getattr(user, 'core_tenant', None)
            forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            remote_addr = forwarded_for or request.META.get('REMOTE_ADDR')
            actor_user_id = getattr(user, 'id', None) if getattr(user, 'is_authenticated', False) else None
            actor_label = user.get_username() if getattr(user, 'is_authenticated', False) else 'anonymous'
            duration_ms = int((time.perf_counter() - started_at) * 1000)

            AuditEvent.objects.create(
                actor_user_id=actor_user_id,
                actor_label=actor_label or 'anonymous',
                tenant_id=getattr(tenant, 'public_id', '') or '',
                action=AuditEvent.ActionChoices.ACCESS,
                resource_type='HttpRequest',
                resource_id=path[:64],
                request_id=request_id,
                ip_address=remote_addr or None,
                metadata={
                    'method': getattr(request, 'method', ''),
                    'path': path,
                    'status_code': getattr(response, 'status_code', None),
                    'duration_ms': duration_ms,
                },
            )
        except Exception as e:
            logger.warning('RequestTraceMiddleware: audit event write failed for %s %s: %s', getattr(request, 'method', ''), path, e)
            return
