from unittest.mock import patch

from django.test import SimpleTestCase
import pandas as pd

from portfolio.adapters import cache_adapter, vnstock_adapter
from portfolio.exceptions import ExternalSystemException


class CacheAdapterTests(SimpleTestCase):
    @patch('portfolio.adapters.cache_adapter.cache.get', return_value={'ok': True})
    def test_get_cache_happy_path(self, _mock_get):
        result = cache_adapter.get_cache('demo:key')
        self.assertEqual(result, {'ok': True})

    @patch('portfolio.adapters.cache_adapter.cache.get', side_effect=RuntimeError('cache down'))
    def test_get_cache_returns_none_on_exception(self, _mock_get):
        result = cache_adapter.get_cache('demo:key')
        self.assertIsNone(result)

    @patch('portfolio.adapters.cache_adapter.cache.set')
    def test_set_cache_happy_path(self, mock_set):
        cache_adapter.set_cache('demo:key', {'value': 1}, timeout=30)
        mock_set.assert_called_once_with('demo:key', {'value': 1}, timeout=30)

    @patch('portfolio.adapters.cache_adapter.cache.set', side_effect=RuntimeError('cache down'))
    def test_set_cache_swallows_exceptions(self, _mock_set):
        cache_adapter.set_cache('demo:key', {'value': 1}, timeout=30)

    @patch('portfolio.adapters.cache_adapter.cache.get', return_value={'triggered_at': 'now'})
    def test_is_vnstock_rate_limited_true_when_key_exists(self, _mock_get):
        self.assertTrue(cache_adapter.is_vnstock_rate_limited('intraday'))

    @patch('portfolio.adapters.cache_adapter.cache.get', return_value=None)
    def test_is_vnstock_rate_limited_false_when_key_missing(self, _mock_get):
        self.assertFalse(cache_adapter.is_vnstock_rate_limited('intraday'))

    @patch('portfolio.adapters.cache_adapter.set_cache')
    def test_mark_vnstock_rate_limited_sets_cache(self, mock_set_cache):
        cache_adapter.mark_vnstock_rate_limited('intraday', '429 Too Many Requests')

        args, kwargs = mock_set_cache.call_args
        self.assertEqual(args[0], 'vnstock:rate-limit:intraday')
        self.assertIn('reason', args[1])
        self.assertEqual(kwargs['timeout'], 20)


class VnstockAdapterTests(SimpleTestCase):
    def test_resolve_price_board_sources_keeps_order_and_dedup(self):
        with patch.dict('os.environ', {'VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES': 'KBS,VCI,KBS'}):
            sources = vnstock_adapter._resolve_price_board_sources(explicit_source='VCI')
        self.assertEqual(sources, ['VCI', 'KBS'])

    def test_run_with_timeout_returns_function_result(self):
        result = vnstock_adapter._run_with_timeout(lambda: {'ok': True}, timeout=2)
        self.assertEqual(result, {'ok': True})

    def test_run_with_timeout_wraps_generic_exception(self):
        def _boom():
            raise RuntimeError('provider failed')

        with self.assertRaises(ExternalSystemException) as ctx:
            vnstock_adapter._run_with_timeout(_boom, timeout=2)

        self.assertEqual(ctx.exception.code, 'vnstock_error')

    @patch('portfolio.adapters.vnstock_adapter.logger.debug')
    def test_read_stream_intraday_ticks_returns_empty_when_reader_fails(self, _mock_debug):
        with patch('portfolio.realtime.stream_reader.StreamReader', side_effect=RuntimeError('redis down')):
            result = vnstock_adapter.read_stream_intraday_ticks('FPT', count=10)

        self.assertEqual(result, [])

    @patch(
        'portfolio.adapters.vnstock_adapter._import_vnstock',
        side_effect=ExternalSystemException('vnstock chưa được cài đặt.', code='vnstock_missing'),
    )
    def test_build_stock_client_raises_vnstock_missing(self, _mock_import):
        with self.assertRaises(ExternalSystemException) as ctx:
            vnstock_adapter._build_stock_client(symbol='FPT', source='VCI')

        self.assertEqual(ctx.exception.code, 'vnstock_missing')

    @patch('portfolio.adapters.vnstock_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnstock_adapter._build_stock_client')
    def test_fetch_financial_ratio_dataframe_uses_timeout_wrapper(self, mock_build_stock, mock_run_timeout):
        fake_client = type('StockClient', (), {'finance': type('FinanceClient', (), {'ratio': lambda *a, **k: {'ok': True}})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = {'rows': 1}

        result = vnstock_adapter.fetch_financial_ratio_dataframe('FPT')

        self.assertEqual(result, {'rows': 1})
        mock_build_stock.assert_called_once_with(symbol='FPT', source='VCI')
        self.assertEqual(mock_run_timeout.call_count, 1)

    @patch('portfolio.adapters.vnstock_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnstock_adapter._build_stock_client')
    def test_fetch_history_dataframe_uses_selected_source(self, mock_build_stock, mock_run_timeout):
        fake_client = type('StockClient', (), {'quote': type('QuoteClient', (), {'history': lambda *a, **k: {'ok': True}})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = {'rows': 5}

        result = vnstock_adapter.fetch_history_dataframe('HPG', start='2026-01-01', end='2026-02-01', interval='1D', source='KBS')

        self.assertEqual(result, {'rows': 5})
        mock_build_stock.assert_called_once_with(symbol='HPG', source='KBS')
        self.assertEqual(mock_run_timeout.call_count, 1)

    def test_normalize_price_board_dataframe_keeps_raw_vnstock_price_units(self):
        source_df = pd.DataFrame(
            [
                [63.0, 61.4, 67.0, 58.0, 63.0, 62.9, 63.1, 100000],
            ],
            columns=pd.MultiIndex.from_tuples(
                [
                    ('match', 'match_price'),
                    ('listing', 'ref_price'),
                    ('listing', 'ceiling'),
                    ('listing', 'floor'),
                    ('bid_ask', 'bid_1_price'),
                    ('bid_ask', 'ask_1_price'),
                    ('match', 'open_price'),
                    ('match', 'accumulated_volume'),
                ]
            ),
        )

        result = vnstock_adapter._normalize_price_board_dataframe(source_df)

        self.assertEqual(result[('match', 'match_price')].iloc[0], 63.0)
        self.assertEqual(result[('listing', 'ref_price')].iloc[0], 61.4)
        self.assertEqual(result[('listing', 'ceiling')].iloc[0], 67.0)
        self.assertEqual(result[('listing', 'floor')].iloc[0], 58.0)
        self.assertEqual(result[('bid_ask', 'bid_1_price')].iloc[0], 63.0)
        self.assertEqual(result[('bid_ask', 'ask_1_price')].iloc[0], 62.9)
        self.assertEqual(result[('match', 'open_price')].iloc[0], 63.1)
        self.assertEqual(result[('match', 'accumulated_volume')].iloc[0], 100000)

    @patch('portfolio.adapters.vnstock_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnstock_adapter._build_stock_client')
    def test_fetch_price_board_dataframe_keeps_raw_vnstock_price_units(self, mock_build_stock, mock_run_timeout):
        fake_client = type('StockClient', (), {'trading': type('TradingClient', (), {'price_board': lambda *a, **k: None})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = pd.DataFrame(
            [[63.0, 61.4]],
            columns=pd.MultiIndex.from_tuples([
                ('match', 'match_price'),
                ('listing', 'ref_price'),
            ]),
        )

        result = vnstock_adapter.fetch_price_board_dataframe(['VNM'], anchor_symbol='VNM')

        self.assertEqual(result[('match', 'match_price')].iloc[0], 63.0)
        self.assertEqual(result[('listing', 'ref_price')].iloc[0], 61.4)

    @patch('portfolio.adapters.vnstock_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnstock_adapter._build_stock_client')
    @patch('portfolio.adapters.vnstock_adapter._resolve_price_board_sources', return_value=['VCI', 'KBS'])
    def test_fetch_price_board_dataframe_fallbacks_on_rate_limit(
        self,
        _mock_sources,
        mock_build_stock,
        mock_run_timeout,
    ):
        first_client = type('StockClient', (), {'trading': type('TradingClient', (), {'price_board': lambda *a, **k: None})()})()
        second_client = type('StockClient', (), {'trading': type('TradingClient', (), {'price_board': lambda *a, **k: None})()})()
        mock_build_stock.side_effect = [first_client, second_client]

        mock_run_timeout.side_effect = [
            ExternalSystemException('429 Too Many Requests', code='vnstock_rate_limited'),
            pd.DataFrame(
                [[63.0, 61.4]],
                columns=pd.MultiIndex.from_tuples([
                    ('match', 'match_price'),
                    ('listing', 'ref_price'),
                ]),
            ),
        ]

        result = vnstock_adapter.fetch_price_board_dataframe(['VNM'], anchor_symbol='VNM')

        self.assertEqual(result[('match', 'match_price')].iloc[0], 63.0)
        self.assertEqual(mock_build_stock.call_count, 2)
