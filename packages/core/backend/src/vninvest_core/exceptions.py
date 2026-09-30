"""
Standard error envelope for all Core API responses.

Implements constitutional R4: All errors follow unified structure with
detail, code, timestamp, request_id, and field_errors.

**API-01 (Wave 3) bổ sung RFC 9457 `application/problem+json`.**

Lịch sử thay đổi, vì nó quyết định cách đọc phần còn lại của file:

- **Trước:** `StandardErrorEnvelope` là hình dạng lỗi duy nhất —
  `{detail, code, timestamp, request_id, field_errors}` với
  `Content-Type: application/json`.
- **Nay:** `ProblemDetail` là hình dạng lỗi chuẩn, trả kèm
  `Content-Type: application/problem+json` (D-11). `StandardErrorEnvelope`
  **được giữ lại** và vẫn xuất hiện trong `to_problem()` dưới tên thành viên
  mở rộng `code` / `timestamp` / `field_errors`, để các consumer cũ đang đọc
  `resp.code` không gãy (D-10: giữ shape 1 release).

Tại sao **giữ cả hai** thay vì thay thế: `code` và `timestamp` được rất nhiều
chỗ trong FE đọc bằng tên. Xoá chúng trong một lần merge là làm hỏng hàng loạt
chỗ đang chạy, trong khi RFC 9457 cho phép **thành viên mở rộng** — tức là có
thể đạt chuẩn mà vẫn không phá ai. Đây là lý do D-10 nói "giữ shape 1 release"
và ở đây được thực hiện đúng nghĩa đó.
"""
import logging
import uuid
from datetime import datetime, timezone as dt_timezone
from typing import Optional, Dict, Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.exceptions import APIException, ValidationError

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404

logger = logging.getLogger(__name__)

#: Base URI cho `type` của problem document.
#: RFC 9457 §4.1: `type` phải là URI. `about:blank` được dùng khi không có
#: URI nào mô tả đúng vấn đề — nhưng với một danh mục lỗi đã biết thì dùng URI
#: thật tốt hơn: client có thể phân nhánh theo nó mà không phải so `code`.
PROBLEM_TYPE_BASE = 'https://vninvest.dev/problems/'

#: `Content-Type` chuẩn của RFC 9457.
PROBLEM_CONTENT_TYPE = 'application/problem+json'


class ProblemTypes:
    """Mapping `code` → URI + `title` chuẩn.

    `title` là **hằng số** theo RFC 9457 §3.1.2 — nó là câu tóm tắt lỗi, không
    phải thông báo cụ thể. Thông báo cụ thể nằm ở `detail`. Trộn hai thứ là
    lý do phổ biến khiến `title` biến thành chuỗi rác mà client không dùng được.
    """

    _TABLE = {
        'validation_error': (400, 'Invalid request'),
        'authentication_error': (401, 'Authentication required'),
        'permission_error': (403, 'Permission denied'),
        'not_found': (404, 'Resource not found'),
        'method_not_allowed': (405, 'Method not allowed'),
        'conflict': (409, 'Conflict'),
        'idempotency_key_conflict': (409, 'Idempotency key reused with a different payload'),
        'idempotency_in_progress': (409, 'A request with this idempotency key is in progress'),
        'idempotency_key_required': (400, 'Idempotency-Key header is required'),
        'idempotency_tenant_unresolved': (403, 'Tenant could not be resolved'),
        'unprocessable_entity': (422, 'Unprocessable entity'),
        'rate_limit_exceeded': (429, 'Rate limit exceeded'),
        'internal_error': (500, 'Internal server error'),
        'service_unavailable': (503, 'Service temporarily unavailable'),
        'timeout': (504, 'Request timed out'),
    }

    @classmethod
    def resolve(cls, code, status_code):
        """Trả `(uri, title)`. Lạ chưa biết ⇒ `about:blank` + `title` chuẩn
        theo status.

        `about:blank` là lựa chọn **có chủ đích**: RFC 9457 nói nếu không có
        type URI nào phù hợp thì dùng `about:blank`, và client phải dựa vào
        `status`. Bịa một URI cho một lỗi lạ sẽ hứa rằng có tài liệu mà không có.
        """
        entry = cls._TABLE.get(code)
        if entry is not None:
            return f'{PROBLEM_TYPE_BASE}{code}', entry[1]
        return 'about:blank', _default_title(status_code)


def _default_title(status_code):
    """`title` chuẩn theo HTTP status khi không có mã lỗi riêng."""
    return {
        400: 'Bad request',
        401: 'Authentication required',
        403: 'Permission denied',
        404: 'Resource not found',
        405: 'Method not allowed',
        409: 'Conflict',
        422: 'Unprocessable entity',
        429: 'Rate limit exceeded',
        500: 'Internal server error',
        502: 'Bad gateway',
        503: 'Service temporarily unavailable',
        504: 'Gateway timeout',
    }.get(status_code, 'Unexpected error')


class ProblemDetail:
    """Problem document theo RFC 9457.

    Thành viên chuẩn (RFC 9457 §3.1): `type`, `title`, `status`, `detail`,
    `instance`.

    Thành viên mở rộng (hợp lệ theo RFC) giữ tương thích ngược:
    `code`, `timestamp`, `request_id`, `errors[]`, `field_errors`.

    `errors[]` là **mảng** `{field, code, message}` chứ không phải object
    `field -> [messages]` như `field_errors` cũ. Lý do: một trường có thể có
    nhiều lỗi **cùng loại** và client cần phân biệt; dạng object ép phải nối
    chuỗi để giữ thứ tự. `field_errors` cũ vẫn được trả kèm cho consumer cũ.
    """

    def __init__(
        self,
        *,
        code: str,
        status_code: int,
        detail: str,
        request_id: Optional[str] = None,
        instance: Optional[str] = None,
        field_errors: Optional[Dict[str, list]] = None,
        errors: Optional[list] = None,
        type_uri: Optional[str] = None,
        title: Optional[str] = None,
    ):
        resolved_type, resolved_title = ProblemTypes.resolve(code, status_code)
        self.type = type_uri or resolved_type
        self.title = title or resolved_title
        self.status = status_code
        self.detail = detail
        # `request_id` là member bắt buộc theo R2, nhưng **không nên** bắt buộc
        # mọi caller phải tự sinh: `CoreAPIException` cũng đã tự sinh. Bắt
        # keyword-only bắt buộc trước đây khiến `legacy_proxy._legacy_problem`
        # ném `TypeError` → 500 thay vì trả problem.
        self.request_id = request_id or f'req_{uuid.uuid4().hex[:16]}'
        self.instance = instance
        self.code = code
        self.field_errors = field_errors or {}
        self.errors = errors if errors is not None else _errors_from_field_errors(
            self.field_errors)
        # Không để múi giờ sinh lệch giữa lúc dựng object và lúc render: tất cả
        # response của cùng một problem phải mang cùng một `timestamp`.
        #
        # Phải kết thúc bằng `Z`, KHÔNG phải `+00:00`. Cả hai đều là ISO 8601
        # hợp lệ, nhưng `StandardErrorEnvelope` ngay dưới (`:420`) và
        # `tests/test_status_codes_and_errors.py:215` đang kỳ vọng `Z`.
        # `isoformat()` mặc định trả `+00:00` ⇒ đổi format là **phá hợp đồng**
        # với client đang parse, mà RFC 9457 không yêu cầu điều đó.
        # Đây là regression do commit `59b459dd` gây ra, phát hiện khi audit
        # độc lập — bản đầu ghi sai "không regression" vì chỉ so 642 test của
        # `backend/tests/`, chưa từng chạy 2104 test trong `src/`.
        self.timestamp = datetime.now(dt_timezone.utc).isoformat().replace(
            '+00:00', 'Z')

    def to_dict(self) -> dict:
        payload: Dict[str, Any] = {
            'type': self.type,
            'title': self.title,
            'status': self.status,
            'detail': self.detail,
            'code': self.code,
            'request_id': self.request_id,
            # RFC 9457 §3.2 **cho phép** extension member: "Members not defined
            # by this specification MAY be present". `timestamp` là member mở
            # rộng, giữ lại vì envelope cũ đã phát ra nó và client đang đọc —
            # xem `tests/test_session_facts_api.py:258`. Bỏ đi sẽ phá hợp đồng
            # với client cũ; giữ thì vẫn chuẩn.
            'timestamp': self.timestamp,
        }
        if self.instance:
            payload['instance'] = self.instance
        if self.errors:
            payload['errors'] = self.errors
        if self.field_errors:
            payload['field_errors'] = self.field_errors
        return payload

    def to_response(self):
        """Trả DRF `Response` — dùng cho exception ném ra **bên trong view DRF**.

        **Vì sao vẫn là `Response` của DRF.** 12 test có sẵn trong repo đọc
        `resp.data` (vd `tests/test_session_facts_api.py:256`) — đó là API công
        khai của DRF mà code cũ đang dựa vào. Trả `JsonResponse` sẽ làm chúng
        hỏng với `AttributeError`. Giữ `Response` nghĩa là `APIView` vẫn
        `finalize_response` bình thường, CSRF exemption vẫn áp dụng.

        **Vấn đề phải xử lý: DRF ghi đè `Content-Type` lúc render.**
        `Response.rendered_content` luôn gán header theo renderer được
        content-negotiate, nên `application/problem+json` bị thay bằng
        `application/json` — R1 của API-01 coi như không đạt dù shape đúng.
        `ProblemResponse.rendered_content` bên dưới ép lại header sau khi
        renderer chạy, nên cả hai yêu cầu đều thoả: `.data` còn nguyên, header
        đúng.
        """
        response = ProblemResponse(self.to_dict(), status=self.status)
        # R3: để client đối chiếu body với log mà không phải parse lại `detail`.
        response['X-Request-ID'] = self.request_id
        return response

    def to_django_response(self):
        """Trả `HttpResponse` cho `handler400/403/404/500` cấp Django.

        Hai khác biệt so với `to_response()`, cả hai đều bắt buộc:

        1. **Không dùng DRF `Response`.** Handler cấp Django chạy ngoài
           `APIView.finalize_response`, nên `accepted_renderer` chưa được set và
           DRF sẽ ném `AssertionError: .accepted_renderer not set on Response` —
           tức lỗi 404 biến thành 500, đúng thứ `handler404` sinh ra để tránh.
        2. **Dùng `JsonResponse`, không `render()`.** Handler nằm ngoài template
           response nên không cần (và không được) render chậm.
        """
        from django.http import JsonResponse

        response = JsonResponse(self.to_dict(), status=self.status)
        # R1: `Content-Type` là **một phần của chuẩn**, không phải chi tiết
        # hình thức. Client phân biệt được lỗi nghiệp vụ với lỗi HTML của proxy
        # chính nhờ header này.
        response['Content-Type'] = PROBLEM_CONTENT_TYPE
        response['X-Request-ID'] = self.request_id
        return response


class ProblemResponse(Response):
    """DRF `Response` giữ nguyên `Content-Type` của RFC 9457 sau khi render.

    DRF chỉ gán `Content-Type` khi `accepted_renderer` có sẵn, nên override
    `rendered_content` là chỗ duy nhất ép được header **sau** khi renderer đã
    chạy mà vẫn giữ `.data` cho caller.

    **Phải là `property`, không phải method.** DRF khai `rendered_content` là
    `@property`; `Response.render()` gán thẳng `self._content =
    self.rendered_content`. Khai bằng method sẽ gán **object method** vào
    `_content`, khiến `response.content` rỗng — lỗi âm thầm, mọi test body đều
    đỏ với `JSONDecodeError: Expecting value: line 1 column 1`.
    """

    @property
    def rendered_content(self):
        rendered = super().rendered_content
        self['Content-Type'] = PROBLEM_CONTENT_TYPE
        return rendered


def _field_errors_from_detail(detail) -> Dict[str, list]:
    """Chuẩn hoá `exc.detail` của DRF về `{field: [message]}`.

    DRF cho phép `detail` là `str`, `list` hoặc `dict`. Trường hợp `dict`/`list`
    mang thông tin field mà `str(detail)` sẽ **bỏ mất** — và AC5 của LED-04 yêu
    cầu mọi lỗi phải nêu rõ field.
    """
    if isinstance(detail, dict):
        out = {}
        for field, messages in detail.items():
            if isinstance(messages, (str, bytes)):
                messages = [messages]
            out[str(field)] = [str(m) for m in messages]
        return out
    if isinstance(detail, list):
        return {'non_field_errors': [str(m) for m in detail]}
    return {}


def _errors_from_field_errors(field_errors: Dict[str, list]) -> list:
    """Chuyển `{field: [msg]}` → `[{field, code, message}]`."""
    out = []
    for field, messages in (field_errors or {}).items():
        if isinstance(messages, (str, bytes)):
            messages = [messages]
        for message in messages:
            out.append({
                'field': field,
                'code': 'invalid',
                'message': str(message),
            })
    return out


# ══════════════════════════════════════════════════════════════════
# Handler cấp Django — vì sao cần, và vì sao DRF handler không đủ
# ══════════════════════════════════════════════════════════════════
#
# `core_api_exception_handler` chỉ chạy cho exception **ném ra trong view DRF**.
# Ba trường hợp phổ biến nhất của hệ thống này xảy ra **trước khi** tới view:
#
#   1. URL không khớp        → Django `Resolver404` → trả **HTML**.
#   2. Method không khớp     → `PermissionDenied` ở tầng Django → HTML.
#   3. Exception trong middleware → `response_for_exception` → HTML/500.
#
# Đây chính là OW-01 ("~50 lỗi routing"), và là câu trả lời cho PB1 của API-01:
# "còn endpoint nào trả HTML lỗi không?". Trả lời: **có**, và không nằm trong DRF.
#
# Các handler dưới đây phải trả `problem+json`. Chúng nhận `request` là
# `HttpRequest` của Django (không phải `Request` của DRF) nên không dùng
# `request.data`/`request.META` kiểu DRF.

def _django_problem_response(request, *, code, status_code, detail):
    meta = getattr(request, 'META', {}) or {}
    request_id = (
        getattr(request, 'request_id', None)
        or meta.get('X_REQUEST_ID')
        or meta.get('HTTP_X_REQUEST_ID')
        or f'req_{uuid.uuid4().hex[:16]}'
    )
    problem = ProblemDetail(
        code=code, status_code=status_code, detail=detail,
        request_id=request_id, instance=getattr(request, 'path', None),
    )
    return problem.to_django_response()


def problem_404(request, exception=None):
    """404 — URL không khớp. Trả problem+json thay vì HTML.

    **Không** nêu "URL này không tồn tại" chi tiết hơn mức an toàn: đường dẫn
    đã có trong `instance` (đó là chính request), nói thêm gì chỉ giúp kẻ quét
    endpoint.
    """
    return _django_problem_response(
        request, code='not_found', status_code=status.HTTP_404_NOT_FOUND,
        detail='Không tìm thấy tài nguyên.',
    )


def problem_403(request, exception=None):
    """403 — Django từ chối (CSRF, quyền ở tầng Django)."""
    return _django_problem_response(
        request, code='permission_error',
        status_code=status.HTTP_403_FORBIDDEN,
        detail='Không có quyền thực hiện thao tác này.',
    )


def problem_400(request, exception=None):
    """400 — request lỗi ở tầng Django (vd. `DisallowedHost`)."""
    return _django_problem_response(
        request, code='validation_error', status_code=status.HTTP_400_BAD_REQUEST,
        detail='Yêu cầu không hợp lệ.',
    )


def problem_500(request):
    """500 — exception chưa xử lý ở tầng Django/middleware.

    Log **kèm `request_id`** để body trả về và log là một cặp — đây là câu trả
    lời cho PB2 của API-01 ("request_id có nối được tới log không?"), và cũng là
    lý do `detail` chỉ chứa mã tra cứu chứ không phải thông báo lỗi gốc.
    """
    meta = getattr(request, 'META', {}) or {}
    request_id = (
        getattr(request, 'request_id', None)
        or meta.get('X_REQUEST_ID')
        or meta.get('HTTP_X_REQUEST_ID')
        or f'req_{uuid.uuid4().hex[:16]}'
    )
    logger.exception(
        'Unhandled exception at Django layer (request_id=%s path=%s)',
        request_id, getattr(request, 'path', None),
    )
    # Defense-in-depth cho PB2: gắn `request_id` đã dùng để log lên `request`
    # trước khi dựng body, để hai chỗ **không thể** sinh khác nhau.
    #
    # **Thực tế ở HEAD:** bug này chưa xảy ra, vì
    # `ops_audit/middleware.py:27-28` đã gán `request.META['X_REQUEST_ID']` cho
    # mọi request — nên `problem_500` và `_django_problem_response` đều đọc ra
    # cùng một ID. Giữ lại dòng này vì nó biến "đang đúng **do may mắn**" thành
    # "đang đúng **do cấu trúc**": nếu middleware bị gỡ khỏi `MIDDLEWARE`, hoặc
    # handler được gọi ở đường đi qua nó, thì body vẫn khớp log.
    try:
        request.request_id = request_id
    except AttributeError:  # pragma: no cover - request bất biến thì bỏ qua
        pass
    return _django_problem_response(
        request, code='internal_error',
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail='Đã xảy ra lỗi không mong muốn. Mã để tra cứu trong log: '
               f'{request_id}',
    )



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


class UnprocessableEntityException(CoreAPIException):
    """422 — body đúng kiểu JSON nhưng nội dung không xử lý được được.

    **Vì sao cần lớp riêng.** LED-04 R6 yêu cầu lỗi tài chính trả `422` kèm
    `problem+json` nêu rõ field, nhưng bộ exception của repo **chưa có** 422 và
    DRF cũng không có (`rest_framework.exceptions` không định nghĩa lớp này).
    Không có lớp riêng thì "trả 422" chỉ có thể là `Response(..., status=422)`
    rải rác ở các view — và mỗi chỗ sẽ tự chế shape riêng, tức mất đúng thứ
    RFC 9457 đang chuẩn hoá.

    Phân biệt với 400: 400 là "tôi không hiểu yêu cầu"; 422 là "tôi hiểu, nhưng
    nội dung không thể xử lý" — ví dụ số lượng 150 không phải bội số của lô.
    """
    default_code = 'unprocessable_entity'
    default_status_code = status.HTTP_422_UNPROCESSABLE_ENTITY

    def __init__(self, detail=None, *, code=None, field_errors=None,
                 request_id=None, **kwargs):
        super().__init__(
            detail=detail or 'Nội dung yêu cầu không thể xử lý được.',
            code=code or self.default_code,
            field_errors=field_errors or {},
            request_id=request_id,
            **kwargs,
        )


class TimeoutException(CoreAPIException):
    """504 — yêu cầu vượt thời gian chờ phía server/nguồn dữ liệu.

    Khác 503: 503 nghĩa là "đang bận, thử lại"; 504 nghĩa là "ta đã chờ hết
    thời gian rồi". API-01 AC1 liệt kê cả hai là hai shape riêng.
    """
    default_code = 'timeout'
    default_status_code = status.HTTP_504_GATEWAY_TIMEOUT


def _request_id_for(request, meta) -> str:
    """`request_id` lấy từ request nếu có, không thì sinh.

    Ưu tiên `request.request_id` (do `ops_audit.middleware.RequestTraceMiddleware`
    gán) để **request_id trong body trùng request_id trong log** — đó là điều
    API-01 PB2 hỏi: "request_id có thật sự nối được tới log không?"
    """
    return (
        getattr(request, 'request_id', None)
        or meta.get('X_REQUEST_ID')
        or meta.get('HTTP_X_REQUEST_ID')
        or f'req_{uuid.uuid4().hex[:16]}'
    )


def core_api_exception_handler(exc: Exception, context: dict) -> Optional[Response]:
    """
    DRF exception handler trả **RFC 9457** `application/problem+json`.

    Args:
        exc: Exception raised by view
        context: Exception handler context (contains 'request', 'view', etc.)

    Returns:
        Response with problem+json, or None to use default handler
    """
    request = context.get('request')
    meta = getattr(request, 'META', None) or getattr(getattr(request, '_request', None), 'META', {})
    request_id = _request_id_for(request, meta)
    instance = getattr(request, 'path', None) or meta.get('PATH_INFO')

    def _problem(*, code, status_code, detail, field_errors=None, errors=None):
        return ProblemDetail(
            code=code, status_code=status_code, detail=detail,
            request_id=request_id, instance=instance,
            field_errors=field_errors, errors=errors,
        ).to_response()

    # Handle Core API exceptions
    if isinstance(exc, CoreAPIException):
        return _problem(
            code=exc.code, status_code=exc.status_code, detail=exc.detail,
            field_errors=exc.field_errors,
        )

    # Handle DRF ValidationError (from serializers)
    if isinstance(exc, ValidationError):
        field_errors = _field_errors_from_detail(exc.detail)
        return _problem(
            code='validation_error', status_code=status.HTTP_400_BAD_REQUEST,
            detail='Request validation failed.', field_errors=field_errors,
        )

    # Handle `Http404` / `PermissionDenied` của **Django** (không phải của DRF).
    #
    # `django.shortcuts.get_object_or_404` — dùng rất nhiều trong repo, vd
    # `identity_access/views_tenant.py:141` — ném `Http404`, mà `Http404` **không
    # phải** `APIException` của DRF. Handler cũ bỏ sót nhánh này nên exception đó
    # nổi lên tới `django.core.handlers.exception` và thành **500** thay vì 404:
    # `tests/test_identity_access.py:449` đang đòi 404. Tương tự,
    # `django.core.exceptions.PermissionDenied` cũng ra 500.
    #
    # Cần khai trước nhánh `APIException` bên dưới? Không — hai nhóm này rời nhau
    # (DRF định nghĩa `NotFound`/`PermissionDenied` riêng, không kế thừa hai lớp
    # Django này), nhưng đặt cạnh nhau để người đọc thấy đủ bốn nhóm.
    if isinstance(exc, Http404):
        return _problem(
            code='not_found', status_code=status.HTTP_404_NOT_FOUND,
            detail='Không tìm thấy tài nguyên.',
        )
    if isinstance(exc, DjangoPermissionDenied):
        return _problem(
            code='permission_error', status_code=status.HTTP_403_FORBIDDEN,
            detail='Không đủ quyền.',
        )

    # Handle standard DRF exceptions (AuthenticationFailed, PermissionDenied, etc.)
    if isinstance(exc, APIException):
        status_code = exc.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR
        code_map = {
            status.HTTP_401_UNAUTHORIZED: 'authentication_error',
            status.HTTP_403_FORBIDDEN: 'permission_error',
            status.HTTP_404_NOT_FOUND: 'not_found',
            status.HTTP_405_METHOD_NOT_ALLOWED: 'method_not_allowed',
            status.HTTP_409_CONFLICT: 'conflict',
            status.HTTP_429_TOO_MANY_REQUESTS: 'rate_limit_exceeded',
            status.HTTP_400_BAD_REQUEST: 'validation_error',
            status.HTTP_500_INTERNAL_SERVER_ERROR: 'internal_error',
            status.HTTP_503_SERVICE_UNAVAILABLE: 'service_unavailable',
        }
        code = code_map.get(status_code, 'api_error')
        # `APIException` cũng có thể mang `detail` dạng dict/list (serializer
        # hoặc view tự đưa vào). Bỏ qua cấu trúc đó sẽ làm mất thông tin field —
        # và AC5 của LED-04 yêu cầu mọi lỗi phải nêu rõ field. Vì vậy chuẩn hoá
        # về `field_errors` trước khi dựng problem.
        field_errors = _field_errors_from_detail(exc.detail)
        return _problem(
            code=code, status_code=status_code,
            detail='Request validation failed.' if field_errors
            else str(exc.detail),
            field_errors=field_errors,
        )

    # ── Lỗi chưa xử lý ───────────────────────────────────────────────
    # Bản cũ `return None` ở đây ⇒ DRF trả 500 **mặc định của mình**, thường là
    # HTML kèm traceback khi DEBUG, hoặc JSON trần không có `code`/`request_id`.
    # Cả hai đều vi phạm RFC 9457 (AC1 cần shape 500) và R5 (không lộ stack
    # trace). Nay tự xử lý: **log kèm `request_id`**, trả problem tối thiểu.
    logger.exception(
        'Unhandled exception (request_id=%s path=%s): %s',
        request_id, instance, exc,
    )
    return _problem(
        code='internal_error',
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        # R5: KHÔNG đưa `str(exc)` vào response. Nội dung exception có thể chứa
        # tên bảng, đường dẫn file, hoặc dữ liệu người dùng. Chi tiết nằm ở
        # log, khớp theo `request_id`.
        detail='Đã xảy ra lỗi không mong muốn. Mã để tra cứu trong log: '
               f'{request_id}',
    )
