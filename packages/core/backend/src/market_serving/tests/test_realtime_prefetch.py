from django.test import TestCase
from django.core.cache import cache
from unittest.mock import patch

from market_data.models import GlobalSymbolRegistry
from market_serving.realtime_prefetch import (
    _collect_universe_symbols,
    REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX,
    DEFAULT_HOT_HYDRATE_INTERVAL_SECONDS,
)
from datetime import UTC


class RealtimePrefetchUniverseTestCase(TestCase):
    def setUp(self):
        cache.clear()

    def test_collect_universe_symbols_uses_global_registry_ssot(self):
        GlobalSymbolRegistry.objects.create(
            symbol='VHM',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=5.0,
            demand_source_count=7,
            freshness_state_summary='stale',
            coverage_state_summary='stale',
        )
        GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM,
            priority_score=3.0,
            demand_source_count=4,
            freshness_state_summary='fresh',
            coverage_state_summary='fresh',
        )
        GlobalSymbolRegistry.objects.create(
            symbol='AAA',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
            priority_score=1.0,
            demand_source_count=1,
            freshness_state_summary='fresh',
            coverage_state_summary='fresh',
        )

        universe = _collect_universe_symbols()

        self.assertEqual(universe['hot'], ['VHM'])
        self.assertEqual(universe['warm'], ['HPG'])
        self.assertEqual(universe['cold'], ['AAA'])
        self.assertEqual(universe['all'], ['VHM', 'HPG', 'AAA'])


class RealtimePrefetchHydrateLegTestCase(TestCase):
    """
    Kiểm tra SSOT intraday hydrate leg trong schedule_realtime_prefetch_shards.

    Khi universe snapshot có hot symbols và elapsed >= HOT_HYDRATE_INTERVAL,
    scheduler phải enqueue warm_intraday_universe với đúng plan (chỉ intraday_ticks).
    """

    def setUp(self):
        cache.clear()
        # Session gate mock True: test hydrate logic, không phụ thuộc giờ chạy test.
        self._session_patcher = patch(
            'market_serving.realtime_prefetch._in_trading_session', return_value=True)
        self._session_patcher.start()
        GlobalSymbolRegistry.objects.filter(symbol__in=['VHM', 'TCB']).delete()
        # Tạo 2 hot symbols trong registry
        GlobalSymbolRegistry.objects.create(
            symbol='VHM',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=5.0,
            demand_source_count=7,
            freshness_state_summary='stale',
            coverage_state_summary='stale',
        )
        GlobalSymbolRegistry.objects.create(
            symbol='TCB',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=4.0,
            demand_source_count=5,
            freshness_state_summary='fresh',
            coverage_state_summary='fresh',
        )

    def tearDown(self):
        self._session_patcher.stop()

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_hydrate_enqueued_when_threshold_elapsed(self, mock_hydrate, mock_prefetch):
        """
        Khi last_hydrate = 0 (chưa chạy lần nào), hydrate phải được enqueue
        với plan_items chứa đúng 2 hot symbols và dataset='intraday_ticks'.
        """
        from market_serving.realtime_prefetch import schedule_realtime_prefetch_shards

        result = schedule_realtime_prefetch_shards.run()

        self.assertEqual(result['status'], 'ok')
        self.assertIn('hydrate_enqueued', result)

        # Phải có ít nhất 1 hydrate enqueue cho hot tier
        hydrate_tiers = [h['tier'] for h in result['hydrate_enqueued']]
        self.assertIn('hot', hydrate_tiers)

        # warm_intraday_universe.apply_async phải được gọi
        self.assertTrue(mock_hydrate.called)

        # Kiểm tra plan_items: mỗi item phải có dataset='intraday_ticks'
        call_kwargs = mock_hydrate.call_args[1]['kwargs']
        plan_items = call_kwargs['plan_items']
        self.assertTrue(len(plan_items) > 0)
        for item in plan_items:
            self.assertEqual(item['dataset'], 'intraday_ticks')
            self.assertIn(item['symbol'], ['VHM', 'TCB'])

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_hydrate_throttled_within_interval(self, mock_hydrate, mock_prefetch):
        """
        Nếu last_hydrate vừa được set (< interval), hydrate KHÔNG được enqueue lại.
        """
        from django.utils import timezone
        from market_serving.realtime_prefetch import schedule_realtime_prefetch_shards

        # Giả lập đã enqueue hot hydrate 10 giây trước
        hot_key = f'{REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX}:hot'
        cache.set(hot_key, int(timezone.now().timestamp()) - 10, timeout=600)

        result = schedule_realtime_prefetch_shards.run()

        self.assertEqual(result['status'], 'ok')
        hydrate_tiers = [h['tier'] for h in result.get('hydrate_enqueued', [])]
        self.assertNotIn('hot', hydrate_tiers, 'Hot hydrate không được enqueue khi còn trong throttle window')

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_hydrate_enqueued_after_interval_expires(self, mock_hydrate, mock_prefetch):
        """
        Nếu elapsed > HOT_HYDRATE_INTERVAL, hydrate phải được enqueue lại.
        """
        from django.utils import timezone
        from market_serving.realtime_prefetch import schedule_realtime_prefetch_shards

        # Giả lập last_hydrate đã quá interval
        hot_key = f'{REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX}:hot'
        old_epoch = int(timezone.now().timestamp()) - DEFAULT_HOT_HYDRATE_INTERVAL_SECONDS - 60
        cache.set(hot_key, old_epoch, timeout=600)

        result = schedule_realtime_prefetch_shards.run()

        hydrate_tiers = [h['tier'] for h in result.get('hydrate_enqueued', [])]
        self.assertIn('hot', hydrate_tiers, 'Hot hydrate phải được enqueue sau khi interval hết')

class RealtimePrefetchDedupGuardTestCase(TestCase):
    """
    Slice B (QueueRecovery) — duplicate-guard chong fan-out trung lap khi xa backlog.

    Tin nao thay run truoc do trong cung chu ky (< DEDUP window) thi skip,
    khong enqueue them shard/hydrate vao cung queue.
    """

    def setUp(self):
        cache.clear()
        # Session gate mock True: test logic guard/fan-out, không phụ thuộc giờ chạy test.
        self._session_patcher = patch(
            'market_serving.realtime_prefetch._in_trading_session', return_value=True)
        self._session_patcher.start()

    def tearDown(self):
        self._session_patcher.stop()

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_skipped_duplicate_when_previous_run_fresh(self, mock_hydrate, mock_prefetch):
        from django.utils import timezone
        from market_serving.realtime_prefetch import (
            REALTIME_SCHEDULER_LAST_RUN_CACHE_KEY,
            schedule_realtime_prefetch_shards,
        )

        cache.set(REALTIME_SCHEDULER_LAST_RUN_CACHE_KEY, timezone.now().isoformat(), timeout=120)

        result = schedule_realtime_prefetch_shards.run()

        self.assertEqual(result['status'], 'skipped_duplicate')
        self.assertFalse(mock_prefetch.called)
        self.assertFalse(mock_hydrate.called)

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_proceeds_when_no_recent_run(self, mock_hydrate, mock_prefetch):
        from market_serving.realtime_prefetch import schedule_realtime_prefetch_shards

        result = schedule_realtime_prefetch_shards.run()

        self.assertNotEqual(result['status'], 'skipped_duplicate')

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_ok_run_records_last_run(self, mock_hydrate, mock_prefetch):
        from market_serving.realtime_prefetch import (
            REALTIME_SCHEDULER_LAST_RUN_CACHE_KEY,
            schedule_realtime_prefetch_shards,
        )

        GlobalSymbolRegistry.objects.create(
            symbol='VHM',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=5.0,
            demand_source_count=7,
            freshness_state_summary='stale',
            coverage_state_summary='stale',
        )

        result = schedule_realtime_prefetch_shards.run()

        self.assertEqual(result['status'], 'ok')
        self.assertIsNotNone(cache.get(REALTIME_SCHEDULER_LAST_RUN_CACHE_KEY))

class RealtimePrefetchCorrectiveTestCase(TestCase):
    """
    Corrective live-measured (QueueRecovery DoD) — session gate + shard timeout + hydrate cap.

    Drain do duoc 1.1/phut vs arrival ~100/phut: shard phai bounded, ngoai phien khong enqueue.
    """

    def setUp(self):
        cache.clear()

    def _ict(self, weekday, hour, minute=0):
        # 2026-09-21 la Thu 2. weekday: 0=T2 ... 5=T7, 6=CN.
        from datetime import datetime, timedelta
        base = datetime(2026, 9, 21, 3, 0, tzinfo=UTC)  # Mon 10:00 ICT
        delta_days = (weekday - 0) % 7
        target = base + timedelta(days=delta_days)
        target = target.replace(hour=hour - 7, minute=minute)
        return target

    def test_session_gate_in_session(self):
        from market_serving.realtime_prefetch import _in_trading_session
        self.assertTrue(_in_trading_session(now=self._ict(0, 10)))

    def test_session_gate_offhours(self):
        from market_serving.realtime_prefetch import _in_trading_session
        self.assertFalse(_in_trading_session(now=self._ict(0, 20)))

    def test_session_gate_weekend(self):
        from market_serving.realtime_prefetch import _in_trading_session
        self.assertFalse(_in_trading_session(now=self._ict(5, 10)))

    def test_session_gate_disabled_flag(self):
        import os
        from market_serving.realtime_prefetch import _in_trading_session
        old = os.getenv('TICKER_PREFETCH_SESSION_ONLY')
        os.environ['TICKER_PREFETCH_SESSION_ONLY'] = 'false'
        try:
            self.assertTrue(_in_trading_session(now=self._ict(5, 10)))
        finally:
            if old is None:
                del os.environ['TICKER_PREFETCH_SESSION_ONLY']
            else:
                os.environ['TICKER_PREFETCH_SESSION_ONLY'] = old

    @patch('market_data.vnbroker_adapter.fetch_realtime_price')
    def test_shard_slow_symbol_timeout(self, fetch_mock):
        import time
        from market_serving.realtime_prefetch import prefetch_realtime_ticker_shard

        def _slow(symbol):
            time.sleep(30)
            return {'symbol': symbol, 'close': 10.0}

        fetch_mock.side_effect = _slow
        cache.set('realtime:shard:hot:0', ['SLOWA', 'SLOWB'], timeout=600)

        started = time.monotonic()
        result = prefetch_realtime_ticker_shard.run(tier='hot', shard_id=0)
        elapsed = time.monotonic() - started

        # 2 symbols x timeout 5s + margin: phai xong duoi 20s (khong treo 60s+).
        self.assertLess(elapsed, 20)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result.get('timed_out'), 2)

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_offhours_scheduler_skips_fanout(self, mock_hydrate, mock_prefetch):
        from market_serving.realtime_prefetch import schedule_realtime_prefetch_shards

        GlobalSymbolRegistry.objects.create(
            symbol='VHM', is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=5.0, demand_source_count=7,
            freshness_state_summary='stale', coverage_state_summary='stale',
        )
        with patch('market_serving.realtime_prefetch._in_trading_session', return_value=False):
            result = schedule_realtime_prefetch_shards.run()

        self.assertEqual(result['status'], 'skipped_offhours')
        self.assertFalse(mock_prefetch.called)
        self.assertFalse(mock_hydrate.called)

    @patch('market_serving.realtime_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('data_ingest.tasks.warm_intraday_universe.apply_async')
    def test_hydrate_warm_capped(self, mock_hydrate, mock_prefetch):
        from django.utils import timezone
        from market_serving.realtime_prefetch import (
            REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
            schedule_realtime_prefetch_shards,
        )

        cache.set(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY, {
            'computed_at': timezone.now().isoformat(),
            'totals': {'all': 500, 'hot': 0, 'warm': 500, 'cold': 0},
            'topology': {'hot_shards': 4, 'warm_shards': 6, 'cold_shards': 6},
        }, timeout=3600)
        cache.set(f'{REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY}:warm',
                  [f'W{i:05d}' for i in range(500)], timeout=3600)

        with patch('market_serving.realtime_prefetch._in_trading_session', return_value=True):
            result = schedule_realtime_prefetch_shards.run()

        hydrate_plans = [c[1]['kwargs']['plan_items'] for c in mock_hydrate.call_args_list]
        total_warm = sum(len(p) for p in hydrate_plans)
        self.assertLessEqual(total_warm, 150)
        self.assertGreater(total_warm, 0)
