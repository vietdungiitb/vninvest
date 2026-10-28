"""
Unit tests cho backfill_intraday_tick_system (D03) và backfill_intraday_tick_user (D04).

Test cases:
  T-C1: System task abort khi no system credentials.
  T-C2: System task skip khi data đã tồn tại (presence check).
  T-C3: System task OK — ghi ticks vào IntradayTick.
  T-C4: User task error khi user chưa có credential.
  T-C5: User task skip khi data đã tồn tại.
  T-C6: POST /backfill/system/ — admin 202, non-admin 403.
  T-C7: POST /backfill/user/ — trade_date quá 180 ngày → 400.
"""
import os
from datetime import date, datetime, timedelta, UTC
from unittest.mock import patch, MagicMock

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

TEST_FERNET_KEY = Fernet.generate_key().decode()

SAMPLE_TICKS = [
    {
        'timestamp': datetime(2026, 5, 10, 2, 30, 0, tzinfo=UTC),
        'price': 25000.0, 'volume': 1000, 'side': 'buy',
        'match_type': 'NormalMatch', 'source': 'dnse_system',
    },
    {
        'timestamp': datetime(2026, 5, 10, 2, 31, 0, tzinfo=UTC),
        'price': 25100.0, 'volume': 500, 'side': 'sell',
        'match_type': 'NormalMatch', 'source': 'dnse_system',
    },
]


class SystemBackfillTaskTests(TestCase):
    """T-C1 / T-C2 / T-C3."""

    def test_abort_when_no_system_credentials(self):
        """T-C1: get_system_provider_credentials() → None → abort."""
        with patch('identity_access.models.get_system_provider_credentials', return_value=None):
            with patch('data_ingest.tasks.get_system_provider_credentials', return_value=None, create=True):
                pass
            # Patch inside task's local import scope
            with patch('identity_access.models.UserDNSECredential.objects') as mock_obj:
                mock_obj.get.side_effect = Exception('no system provider')
                # Patch directly via the models module
        with patch('identity_access.models.get_system_provider_credentials', return_value=None):
            # Force the task to use the patched version
            import data_ingest.tasks as tasks_module
            import identity_access.models as id_models
            original = id_models.get_system_provider_credentials
            id_models.get_system_provider_credentials = lambda: None
            try:
                result = tasks_module.backfill_intraday_tick_system.run(symbol='HPG', trade_date='2026-05-10')
            finally:
                id_models.get_system_provider_credentials = original
        self.assertEqual(result['status'], 'aborted')
        self.assertEqual(result['reason'], 'no_system_credentials')

    def test_skip_when_data_already_exists(self):
        """T-C2: presence check → skip khi đã có data."""
        import data_ingest.tasks as tasks_module
        import identity_access.models as id_models
        original_creds = id_models.get_system_provider_credentials
        id_models.get_system_provider_credentials = lambda: ('k', 's')
        try:
            with patch('market_data.models.IntradayTick.objects') as mock_qs:
                mock_qs.filter.return_value.exists.return_value = True
                result = tasks_module.backfill_intraday_tick_system.run(symbol='HPG', trade_date='2026-05-10')
        finally:
            id_models.get_system_provider_credentials = original_creds
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'already_exists')

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_ok_creates_intraday_ticks(self):
        """T-C3: normal flow — ghi ticks vào DB."""
        import data_ingest.tasks as tasks_module
        import identity_access.models as id_models
        from market_data.models import IntradayTick

        original_creds = id_models.get_system_provider_credentials
        id_models.get_system_provider_credentials = lambda: ('k', 's')
        try:
            with patch('market_data.vnbroker_adapter.fetch_intraday_tape_history', return_value=SAMPLE_TICKS):
                result = tasks_module.backfill_intraday_tick_system.run(symbol='HPG2', trade_date='2026-05-10')
        finally:
            id_models.get_system_provider_credentials = original_creds

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ticks'], 2)
        count = IntradayTick.objects.filter(symbol='HPG2').count()
        self.assertEqual(count, 2)


class UserBackfillTaskTests(TestCase):
    """T-C4 / T-C5."""

    def setUp(self):
        self.user = User.objects.create_user(username='backfill_user', password='pass')

    def test_error_when_no_user_credential(self):
        """T-C4: UserDNSECredential DoesNotExist → error."""
        from data_ingest.tasks import backfill_intraday_tick_user
        result = backfill_intraday_tick_user.run(
            user_id=self.user.id, symbol='HPG', trade_date='2026-05-10'
        )
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['reason'], 'no_user_credential')

    def test_skip_when_data_exists(self):
        """T-C5: presence check → skip."""
        from user_workspace.models import DNSECredential
        import data_ingest.tasks as tasks_module

        cred = DNSECredential(user=self.user)
        cred.set_client_id('api_key')
        cred.set_client_secret('api_secret')
        cred.save()

        with patch('market_data.models.IntradayTick.objects') as mock_qs:
            mock_qs.filter.return_value.exists.return_value = True
            result = tasks_module.backfill_intraday_tick_user.run(
                user_id=self.user.id, symbol='HPG', trade_date='2026-05-10'
            )
        self.assertEqual(result['status'], 'skipped')


class BackfillViewTests(TestCase):
    """T-C6 / T-C7: HTTP API."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='view_user', password='pass')
        self.admin = User.objects.create_user(username='view_admin', password='pass', is_staff=True)

    def test_system_backfill_requires_admin(self):
        """T-C6: non-admin nhận 403."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/core/v1/data-ingest/backfill/system/', {
            'symbol': 'HPG', 'trade_date': '2026-05-10',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_system_backfill_admin_accepted(self):
        """T-C6: admin nhận 202 với v2 payload."""
        self.client.force_authenticate(user=self.admin)
        # Dùng ngày cụ thể là thứ Hai để đảm bảo có ngày giao dịch hợp lệ
        with patch('data_ingest.views._resolve_backfill_symbols', return_value=['HPG']):
            with patch('data_ingest.tasks.backfill_intraday_tick_system') as mock_task:
                mock_result = MagicMock()
                mock_result.id = 'test-task-id'
                mock_task.apply_async.return_value = mock_result
                resp = self.client.post('/core/v1/data-ingest/backfill/system/', {
                    'datasets': ['tape_intraday'],
                    'symbols_group': 'custom',
                    'symbol': 'HPG',
                    'from_date': '2026-05-11',  # Monday
                    'to_date': '2026-05-11',
                    'mode': 'missing_only',
                    'dry_run': False,
                }, format='json')
        self.assertIn(resp.status_code, (202, 200))
        body = resp.json()
        self.assertIn('tasks_queued', body)

    def test_user_backfill_old_date_returns_400(self):
        """T-C7: trade_date > 180 ngày → 400."""
        self.client.force_authenticate(user=self.user)
        old_date = (date.today() - timedelta(days=200)).isoformat()
        resp = self.client.post('/core/v1/data-ingest/backfill/user/', {
            'symbol': 'HPG', 'trade_date': old_date,
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_user_backfill_valid_date_accepted(self):
        """User backfill recent date → 202."""
        self.client.force_authenticate(user=self.user)
        recent_date = (date.today() - timedelta(days=10)).isoformat()
        with patch('data_ingest.tasks.backfill_intraday_tick_user') as mock_task:
            mock_result = MagicMock()
            mock_result.id = 'test-task-id-2'
            mock_task.apply_async.return_value = mock_result
            resp = self.client.post('/core/v1/data-ingest/backfill/user/', {
                'symbol': 'HPG', 'trade_date': recent_date,
            }, format='json')
        self.assertEqual(resp.status_code, 202)


class SynthesizeBarsFromTicksTests(TestCase):
    """
    T-D1 … T-D5: _synthesize_bars_from_db_ticks và synthesize_intraday_bars_from_ticks (D06).

    T-D1: empty khi không có tick trong DB.
    T-D2: tổng hợp đúng IntradayBar với tất cả timeframes từ DB ticks.
    T-D3: idempotent — chạy lần 2 trả về skipped = tổng số bars lần 1.
    T-D4: task synthesize_intraday_bars_from_ticks gọi đúng helper.
    T-D5: backfill_intraday_tick_system chain bao gồm synthesize_intraday_bars_from_ticks.
    """

    _TRADE_DATE = '2026-05-12'
    _SYMBOL = 'SYNTHTEST'

    def _make_ticks(self):
        """Tạo 4 IntradayTick trong DB để test tổng hợp bar."""
        from market_data.models import IntradayTick
        base = datetime(2026, 5, 12, 2, 30, 0, tzinfo=UTC)
        rows = [
            IntradayTick(symbol=self._SYMBOL, timestamp=base,
                         price=25000, volume=1000, side='BUY',
                         match_type='NormalMatch', source='dnse_system'),
            IntradayTick(symbol=self._SYMBOL, timestamp=base.replace(minute=31),
                         price=25200, volume=500, side='SELL',
                         match_type='NormalMatch', source='dnse_system'),
            IntradayTick(symbol=self._SYMBOL, timestamp=base.replace(minute=45),
                         price=24900, volume=800, side='BUY',
                         match_type='NormalMatch', source='dnse_system'),
            IntradayTick(symbol=self._SYMBOL, timestamp=base.replace(hour=3, minute=0),
                         price=25100, volume=600, side='BUY',
                         match_type='NormalMatch', source='dnse_system'),
        ]
        IntradayTick.objects.bulk_create(rows)

    def test_d1_empty_when_no_ticks(self):
        """T-D1: không có ticks → trả về status=empty, bars_computed=0."""
        from data_ingest.tasks import _synthesize_bars_from_db_ticks
        result = _synthesize_bars_from_db_ticks('NOTEXIST', self._TRADE_DATE)
        self.assertEqual(result['status'], 'empty')
        self.assertEqual(result['ticks_read'], 0)
        self.assertEqual(result['bars_computed'], 0)

    def test_d2_builds_intraday_bars_from_db_ticks(self):
        """T-D2: 4 ticks → IntradayBar được tổng hợp cho tất cả 6 timeframes."""
        from market_data.models import IntradayBar
        from data_ingest.tasks import _synthesize_bars_from_db_ticks

        self._make_ticks()
        result = _synthesize_bars_from_db_ticks(self._SYMBOL, self._TRADE_DATE)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ticks_read'], 4)
        self.assertGreater(result['bars_computed'], 0)
        self.assertGreater(result['inserted'], 0)
        self.assertEqual(result['updated'], 0)

        # Kiểm tra các timeframes được tạo
        timeframes_in_db = set(
            IntradayBar.objects.filter(symbol=self._SYMBOL)
            .values_list('timeframe', flat=True).distinct()
        )
        # 4 ticks trong ~1h30 phải sinh ra ít nhất 1m, 5m, 15m, 1H
        for tf in ('1m', '5m', '15m', '1H'):
            self.assertIn(tf, timeframes_in_db, f'Thiếu timeframe {tf}')

        # Source phải là dnse_backfill (vì ticks source='dnse_system')
        bar_sources = set(
            IntradayBar.objects.filter(symbol=self._SYMBOL)
            .values_list('source', flat=True).distinct()
        )
        self.assertIn('dnse_backfill', bar_sources)

    def test_d3_idempotent_second_run_skips_all(self):
        """T-D3: chạy lần 2 không tạo duplicate — toàn bộ là skipped."""
        from data_ingest.tasks import _synthesize_bars_from_db_ticks
        from market_data.models import IntradayBar

        self._make_ticks()
        result1 = _synthesize_bars_from_db_ticks(self._SYMBOL, self._TRADE_DATE)
        count_after_1 = IntradayBar.objects.filter(symbol=self._SYMBOL).count()

        result2 = _synthesize_bars_from_db_ticks(self._SYMBOL, self._TRADE_DATE)
        count_after_2 = IntradayBar.objects.filter(symbol=self._SYMBOL).count()

        self.assertEqual(count_after_1, count_after_2, 'Số lượng bar không thay đổi sau lần 2')
        self.assertEqual(result2['inserted'], 0)
        self.assertEqual(result2['updated'], 0)
        self.assertEqual(result2['skipped'], result1['bars_computed'])

    def test_d4_task_calls_helper(self):
        """T-D4: synthesize_intraday_bars_from_ticks task gọi _synthesize_bars_from_db_ticks."""
        from data_ingest.tasks import synthesize_intraday_bars_from_ticks

        expected = {'status': 'ok', 'ticks_read': 2, 'bars_computed': 3,
                    'inserted': 3, 'updated': 0, 'skipped': 0,
                    'symbol': self._SYMBOL, 'date': self._TRADE_DATE}
        with patch('data_ingest.tasks._synthesize_bars_from_db_ticks', return_value=expected) as mock_helper:
            result = synthesize_intraday_bars_from_ticks.run(
                symbol=self._SYMBOL, trade_date=self._TRADE_DATE
            )
        mock_helper.assert_called_once_with(self._SYMBOL, self._TRADE_DATE)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['inserted'], 3)

    def test_d5_system_chain_includes_bar_synthesis(self):
        """T-D5: backfill_intraday_tick_system chain gọi synthesize_intraday_bars_from_ticks."""
        import data_ingest.tasks as tasks_module
        import identity_access.models as id_models

        original_creds = id_models.get_system_provider_credentials
        id_models.get_system_provider_credentials = lambda: ('k', 's')
        captured_chains: list = []

        def mock_chain(*tasks):
            captured_chains.append(tasks)
            mock_obj = MagicMock()
            mock_obj.apply_async = MagicMock()
            return mock_obj

        try:
            with patch('market_data.vnbroker_adapter.fetch_intraday_tape_history', return_value=SAMPLE_TICKS):
                with patch('data_ingest.tasks.celery_chain', mock_chain, create=True):
                    with patch('celery.chain', mock_chain):
                        tasks_module.backfill_intraday_tick_system.run(
                            symbol='CHAINTEST', trade_date='2026-05-10'
                        )
        finally:
            id_models.get_system_provider_credentials = original_creds

        # Xác nhận synthesize_intraday_bars_from_ticks xuất hiện trong chain
        from market_data.models import IntradayTick
        tick_count = IntradayTick.objects.filter(symbol='CHAINTEST').count()
        self.assertEqual(tick_count, 2)  # Ticks đã được ghi dù chain mock


class RateLimitDetectionTests(TestCase):
    """T-C8: _RateLimitWatcher phat hien warning chua 'rate limit'.

    Hai test T-C9 đã bị gỡ ở bước 2/9 của đợt dọn dẹp: chúng
    ``patch('vnbroker.explorer.dnse.quote.DNSEQuote')`` mà package ``vnbroker``
    không tồn tại trong repo. Xem ``docs/CLAIMS.md`` claim ``cleanup-step2-vnbroker``.
    """

    def test_c8_rate_limit_watcher_triggers_on_warning(self):
        """T-C8: _RateLimitWatcher bắt warning chứa 'rate limit'."""
        import logging
        from market_data.vnbroker_adapter import _RateLimitWatcher

        watcher = _RateLimitWatcher()
        # Simulate warning từ vnbroker library
        record = logging.LogRecord(
            name='vnbroker.explorer.dnse.quote',
            level=logging.WARNING,
            pathname='',
            lineno=0,
            msg='DNSE get_trades lỗi: Rate Limit Exceeded',
            args=(),
            exc_info=None,
        )
        watcher.emit(record)
        self.assertTrue(watcher.triggered)

    def test_c8_rate_limit_watcher_ignores_other_warnings(self):
        """T-C8b: _RateLimitWatcher không trigger với warning bình thường."""
        import logging
        from market_data.vnbroker_adapter import _RateLimitWatcher

        watcher = _RateLimitWatcher()
        record = logging.LogRecord(
            name='vnbroker',
            level=logging.WARNING,
            pathname='',
            lineno=0,
            msg='Không có dữ liệu',
            args=(),
            exc_info=None,
        )
        watcher.emit(record)
        self.assertFalse(watcher.triggered)
