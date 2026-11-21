"""
RequestTraceMiddleware — injects X-Request-ID into every request/response.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import collections
import concurrent.futures
import logging
import threading
import time
import uuid

from vninvest_core.client_ip import UNKNOWN_IP, get_client_ip

from .models import AuditEvent

logger = logging.getLogger(__name__)


# S3 (Phase A — fast data service): audit write rời critical path.
# Sync Django chạy dưới daphne trên shared thread (thread_sensitive=True) nên
# INSERT sync mỗi request làm mọi request xếp hàng. Executor RIÊNG có giới hạn
# (2 worker) để ghi audit không chặn response; submit lỗi (shutdown) ⇒ fallback
# sync + log; worker lỗi ⇒ log warning (KHÔNG nuốt âm thầm, KHÔNG raise ra caller).
audit_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=2, thread_name_prefix='audit-write',
)
_pending_futures: collections.deque = collections.deque()
_pending_lock = threading.Lock()


def _audit_write_done(future):
    with _pending_lock:
        try:
            _pending_futures.remove(future)
        except ValueError:
            pass
    try:
        future.result()
    except Exception as exc:  # noqa: BLE001 — log rồi bỏ, không raise ra request
        logger.warning('RequestTraceMiddleware: background audit write failed: %r', exc)


def _submit_audit_event(payload):
    try:
        future = audit_executor.submit(AuditEvent.objects.create, **payload)
    except RuntimeError:
        # Executor đang shutdown: ghi sync để không mất dòng (fail-closed).
        logger.warning('RequestTraceMiddleware: executor busy/shutdown, sync fallback')
        AuditEvent.objects.create(**payload)
        return
    with _pending_lock:
        _pending_futures.append(future)
    future.add_done_callback(_audit_write_done)


def flush_audit_events(timeout=10):
    """Chờ các audit write đang chờ xong. Dùng cho test (tenantreg_b)."""
    deadline = time.perf_counter() + timeout
    while True:
        with _pending_lock:
            pending = list(_pending_futures)
        if not pending:
            return True
        remaining = deadline - time.perf_counter()
        if remaining <= 0:
            return False
        done, _ = concurrent.futures.wait(pending, timeout=min(remaining, 0.5))
        if not done:
            continue


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
            # B8: was `getattr(user, 'core_tenant', None)` only. core_tenant is
            # the REVERSE side of the CoreTenant.owner_user OneToOne, so it is
            # absent for any member-only user and every one of their requests was
            # recorded with tenant_id=''. Beyond being unattributed, that also
            # made identity_access.tasks.cross_ref_pat_audit_events miss their
            # traffic entirely, because that task filters tenant_id__gt=''.
            # request.tenant is authoritative and IS populated by the time we
            # get here: RequestTraceMiddleware is MIDDLEWARE index 7
            # (settings.py:113) and records AFTER self.get_response() returns
            # (line 34-35), by which point TenantResolutionMiddleware
            # (index 8) has already set it. Fall back to core_tenant for the
            # exempt paths where no tenant was resolved.
            tenant = getattr(request, 'tenant', None)
            if tenant is None:
                tenant = getattr(user, 'core_tenant', None)
            # B4: was left-most X-Forwarded-For, i.e. client-forgeable.
            # UNKNOWN_IP -> None so the row is still written with a NULL ip
            # instead of failing the GenericIPAddressField write (which the
            # outer except would swallow, silently dropping the audit event).
            client_ip = get_client_ip(request)
            if client_ip == UNKNOWN_IP:
                client_ip = None
            actor_user_id = getattr(user, 'id', None) if getattr(user, 'is_authenticated', False) else None
            actor_label = user.get_username() if getattr(user, 'is_authenticated', False) else 'anonymous'
            duration_ms = int((time.perf_counter() - started_at) * 1000)

            _submit_audit_event({
                'actor_user_id': actor_user_id,
                'actor_label': actor_label or 'anonymous',
                'tenant_id': str(getattr(tenant, 'public_id', '') or ''),
                'action': AuditEvent.ActionChoices.ACCESS,
                'resource_type': 'HttpRequest',
                'resource_id': path[:64],
                'request_id': request_id,
                'ip_address': client_ip,
                'metadata': {
                    'method': getattr(request, 'method', ''),
                    'path': path,
                    'status_code': getattr(response, 'status_code', None),
                    'duration_ms': duration_ms,
                },
            })
        except Exception as e:
            logger.warning('RequestTraceMiddleware: audit event write failed for %s %s: %s', getattr(request, 'method', ''), path, e)
            return
