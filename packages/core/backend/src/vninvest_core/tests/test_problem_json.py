"""
API-01 — RFC 9457 `application/problem+json`.

AC1 của API-01: **10 loại lỗi khác nhau đều đúng shape** — validation · 401 ·
403 · 404 · 409 · 422 · 429 · 500 · 503 · timeout.

AC2: validate bằng schema RFC 9457. Không cài thêm dependency (quy tắc repo:
không tự thêm dep) nên bộ kiểm schema được viết tay từ §3.1 của RFC 9457 —
mỗi thành viên bắt buộc kiểm đúng kiểu và ràng buộc của nó.

AC3: 500 không lộ traceback.
AC4: `request_id` trong body khớp header.

PB1: còn endpoint nào trả HTML lỗi không? → `DjangoLayerHtmlTests`.
PB2: `request_id` có nối được tới log không? → `RequestIdReachesTheLogTests`.
"""
from __future__ import annotations

import json

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from vninvest_core.exceptions import (
    PROBLEM_CONTENT_TYPE,
    ConflictErrorException,
    NotFoundErrorException,
    PermissionErrorException,
    ProblemDetail,
    ProblemTypes,
    ServiceUnavailableException,
    TimeoutException,
    UnprocessableEntityException,
    problem_400,
    problem_403,
    problem_404,
    problem_500,
)

# Django chỉ tìm `handler400/403/404/500` trong **ROOT_URLCONF đang dùng**, mà
# `@override_settings(ROOT_URLCONF=__name__)` trỏ về chính file test này. Không
# import 4 handler vào đây thì Django rơi về handler mặc định (HTML) — tức test
# sẽ xanh vì đang kiểm tra nhầm thứ. Gán tường minh ở đây để test đo đúng.
handler400 = problem_400
handler403 = problem_403
handler404 = problem_404
handler500 = problem_500

# ── Bộ kiểm schema RFC 9457 §3.1, viết tay thay vì thêm dependency ──────
# Thành viên bắt buộc: type, title, status, detail, instance.
# - `type` PHẢI là URI (absolute, hoặc `about:blank`).
# - `title` PHẢI là chuỗi khác rỗng.
# - `status` PHẢI là số nguyên 100..599.
# - `detail` PHẢI là chuỗi.
# - Thành viên mở rộng: mọi tên khác được phép.
REQUIRED_MEMBERS = ('type', 'title', 'status', 'detail')


def assert_valid_problem(testcase, body, *, expected_status=None):
    """AC2: kiểm body theo RFC 9457 §3.1. Trả body để test dùng tiếp."""
    for member in REQUIRED_MEMBERS:
        testcase.assertIn(member, body, f'thiếu thành viên bắt buộc: {member}')

    type_uri = body['type']
    testcase.assertIsInstance(type_uri, str)
    testcase.assertTrue(
        type_uri == 'about:blank' or type_uri.startswith(('http://', 'https://')),
        f'`type` phải là URI hoặc about:blank, nhận {type_uri!r}',
    )
    testcase.assertIsInstance(body['title'], str)
    testcase.assertTrue(body['title'].strip(), '`title` không được rỗng')
    testcase.assertIsInstance(body['status'], int)
    testcase.assertTrue(100 <= body['status'] <= 599,
                        f'`status` ngoài khoảng hợp lệ: {body["status"]}')
    testcase.assertIsInstance(body['detail'], str)

    if expected_status is not None:
        testcase.assertEqual(body['status'], expected_status,
                             '`status` trong body phải khớp HTTP status')
    return body


def _problem_of(response):
    return json.loads(response.content.decode('utf-8'))


# ══════════════════════════════════════════════════════════════════
# 10 loại lỗi — AC1
# ══════════════════════════════════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([])
def _boom(request):
    raise RuntimeError('chi tiết nội bộ: bảng user_workspace_ledgerentry, '
                       'file C:/secret/path.py')


@api_view(['GET', 'POST'])
@permission_classes([])
def _not_found(request):
    raise NotFoundErrorException(detail='Không có danh mục đó.')


@api_view(['GET', 'POST'])
@permission_classes([])
def _conflict(request):
    raise ConflictErrorException(detail='Key đã dùng cho lệnh khác.')


@api_view(['GET', 'POST'])
@permission_classes([])
def _forbidden(request):
    raise PermissionErrorException(detail='Không đủ quyền.')


@api_view(['GET', 'POST'])
@permission_classes([])
def _validation_error(request):
    """400 — `ValidationError` của DRF (từ serializer)."""
    from rest_framework.exceptions import ValidationError

    raise ValidationError({'quantity': ['Số lượng phải là bội số của 100.']})


@api_view(['GET', 'POST'])
@permission_classes([])
def _unauthorized(request):
    """401 — `NotAuthenticated` của DRF."""
    from rest_framework.exceptions import NotAuthenticated

    raise NotAuthenticated()


@api_view(['GET', 'POST'])
@permission_classes([])
def _unprocessable(request):
    # Dùng `UnprocessableEntityException` của repo chứ không phải
    # `rest_framework.exceptions.UnprocessableEntity` — DRF **không định nghĩa**
    # lớp đó (đã kiểm: `dir()` không có mục nào chứa "nprocess"). Trước khi thêm
    # lớp riêng vào `vninvest_core.exceptions`, lệnh này ném `ImportError` và
    # biến thành 500 — tức một AC của API-01 đỏ vì lý do không liên quan.
    raise UnprocessableEntityException(
        detail='Số lượng không hợp lệ với quy định lô.',
        field_errors={'quantity': ['Số lượng phải là bội số của 100.']},
    )


@api_view(['GET', 'POST'])
@permission_classes([])
def _throttled(request):
    from rest_framework.exceptions import Throttled

    raise Throttled(wait=60)


@api_view(['GET', 'POST'])
@permission_classes([])
def _service_unavailable(request):
    raise ServiceUnavailableException(detail='Kill-switch đang bật.')


@api_view(['GET', 'POST'])
@permission_classes([])
def _timeout(request):
    raise TimeoutException(detail='Yêu cầu vượt thời gian chờ.')


@api_view(['GET', 'POST'])
@permission_classes([])
def _ok(request):
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([])
def _get_only(request):
    """Chỉ nhận GET — dùng để sinh 405 ở tầng Django."""
    return Response({'ok': True})


def _django_boom(request):
    """View Django **thuần** (không phải DRF) ném lỗi — chạm `handler500`.

    Cần một view không qua DRF vì `core_api_exception_handler` chỉ bắt exception
    trong view DRF. Đây chính là nhóm lỗi mà `handler500` sinh ra để xử lý, và
    là nơi `request_id` từng bị sinh **hai lần** (một cho log, một cho body).
    """
    raise RuntimeError('lỗi chưa xử lý ở tầng Django')


urlpatterns = [
    path('probe/ok', _ok),
    path('probe/get-only', _get_only),
    path('probe/validation', _validation_error),
    path('probe/unauthorized', _unauthorized),
    path('probe/boom', _boom),
    path('probe/django-boom', _django_boom),
    path('probe/notfound', _not_found),
    path('probe/conflict', _conflict),
    path('probe/forbidden', _forbidden),
    path('probe/unprocessable', _unprocessable),
    path('probe/throttled', _throttled),
    path('probe/unavailable', _service_unavailable),
    path('probe/timeout', _timeout),
]


@override_settings(ROOT_URLCONF=__name__, DEBUG=False)
class AllTenErrorShapesTests(TestCase):
    """AC1: 10 loại lỗi, 10 shape giống nhau."""

    def setUp(self):
        self.client = APIClient()

    def _assert_problem(self, url, expected_status):
        response = self.client.get(url)
        self.assertEqual(response.status_code, expected_status, response.content)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response),
                                    expected_status=expected_status)
        self.assertEqual(response['X-Request-ID'], body['request_id'],
                         'AC4: header phải khớp body')
        return body

    def test_01_validation_400(self):
        body = self._assert_problem('/probe/validation', 400)
        self.assertEqual(body['code'], 'validation_error')

    def test_02_unprocessable_422(self):
        body = self._assert_problem('/probe/unprocessable', 422)
        self.assertTrue(body['errors'], '422 phải nêu field sai (AC5 của LED-04)')
        self.assertEqual(body['errors'][0]['field'], 'quantity')

    def test_03_unauthorized_401(self):
        self._assert_problem('/probe/unauthorized', 401)

    def test_04_forbidden_403(self):
        body = self._assert_problem('/probe/forbidden', 403)
        self.assertEqual(body['code'], 'permission_error')

    def test_05_not_found_404(self):
        body = self._assert_problem('/probe/notfound', 404)
        self.assertEqual(body['code'], 'not_found')

    def test_06_conflict_409(self):
        body = self._assert_problem('/probe/conflict', 409)
        self.assertEqual(body['code'], 'conflict')

    def test_07_rate_limit_429(self):
        self._assert_problem('/probe/throttled', 429)

    def test_08_internal_500(self):
        body = self._assert_problem('/probe/boom', 500)
        self.assertEqual(body['code'], 'internal_error')

    def test_09_service_unavailable_503(self):
        body = self._assert_problem('/probe/unavailable', 503)
        self.assertEqual(body['code'], 'service_unavailable')

    def test_10_timeout_504(self):
        body = self._assert_problem('/probe/timeout', 504)
        self.assertEqual(body['code'], 'timeout')

    # ── AC3 + R5 ────────────────────────────────────────────────────

    def test_500_does_not_leak_a_traceback_or_internal_paths(self):
        response = self.client.get('/probe/boom')
        text = response.content.decode('utf-8')
        for leak in ('Traceback', 'RuntimeError', 'user_workspace_ledgerentry',
                     'C:/secret/path.py', 'File "'):
            self.assertNotIn(leak, text, f'500 lộ chi tiết nội bộ: {leak!r}')

    def test_500_detail_carries_the_lookup_id(self):
        """Client cần một thứ **hành động được** để báo lỗi. Mã tra cứu là
        thứ đó — và nó phải trùng với cái trong log (kiểm ở PB2)."""
        body = _problem_of(self.client.get('/probe/boom'))
        self.assertIn(body['request_id'], body['detail'])

    def test_500_never_falls_back_to_drf_default(self):
        """`assert_valid_problem` đã đủ để bắt: nếu handler trả None, DRF trả
        500 mặc định và `type`/`title` sẽ thiếu. Test này nêu rõ ý nghĩa."""
        body = _problem_of(self.client.get('/probe/boom'))
        for member in ('type', 'title', 'status', 'detail', 'code', 'request_id'):
            self.assertIn(member, body)

    def test_every_error_uses_the_same_content_type(self):
        for url in ('/probe/boom', '/probe/notfound', '/probe/conflict',
                    '/probe/unavailable', '/probe/timeout'):
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url)['Content-Type'], PROBLEM_CONTENT_TYPE)


# ══════════════════════════════════════════════════════════════════
# PB1 — lỗi tầng Django KHÔNG được trả HTML
# ══════════════════════════════════════════════════════════════════


@override_settings(ROOT_URLCONF=__name__, DEBUG=False)
class DjangoLayerHtmlTests(TestCase):
    """OW-01 ghi "~50 lỗi routing" — URL không khớp trả HTML.

    Đây là lý do `core_api_exception_handler` của DRF không đủ: nó chỉ chạy
    cho exception **trong view DRF**. Test dùng `Client` (Django thuần) để
    đi đúng đường đó.
    """

    def setUp(self):
        self.client = Client()

    def test_unknown_url_returns_problem_json_not_html(self):
        response = self.client.get('/khong-ton-tai-abcxyz')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response), expected_status=404)
        self.assertEqual(body['code'], 'not_found')

    def test_method_not_allowed_returns_problem_json(self):
        # `/probe/get-only` chỉ nhận GET ⇒ POST phải ra 405 ở **tầng Django**,
        # không phải 405 của DRF. Đó mới đúng là trường hợp OW-01 mô tả.
        response = self.client.post('/probe/get-only')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response), expected_status=405)
        self.assertEqual(body['code'], 'method_not_allowed')

    def test_html_would_have_contained_doctype(self):
        """Negative check: nếu handler không chạy, body có `<!DOCTYPE html>`.
        Test này chỉ để ghi rõ sự khác biệt — không dùng làm tiêu chí."""
        response = self.client.get('/khong-ton-tai-abcxyz')
        self.assertNotIn('<!DOCTYPE html>', response.content.decode('utf-8'))


# ══════════════════════════════════════════════════════════════════
# R1 trên **URLconf thật** — chỗ mà trước đó không test nào chạm tới
# ══════════════════════════════════════════════════════════════════
#
# Ba class trên đều `@override_settings(ROOT_URLCONF=__name__)`, tức dùng
# URLconf riêng của file test. Điều đó **giấu** bug thật trong
# `vninvest_core/urls.py`: handler ở đó từng được gán bằng **chuỗi**
# (`handler404 = 'vninvest_core.exceptions.problem_404'`). Django đọc
# `handler404` như thuộc tính module rồi gọi — nên với chuỗi, mọi URL lạ vẫn
# trả **HTML**, trong khi test vẫn xanh vì đang chạy URLconf riêng.
#
# Vì vậy phải có class dùng `ROOT_URLCONF` thật (không override).


@override_settings(DEBUG=False)
class RealRootUrlconfProblemTests(TestCase):
    """R1/PB1 trên `vninvest_core/urls.py` thật — đóng lỗ "test xanh, prod HTML"."""

    def setUp(self):
        self.client = Client()

    def test_root_urlconf_wires_callable_handlers(self):
        """`handler*` phải là **callable**. Chuỗi sẽ khiến Django rơi về
        handler mặc định (HTML) mà không báo lỗi lúc import."""
        from django.urls import get_resolver

        resolver = get_resolver()
        for name in ('handler400', 'handler403', 'handler404', 'handler500'):
            with self.subTest(handler=name):
                handler = getattr(resolver.urlconf_module, name, None)
                self.assertTrue(
                    callable(handler),
                    f'{name} phải là callable, nhận được {type(handler).__name__}',
                )

    def test_unknown_url_through_real_urlconf_is_problem_json(self):
        response = self.client.get('/khong-ton-tai-that-roi-xyz')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response), expected_status=404)
        self.assertEqual(body['code'], 'not_found')

    def test_unmatched_api_path_stops_at_catch_all_but_still_problem_json(self):
        """`api/<path:remaining>` là catch-all **có chủ đích** (proxy legacy), nên
        `/api/khong-ton-tai` **không** ra 404 mà đi vào proxy.

        R1 nói "mọi lỗi API", và đây chính là chỗ mọi URL lạ dừng lại — nên lỗi
        của proxy cũng phải là `problem+json`, không được là JSON trần kiểu cũ.
        """
        response = self.client.get('/api/khong-ton-tai-that-roi-xyz')
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response))
        # `code` cũ phải còn nguyên: 5 file test của repo đang assert nó.
        self.assertEqual(body['code'], 'LEGACY_BACKEND_NOT_CONFIGURED')
        self.assertIn('detail', body)


# ══════════════════════════════════════════════════════════════════
# PB2 — request_id có nối được tới log không
# ══════════════════════════════════════════════════════════════════


@override_settings(ROOT_URLCONF=__name__, DEBUG=False)
class RequestIdReachesTheLogTests(TestCase):
    """API-01 PB2: "`request_id` có thật sự nối được tới log không?"

    Trả lời bằng cách bắt log thật rồi so `request_id` trong **record log** với
    `request_id` trong **body response**. Nếu hai cái khác nhau thì `request_id`
    trong body chỉ là trang trí.
    """

    def test_500_logs_the_same_request_id_that_the_client_receives(self):
        client = APIClient()
        with self.assertLogs('vninvest_core.exceptions', level='ERROR') as captured:
            response = client.get('/probe/boom')
        body = _problem_of(response)
        joined = '\n'.join(captured.output)
        self.assertIn(
            body['request_id'], joined,
            'log không chứa request_id mà client nhận được ⇒ tra cứu bằng mã đó vô nghĩa',
        )

    def test_client_supplied_request_id_is_echoed_everywhere(self):
        client = APIClient()
        given = 'req_client_supplied_123'
        with self.assertLogs('vninvest_core.exceptions', level='ERROR') as captured:
            response = client.get('/probe/boom', HTTP_X_REQUEST_ID=given)
        self.assertEqual(_problem_of(response)['request_id'], given)
        self.assertEqual(response['X-Request-ID'], given)
        self.assertIn(given, '\n'.join(captured.output))

    def test_django_500_without_client_header_still_matches_its_own_log(self):
        """PB2 ở **tầng Django** (`handler500`), không gửi `X-Request-ID`.

        Hai test PB2 kia đều đi qua DRF hoặc tự gửi header, nên chúng **không**
        chạm nhánh `handler500` — nơi `request_id` được tạo ở hai chỗ riêng biệt
        (một cho log, một cho body).

        Ở HEAD hai chỗ đó vẫn khớp, nhưng nhờ `ops_audit/middleware.py:27-28` gán
        sẵn `request.META['X_REQUEST_ID']`, **không** nhờ cấu trúc của handler.
        Test này giữ nguyên yêu cầu đó và sẽ đỏ nếu middleware ngừng gán ID.
        """
        client = Client(raise_request_exception=False)
        with self.assertLogs('vninvest_core.exceptions', level='ERROR') as captured:
            response = client.get('/probe/django-boom')
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = _problem_of(response)
        self.assertEqual(response['X-Request-ID'], body['request_id'])
        self.assertIn(
            body['request_id'], '\n'.join(captured.output),
            'request_id trong body khác ID trong log ⇒ PB2 hỏng',
        )

    def test_django_500_does_not_leak_the_traceback(self):
        """AC3: 500 không lộ stack trace."""
        client = Client(raise_request_exception=False)
        response = client.get('/probe/django-boom')
        text = response.content.decode('utf-8')
        self.assertNotIn('Traceback', text)
        self.assertNotIn('RuntimeError', text)
        self.assertNotIn('django_boom', text)


# ══════════════════════════════════════════════════════════════════
# Shape của problem document
# ══════════════════════════════════════════════════════════════════


class ProblemDetailUnitTests(TestCase):
    def test_type_is_a_real_uri_for_known_codes(self):
        problem = ProblemDetail(
            code='idempotency_key_conflict', status_code=409, detail='x',
            request_id='req_1')
        self.assertTrue(problem.type.startswith('https://'))
        self.assertIn('idempotency_key_conflict', problem.type)

    def test_unknown_code_falls_back_to_about_blank(self):
        """RFC 9457: không có type URI phù hợp thì dùng `about:blank`. Bịa một
        URI cho lỗi lạ sẽ hứa rằng có tài liệu mà không có."""
        problem = ProblemDetail(
            code='loi_cha_biet', status_code=418, detail='x', request_id='req_1')
        self.assertEqual(problem.type, 'about:blank')
        self.assertTrue(problem.title)

    def test_title_is_constant_per_type_not_the_detail(self):
        """RFC 9457 §3.1.2: `title` là câu tóm tắt, không phải thông báo cụ
        thể. Trộn hai thứ khiến `title` biến thành chuỗi mà client không dùng
        được."""
        a = ProblemDetail(code='not_found', status_code=404,
                          detail='Không có danh mục số 7.', request_id='r1')
        b = ProblemDetail(code='not_found', status_code=404,
                          detail='Route /xyz không tồn tại.', request_id='r2')
        self.assertEqual(a.title, b.title)
        self.assertNotEqual(a.detail, b.detail)

    def test_field_errors_become_an_errors_array(self):
        problem = ProblemDetail(
            code='validation_error', status_code=400, detail='x',
            request_id='r1',
            field_errors={'quantity': ['phải là bội số của 100']})
        self.assertEqual(
            problem.errors,
            [{'field': 'quantity', 'code': 'invalid',
              'message': 'phải là bội số của 100'}],
        )

    def test_legacy_members_survive_for_existing_consumers(self):
        """D-10 giữ shape 1 release: `code` và `field_errors` phải còn, vì FE
        hiện đang đọc chúng bằng tên."""
        problem = ProblemDetail(
            code='validation_error', status_code=400, detail='x',
            request_id='r1', field_errors={'a': ['b']})
        payload = problem.to_dict()
        self.assertEqual(payload['code'], 'validation_error')
        self.assertEqual(payload['field_errors'], {'a': ['b']})
        self.assertIn('errors', payload)

    def test_instance_is_included_when_known(self):
        problem = ProblemDetail(code='not_found', status_code=404, detail='x',
                                request_id='r1', instance='/core/v1/nope')
        self.assertEqual(problem.to_dict()['instance'], '/core/v1/nope')

    def test_status_matches_http_status_on_the_response(self):
        problem = ProblemDetail(code='conflict', status_code=409, detail='x',
                                request_id='r1')
        self.assertEqual(problem.to_response().status_code, 409)

    def test_resolve_is_total(self):
        """Mọi status đều có `title`; không có ngoại lệ nào lọt ra ngoài."""
        for code, (status_code, _title) in ProblemTypes._TABLE.items():
            with self.subTest(code=code):
                uri, title = ProblemTypes.resolve(code, status_code)
                self.assertTrue(uri and title)


# ══════════════════════════════════════════════════════════════════
# Tích hợp: endpoint thật của portfolio
# ══════════════════════════════════════════════════════════════════


class RealPortfolioEndpointTests(TestCase):
    """RFC 9457 phải đúng trên endpoint thật, không chỉ trên view giả."""

    def setUp(self):
        self.owner = User.objects.create_user(username='rfc-owner', password='x')
        self.tenant = CoreTenant.objects.create(
            tenant_code='rfc-tenant', display_name='rfc', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE)
        self.client = APIClient()
        self.client.force_login(self.owner)
        self.client.defaults['HTTP_X_TENANT_ID'] = self.tenant.public_id

    def test_missing_portfolio_returns_problem_json(self):
        response = self.client.get('/core/v1/portfolio/portfolios/999999/holdings/')
        self.assertIn(response.status_code, (403, 404), response.content)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response))
        self.assertEqual(body['status'], response.status_code)

    def test_order_without_idempotency_key_is_a_400_problem(self):
        response = self.client.post(
            '/core/v1/broker/dnse/place-order/',
            {'market_type': 'STOCK', 'order_category': 'NORMAL', 'mode': 'paper',
             'trading_token': 'T', 'payload': {'account_no': 'A', 'symbol': 'VNM',
                                              'side': 'BUY', 'price': 1,
                                              'quantity': 100}},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response['Content-Type'], PROBLEM_CONTENT_TYPE)
        body = assert_valid_problem(self, _problem_of(response), expected_status=400)
        self.assertEqual(body['code'], 'idempotency_key_required')
        self.assertTrue(body['type'].endswith('idempotency_key_required'))
