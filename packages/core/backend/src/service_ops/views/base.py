"""
SOC Base View — base class cho tất cả SOC API views.

Cung cấp:
  - IsAuthenticated + IsAdminUser permission
  - Standardized error envelope theo OpenAPI Constitution
  - Request ID extraction từ middleware
  - Pagination helper
"""
import uuid
from django.http import StreamingHttpResponse
from django.utils import timezone
from asgiref.sync import sync_to_async
from rest_framework.renderers import BaseRenderer
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from ..registry import ensure_service_registry
from vninvest_core.pagination import StandardPageNumberPagination


class SOCOperatorReadThrottle(UserRateThrottle):
    """Independent bucket for SOC operator read endpoints — does not share the global 'user' quota."""
    scope = 'soc_operator_read'


class EventStreamRenderer(BaseRenderer):
    """Renderer pass-through cho SSE endpoints.

    Browser EventSource luôn gửi `Accept: text/event-stream`. DRF mặc định chỉ
    có JSONRenderer/BrowsableAPIRenderer → content negotiation fail với 406
    trước cả khi view.get() chạy (RC1: reconnect loop vô hạn trên mọi browser
    thật, trong khi test client gửi `*/*` nên vẫn 200 và không phát hiện được).

    View trả StreamingHttpResponse trực tiếp (không qua renderer), nên render()
    ở đây chỉ phục vụ error envelope (401/403/429) khi Accept là event-stream.
    """

    media_type = 'text/event-stream'
    format = 'event-stream'
    charset = 'utf-8'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        import json

        if data is None:
            return b''
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode(self.charset)
        return json.dumps(data, ensure_ascii=False, default=str).encode(self.charset)


class SSEStreamingHttpResponse(StreamingHttpResponse):
    """StreamingHttpResponse flush từng chunk cho SSE dưới daphne/ASGI.

    Root cause RC1-phần-2: Django `StreamingHttpResponse.__aiter__` tiêu thụ
    iterator ĐỒNG BỘ bằng `await sync_to_async(list)(...)` — tức `list()` toàn
    bộ generator trước khi yield chunk đầu tiên. Generator vô hạn
    (`while True` + `time.sleep(3)`) không bao giờ kết thúc → browser treo ở
    CONNECTING vĩnh viễn, 0 byte (đã đo: 20s/12s zero-byte cả direct lẫn qua
    nginx), trong khi response hữu hạn (`max_loops`) vẫn 200 đủ body lúc xong.

    Class này override `__aiter__`: mỗi `next()` chạy trong threadpool
    (`thread_sensitive=False` — không block event loop, không chiếm single
    sync thread), chunk encode utf-8 và yield ngay → flush incremental thật.
    Sync `__iter__` giữ nguyên nên test client/WSGI cũ không ảnh hưởng.
    """

    async def __aiter__(self):
        it = iter(self.streaming_content)
        try:
            while True:
                try:
                    part = await sync_to_async(next, thread_sensitive=False)(it)
                except StopIteration:
                    return
                if isinstance(part, str):
                    part = part.encode(self.charset)
                yield part
        finally:
            close = getattr(it, 'close', None)
            if callable(close):
                close()


class SOCRegistryBootstrapMixin:
    """Ensure canonical SOC registry exists before servicing API requests."""

    def initial(self, request, *args, **kwargs):
        ensure_service_registry()
        return super().initial(request, *args, **kwargs)


class SOCBaseView(SOCRegistryBootstrapMixin, APIView):
    """Base view cho tất cả SOC endpoints."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [SOCOperatorReadThrottle]

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
