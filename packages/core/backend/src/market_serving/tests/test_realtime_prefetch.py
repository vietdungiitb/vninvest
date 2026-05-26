from django.test import TestCase
from django.core.cache import cache
from unittest.mock import patch, MagicMock

from market_data.models import GlobalSymbolRegistry
from market_serving.realtime_prefetch import (
    _collect_universe_symbols,
    REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
    REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX,
    DEFAULT_HOT_HYDRATE_INTERVAL_SECONDS,
)


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
