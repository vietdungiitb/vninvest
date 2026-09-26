"""PA-1 order safety — regression + contract tests cho DNSE write endpoints.

Chạy: python manage.py test user_workspace.test_order_safety

Mỗi test gắn 1 finding đã verify từ source (audit
`docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1 P0-SAFETY-01):

  SAFE-01  order không fail-closed — thiếu `dry_run`/`mode` mặc định LIVE
  X.1      `_validate_order_payload` chỉ đọc `volume`, cả 2 caller FE gửi
           `quantity` (`DNSEConnectionPanel.js:216`, `AdvisoryOrderTicket.js:51`)
           ⇒ mọi lệnh từ UI trả HTTP 400
  X.2      `action='broker.place_order'` (18 ký tự) vượt `AuditEvent.action`
           `max_length=16` (`ops_audit/models.py:25`) ⇒ `DataError` bị
           `except Exception` nuốt ⇒ KHÔNG còn dòng audit nào cho order
  X.3      `market_type` không allowlist ⇒ `FUND` + `volume:1` bypass lô 100
           và giá trị thô đi thẳng xuống broker
  X.4      `order_category` nhận và truyền thẳng, không validate
  X.5      `str(exc)` rò ra response ở `send-email-otp` + `create-trading-token`
  X.6      TOCTOU — validate bản `symbol` đã `.upper()` nhưng execute `payload` gốc
  IDEM     `Idempotency-Key` bắt buộc; duplicate trả 200 với kết quả cũ

Broker thật (`vnbroker`) KHÔNG cài trong môi trường test ⇒ test dùng spy
đếm call, khẳng định "có/không gọi broker" thay vì khẳng định payload broker
nhận đúng nghiệp vụ. Key `volume` vs `quantity` mà vnbroker mong đợi chưa
verify được — xem `docs/evidence/portfolio-commercial/pa-1-gates.md`.
"""
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from ops_audit.models import AuditEvent

ORDER_URL = '/core/v1/broker/dnse/place-order/'
OTP_URL = '/core/v1/broker/dnse/send-email-otp/'
TOKEN_URL = '/core/v1/broker/dnse/create-trading-token/'

#: Canary — nếu chuỗi này lọt vào response thì X.5 chưa đóng.
CANARY = 'CANARY_SECRET_xyz'

#: Ngưỡng dài của `AuditEvent.action` — `ops_audit/models.py:25`.
AUDIT_ACTION_MAX_LENGTH = AuditEvent._meta.get_field('action').max_length
#: `action` hợp lệ theo `AuditEvent.ActionChoices`.
AUDIT_VALID_ACTIONS = {value for value, _label in AuditEvent.ActionChoices.choices}


class _FakeBroker:
    """Spy đếm call — thay cho `vnbroker` DNSEClient (chưa cài được ở CI)."""

    def __init__(self, order_result=None, order_error=None):
        self.order_calls = []
        self.otp_calls = []
        self.token_calls = []
        self.order_result = order_result if order_result is not None else {'order_id': 'DNSE-ORDER-1'}
        self.order_error = order_error

    def post_order(self, **kwargs):
        self.order_calls.append(kwargs)
        if self.order_error is not None:
            raise self.order_error
        return self.order_result

    def send_email_otp(self, **kwargs):
        self.otp_calls.append(kwargs)
        return {'ok': True}

    def create_trading_token(self, **kwargs):
        self.token_calls.append(kwargs)
        return {'trading_token': 'TT-FAKE'}

    @property
    def total_calls(self):
        return len(self.order_calls) + len(self.otp_calls) + len(self.token_calls)


class OrderSafetyTestCase(TestCase):
    """Base: user đã đăng nhập + broker spy đã patch sẵn."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='pf1-order', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.broker = _FakeBroker()
        patcher = patch(
            'user_workspace.views_dnse._get_active_dnse_client',
            return_value=self.broker,
        )
        self.addCleanup(patcher.stop)
        patcher.start()

    # -- helpers ------------------------------------------------------------

    def order_body(self, **overrides):
        """Payload đặt lệnh hợp lệ.

        Cố tình dùng `quantity` (không `volume`) + `symbol` viết thường để tái
        hiện đúng 2 lỗi của caller FE thật: X.1 và X.6.
        """
        body = {
            'market_type': 'STOCK',
            'order_category': 'NORMAL',
            'mode': 'paper',
            'trading_token': 'TT-REAL-1',
            'payload': {
                'account_no': 'ACC-1',
                'symbol': 'fpt',
                'side': 'buy',
                'price': 46000,
                'quantity': 100,
            },
        }
        body.update(overrides)
        return body

    def post_order(self, body=None, idempotency_key='IDEM-1'):
        kwargs = {'format': 'json'}
        if idempotency_key is not None:
            kwargs['HTTP_IDEMPOTENCY_KEY'] = idempotency_key
        return self.client.post(ORDER_URL, self.order_body() if body is None else body, **kwargs)

    def order_events(self):
        return AuditEvent.objects.filter(
            resource_type='dnse_order', actor_user_id=self.user.id)


class OrderFailClosedTests(OrderSafetyTestCase):
    """SAFE-01 — không có mode rõ ràng thì KHÔNG gọi broker write."""

    def test_missing_mode_never_calls_broker(self):
        """AC-1: payload thiếu cả `mode` lẫn `dry_run` ⇒ broker call = 0."""
        body = self.order_body()
        body.pop('mode')
        resp = self.post_order(body)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_mode_required')
        self.assertEqual(self.broker.order_calls, [])

    def test_unparsable_dry_run_string_never_calls_broker(self):
        """`_to_bool` cũ hiểu `{"1","true","yes","y","on"}` ⇒ `"paper"` ra False = LIVE."""
        resp = self.post_order(self.order_body(mode=None, dry_run='paper'))
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_mode_invalid')
        self.assertEqual(self.broker.order_calls, [])

    def test_invalid_mode_rejected(self):
        resp = self.post_order(self.order_body(mode='sandbox'))
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_mode_invalid')
        self.assertEqual(self.broker.order_calls, [])

    def test_live_mode_rejected_with_explicit_code(self):
        """AC-2: live bị từ chối vì chưa có policy/OTP/confirm/risk-limit/idempotency."""
        resp = self.post_order(self.order_body(mode='live'))
        self.assertEqual(resp.status_code, 403, resp.content)
        payload = resp.json()
        self.assertEqual(payload['code'], 'live_ordering_disabled')
        self.assertNotEqual(payload['code'], 'permission_error')
        self.assertTrue(payload['request_id'])
        self.assertEqual(self.broker.order_calls, [])

    def test_dry_run_false_is_an_explicit_live_request(self):
        resp = self.post_order(self.order_body(mode=None, dry_run=False))
        self.assertEqual(resp.status_code, 403, resp.content)
        self.assertEqual(resp.json()['code'], 'live_ordering_disabled')
        self.assertEqual(self.broker.order_calls, [])

    def test_mode_paper_conflicting_with_dry_run_false_rejected(self):
        resp = self.post_order(self.order_body(mode='paper', dry_run=False))
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_mode_conflict')
        self.assertEqual(self.broker.order_calls, [])

    def test_missing_idempotency_key_rejected(self):
        resp = self.post_order(idempotency_key=None)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'idempotency_key_required')
        self.assertEqual(self.broker.order_calls, [])

    def test_paper_mode_reaches_the_broker_as_dry_run_true(self):
        """Server là nguồn sự thật của mode: `mode=paper` ⇒ `dry_run=True` xuống broker."""
        resp = self.post_order(self.order_body(mode='paper'))
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIs(self.broker.order_calls[0]['dry_run'], True)

    def test_legacy_dry_run_true_still_reaches_the_broker_as_paper(self):
        resp = self.post_order(self.order_body(mode=None, dry_run=True))
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIs(self.broker.order_calls[0]['dry_run'], True)


class OrderPayloadContractTests(OrderSafetyTestCase):
    """X.1 / X.3 / X.4 / X.6 — payload phải khớp giá trị đã validate."""

    def test_quantity_key_accepted_regression_x1(self):
        """AC-3: caller FE gửi `quantity` ⇒ 200/201, KHÔNG 400."""
        resp = self.post_order()
        self.assertIn(resp.status_code, (200, 201), resp.content)
        self.assertEqual(len(self.broker.order_calls), 1)

    def test_legacy_volume_key_still_accepted(self):
        body = self.order_body()
        body['payload'].pop('quantity')
        body['payload']['volume'] = 100
        resp = self.post_order(body)
        self.assertIn(resp.status_code, (200, 201), resp.content)
        self.assertEqual(len(self.broker.order_calls), 1)

    def test_both_volume_keys_present_with_different_values_rejected(self):
        body = self.order_body()
        body['payload']['volume'] = 999
        resp = self.post_order(body)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(self.broker.order_calls, [])

    def test_neither_volume_nor_quantity_rejected_with_clear_code(self):
        body = self.order_body()
        body['payload'].pop('quantity')
        resp = self.post_order(body)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_volume_missing')
        self.assertEqual(self.broker.order_calls, [])

    def test_market_type_outside_allowlist_rejected(self):
        """AC-4: `FUND` + `quantity:1` là đường bypass lô 100 (X.3)."""
        body = self.order_body(market_type='FUND')
        body['payload']['quantity'] = 1
        resp = self.post_order(body)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'market_type_not_allowed')
        self.assertEqual(self.broker.order_calls, [])

    def test_stock_lot_size_guard_still_enforced(self):
        body = self.order_body()
        body['payload']['quantity'] = 150
        resp = self.post_order(body)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(self.broker.order_calls, [])

    def test_order_category_outside_allowlist_rejected(self):
        """X.4 — `order_category` trước đây nhận và truyền thẳng xuống broker."""
        resp = self.post_order(self.order_body(order_category='BLOT'))
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_category_not_allowed')
        self.assertEqual(self.broker.order_calls, [])

    def test_normalized_values_are_what_reaches_the_broker(self):
        """AC-8 + X.6 — giá trị kiểm phải CHÍNH LÀ giá trị thực thi."""
        self.post_order()
        call = self.broker.order_calls[0]
        self.assertEqual(call['market_type'], 'STOCK')
        self.assertEqual(call['order_category'], 'NORMAL')
        payload = call['payload']
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['side'], 'BUY')
        self.assertEqual(payload['volume'], 100)
        self.assertEqual(payload['quantity'], 100)

    def test_validated_values_are_not_left_behind_in_the_raw_payload(self):
        """X.6 — `normalized_payload` phải là copy, không mutate dict của request."""
        body = self.order_body()
        raw = body['payload']
        self.post_order(body)
        self.assertEqual(raw['symbol'], 'fpt')
        self.assertEqual(raw['side'], 'buy')
        self.assertNotIn('volume', raw)


class OrderIdempotencyTests(OrderSafetyTestCase):
    """`Idempotency-Key` bắt buộc, TTL 7 ngày, duplicate trả 200 kết quả cũ."""

    def test_ten_same_keys_create_exactly_one_order(self):
        """AC-5."""
        codes = [self.post_order(idempotency_key='SAME-KEY').status_code for _ in range(10)]
        self.assertEqual(codes, [200] * 10, codes)
        self.assertEqual(len(self.broker.order_calls), 1)

    def test_replay_returns_the_original_result(self):
        first = self.post_order(idempotency_key='REPLAY-1')
        self.assertEqual(first.status_code, 200)
        second = self.post_order(idempotency_key='REPLAY-1')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()['result'], first.json()['result'])
        self.assertIs(second.json()['idempotent_replay'], True)
        self.assertIs(first.json()['idempotent_replay'], False)

    def test_key_reuse_with_different_payload_rejected(self):
        self.assertEqual(self.post_order(idempotency_key='REUSE-1').status_code, 200)
        changed = self.order_body()
        changed['payload']['quantity'] = 200
        resp = self.post_order(changed, idempotency_key='REUSE-1')
        self.assertEqual(resp.status_code, 409, resp.content)
        self.assertEqual(resp.json()['code'], 'idempotency_key_conflict')
        self.assertEqual(len(self.broker.order_calls), 1)

    def test_key_is_scoped_per_user(self):
        self.assertEqual(self.post_order(idempotency_key='SCOPED').status_code, 200)
        other = User.objects.create_user(username='pf1-order-2', password='x')
        self.client.force_authenticate(user=other)
        resp = self.post_order(idempotency_key='SCOPED')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(self.broker.order_calls), 2)

    def test_failed_order_releases_the_key_for_retry(self):
        self.broker.order_error = RuntimeError('broker down')
        failed = self.post_order(idempotency_key='RETRY-1')
        self.assertEqual(failed.status_code, 400, failed.content)
        self.broker.order_error = None
        retried = self.post_order(idempotency_key='RETRY-1')
        self.assertEqual(retried.status_code, 200, retried.content)
        self.assertEqual(len(self.broker.order_calls), 2)


class OrderAuditTests(OrderSafetyTestCase):
    """X.2 — audit order phải thực sự ghi được, và fail-closed."""

    def test_audit_row_is_written_with_a_valid_action(self):
        """AC-6: regression cho X.2 — trước đây `DataError` bị nuốt, 0 dòng audit."""
        resp = self.post_order()
        self.assertEqual(resp.status_code, 200, resp.content)
        events = self.order_events()
        self.assertEqual(events.count(), 1)
        event = events.get()
        self.assertLessEqual(len(event.action), AUDIT_ACTION_MAX_LENGTH)
        self.assertIn(event.action, AUDIT_VALID_ACTIONS)
        self.assertEqual(event.metadata['operation'], 'broker.place_order')
        self.assertEqual(event.metadata['outcome'], 'accepted')
        self.assertEqual(event.resource_id, 'FPT')

    def test_audit_action_never_exceeds_column_width(self):
        self.assertEqual(len('broker.place_order'), 18)
        self.assertGreater(len('broker.place_order'), AUDIT_ACTION_MAX_LENGTH)

    def test_audit_write_failure_blocks_the_order(self):
        """Fail-closed: không có audit ⇒ không gọi broker (gate trước hành động không thể đảo)."""
        with patch.object(AuditEvent.objects, 'create', side_effect=RuntimeError('audit down')):
            resp = self.post_order()
        self.assertEqual(resp.status_code, 500, resp.content)
        self.assertEqual(resp.json()['code'], 'audit_unavailable')
        self.assertEqual(self.broker.order_calls, [])

    def test_rejected_order_is_audited(self):
        resp = self.post_order(self.order_body(market_type='FUND'))
        self.assertEqual(resp.status_code, 400)
        event = self.order_events().get()
        self.assertEqual(event.metadata['outcome'], 'rejected_validation')
        self.assertIn(event.action, AUDIT_VALID_ACTIONS)

    def test_audit_action_length_stays_inside_the_column(self):
        """`metadata['operation']` giữ nguyên tên thao tác dài, `action` mới là cột hẹp."""
        resp = self.post_order()
        self.assertEqual(resp.status_code, 200, resp.content)
        event = self.order_events().get()
        self.assertLessEqual(len(event.action), AUDIT_ACTION_MAX_LENGTH)
        self.assertEqual(event.metadata['operation'], 'broker.place_order')
        self.assertGreater(len(event.metadata['operation']), AUDIT_ACTION_MAX_LENGTH)

    def test_audit_records_the_server_resolved_mode(self):
        """Server là nguồn sự thật của mode ⇒ audit phải ghi `paper`, không phải giá trị client."""
        resp = self.post_order(self.order_body(mode='paper', dry_run=True))
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(self.order_events().get().metadata['mode'], 'paper')

    def test_live_mode_rejection_is_audited(self):
        resp = self.post_order(self.order_body(mode='live'))
        self.assertEqual(resp.status_code, 403)
        event = self.order_events().get()
        self.assertEqual(event.metadata['outcome'], 'rejected_live_mode')
        self.assertEqual(event.metadata['mode'], 'live')
        self.assertIn(event.action, AUDIT_VALID_ACTIONS)

    def test_missing_mode_rejection_is_audited(self):
        body = self.order_body()
        body.pop('mode')
        resp = self.post_order(body)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(self.order_events().get().metadata['outcome'], 'rejected_mode')


class OrderErrorRedactionTests(OrderSafetyTestCase):
    """X.5 — response không được chứa `str(exc)` thô."""

    def test_place_order_does_not_leak_exception_detail(self):
        """AC-7: canary trong exception không được xuất hiện trong response."""
        self.broker.order_error = RuntimeError(f'upstream refused token={CANARY}')
        resp = self.post_order()
        self.assertNotIn(CANARY, resp.content.decode())
        self.assertEqual(resp.json()['code'], 'internal_error')
        self.assertTrue(resp.json()['request_id'])

    def test_send_email_otp_does_not_leak_exception_detail(self):
        with patch.object(
            _FakeBroker, 'send_email_otp', side_effect=RuntimeError(f'otp blew up {CANARY}')
        ):
            resp = self.client.post(OTP_URL, {'mode': 'paper'}, format='json')
        self.assertNotIn(CANARY, resp.content.decode())
        self.assertTrue(resp.json()['request_id'])

    def test_create_trading_token_does_not_leak_exception_detail(self):
        with patch.object(
            _FakeBroker, 'create_trading_token', side_effect=RuntimeError(f'token blew up {CANARY}')
        ):
            resp = self.client.post(
                TOKEN_URL, {'mode': 'paper', 'passcode': '123456'}, format='json')
        self.assertNotIn(CANARY, resp.content.decode())
        self.assertTrue(resp.json()['request_id'])


class ChallengeEndpointModeTests(OrderSafetyTestCase):
    """SAFE-01 mở rộng: `send-email-otp` và `create-trading-token` cũng default live."""

    def test_otp_without_mode_never_calls_broker(self):
        resp = self.client.post(OTP_URL, {}, format='json')
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_mode_required')
        self.assertEqual(self.broker.otp_calls, [])

    def test_otp_live_mode_rejected(self):
        resp = self.client.post(OTP_URL, {'mode': 'live'}, format='json')
        self.assertEqual(resp.status_code, 403, resp.content)
        self.assertEqual(resp.json()['code'], 'live_ordering_disabled')
        self.assertEqual(self.broker.otp_calls, [])

    def test_otp_paper_mode_calls_broker_with_dry_run_true(self):
        resp = self.client.post(OTP_URL, {'mode': 'paper'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIs(self.broker.otp_calls[0]['dry_run'], True)

    def test_trading_token_without_mode_never_calls_broker(self):
        resp = self.client.post(TOKEN_URL, {'passcode': '123456'}, format='json')
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'order_mode_required')
        self.assertEqual(self.broker.token_calls, [])

    def test_trading_token_live_mode_rejected(self):
        resp = self.client.post(
            TOKEN_URL, {'mode': 'live', 'passcode': '123456'}, format='json')
        self.assertEqual(resp.status_code, 403, resp.content)
        self.assertEqual(resp.json()['code'], 'live_ordering_disabled')
        self.assertEqual(self.broker.token_calls, [])

    def test_trading_token_paper_mode_calls_broker_with_dry_run_true(self):
        resp = self.client.post(
            TOKEN_URL, {'mode': 'paper', 'passcode': '123456'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIs(self.broker.token_calls[0]['dry_run'], True)


class IdempotencyUnitTests(SimpleTestCase):
    """Unit test cho `services/idempotency.py` — không cần DB."""

    def setUp(self):
        cache.clear()

    def test_ttl_is_seven_days(self):
        from user_workspace.services import idempotency
        self.assertEqual(idempotency.IDEMPOTENCY_TTL_SECONDS, 7 * 24 * 3600)

    def test_claim_then_replay_then_release(self):
        from user_workspace.services import idempotency
        first = idempotency.claim(user_id=7, scope='dnse_order', key='K', fingerprint='fp1')
        self.assertTrue(first.acquired)
        # Request thứ hai tới khi request đầu còn đang chạy => in_progress, KHÔNG replay.
        second = idempotency.claim(user_id=7, scope='dnse_order', key='K', fingerprint='fp1')
        self.assertFalse(second.acquired)
        self.assertTrue(second.in_progress)
        self.assertFalse(second.replay)
        # Cùng key nhưng payload khác => conflict, kể cả khi đang in_progress.
        third = idempotency.claim(user_id=7, scope='dnse_order', key='K', fingerprint='fp2')
        self.assertFalse(third.acquired)
        self.assertTrue(third.conflict)
        idempotency.release(user_id=7, scope='dnse_order', key='K')
        fourth = idempotency.claim(user_id=7, scope='dnse_order', key='K', fingerprint='fp1')
        self.assertTrue(fourth.acquired)
        self.assertTrue(idempotency.store_result(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp1', result={'r': 1}))
        replay = idempotency.claim(user_id=7, scope='dnse_order', key='K', fingerprint='fp1')
        self.assertTrue(replay.replay)
        self.assertEqual(replay.result, {'r': 1})

    def test_store_result_refuses_a_mismatched_fingerprint(self):
        from user_workspace.services import idempotency
        idempotency.claim(user_id=9, scope='dnse_order', key='K', fingerprint='fp1')
        self.assertFalse(idempotency.store_result(
            user_id=9, scope='dnse_order', key='K', fingerprint='other', result={'r': 1}))

    def test_key_is_scoped_by_user_and_scope(self):
        from user_workspace.services import idempotency
        self.assertTrue(
            idempotency.claim(user_id=1, scope='dnse_order', key='K', fingerprint='f').acquired)
        self.assertTrue(
            idempotency.claim(user_id=2, scope='dnse_order', key='K', fingerprint='f').acquired)
        self.assertTrue(
            idempotency.claim(user_id=1, scope='dnse_otp', key='K', fingerprint='f').acquired)

    def test_blank_key_is_rejected(self):
        from user_workspace.services import idempotency
        for blank in ('', '   ', None):
            with self.assertRaises(idempotency.IdempotencyKeyError):
                idempotency.claim(user_id=1, scope='dnse_order', key=blank, fingerprint='f')
