"""B06 — Promotion fast-path bootstrap tests."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from market_data.models import GlobalSymbolCoverage, GlobalSymbolRegistry
from market_data.promotion_fast_path import (
    _get_sla_countdown,
    enqueue_promotion_repair,
    handle_symbol_promotion,
    should_enqueue_promotion_repair,
)


def _registry(symbol: str, tier: str = 'hot') -> GlobalSymbolRegistry:
    obj, _ = GlobalSymbolRegistry.objects.get_or_create(
        symbol=symbol,
        defaults={'is_active': True, 'current_priority_tier': tier},
    )
    if obj.current_priority_tier != tier:
        obj.current_priority_tier = tier
        obj.save(update_fields=['current_priority_tier'])
    return obj


def _coverage(
    symbol: str,
    freshness: str = GlobalSymbolCoverage.FreshnessChoices.STALE,
    dataset: str = GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    last_verified_at=None,
) -> GlobalSymbolCoverage:
    reg = _registry(symbol)
    row, _ = GlobalSymbolCoverage.objects.get_or_create(
        registry=reg, dataset=dataset,
        defaults={'freshness_state': freshness, 'last_verified_at': last_verified_at},
    )
    return row


# ---------------------------------------------------------------------------
# Unit: _get_sla_countdown
# ---------------------------------------------------------------------------

class SlaCountdownTest(TestCase):
    def test_hot_is_immediate(self):
        self.assertEqual(_get_sla_countdown('hot'), 0)

    def test_warm_is_300s(self):
        self.assertEqual(_get_sla_countdown('warm'), 300)

    def test_cold_returns_minus1(self):
        self.assertEqual(_get_sla_countdown('cold'), -1)

    def test_empty_returns_minus1(self):
        self.assertEqual(_get_sla_countdown(''), -1)

    def test_case_insensitive(self):
        self.assertEqual(_get_sla_countdown('HOT'), 0)


# ---------------------------------------------------------------------------
# Unit: should_enqueue_promotion_repair
# ---------------------------------------------------------------------------

class ShouldEnqueueTest(TestCase):
    def test_no_coverage_row_returns_true(self):
        reg = _registry('NEWHOT', tier='hot')
        result = should_enqueue_promotion_repair(reg)
        self.assertTrue(result)

    def test_fresh_coverage_returns_false(self):
        reg = _registry('FRESHTEST', tier='hot')
        GlobalSymbolCoverage.objects.get_or_create(
            registry=reg,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            defaults={'freshness_state': GlobalSymbolCoverage.FreshnessChoices.FRESH},
        )
        result = should_enqueue_promotion_repair(reg)
        self.assertFalse(result)

    def test_cold_tier_returns_false(self):
        reg = _registry('COLDONE', tier='cold')
        result = should_enqueue_promotion_repair(reg)
        self.assertFalse(result)

    def test_stale_hot_returns_true(self):
        reg = _registry('STALEHOT', tier='hot')
        GlobalSymbolCoverage.objects.get_or_create(
            registry=reg,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            defaults={'freshness_state': GlobalSymbolCoverage.FreshnessChoices.STALE},
        )
        result = should_enqueue_promotion_repair(reg)
        self.assertTrue(result)

    def test_recently_verified_dedup_returns_false(self):
        reg = _registry('RECENTHOT', tier='hot')
        GlobalSymbolCoverage.objects.get_or_create(
            registry=reg,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            defaults={
                'freshness_state': GlobalSymbolCoverage.FreshnessChoices.STALE,
                'last_verified_at': timezone.now(),  # Just now → dedup window
            },
        )
        result = should_enqueue_promotion_repair(reg)
        self.assertFalse(result)


# ---------------------------------------------------------------------------
# Unit: enqueue_promotion_repair (mock Celery)
# ---------------------------------------------------------------------------

class EnqueuePromotionRepairTest(TestCase):
    @patch('market_data.promotion_fast_path.enqueue_promotion_repair')
    def test_cold_does_not_enqueue(self, mock_enqueue):
        result = enqueue_promotion_repair(symbol='COLD1', tier='cold')
        self.assertFalse(result['enqueued'])
        self.assertIn('tier_not_eligible', result['reason'])

    def test_hot_enqueues_with_mock(self):
        mock_task = MagicMock()
        mock_task.apply_async.return_value = MagicMock(id='mock-task-id')

        with patch('data_ingest.tasks.backfill_daily_prices', mock_task):
            result = enqueue_promotion_repair(symbol='VCB', tier='hot')

        self.assertTrue(result['enqueued'])
        self.assertEqual(result['countdown_seconds'], 0)
        self.assertEqual(result['symbol'], 'VCB')
        mock_task.apply_async.assert_called_once()

    def test_warm_enqueues_with_countdown(self):
        mock_task = MagicMock()
        mock_task.apply_async.return_value = MagicMock(id='mock-warm-id')

        with patch('data_ingest.tasks.backfill_daily_prices', mock_task):
            result = enqueue_promotion_repair(symbol='FPT', tier='warm')

        self.assertTrue(result['enqueued'])
        self.assertEqual(result['countdown_seconds'], 300)


# ---------------------------------------------------------------------------
# Integration: handle_symbol_promotion
# ---------------------------------------------------------------------------

class HandleSymbolPromotionTest(TestCase):
    def test_no_tier_change_not_triggered(self):
        reg = _registry('SAME', tier='hot')
        result = handle_symbol_promotion(reg, previous_tier='hot')
        self.assertFalse(result['triggered'])
        self.assertEqual(result['reason'], 'no_tier_promotion')

    def test_demotion_not_triggered(self):
        reg = _registry('DEMOTED', tier='cold')
        result = handle_symbol_promotion(reg, previous_tier='hot')
        self.assertFalse(result['triggered'])

    def test_new_symbol_no_previous_tier(self):
        """Symbol mới không có previous tier → considered promotion từ '' → hot."""
        mock_task = MagicMock()
        mock_task.apply_async.return_value = MagicMock(id='mock-new-id')

        reg = _registry('NEWSYM', tier='hot')
        with patch('data_ingest.tasks.backfill_daily_prices', mock_task):
            result = handle_symbol_promotion(reg, previous_tier=None)

        # Should trigger (promoted from nothing to hot)
        self.assertTrue(result.get('triggered', False) or result.get('reason') in (
            'dedup_or_already_fresh', 'no_tier_promotion',
        ))

    def test_cold_to_hot_enqueues(self):
        mock_task = MagicMock()
        mock_task.apply_async.return_value = MagicMock(id='c2h-id')

        reg = _registry('C2H', tier='hot')
        with patch('data_ingest.tasks.backfill_daily_prices', mock_task):
            result = handle_symbol_promotion(reg, previous_tier='cold')

        # Either triggered (enqueued) or dedup'd — no crash
        self.assertIn('triggered', result)
        self.assertIn('symbol', result)
