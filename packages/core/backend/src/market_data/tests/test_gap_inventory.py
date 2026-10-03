"""B04 — Coverage Gap Inventory tests."""
from __future__ import annotations

from django.test import TestCase

from market_data.global_symbol_coverage import (
    build_gap_inventory,
    compute_gap_score,
    refresh_gap_scores,
)
from market_data.models import GlobalSymbolCoverage, GlobalSymbolRegistry


def _make_registry(symbol: str, tier: str = 'warm') -> GlobalSymbolRegistry:
    obj, _ = GlobalSymbolRegistry.objects.get_or_create(
        symbol=symbol,
        defaults={
            'is_active': True,
            'current_priority_tier': tier,
        },
    )
    return obj


def _make_coverage(
    symbol: str,
    dataset: str = GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    freshness_state: str = GlobalSymbolCoverage.FreshnessChoices.STALE,
    tier: str = 'warm',
    demand_source: str = 'watchlist',
    gap_days: int = 0,
    gap_score: float = 0.0,
    priority_reason: str = '',
) -> GlobalSymbolCoverage:
    registry = _make_registry(symbol, tier=tier)
    row, _ = GlobalSymbolCoverage.objects.get_or_create(
        registry=registry,
        dataset=dataset,
        defaults={
            'freshness_state': freshness_state,
            'demand_source': demand_source,
            'gap_days': gap_days,
            'gap_score': gap_score,
            'priority_reason': priority_reason,
        },
    )
    return row


# ---------------------------------------------------------------------------
# Unit: compute_gap_score
# ---------------------------------------------------------------------------

class ComputeGapScoreTest(TestCase):
    def test_fresh_symbol_hot_tier_baseline(self):
        score = compute_gap_score(
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
            tier='hot',
            demand_source='portfolio',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            gap_days=0,
        )
        # No freshness penalty; should be tier(40) + demand(20) + dataset(10) = 70
        self.assertEqual(score, 70.0)

    def test_missing_symbol_low_tier(self):
        score = compute_gap_score(
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
            tier='cold',
            demand_source='universe',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            gap_days=0,
        )
        # 28 + 10 + 5 + 10 = 53
        self.assertEqual(score, 53.0)

    def test_gap_days_adds_points(self):
        score_no_gap = compute_gap_score(
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.STALE,
            tier='warm',
            demand_source='watchlist',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            gap_days=0,
        )
        score_with_gap = compute_gap_score(
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.STALE,
            tier='warm',
            demand_source='watchlist',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            gap_days=30,
        )
        self.assertGreater(score_with_gap, score_no_gap)

    def test_score_capped_at_100(self):
        score = compute_gap_score(
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.ERROR,
            tier='hot',
            demand_source='portfolio',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            gap_days=365,
        )
        self.assertLessEqual(score, 100.0)

    def test_score_minimum_zero(self):
        score = compute_gap_score(
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
            tier='',
            demand_source='',
            dataset='unknown_dataset',
            gap_days=0,
        )
        self.assertGreaterEqual(score, 0.0)


# ---------------------------------------------------------------------------
# Integration: build_gap_inventory
# ---------------------------------------------------------------------------

class BuildGapInventoryTest(TestCase):
    def setUp(self):
        _make_coverage('VCB', gap_score=80.0, demand_source='portfolio')
        _make_coverage('FPT', gap_score=50.0, demand_source='watchlist')
        _make_coverage('SSI', gap_score=20.0, demand_source='universe')

    def test_returns_sorted_by_gap_score(self):
        result = build_gap_inventory(
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            limit=10,
        )
        scores = [r['gap_score'] for r in result]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_limit_respected(self):
        result = build_gap_inventory(
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            limit=2,
        )
        self.assertLessEqual(len(result), 2)

    def test_min_score_filter(self):
        result = build_gap_inventory(
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            limit=100,
            min_score=60.0,
        )
        for row in result:
            self.assertGreaterEqual(row['gap_score'], 60.0)

    def test_demand_source_filter(self):
        result = build_gap_inventory(
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            limit=100,
            demand_source='portfolio',
        )
        for row in result:
            self.assertEqual(row['demand_source'], 'portfolio')

    def test_result_contains_expected_fields(self):
        result = build_gap_inventory(
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            limit=1,
        )
        if result:
            row = result[0]
            self.assertIn('symbol', row)
            self.assertIn('gap_score', row)
            self.assertIn('priority_reason', row)
            self.assertIn('freshness_state', row)
            self.assertIn('next_recommended_action', row)


# ---------------------------------------------------------------------------
# Integration: refresh_gap_scores
# ---------------------------------------------------------------------------

class RefreshGapScoresTest(TestCase):
    def setUp(self):
        _make_coverage('HPG', freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
                       demand_source='advisory', gap_score=0.0, priority_reason='')
        _make_coverage('MBB', freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
                       demand_source='universe', gap_score=0.0, priority_reason='')

    def test_refresh_updates_scores(self):
        updated = refresh_gap_scores(dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES)
        self.assertGreater(updated, 0)

    def test_missing_symbol_gets_higher_score_than_fresh(self):
        refresh_gap_scores(dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES)
        hpg = GlobalSymbolCoverage.objects.get(
            registry__symbol='HPG',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        )
        mbb = GlobalSymbolCoverage.objects.get(
            registry__symbol='MBB',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        )
        self.assertGreater(hpg.gap_score, mbb.gap_score)

    def test_priority_reason_populated(self):
        refresh_gap_scores(dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES)
        hpg = GlobalSymbolCoverage.objects.get(
            registry__symbol='HPG',
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        )
        self.assertIn('freshness', hpg.priority_reason)
