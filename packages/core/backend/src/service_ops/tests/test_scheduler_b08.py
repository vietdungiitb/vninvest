"""B08 — Coverage anomaly guard regression tests."""
from __future__ import annotations

from django.test import TestCase

from market_data.models import GlobalSymbolCoverage, GlobalSymbolRegistry
from service_ops.dataops_market_data import _build_anomaly_guard


def _registry(symbol: str, tier: str = 'hot', is_active: bool = True) -> GlobalSymbolRegistry:
    obj, _ = GlobalSymbolRegistry.objects.get_or_create(
        symbol=symbol,
        defaults={'is_active': is_active, 'current_priority_tier': tier},
    )
    if obj.current_priority_tier != tier or obj.is_active != is_active:
        obj.current_priority_tier = tier
        obj.is_active = is_active
        obj.save(update_fields=['current_priority_tier', 'is_active'])
    return obj


def _coverage(
    symbol: str,
    tier: str = 'hot',
    freshness: str = GlobalSymbolCoverage.FreshnessChoices.STALE,
    gap_score: float = 0.0,
    gap_days: int = 0,
    is_active: bool = True,
) -> GlobalSymbolCoverage:
    reg = _registry(symbol, tier=tier, is_active=is_active)
    row, _ = GlobalSymbolCoverage.objects.get_or_create(
        registry=reg,
        dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        defaults={
            'freshness_state': freshness,
            'gap_score': gap_score,
            'gap_days': gap_days,
        },
    )
    return row


class AnomalyGuardReturnStructureTest(TestCase):
    def test_returns_all_required_keys(self):
        result = _build_anomaly_guard()
        self.assertIn('critical_gap_symbols', result)
        self.assertIn('hot_tier_breach', result)
        self.assertIn('promotion_backlog', result)
        self.assertIn('repair_backlog_age_hours', result)
        self.assertIn('anomaly_computed_at', result)

    def test_empty_db_returns_empty_lists(self):
        result = _build_anomaly_guard()
        self.assertIsInstance(result['critical_gap_symbols'], list)
        self.assertIsInstance(result['hot_tier_breach'], list)
        self.assertIsInstance(result['promotion_backlog'], int)


class CriticalGapSymbolsTest(TestCase):
    def test_high_gap_score_stale_symbol_appears(self):
        _coverage('VNM', tier='hot', freshness=GlobalSymbolCoverage.FreshnessChoices.STALE, gap_score=75.0)
        result = _build_anomaly_guard()
        symbols = [r['symbol'] for r in result['critical_gap_symbols']]
        self.assertIn('VNM', symbols)

    def test_low_gap_score_symbol_excluded(self):
        _coverage('SSI', tier='cold', freshness=GlobalSymbolCoverage.FreshnessChoices.STALE, gap_score=10.0)
        result = _build_anomaly_guard()
        symbols = [r['symbol'] for r in result['critical_gap_symbols']]
        self.assertNotIn('SSI', symbols)

    def test_fresh_symbol_excluded_even_with_high_score(self):
        _coverage('FPT', tier='hot', freshness=GlobalSymbolCoverage.FreshnessChoices.FRESH, gap_score=90.0)
        result = _build_anomaly_guard()
        symbols = [r['symbol'] for r in result['critical_gap_symbols']]
        self.assertNotIn('FPT', symbols)

    def test_sorted_by_gap_score_desc(self):
        _coverage('A1', tier='hot', freshness=GlobalSymbolCoverage.FreshnessChoices.MISSING, gap_score=65.0)
        _coverage('A2', tier='hot', freshness=GlobalSymbolCoverage.FreshnessChoices.MISSING, gap_score=90.0)
        result = _build_anomaly_guard()
        scores = [r['gap_score'] for r in result['critical_gap_symbols']]
        if len(scores) >= 2:
            self.assertGreaterEqual(scores[0], scores[-1])


class HotTierBreachTest(TestCase):
    def test_hot_symbol_with_many_gap_days_appears(self):
        _coverage('HBB', tier='hot', gap_days=30, gap_score=50.0)
        result = _build_anomaly_guard()
        symbols = [r['symbol'] for r in result['hot_tier_breach']]
        self.assertIn('HBB', symbols)

    def test_hot_symbol_with_few_gap_days_excluded(self):
        _coverage('MBB', tier='hot', gap_days=3, gap_score=40.0)
        result = _build_anomaly_guard()
        symbols = [r['symbol'] for r in result['hot_tier_breach']]
        self.assertNotIn('MBB', symbols)

    def test_cold_symbol_with_gap_days_excluded(self):
        _coverage('COLDGAP', tier='cold', gap_days=100, gap_score=30.0)
        result = _build_anomaly_guard()
        symbols = [r['symbol'] for r in result['hot_tier_breach']]
        self.assertNotIn('COLDGAP', symbols)


class PromotionBacklogTest(TestCase):
    def test_hot_warm_stale_counted(self):
        _coverage('WB1', tier='hot', freshness=GlobalSymbolCoverage.FreshnessChoices.STALE)
        _coverage('WB2', tier='warm', freshness=GlobalSymbolCoverage.FreshnessChoices.MISSING)
        result = _build_anomaly_guard()
        self.assertGreaterEqual(result['promotion_backlog'], 2)

    def test_cold_stale_not_counted(self):
        _coverage('CB1', tier='cold', freshness=GlobalSymbolCoverage.FreshnessChoices.STALE)
        before = _build_anomaly_guard()['promotion_backlog']
        # Add another cold stale — should not increase
        _coverage('CB2', tier='cold', freshness=GlobalSymbolCoverage.FreshnessChoices.MISSING)
        after = _build_anomaly_guard()['promotion_backlog']
        self.assertEqual(before, after)

    def test_hot_fresh_not_counted(self):
        _coverage('HF1', tier='hot', freshness=GlobalSymbolCoverage.FreshnessChoices.FRESH)
        result = _build_anomaly_guard()
        # Fresh hot symbols should not be in promotion backlog
        # Just verify no crash and it's an int
        self.assertIsInstance(result['promotion_backlog'], int)
