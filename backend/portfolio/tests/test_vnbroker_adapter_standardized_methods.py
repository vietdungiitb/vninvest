from django.test import SimpleTestCase
from unittest.mock import patch

import pandas as pd

from portfolio.adapters import vnbroker_adapter


class _FakeFinance:
    def fundamental_snapshot(self, **kwargs):
        return pd.DataFrame(
            [
                {
                    'report_date': '2025-12-31',
                    'metric': 'roe',
                    'value': 17.5,
                    'unit': '%',
                }
            ]
        )

    def industry_peers(self, **kwargs):
        return pd.DataFrame([{'peer_symbol': 'VCB'}, {'peer_symbol': 'BID'}])

    def industry_benchmark(self, **kwargs):
        return pd.DataFrame([{'peer_symbol': 'VCB', 'metric': 'roe', 'industry_median': 14.2}])

    def industry_rank(self, **kwargs):
        return pd.DataFrame([{'peer_symbol': 'VCB', 'rank': 1, 'percentile': 98.0, 'zscore': 1.8}])


class _FakeCompany:
    def insider_deals(self, **kwargs):
        return pd.DataFrame(
            [
                {
                    'announce_date': '2025-06-01',
                    'deal_date': '2025-06-03',
                    'actor_name': 'Nguyen Van A',
                    'actor_type': 'insider',
                    'action': 'buy',
                    'quantity': 120000,
                    'price': 68.5,
                    'ratio': 0.02,
                    'note': 'Test data',
                }
            ]
        )


class _FakeStockClient:
    finance = _FakeFinance()
    company = _FakeCompany()


class vnbrokerAdapterStandardizedMethodsTests(SimpleTestCase):
    def _run_inline(self, fn, timeout=0):
        return fn()

    @patch.object(vnbroker_adapter, '_resolve_financial_ratio_sources', return_value=['AUTO'])
    @patch.object(vnbroker_adapter, '_build_stock_client', return_value=_FakeStockClient())
    @patch.object(vnbroker_adapter, '_run_with_timeout')
    @patch.object(vnbroker_adapter, '_get_runtime_settings', return_value={})
    def test_fundamental_snapshot_returns_canonical_schema(self, _runtime_cfg_mock, run_with_timeout_mock, *_):
        run_with_timeout_mock.side_effect = self._run_inline

        frame = vnbroker_adapter.fetch_fundamental_snapshot_dataframe(
            'vcb',
            metrics=['roe', 'eps'],
            period='annual',
            source='AUTO',
        )

        self.assertEqual(
            list(frame.columns),
            ['symbol', 'period', 'report_date', 'metric', 'value', 'unit', 'source', 'source_used'],
        )
        self.assertEqual(frame.iloc[0]['symbol'], 'VCB')
        self.assertEqual(frame.iloc[0]['period'], 'year')
        self.assertEqual(frame.iloc[0]['metric'], 'roe')
        self.assertEqual(frame.iloc[0]['source_used'], 'AUTO')

    @patch.object(vnbroker_adapter, '_resolve_financial_ratio_sources', return_value=['AUTO'])
    @patch.object(vnbroker_adapter, '_build_stock_client', return_value=_FakeStockClient())
    @patch.object(vnbroker_adapter, '_run_with_timeout')
    @patch.object(vnbroker_adapter, '_get_runtime_settings', return_value={})
    def test_insider_deals_returns_canonical_schema(self, _runtime_cfg_mock, run_with_timeout_mock, *_):
        run_with_timeout_mock.side_effect = self._run_inline

        frame = vnbroker_adapter.fetch_insider_deals_dataframe(
            'vcb',
            page=1,
            page_size=20,
            start_date='2025-01-01',
            end_date='2025-12-31',
            standardize=True,
        )

        self.assertEqual(
            list(frame.columns),
            [
                'symbol',
                'announce_date',
                'deal_date',
                'actor_name',
                'actor_type',
                'action',
                'quantity',
                'price',
                'ratio',
                'note',
                'source',
                'source_used',
            ],
        )
        self.assertEqual(frame.iloc[0]['symbol'], 'VCB')
        self.assertEqual(frame.iloc[0]['action'], 'BUY')
        self.assertEqual(frame.iloc[0]['source_used'], 'AUTO')

    @patch.object(vnbroker_adapter, '_resolve_financial_ratio_sources', return_value=['AUTO'])
    @patch.object(vnbroker_adapter, '_build_stock_client', return_value=_FakeStockClient())
    @patch.object(vnbroker_adapter, '_run_with_timeout')
    @patch.object(vnbroker_adapter, '_get_runtime_settings', return_value={})
    def test_industry_methods_attach_source_columns(self, _runtime_cfg_mock, run_with_timeout_mock, *_):
        run_with_timeout_mock.side_effect = self._run_inline

        peers = vnbroker_adapter.fetch_industry_peers_dataframe('VCB', source='AUTO')
        benchmark = vnbroker_adapter.fetch_industry_benchmark_dataframe('VCB', metrics=['roe'], source='AUTO')
        rank = vnbroker_adapter.fetch_industry_rank_dataframe('VCB', metric='roe', source='AUTO')

        for frame in [peers, benchmark, rank]:
            self.assertIn('source', frame.columns)
            self.assertIn('source_used', frame.columns)
            self.assertEqual(frame.iloc[0]['source_used'], 'AUTO')
