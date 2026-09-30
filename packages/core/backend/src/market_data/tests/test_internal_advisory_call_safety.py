"""B0 — chặn việc server **tự thay record AI bằng record khác** trong im lặng.

Bối cảnh
--------
`stock_mgmt_native_views.py` có 2 `APIView` tự gọi chính
`AdvisoryRefreshView.as_view()(...)` rồi đọc `Response.data`:

    StockManagementAIAdvisorySessionView.post        :2764 -> :2768
    StockManagementAIAdvisoryComponentsGenerateView.post  :2913 -> :2916

Cả hai đều làm:

    advisory_id = refresh_response.data.get('advisory_id')      # :2768
    record = ....filter(advisory_id=advisory_id...).first() if advisory_id else None
    if record is None:
        record = _latest_ai_record(user, symbol)                # :2771  ← thay thế

`_latest_ai_record` (`:2317-2321`) **không dùng `advisory_id`**: nó lọc
`session_date__lte` rồi `order_by('-created_at').first()`. Nên nếu
`advisory_id` không resolve được, hai chỗ này **âm thầm trả phiên khác** —
và `status_code` không đổi nên không có lỗi, không có log.

Kịch bản B0 chặn: `advisory_id` **không** phải lý do để đổi record.

Test ở đây viết cho hành vi **đúng**, không viết cho hành vi hiện tại.
"""

import uuid
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from advisory.models import AdvisoryRecord
from market_data.stock_mgmt_native_views import (
    StockManagementAIAdvisorySessionView,
    _advisory_field,
    _resolve_refreshed_advisory,
)

User = get_user_model()


class _FakeRefreshResponse:
    """Thay thế `Response` của DRF — chỉ cần những gì 2 call site dùng."""

    def __init__(self, data, status_code=200):
        self.data = data
        self.status_code = status_code


class AdvisoryFieldShapeTests(TestCase):
    """`_advisory_field` phải đọc được cả hai hình dạng envelope."""

    def test_reads_flat_payload(self):
        resp = _FakeRefreshResponse({'advisory_id': 'abc', 'task_id': 't1'})
        self.assertEqual(_advisory_field(resp, 'advisory_id'), 'abc')
        self.assertEqual(_advisory_field(resp, 'task_id'), 't1')

    def test_reads_wrapped_payload(self):
        """Nếu sau này bọc `{data: {...}}`, chỗ này **không** được hỏng.

        Đây là lý do hàm tồn tại: hiện tại hai call site đọc thẳng
        `refresh_response.data.get(...)`, nên đổi hình dạng envelope là
        chúng ra `None` — và `None` lại kích hoạt fallback im lặng ở trên.
        """
        resp = _FakeRefreshResponse({'data': {'advisory_id': 'abc', 'task_id': 't1'}})
        self.assertEqual(_advisory_field(resp, 'advisory_id'), 'abc')
        self.assertEqual(_advisory_field(resp, 'task_id'), 't1')

    def test_missing_field_is_none_not_empty_dict(self):
        resp = _FakeRefreshResponse({'data': {'advisory_id': 'abc'}})
        self.assertIsNone(_advisory_field(resp, 'task_id'))

    def test_non_dict_payload_is_safe(self):
        self.assertIsNone(_advisory_field(_FakeRefreshResponse(None), 'advisory_id'))
        self.assertIsNone(_advisory_field(_FakeRefreshResponse([]), 'advisory_id'))


class ResolveRefreshedAdvisoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='b0user', password='x')
        factory = APIRequestFactory()
        self.request = factory.post('/x/')
        force_authenticate(self.request, user=self.user)
        self.request.user = self.user
        self.symbol = 'VNM'

    def _record(self, session_date, suffix):
        return AdvisoryRecord.objects.create(
            user=self.user, symbol=self.symbol,
            advisory_id=uuid.uuid4(),
            session_date=session_date,
            advisory_text=f'khuyen nghi {suffix}',
        )

    def test_resolves_the_exact_advisory_named_by_refresh(self):
        target = self._record(date(2026, 5, 10), 'dung')
        resp = _FakeRefreshResponse({'advisory_id': str(target.advisory_id)})

        record, advisory_id = _resolve_refreshed_advisory(
            resp, user=self.user, symbol=self.symbol)

        self.assertEqual(advisory_id, str(target.advisory_id))
        self.assertEqual(record.pk, target.pk)

    def test_returns_none_without_inventing_a_substitute(self):
        """Refresh trỏ `advisory_id` không tồn tại ⇒ phải trả `None`.

        KHÔNG được trả record khác. Đây là toàn bộ điều B0 chặn.
        """
        self._record(date(2026, 5, 10), 'khac')
        resp = _FakeRefreshResponse({'advisory_id': str(uuid.uuid4())})

        record, advisory_id = _resolve_refreshed_advisory(
            resp, user=self.user, symbol=self.symbol)

        self.assertIsNotNone(advisory_id, 'phải báo lại advisory_id để caller biết')
        self.assertIsNone(record, 'tuyệt đối không được thay bằng record khác')

    def test_refresh_without_advisory_id_yields_no_claim(self):
        """Không có `advisory_id` thì không được khẳng định là đã biết phiên nào."""
        resp = _FakeRefreshResponse({'message': 'da queue'})

        record, advisory_id = _resolve_refreshed_advisory(
            resp, user=self.user, symbol=self.symbol)

        self.assertIsNone(record)
        self.assertIsNone(advisory_id)

    def test_never_crosses_user_boundary(self):
        """Record của user khác phải không bao giờ được trả về."""
        other = User.objects.create_user(username='b0other', password='x')
        foreign = AdvisoryRecord.objects.create(
            user=other, symbol=self.symbol, advisory_id=uuid.uuid4(),
            session_date=date(2026, 5, 10), advisory_text='cua nguoi khac')
        resp = _FakeRefreshResponse({'advisory_id': str(foreign.advisory_id)})

        record, _ = _resolve_refreshed_advisory(
            resp, user=self.user, symbol=self.symbol)

        self.assertIsNone(record, 'leak cross-user')


class SessionViewMustNotSubstituteTests(TestCase):
    """Bọc ở tầng view: `advisory_id` mất không được đổi thành phiên khác."""

    def setUp(self):
        self.user = User.objects.create_user(username='b0view', password='x')
        factory = APIRequestFactory()
        self.request = factory.post('/x/', {'symbol': 'VNM'}, format='json')
        force_authenticate(self.request, user=self.user)
        self.request.user = self.user

    def test_view_returns_error_instead_of_serving_another_session(self):
        """Refresh trỏ `advisory_id` **không tồn tại** ⇒ view phải trả lỗi.

        Kịch bản này là tai nạn thật: advisory vừa tạo chưa kịp commit, hoặc
        transaction chưa flush. Hành vi cũ rơi xuống `_latest_ai_record` và
        âm thầm phục vụ phiên cũ với `status_code` 2xx — không có lỗi, không
        có log.

        Không dùng `assertRaises`: gọi qua `as_view()(...)` thì DRF `dispatch()`
        **bắt** `APIException` và dựng thành `Response` chứ không ném ra ngoài.
        Nên tiêu chí đúng là: response phải là **lỗi**, không phải 2xx.
        """
        old = AdvisoryRecord.objects.create(
            user=self.user, symbol='VNM', advisory_id=uuid.uuid4(),
            session_date=date(2026, 5, 10), advisory_text='PHIEN CU')
        ghost = uuid.uuid4()
        resp = _FakeRefreshResponse(
            {'advisory_id': str(ghost), 'task_id': 't9'}, status_code=201)

        from unittest.mock import MagicMock, patch
        inner = MagicMock(return_value=resp)
        as_view = MagicMock(return_value=inner)
        with patch('advisory.views.AdvisoryRefreshView.as_view', as_view):
            out = StockManagementAIAdvisorySessionView.as_view()(
                self.request, symbol='VNM')

        self.assertTrue(
            as_view.called,
            'mock AdvisoryRefreshView.as_view không được gọi — test đang '
            'chạy code thật nên kết luận về nó là vô nghĩa')

        self.assertGreaterEqual(
            out.status_code, 400,
            f'phải trả lỗi, không được phục vụ 2xx; body={out.data!r}')
        self.assertEqual(out.data.get('code'), 'advisory_refresh_unresolvable')
        # Tuyệt đối không được lộ nội dung của phiên cũ.
        self.assertNotIn(old.advisory_text, str(out.data))

    def test_view_serves_the_record_named_by_refresh(self):
        """Happy path: resolve được thì phải trả **đúng** record đó."""
        target = AdvisoryRecord.objects.create(
            user=self.user, symbol='VNM', advisory_id=uuid.uuid4(),
            session_date=date(2026, 5, 10), advisory_text='PHIEN DUNG')
        newer = AdvisoryRecord.objects.create(
            user=self.user, symbol='VNM', advisory_id=uuid.uuid4(),
            session_date=date(2026, 5, 20), advisory_text='PHIEN MOI HON')

        resp = _FakeRefreshResponse(
            {'advisory_id': str(target.advisory_id), 'task_id': 't9'},
            status_code=201)

        from unittest.mock import MagicMock, patch
        inner = MagicMock(return_value=resp)
        as_view = MagicMock(return_value=inner)
        with patch('advisory.views.AdvisoryRefreshView.as_view', as_view):
            out = StockManagementAIAdvisorySessionView.as_view()(
                self.request, symbol='VNM')

        self.assertTrue(as_view.called)
        self.assertEqual(out.status_code, 201)
        body = str(out.data)
        self.assertIn('t9', body, 'task_id phải đọc được qua mọi hình dạng envelope')
        self.assertNotIn(newer.advisory_text, body,
                         'phải phục vụ đúng phiên refresh chỉ định, không phải phiên mới hơn')
