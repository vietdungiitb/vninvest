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

from vninvest_core.pagination import StandardPageNumberPagination


class SOCBaseView(APIView):
    """Base view cho tất cả SOC endpoints."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_request_id(self, request) -> str:
        return getattr(request, 'request_id', '') or str(uuid.uuid4())

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
