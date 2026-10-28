"""
Middleware for Phase 3 Shadow Run dual-read capability.

Captures every API request, forwards to core-api, compares with legacy backend
response, and logs parity result asynchronously to ParityLog without blocking.

CRITICAL: Only activated during Phase 3 window via PHASE3_SHADOW_RUN_ENABLED env var.
"""

import hashlib
import json
import logging
import os
import time
from django.http import HttpRequest, HttpResponse

logger = logging.getLogger(__name__)


class ShadowRunDualReadMiddleware:
    """
    Request capture + async dual-read logging middleware.
    
    For EVERY incoming request during Phase 3:
    1. Forward to core-api in parallel (async, non-blocking)
    2. Compare responses
    3. Log parity result to ParityLog async
    
    Does NOT affect request/response flow — legacy backend remains primary.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
        # Phase 3 feature flag
        self.enabled = os.getenv('PHASE3_SHADOW_RUN_ENABLED', 'false').lower() == 'true'
        
        # Core API endpoint for shadow reads
        self.core_api_base = os.getenv(
            'CORE_API_SHADOW_RUN_ENDPOINT',
            'http://core-api:8000'
        )
        
        # Timeout for shadow request (must complete within window)
        self.shadow_timeout_s = float(os.getenv('PHASE3_SHADOW_RUN_TIMEOUT', '5.0'))
        
        # List of endpoints to monitor (comma-separated)
        monitored_endpoints_str = os.getenv(
            'PHASE3_MONITORED_ENDPOINTS',
            '/api/portfolios/,/api/transactions/,/api/watchlist-items/,'
            '/api/stocks/,/api/signals/,/api/whale-feed/'
        )
        self.monitored_endpoints = [e.strip() for e in monitored_endpoints_str.split(',')]
        
        logger.info(f"ShadowRunDualReadMiddleware initialized: enabled={self.enabled}")
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        """
        Main middleware entry point. Handle request → response flow.
        """
        
        # 1. Process request through legacy backend (primary path, unchanged)
        legacy_start_time = time.time()
        response = self.get_response(request)
        legacy_elapsed_ms = (time.time() - legacy_start_time) * 1000
        
        # 2. If shadow run enabled and endpoint monitored, trigger async dual-read
        if self.enabled and self._should_monitor(request):
            try:
                # Queue async parity logging (non-blocking)
                self._queue_parity_check(
                    request=request,
                    response=response,
                    legacy_elapsed_ms=legacy_elapsed_ms
                )
            except Exception as e:
                # Never let shadow run errors affect primary path
                logger.warning(f"Shadow run parity check queued with error: {e}")
        
        # 3. Return legacy response (primary path, unchanged)
        return response
    
    def _should_monitor(self, request: HttpRequest) -> bool:
        """
        Check if this request endpoint should be monitored during Phase 3.
        """
        if not self.monitored_endpoints:
            return False
        
        path = request.path
        return any(path.startswith(ep) for ep in self.monitored_endpoints)
    
    def _queue_parity_check(self, request: HttpRequest, response: HttpResponse, legacy_elapsed_ms: float):
        """
        Queue async parity check task (non-blocking to primary request flow).
        
        Uses Celery task: signal_intelligence.tasks.shadow_run_parity_check_task
        """
        from celery import current_app
        
        # Extract request context
        x_request_id = request.headers.get('X-Request-ID', '')
        method = request.method
        endpoint = request.path
        
        # Serialize request headers + body for shadow request
        request_context = {
            'method': method,
            'path': endpoint,
            'query_string': request.GET.urlencode() if request.GET else '',
            'headers': self._extract_safe_headers(request),
            'x_request_id': x_request_id,
        }
        
        # Extract legacy response details
        legacy_context = {
            'status': response.status_code,
            'elapsed_ms': legacy_elapsed_ms,
            'payload': self._extract_response_body(response),
        }
        
        # Queue task to Celery (non-blocking, will execute in worker)
        try:
            current_app.send_task(
                'signal_intelligence.tasks.shadow_run_parity_check_task',
                args=(request_context, legacy_context, self.core_api_base),
                kwargs={'shadow_timeout_s': self.shadow_timeout_s},
                priority=5,  # Low priority to not block critical tasks
            )
            logger.debug(f"Shadow run parity check queued: {x_request_id} {endpoint}")
        except Exception as e:
            logger.error(f"Failed to queue parity check: {e}")
    
    def _extract_safe_headers(self, request: HttpRequest) -> dict:
        """
        Extract safe headers for shadow request (exclude sensitive headers).
        """
        safe_headers = {}
        for key, value in request.headers.items():
            # Include only safe headers for comparison
            if key.lower() in ['content-type', 'accept', 'authorization']:
                safe_headers[key] = value
        return safe_headers
    
    def _extract_response_body(self, response: HttpResponse) -> str:
        """
        Extract response body for payload hashing + comparison.
        """
        try:
            if hasattr(response, 'content'):
                return response.content.decode('utf-8')
            return ""
        except Exception as e:
            logger.error(f"Failed to extract response body: {e}")
            return ""


def compute_payload_hash(payload: str) -> str:
    """
    Compute SHA256 hash of response payload for comparison.
    
    Used to detect if core API response is structurally identical to legacy.
    """
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def compare_json_structure(legacy_json: str, core_json: str) -> bool:
    """
    Compare JSON structure without comparing values.
    
    Returns True if both have same keys/nesting, False if structure differs.
    """
    try:
        legacy_obj = json.loads(legacy_json)
        core_obj = json.loads(core_json)
        
        # Simple structure comparison (keys match at all levels)
        return _compare_structure_recursive(legacy_obj, core_obj)
    except json.JSONDecodeError:
        return False


def _compare_structure_recursive(obj1, obj2) -> bool:
    """
    Recursively compare JSON structure.
    """
    if type(obj1) != type(obj2):
        return False
    
    if isinstance(obj1, dict):
        if set(obj1.keys()) != set(obj2.keys()):
            return False
        return all(_compare_structure_recursive(obj1[k], obj2[k]) for k in obj1.keys())
    
    if isinstance(obj1, list):
        if len(obj1) != len(obj2):
            return False
        return all(_compare_structure_recursive(obj1[i], obj2[i]) for i in range(len(obj1)))
    
    # Scalars are structurally the same if same type
    return True
