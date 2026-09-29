"""
Standard error envelope for all Core API responses.

Implements constitutional R4: All errors follow unified structure with
detail, code, timestamp, request_id, and field_errors.
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.exceptions import APIException, ValidationError


class StandardErrorEnvelope:
    """
    Standard error response envelope per CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION.
    
    Structure:
    {
        "detail": "Human-readable error message",
        "code": "error_code_slug",
        "timestamp": "2026-05-13T15:30:00Z",
        "request_id": "req_xxx...",
        "field_errors": {
            "field_name": ["error message 1", "error message 2"]
        }
    }
    """
    
    def __init__(
        self,
        detail: str,
        code: str,
        timestamp: Optional[str] = None,
        request_id: Optional[str] = None,
        field_errors: Optional[Dict[str, list]] = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ):
        """
        Initialize error envelope.
        
        Args:
            detail: Human-readable error message
            code: Machine-readable error code (e.g., 'validation_error', 'not_found')
            timestamp: ISO8601 timestamp (auto-generated if None)
            request_id: Request ID for tracing (auto-generated if None)
            field_errors: Dict of field validation errors
            status_code: HTTP status code for response
        """
        self.detail = detail
        self.code = code
        self.timestamp = timestamp or datetime.utcnow().isoformat() + 'Z'
        self.request_id = request_id or f'req_{uuid.uuid4().hex[:16]}'
        self.field_errors = field_errors or {}
        self.status_code = status_code
    
    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        payload = {
            'detail': self.detail,
            'code': self.code,
            'timestamp': self.timestamp,
            'request_id': self.request_id,
        }
        if self.field_errors:
            payload['field_errors'] = self.field_errors
        return payload
    
    def to_response(self) -> Response:
        """Convert to DRF Response object."""
        return Response(self.to_dict(), status=self.status_code)


class CoreAPIException(APIException):
    """
    Base exception for all Core API errors.
    
    Automatically formats response using StandardErrorEnvelope.
    """
    
    default_detail = 'An error occurred.'
    default_code = 'error'
    default_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    def __init__(
        self,
        detail: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        field_errors: Optional[Dict[str, list]] = None,
        request_id: Optional[str] = None,
    ):
        """
        Initialize Core API exception.
        
        Args:
            detail: Custom error detail (uses default if None)
            code: Custom error code (uses default if None)
            status_code: Custom HTTP status (uses default if None)
            field_errors: Field validation errors dict
            request_id: Request ID for tracing
        """
        self.detail = detail or self.default_detail
        self.code = code or self.default_code
        self.status_code = status_code or self.default_status_code
        self.field_errors = field_errors or {}
        self.request_id = request_id or f'req_{uuid.uuid4().hex[:16]}'
        
        super().__init__(detail=self.detail)
    
    def get_envelope(self) -> StandardErrorEnvelope:
        """Get standardized error envelope for this exception."""
        return StandardErrorEnvelope(
            detail=self.detail,
            code=self.code,
            status_code=self.status_code,
            field_errors=self.field_errors,
            request_id=self.request_id,
        )


class ValidationErrorException(CoreAPIException):
    """Validation error (400)."""
    default_code = 'validation_error'
    default_status_code = status.HTTP_400_BAD_REQUEST


class AuthenticationErrorException(CoreAPIException):
    """Authentication error (401)."""
    default_code = 'authentication_error'
    default_status_code = status.HTTP_401_UNAUTHORIZED


class PermissionErrorException(CoreAPIException):
    """Permission error (403)."""
    default_code = 'permission_error'
    default_status_code = status.HTTP_403_FORBIDDEN


class NotFoundErrorException(CoreAPIException):
    """Not found error (404)."""
    default_code = 'not_found'
    default_status_code = status.HTTP_404_NOT_FOUND


class ConflictErrorException(CoreAPIException):
    """Conflict error (409)."""
    default_code = 'conflict'
    default_status_code = status.HTTP_409_CONFLICT


class RateLimitErrorException(CoreAPIException):
    """Rate limit error (429)."""
    default_code = 'rate_limit_exceeded'
    default_status_code = status.HTTP_429_TOO_MANY_REQUESTS


class InternalErrorException(CoreAPIException):
    """Internal server error (500)."""
    default_code = 'internal_error'
    default_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR


class ServiceUnavailableException(CoreAPIException):
    """503 — dịch vụ tạm không phục vụ được.

    SAFE-03 dùng cho kill-switch: operator đang chủ động tắt ghi, hoặc hệ
    thống không đọc được trạng thái kill-switch (fail-closed). Cả hai đều là
    "đừng ghi lúc này, thử lại sau" chứ không phải lỗi của client, nên 503
    chứ không phải 400/403 — 503 cũng khiến client retry được an toàn.
    """
    default_code = 'service_unavailable'
    default_status_code = status.HTTP_503_SERVICE_UNAVAILABLE


def core_api_exception_handler(exc: Exception, context: dict) -> Optional[Response]:
    """
    Custom DRF exception handler for standardized error envelopes.
    
    Converts all exceptions (both CoreAPIException and standard DRF exceptions)
    to StandardErrorEnvelope format.
    
    Args:
        exc: Exception raised by view
        context: Exception handler context (contains 'request', 'view', etc.)
    
    Returns:
        Response with standardized error envelope, or None to use default handler
    """
    request = context.get('request')
    meta = getattr(request, 'META', None) or getattr(getattr(request, '_request', None), 'META', {})
    request_id = (
        getattr(request, 'request_id', None) or
        meta.get('X_REQUEST_ID') or
        meta.get('HTTP_X_REQUEST_ID') or
        f'req_{uuid.uuid4().hex[:16]}'
    )
    
    # Handle Core API exceptions
    if isinstance(exc, CoreAPIException):
        envelope = exc.get_envelope()
        envelope.request_id = request_id
        return envelope.to_response()
    
    # Handle DRF ValidationError (from serializers)
    if isinstance(exc, ValidationError):
        field_errors = {}
        if isinstance(exc.detail, dict):
            # Nested field errors
            for field, messages in exc.detail.items():
                field_errors[field] = [str(msg) for msg in messages]
        
        envelope = StandardErrorEnvelope(
            detail='Request validation failed.',
            code='validation_error',
            status_code=status.HTTP_400_BAD_REQUEST,
            field_errors=field_errors,
            request_id=request_id,
        )
        return envelope.to_response()
    
    # Handle standard DRF exceptions (AuthenticationFailed, PermissionDenied, etc.)
    if isinstance(exc, APIException):
        # Map DRF exceptions to standard error codes
        status_code = exc.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR
        code_map = {
            status.HTTP_401_UNAUTHORIZED: 'authentication_error',
            status.HTTP_403_FORBIDDEN: 'permission_error',
            status.HTTP_404_NOT_FOUND: 'not_found',
            status.HTTP_429_TOO_MANY_REQUESTS: 'rate_limit_exceeded',
            status.HTTP_400_BAD_REQUEST: 'validation_error',
        }
        code = code_map.get(status_code, 'api_error')
        
        envelope = StandardErrorEnvelope(
            detail=str(exc.detail),
            code=code,
            status_code=status_code,
            request_id=request_id,
        )
        return envelope.to_response()
    
    # Unhandled exceptions — log and return 500
    return None
