"""Phase 2 (`retire-close-consumers`) — fail-before tests for AC1-AC4."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from advisory.advisory_helpers import build_ohlcv_lookback_context
from advisory.models import AdvisoryRecord
from identity_access.models import CoreTenant
from market_data.cafef.integrity import audit_rows
from market_data.models import DailyPrice, StockProfile
from market_data.pricing import effective_close, effective_ohlc
from market_data.stock_mgmt_native_views import (
    _aggregate_daily_to_ohlcv_bars,
    _build_price_change_map,
    StockManagementDarkMoneyHistoryView,
    StockManagementStockDetailView,
    StockManagementWatchlistTechnicalsView,
)
from market_serving.materializers import materialize_pre_open_snapshots
from market_serving.models import SymbolSnapshot
from market_serving.native_views import build_whale_buckets
from market_serving.vnbroker_materializer import (
    fetch_realtime_tickers_from_vnbroker,
    materialize_symbol_snapshot_from_vnbroker,
)
from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical
from user_workspace.management.commands.seed_qa_user_dataset import Command as SeedCommand
from user_workspace.models import ScreenerRule, ScreenerRunHistory
from user_workspace.portfolio_analytics_views import _benchmark_returns
from user_workspace.screener_helpers import _screener_build_technical

User = get_user_model()


class PricingAndNullPolicyTests(SimpleTestCase):
    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_effective_close_and_ohlc_support_dict_and_null_without_raising(self):
        dict_row = {
            'open': Decimal('43000'),
            'high': Decimal('43500'),
            'low': Decimal('42000'),
            'close': None,
            'adj_close': Decimal('17940'),
            'adj_factor': Decimal('0.5'),
            'price_source': 'vnbroker_fallback',
        }
        self.assertEqual(effective_close(dict_row), Decimal('17940'))
        ohlc = effective_ohlc(dict_row)
        self.assertIsNotNone(ohlc)
        self.assertEqual(ohlc[0], Decimal('21500'))
        self.assertEqual(ohlc[3], Decimal('17940'))

        null_row = SimpleNamespace(
            open=Decimal('100'),
            high=Decimal('110'),
            low=Decimal('90'),
            close=None,
            adj_close=None,
            adj_factor=None,
            price_source='vnbroker_legacy',
        )
        self.assertIsNone(effective_close(null_row))
        self.assertIsNone(effective_ohlc(null_row))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_advisory_helpers_skips_null_close_and_never_emits_zero(self):
        rows = [
            SimpleNamespace(
                date=date(2022, 1, 4),
                open=None,
                high=None,
                low=None,
                close=Decimal('42750'),
                adj_close=Decimal('17940'),
                adj_factor=Decimal('0.4196491228'),
                price_source='vnbroker_fallback',
                volume=1000,
            ),
            SimpleNamespace(
                date=date(2022, 1, 5),
                open=Decimal('100'),
                high=Decimal('110'),
                low=Decimal('90'),
                close=None,
                adj_close=None,
                adj_factor=None,
                price_source='vnbroker_legacy',
                volume=500,
            ),
        ]
        with patch('advisory.advisory_helpers.DailyPrice.objects.filter') as flt:
            flt.return_value.order_by.return_value.__getitem__ = lambda s, k: list(reversed(rows))
            text = build_ohlcv_lookback_context('TPB', limit=2)
        self.assertIn('17,940', text)
        self.assertNotIn('2022-01-05', text)
        self.assertNotIn('| 0 |', text)

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_screener_helpers_skips_null_and_scales_non_cafef_quote(self):
        d0 = date(2022, 1, 4)
        history = [
            SimpleNamespace(
                date=d0 + timedelta(days=i),
                open=Decimal('100'),
                high=None,
                low=None,
                close=Decimal('100'),
                adj_close=Decimal('50'),
                adj_factor=Decimal('0.5'),
                price_source='vnbroker_fallback',
                adj_basis='anchor_provider',
                volume=1000,
            )
            for i in range(51)
        ]
        # Inject a NULL-close row that must be skipped, NOT coerced to 0.0
        history.insert(
            10,
            SimpleNamespace(
                date=d0 + timedelta(days=99),
                open=Decimal('100'),
                high=Decimal('110'),
                low=Decimal('90'),
                close=None,
                adj_close=None,
                adj_factor=None,
                price_source='vnbroker_legacy',
                adj_basis='',
                volume=1000,
            ),
        )
        tech = _screener_build_technical('TPB', Decimal('100'), 1000, history)
        self.assertEqual(tech['sma20'], 50.0)
        self.assertEqual(tech['lo52'], 50.0)
        self.assertEqual(tech['price_vs_sma20_pct'], 0.0)

    def test_integrity_counts_adj_close_null_without_violation(self):
        rows = [
            {
                'symbol': 'TPB',
                'date': date(2026, 1, 5),
                'price_source': 'vnbroker_fallback',
                'close': Decimal('16.60'),
                'adj_close': Decimal('13.93'),
                'adj_factor': Decimal('13.93') / Decimal('16.60'),
            },
            {
                'symbol': 'AAA',
                'date': date(2026, 1, 5),
                'price_source': 'vnbroker_legacy',
                'close': Decimal('12.00'),
                'adj_close': None,
                'adj_factor': None,
            },
            {
                'symbol': 'BBB',
                'date': date(2026, 1, 5),
                'price_source': 'unmapped_cafef',
                'close': Decimal('20.00'),
                'adj_close': None,
                'adj_factor': None,
            },
        ]
        report = audit_rows(rows)
        self.assertTrue(report['ok'])
        self.assertNotIn('adj_close_null', report['violations'])
        self.assertEqual(report['counts']['adj_close_null'], 2)


class AdjustedConsumersDbTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.yesterday = self.today - timedelta(days=1)
        StockProfile.objects.create(
            symbol='TPB',
            company_name='TPBank',
            exchange='HOSE',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=self.yesterday,
            open=Decimal('43000'),
            high=Decimal('43500'),
            low=Decimal('42000'),
            close=Decimal('42750'),
            adj_close=Decimal('17940'),
            adj_factor=Decimal('0.4196491228'),
            price_source='vnbroker_fallback',
            adj_basis='anchor_provider',
            volume=1000,
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=self.today,
            open=Decimal('44000'),
            high=Decimal('44500'),
            low=Decimal('43000'),
            close=Decimal('43500'),
            adj_close=Decimal('18200'),
            adj_factor=Decimal('0.4183908046'),
            price_source='vnbroker_fallback',
            adj_basis='anchor_provider',
            volume=1500,
        )

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_whale_buckets_uses_effective_close_and_no_fake_zero(self):
        # Unmapped symbol: empty DailyPrice bucket must be dropped; tick bucket -> price=None
        unmapped_date = self.today
        DailyPrice.objects.create(
            symbol='UNM',
            date=unmapped_date,
            open=Decimal('10000'),
            high=Decimal('10000'),
            low=Decimal('10000'),
            close=Decimal('10000'),
            adj_close=None,
            adj_factor=None,
            price_source='unmapped_cafef',
            volume=100,
        )
        tpb_buckets = build_whale_buckets('TPB', '1D')
        tpb_by_date = {b['bucket_ts'][:10]: b for b in tpb_buckets}
        self.assertEqual(tpb_by_date[self.today.isoformat()]['price'], 18200.0)

        # Empty unmapped bucket is omitted
        self.assertEqual(build_whale_buckets('UNM', '1D'), [])

        # Tick-bearing unmapped bucket gets price=None (not 0.0)
        now_dt = timezone.make_aware(
            datetime.combine(unmapped_date, time(10, 0)),
            timezone.get_current_timezone(),
        )
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='UNM',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale tick UNM',
            value='600000000',
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=unmapped_date,
            triggered_at=now_dt,
            source_ref='whale_tick:UNM:test1',
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='UNM',
            session_date=unmapped_date,
            side=WhaleAlertCanonical.SideChoices.BUY,
            price='10000.00',
            volume=60000,
            matched_value=600000000,
            executed_at=now_dt,
        )
        unm_buckets = build_whale_buckets('UNM', '1D')
        self.assertEqual(len(unm_buckets), 1)
        self.assertIsNone(unm_buckets[0]['price'])

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_vnbroker_materializer_uses_effective_close(self):
        live = {'close': 18500, 'volume': 100, 'fetched_at': 'now'}
        with patch('market_data.vnbroker_adapter.fetch_realtime_price', return_value=live):
            out = fetch_realtime_tickers_from_vnbroker(['TPB'])
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]['reference_price'], 17940.0)

        with patch('market_data.vnbroker_adapter.fetch_price_board_snapshots_batch', return_value={}):
            res = materialize_symbol_snapshot_from_vnbroker(symbols=['TPB'])
        self.assertEqual(res['status'], 'ok')
        snap = SymbolSnapshot.objects.get(symbol='TPB', session_date=self.today)
        self.assertEqual(snap.price, Decimal('18200.00'))
        self.assertEqual(snap.reference_price, Decimal('17940.00'))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_pre_open_materializer_uses_effective_close_and_skips_unmapped(self):
        StockProfile.objects.create(
            symbol='UNM',
            company_name='Unmapped',
            exchange='HOSE',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        DailyPrice.objects.create(
            symbol='UNM',
            date=self.today,
            open=Decimal('10000'),
            high=Decimal('10000'),
            low=Decimal('10000'),
            close=Decimal('10000'),
            adj_close=None,
            adj_factor=None,
            price_source='unmapped_cafef',
            volume=100,
        )
        res = materialize_pre_open_snapshots(symbols=['TPB', 'UNM'], as_of_date=self.today)
        self.assertIn('UNM', res['missing_symbols'])
        snap = SymbolSnapshot.objects.get(symbol='TPB', session_date=self.today)
        self.assertEqual(snap.price, Decimal('18200.00'))
        self.assertEqual(snap.reference_price, Decimal('17940.00'))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_stock_mgmt_native_views_uses_effective_close_and_preserves_s6_guard(self):
        pm = _build_price_change_map(['TPB'])
        self.assertEqual(pm['TPB']['current_price'], 18200.0)

        # Stock detail overview + watchlist technicals + dark money marker
        user = User.objects.create_user(username='retire-close-user', email='rc@test.local', password='pass123')
        client = APIClient()
        client.force_authenticate(user=user)

        detail_resp = client.get('/core/v1/stock-management/stocks/TPB/')
        self.assertEqual(detail_resp.status_code, 200)
        detail_data = detail_resp.json().get('data', detail_resp.json())
        self.assertEqual(detail_data['current_price'], 18200.0)
        self.assertEqual(detail_data['reference_price'], 17940.0)

        tech_resp = client.post(
            '/core/v1/stock-management/stocks/watchlist/technicals/',
            {'symbols': ['TPB']},
            format='json',
        )
        self.assertEqual(tech_resp.status_code, 200)
        tech_data = tech_resp.json().get('data', tech_resp.json())
        self.assertEqual(tech_data['results'][0]['price'], 18200.0)

        # _aggregate_daily_to_ohlcv_bars: unmapped skipped + vnbroker_legacy stays raw
        rows = [
            SimpleNamespace(
                date=date(2024, 1, 1),
                open=Decimal('100'),
                high=Decimal('100'),
                low=Decimal('100'),
                close=Decimal('100'),
                volume=100,
                adj_close=Decimal('50'),
                adj_factor=Decimal('0.5'),
                price_source='cafef',
                adj_basis='anchor_provider',
            ),
            SimpleNamespace(
                date=date(2024, 1, 2),
                open=Decimal('999'),
                high=Decimal('999'),
                low=Decimal('999'),
                close=Decimal('999'),
                volume=100,
                adj_close=None,
                adj_factor=None,
                price_source='unmapped_cafef',
                adj_basis='',
            ),
        ]
        bars = _aggregate_daily_to_ohlcv_bars(rows, 'W', adjusted=True)
        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0]['close'], 50.0)

        legacy_stale = [
            SimpleNamespace(
                date=date(2024, 1, 8),
                open=Decimal('100'),
                high=Decimal('100'),
                low=Decimal('100'),
                close=Decimal('100'),
                volume=100,
                adj_close=Decimal('50'),
                adj_factor=Decimal('0.5'),
                price_source='vnbroker_legacy',
                adj_basis='',
            ),
        ]
        legacy_bars = _aggregate_daily_to_ohlcv_bars(legacy_stale, 'W', adjusted=True)
        self.assertEqual(legacy_bars[0]['close'], 100.0)

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_advisory_backtest_and_portfolio_analytics_and_seed_use_effective_close(self):
        user = User.objects.create_user(username='retire-adv-user', email='radv@test.local', password='pass123')
        tenant = CoreTenant.objects.create(
            owner_user=user, tenant_code='retire_t', display_name='Retire T', status='active', plan='pro',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        # Create 7 days of adjusted DailyPrice for TPB + 1 unmapped_cafef day
        d_base = self.today - timedelta(days=10)
        for offset in range(7):
            day = d_base + timedelta(days=offset)
            DailyPrice.objects.update_or_create(
                symbol='TPB',
                date=day,
                defaults={
                    'open': Decimal('40000'),
                    'high': Decimal('41000'),
                    'low': Decimal('39000'),
                    'close': Decimal('40000') + Decimal(offset * 100),
                    'adj_close': Decimal('20000') + Decimal(offset * 100),
                    'adj_factor': Decimal('0.5'),
                    'price_source': 'vnbroker_fallback',
                    'adj_basis': 'anchor_provider',
                    'volume': 1000,
                },
            )
        DailyPrice.objects.update_or_create(
            symbol='TPB',
            date=d_base + timedelta(days=7),
            defaults={
                'open': Decimal('99999'),
                'high': Decimal('99999'),
                'low': Decimal('99999'),
                'close': Decimal('99999'),
                'adj_close': None,
                'adj_factor': None,
                'price_source': 'unmapped_cafef',
                'adj_basis': '',
                'volume': 1000,
            },
        )
        AdvisoryRecord.objects.create(
            user=user,
            symbol='TPB',
            session_date=d_base,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            structured_output={'signal': 'BUY'},
        )
        adv_resp = client.get('/core/v1/advisory/backtest/TPB/?window=30')
        self.assertEqual(adv_resp.status_code, 200)
        adv_data = adv_resp.json().get('data', adv_resp.json())
        self.assertEqual(adv_data['samples'][0]['base_close'], 20000.0)

        # _benchmark_returns skips unmapped and uses adj_close
        rets, reason = _benchmark_returns('TPB', d_base, d_base + timedelta(days=7))
        self.assertIsNone(reason)
        self.assertAlmostEqual(rets[0], (20100.0 - 20000.0) / 20000.0, places=6)

        # ScreenerHistoryBacktestView uses adj_close for exit price
        rule = ScreenerRule.objects.create(
            user=user, tenant=tenant, name='R', rules_json=[{'field': 'close', 'op': 'gt', 'value': 0}],
        )
        hist = ScreenerRunHistory.objects.create(
            user=user,
            tenant=tenant,
            rule=rule,
            rule_name='R',
            matched_count=1,
            total_scanned=1,
            window_days=35,
            session_date=self.yesterday,
            matched=[{'symbol': 'TPB', 'close': 17000.0, 'action': 'BUY'}],
            params={},
        )
        ScreenerRunHistory.objects.filter(pk=hist.pk).update(
            run_at=timezone.make_aware(datetime.combine(self.yesterday, time(9, 0)), timezone.get_current_timezone())
        )
        bt_resp = client.get(f'/core/v1/screener/history/{hist.pk}/backtest/?horizon=1')
        self.assertEqual(bt_resp.status_code, 200)
        bt_data = bt_resp.json().get('data', bt_resp.json())
        self.assertEqual(bt_data['trades'][0]['exit'], 18200.0)

        # seed_qa_user_dataset._price_map uses adj_close
        DailyPrice.objects.create(
            symbol='VCB',
            date=self.today,
            open=Decimal('90000'),
            high=Decimal('90000'),
            low=Decimal('90000'),
            close=Decimal('90000'),
            adj_close=Decimal('60000'),
            adj_factor=Decimal('0.6666666667'),
            price_source='vnbroker_fallback',
            adj_basis='anchor_provider',
            volume=1000,
        )
        price_map = SeedCommand()._price_map()
        self.assertEqual(price_map['VCB'], 60000.0)
