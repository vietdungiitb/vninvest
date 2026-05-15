"""
SOC Base View — base class cho tất cả SOC API views.

Cung cấp:
  - IsAuthenticated + IsAdminUser permission
  - Standardized error envelope theo OpenAPI Constitution
  - Request ID extraction từ middleware
  - Pagination helper
"""
import uuid
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from ..registry import ensure_service_registry
from vninvest_core.pagination import StandardPageNumberPagination


class SOCRegistryBootstrapMixin:
    """Ensure canonical SOC registry exists before servicing API requests."""

    def initial(self, request, *args, **kwargs):
        ensure_service_registry()
        return super().initial(request, *args, **kwargs)


class SOCBaseView(SOCRegistryBootstrapMixin, APIView):
    """Base view cho tất cả SOC endpoints."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    @staticmethod
    def _stringify_error_detail(detail) -> str:
        if isinstance(detail, dict):
            return '; '.join(
                f'{key}: {SOCBaseView._stringify_error_detail(value)}'
                for key, value in detail.items()
            )
        if isinstance(detail, list):
            return '; '.join(SOCBaseView._stringify_error_detail(item) for item in detail)
        return str(detail)

    def get_request_id(self, request) -> str:
        return getattr(request, 'request_id', '') or str(uuid.uuid4())

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if response is None:
            return response

        payload = response.data if isinstance(response.data, dict) else {}
        field_errors = None
        detail_source = payload.get('detail') if 'detail' in payload else payload
        if payload:
            extra_fields = {key: value for key, value in payload.items() if key != 'detail'}
            if extra_fields:
                field_errors = extra_fields

        return self.error_response(
            self.request,
            code=str(getattr(exc, 'default_code', 'api_error')).upper(),
            detail=self._stringify_error_detail(detail_source or response.status_text),
            http_status=response.status_code,
            field_errors=field_errors,
        )

    def error_response(
        self,
        request,
        code: str,
        detail: str,
        http_status: int = status.HTTP_400_BAD_REQUEST,
        field_errors: 'dict | None' = None,
    ) -> Response:
        """Standard error envelope theo OpenAPI Constitution."""
        body = {
            'detail': detail,
            'code': code,
            'timestamp': timezone.now().isoformat(),
            'request_id': self.get_request_id(request),
        }
        if field_errors:
            body['field_errors'] = field_errors
        return Response(body, status=http_status)

    def paginate_queryset(self, queryset, request):
        self._paginator = StandardPageNumberPagination()
        return self._paginator.paginate_queryset(queryset, request, view=self)

    def get_paginated_response(self, data):
        return self._paginator.get_paginated_response(data)
