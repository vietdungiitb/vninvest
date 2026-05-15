from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from market_data.global_symbol_coverage import build_global_coverage_summary, build_global_planner_preview, build_symbol_coverage_detail, refresh_global_symbol_coverage
from market_data.global_symbol_registry import upsert_global_symbol_demand
from market_data.models import DailyPrice, GlobalSymbolCoverage, GlobalSymbolDemandSource, GlobalSymbolRegistry, IntradayBar, IntradayTick
from market_serving.models import SessionFacts, SymbolSnapshot


class GlobalSymbolCoverageServiceTestCase(TestCase):
    def _ensure_registry(self, symbol: str) -> GlobalSymbolRegistry:
        registry, _ = upsert_global_symbol_demand(
            symbol=symbol,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref=f'watchlist:test-{symbol.lower()}',
        )
        return registry

    def test_refresh_global_symbol_coverage_populates_all_dataset_rows(self):
        today = date(2026, 5, 15)
        verified_at = timezone.make_aware(datetime.combine(today, time(hour=14, minute=30)))
        registry = self._ensure_registry('FPT')

        DailyPrice.objects.create(
            symbol='FPT',
            date=today - timedelta(days=1),
            open=Decimal('120.00'),
            high=Decimal('121.00'),
            low=Decimal('119.00'),
            close=Decimal('120.50'),
            volume=1000,
        )
        DailyPrice.objects.create(
            symbol='FPT',
            date=today,
            open=Decimal('121.00'),
            high=Decimal('123.00'),
            low=Decimal('120.50'),
            close=Decimal('122.50'),
            volume=1500,
        )
        IntradayBar.objects.create(
            symbol='FPT',
            datetime=verified_at - timedelta(minutes=5),
            timeframe='1M',
            open=Decimal('121.00'),
            high=Decimal('123.00'),
            low=Decimal('120.50'),
            close=Decimal('122.50'),
            volume=500,
        )
        IntradayTick.objects.create(
            symbol='FPT',
            timestamp=verified_at - timedelta(minutes=1),
            price=Decimal('122.50'),
            volume=100,
            side=IntradayTick.SideChoices.BUY,
        )
        SymbolSnapshot.objects.create(
            symbol='FPT',
            session_date=today,
            price=Decimal('122.50'),
            volume=1500,
            stale=False,
        )
        SessionFacts.objects.create(
            symbol='FPT',
            session_date=today,
            stale=False,
        )

        coverage_rows = refresh_global_symbol_coverage(
            registry,
            reference_trade_date=today,
            as_of=verified_at,
        )

        self.assertEqual(len(coverage_rows), 5)
        coverage_by_dataset = {
            row.dataset: row
            for row in GlobalSymbolCoverage.objects.filter(registry=registry)
        }
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES].freshness_state, GlobalSymbolCoverage.FreshnessChoices.FRESH)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT].freshness_state, GlobalSymbolCoverage.FreshnessChoices.FRESH)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS].freshness_state, GlobalSymbolCoverage.FreshnessChoices.FRESH)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS].freshness_state, GlobalSymbolCoverage.FreshnessChoices.FRESH)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS].freshness_state, GlobalSymbolCoverage.FreshnessChoices.FRESH)

        registry.refresh_from_db()
        self.assertEqual(registry.freshness_state_summary, GlobalSymbolCoverage.FreshnessChoices.FRESH)
        self.assertEqual(registry.coverage_state_summary, 'ok')
        self.assertEqual(registry.latest_trade_date, today)
        self.assertIsNotNone(registry.last_hydrated_at)

        detail = build_symbol_coverage_detail(registry)
        self.assertEqual(detail['symbol'], 'FPT')
        self.assertEqual(len(detail['datasets']), 5)

    def test_refresh_global_symbol_coverage_marks_stale_and_missing_datasets(self):
        today = date(2026, 5, 15)
        verified_at = timezone.make_aware(datetime.combine(today, time(hour=14, minute=30)))
        registry = self._ensure_registry('HPG')

        DailyPrice.objects.create(
            symbol='HPG',
            date=today - timedelta(days=5),
            open=Decimal('25.00'),
            high=Decimal('25.50'),
            low=Decimal('24.70'),
            close=Decimal('25.20'),
            volume=1000,
        )
        IntradayBar.objects.create(
            symbol='HPG',
            datetime=verified_at - timedelta(days=2),
            timeframe='1M',
            open=Decimal('25.00'),
            high=Decimal('25.20'),
            low=Decimal('24.90'),
            close=Decimal('25.10'),
            volume=200,
        )
        SessionFacts.objects.create(
            symbol='HPG',
            session_date=today - timedelta(days=1),
            stale=True,
        )

        refresh_global_symbol_coverage(
            registry,
            reference_trade_date=today,
            as_of=verified_at,
        )

        coverage_by_dataset = {
            row.dataset: row
            for row in GlobalSymbolCoverage.objects.filter(registry=registry)
        }
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES].freshness_state, GlobalSymbolCoverage.FreshnessChoices.STALE)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT].freshness_state, GlobalSymbolCoverage.FreshnessChoices.MISSING)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS].freshness_state, GlobalSymbolCoverage.FreshnessChoices.STALE)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS].freshness_state, GlobalSymbolCoverage.FreshnessChoices.MISSING)
        self.assertEqual(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS].freshness_state, GlobalSymbolCoverage.FreshnessChoices.STALE)
        self.assertEqual(
            coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT].next_recommended_action,
            'hydrate_price_board_snapshot',
        )
        self.assertTrue(coverage_by_dataset[GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES].missing_ranges)

        registry.refresh_from_db()
        self.assertEqual(registry.freshness_state_summary, GlobalSymbolCoverage.FreshnessChoices.MISSING)
        self.assertEqual(registry.coverage_state_summary, 'gap')

    def test_build_global_coverage_summary_aggregates_by_dataset(self):
        today = date(2026, 5, 15)
        verified_at = timezone.make_aware(datetime.combine(today, time(hour=14, minute=30)))

        fpt_registry = self._ensure_registry('FPT')
        hpg_registry = self._ensure_registry('HPG')

        DailyPrice.objects.create(
            symbol='FPT',
            date=today,
            open=Decimal('121.00'),
            high=Decimal('123.00'),
            low=Decimal('120.50'),
            close=Decimal('122.50'),
            volume=1500,
        )
        SymbolSnapshot.objects.create(
            symbol='FPT',
            session_date=today,
            price=Decimal('122.50'),
            volume=1500,
            stale=False,
        )
        SessionFacts.objects.create(
            symbol='FPT',
            session_date=today,
            stale=False,
        )
        IntradayBar.objects.create(
            symbol='FPT',
            datetime=verified_at - timedelta(minutes=10),
            timeframe='1M',
            open=Decimal('121.00'),
            high=Decimal('123.00'),
            low=Decimal('120.50'),
            close=Decimal('122.50'),
            volume=500,
        )
        IntradayTick.objects.create(
            symbol='FPT',
            timestamp=verified_at - timedelta(minutes=3),
            price=Decimal('122.50'),
            volume=100,
            side=IntradayTick.SideChoices.BUY,
        )
        DailyPrice.objects.create(
            symbol='HPG',
            date=today - timedelta(days=5),
            open=Decimal('25.00'),
            high=Decimal('25.50'),
            low=Decimal('24.70'),
            close=Decimal('25.20'),
            volume=1000,
        )

        refresh_global_symbol_coverage(fpt_registry, reference_trade_date=today, as_of=verified_at)
        refresh_global_symbol_coverage(hpg_registry, reference_trade_date=today, as_of=verified_at)

        summary = build_global_coverage_summary(top_gap_limit=5)
        dataset_lookup = {row['dataset']: row for row in summary['datasets']}

        self.assertEqual(dataset_lookup[GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES]['fresh'], 1)
        self.assertEqual(dataset_lookup[GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES]['stale'], 1)
        self.assertEqual(dataset_lookup[GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT]['fresh'], 1)
        self.assertEqual(dataset_lookup[GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT]['missing'], 1)
        self.assertGreaterEqual(len(summary['top_gaps']), 1)
        self.assertEqual(summary['top_gaps'][0]['symbol'], 'HPG')
        self.assertIn(summary['top_gaps'][0]['freshness_state'], {'missing', 'stale'})

    def test_build_global_planner_preview_uses_missing_only_policy(self):
        today = date(2026, 5, 15)
        verified_at = timezone.make_aware(datetime.combine(today, time(hour=14, minute=30)))

        fpt_registry = self._ensure_registry('FPT')
        hpg_registry = self._ensure_registry('HPG')

        DailyPrice.objects.create(
            symbol='FPT',
            date=today,
            open=Decimal('121.00'),
            high=Decimal('123.00'),
            low=Decimal('120.50'),
            close=Decimal('122.50'),
            volume=1500,
        )
        SessionFacts.objects.create(
            symbol='FPT',
            session_date=today,
            stale=False,
        )
        DailyPrice.objects.create(
            symbol='HPG',
            date=today - timedelta(days=5),
            open=Decimal('25.00'),
            high=Decimal('25.50'),
            low=Decimal('24.70'),
            close=Decimal('25.20'),
            volume=1000,
        )

        refresh_global_symbol_coverage(fpt_registry, reference_trade_date=today, as_of=verified_at)
        refresh_global_symbol_coverage(hpg_registry, reference_trade_date=today, as_of=verified_at)

        preview = build_global_planner_preview(
            symbols=['FPT', 'HPG'],
            datasets=['daily_prices', 'session_facts'],
            mode='missing_only',
            force_refresh=False,
            reason='manual_preview',
            reference_trade_date=today,
        )

        self.assertEqual(preview['mode'], 'missing_only')
        self.assertEqual(preview['summary']['planned_items'], 2)
        self.assertEqual(preview['summary']['skipped_items'], 2)
        planned_by_key = {(item['symbol'], item['dataset']): item for item in preview['items']}
        skipped_by_key = {(item['symbol'], item['dataset']): item for item in preview['skipped']}

        self.assertEqual(planned_by_key[('HPG', 'daily_prices')]['reason'], 'stale')
        self.assertEqual(planned_by_key[('HPG', 'daily_prices')]['requested_window'], {
            'start_date': '2026-05-11',
            'end_date': '2026-05-15',
        })
        self.assertFalse(planned_by_key[('HPG', 'daily_prices')]['overwrite_existing'])
        self.assertEqual(planned_by_key[('HPG', 'session_facts')]['reason'], 'missing')
        self.assertEqual(planned_by_key[('HPG', 'session_facts')]['coverage_before'], 'missing')
        self.assertEqual(skipped_by_key[('FPT', 'daily_prices')]['reason'], 'coverage_ok')
        self.assertEqual(skipped_by_key[('FPT', 'session_facts')]['reason'], 'coverage_ok')

    def test_build_global_planner_preview_requires_explicit_force_refresh(self):
        today = date(2026, 5, 15)
        verified_at = timezone.make_aware(datetime.combine(today, time(hour=14, minute=30)))
        registry = self._ensure_registry('VCB')

        DailyPrice.objects.create(
            symbol='VCB',
            date=today,
            open=Decimal('88.00'),
            high=Decimal('89.00'),
            low=Decimal('87.50'),
            close=Decimal('88.80'),
            volume=1000,
        )

        refresh_global_symbol_coverage(registry, reference_trade_date=today, as_of=verified_at)

        preview = build_global_planner_preview(
            symbols=['VCB'],
            datasets=['daily_prices'],
            reference_trade_date=today,
        )
        self.assertEqual(preview['summary']['planned_items'], 0)
        self.assertEqual(preview['summary']['skipped_items'], 1)

        forced_preview = build_global_planner_preview(
            symbols=['VCB'],
            datasets=['daily_prices'],
            force_refresh=True,
            reason='operator_manual_run',
            reference_trade_date=today,
        )
        self.assertEqual(forced_preview['summary']['planned_items'], 1)
        item = forced_preview['items'][0]
        self.assertEqual(item['reason'], 'manual_force')
        self.assertTrue(item['overwrite_existing'])
        self.assertEqual(item['coverage_before'], 'fresh')
        self.assertEqual(item['requested_window'], {'trade_date': '2026-05-15'})