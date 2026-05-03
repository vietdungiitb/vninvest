"""
RequestTraceMiddleware — injects X-Request-ID into every request/response.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import uuid


class RequestTraceMiddleware:
    """
    Reads X-Request-ID from incoming request; generates one if absent.
    Attaches request_id to request.META['X_REQUEST_ID'] and echoes it
    in the response header.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get('HTTP_X_REQUEST_ID', '').strip() or str(uuid.uuid4())
        request.META['X_REQUEST_ID'] = request_id
        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response
