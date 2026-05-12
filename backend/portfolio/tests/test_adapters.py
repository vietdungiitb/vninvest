from unittest.mock import patch

from django.test import SimpleTestCase
import pandas as pd

from portfolio.adapters import cache_adapter, vnbroker_adapter
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
    def test_is_vnbroker_rate_limited_true_when_key_exists(self, _mock_get):
        self.assertTrue(cache_adapter.is_vnbroker_rate_limited('intraday'))

    @patch('portfolio.adapters.cache_adapter.cache.get', return_value=None)
    def test_is_vnbroker_rate_limited_false_when_key_missing(self, _mock_get):
        self.assertFalse(cache_adapter.is_vnbroker_rate_limited('intraday'))

    @patch('portfolio.adapters.cache_adapter.set_cache')
    def test_mark_vnbroker_rate_limited_sets_cache(self, mock_set_cache):
        cache_adapter.mark_vnbroker_rate_limited('intraday', '429 Too Many Requests')

        args, kwargs = mock_set_cache.call_args
        self.assertEqual(args[0], 'vnbroker:rate-limit:intraday')
        self.assertIn('reason', args[1])
        self.assertEqual(kwargs['timeout'], 20)


class VnbrokerAdapterTests(SimpleTestCase):
    databases = {'default'}

    def setUp(self):
        super().setUp()
        vnbroker_adapter._VNBROKER_PROVIDER_CACHE.clear()
        vnbroker_adapter._VNBROKER_STOCK_CLIENT_CACHE.clear()

    @patch('portfolio.adapters.vnbroker_adapter.get_vnbroker_runtime_settings', return_value={})
    def test_resolve_price_board_sources_keeps_order_and_dedup(self, _mock_settings):
        with patch.dict('os.environ', {'VNBROKER_PRICE_BOARD_FALLBACK_SOURCES': 'KBS,VCI,KBS'}):
            sources = vnbroker_adapter._resolve_price_board_sources(explicit_source='VCI')
        self.assertEqual(sources, ['VCI', 'KBS'])

    @patch('portfolio.adapters.vnbroker_adapter.get_vnbroker_runtime_settings', return_value={})
    def test_resolve_financial_ratio_sources_keeps_order_and_dedup(self, _mock_settings):
        with patch.dict('os.environ', {'VNBROKER_FINANCIAL_RATIO_FALLBACK_SOURCES': 'TCBS,VCI,TCBS'}):
            sources = vnbroker_adapter._resolve_financial_ratio_sources(explicit_source='AUTO')
        self.assertEqual(sources, ['AUTO', 'TCBS', 'VCI'])

    @patch('portfolio.adapters.vnbroker_adapter.resolve_provider_order', side_effect=lambda channel, sources, **kwargs: sources)
    @patch(
        'portfolio.adapters.vnbroker_adapter.get_vnbroker_runtime_settings',
        return_value={
            'source_config': {'price_board': {'primary': 'SSI'}},
            'price_board_source': 'KBS',
            'fallback_sources': ['VCI'],
        },
    )
    def test_resolve_price_board_sources_prefers_source_config_primary(self, _mock_settings, mock_resolve_order):
        sources = vnbroker_adapter._resolve_price_board_sources()

        self.assertEqual(sources, ['SSI', 'VCI'])
        mock_resolve_order.assert_called_once_with('price_board', ['SSI', 'VCI'])

    @patch(
        'portfolio.adapters.vnbroker_adapter.get_vnbroker_runtime_settings',
        return_value={'price_board_source': 'KBS', 'fallback_sources': ['VCI', 'KBS']},
    )
    def test_resolve_intraday_sources_uses_runtime_config_order(self, _mock_settings):
        sources = vnbroker_adapter._resolve_intraday_sources()

        self.assertEqual(sources, ['KBS', 'VCI'])

    def test_run_with_timeout_returns_function_result(self):
        result = vnbroker_adapter._run_with_timeout(lambda: {'ok': True}, timeout=2)
        self.assertEqual(result, {'ok': True})

    def test_run_with_timeout_wraps_generic_exception(self):
        def _boom():
            raise RuntimeError('provider failed')

        with self.assertRaises(ExternalSystemException) as ctx:
            vnbroker_adapter._run_with_timeout(_boom, timeout=2)

        self.assertEqual(ctx.exception.code, 'vnbroker_error')

    @patch('portfolio.adapters.vnbroker_adapter.logger.debug')
    def test_read_stream_intraday_ticks_returns_empty_when_reader_fails(self, _mock_debug):
        with patch('portfolio.realtime.stream_reader.StreamReader', side_effect=RuntimeError('redis down')):
            result = vnbroker_adapter.read_stream_intraday_ticks('FPT', count=10)

        self.assertEqual(result, [])

    @patch(
        'portfolio.adapters.vnbroker_adapter._import_vnbroker',
        side_effect=ExternalSystemException('vnbroker chưa được cài đặt.', code='vnbroker_missing'),
    )
    def test_build_stock_client_raises_vnbroker_missing(self, _mock_import):
        with self.assertRaises(ExternalSystemException) as ctx:
            vnbroker_adapter._build_stock_client(symbol='FPT', source='VCI')

        self.assertEqual(ctx.exception.code, 'vnbroker_missing')

    @patch('portfolio.adapters.vnbroker_adapter._import_vnbroker')
    def test_build_stock_client_maps_rate_limit_error(self, mock_import):
        class _vnbrokerStub:
            def stock(self, symbol, source):
                raise ConnectionError('Failed to fetch data: 429 - Too Many Requests')

        mock_import.return_value = _vnbrokerStub

        with self.assertRaises(ExternalSystemException) as ctx:
            vnbroker_adapter._build_stock_client(symbol='FPT', source='VCI')

        self.assertEqual(ctx.exception.code, 'vnbroker_rate_limited')

    @patch('portfolio.adapters.vnbroker_adapter._import_vnbroker')
    def test_build_stock_client_reuses_cached_instance_when_enabled(self, mock_import):
        class _Provider:
            def __init__(self):
                self.calls = 0

            def stock(self, symbol, source):
                self.calls += 1
                return {'symbol': symbol, 'source': source, 'instance': self.calls}

        provider = _Provider()
        mock_import.return_value = lambda: provider

        with patch.dict(
            'os.environ',
            {
                'VNBROKER_PROVIDER_CACHE_ENABLED': 'True',
                'VNBROKER_CLIENT_CACHE_ENABLED': 'True',
                'VNBROKER_PROVIDER_CACHE_TTL_SECONDS': '900',
                'VNBROKER_CLIENT_CACHE_TTL_SECONDS': '900',
            },
            clear=False,
        ):
            first = vnbroker_adapter._build_stock_client(symbol='FPT', source='VCI')
            second = vnbroker_adapter._build_stock_client(symbol='FPT', source='VCI')

        self.assertEqual(provider.calls, 1)
        self.assertEqual(first, second)

    @patch('portfolio.adapters.vnbroker_adapter._import_vnbroker')
    def test_build_stock_client_does_not_cache_when_disabled(self, mock_import):
        class _Provider:
            def __init__(self):
                self.calls = 0

            def stock(self, symbol, source):
                self.calls += 1
                return {'symbol': symbol, 'source': source, 'instance': self.calls}

        provider = _Provider()
        mock_import.return_value = lambda: provider

        with patch.dict(
            'os.environ',
            {
                'VNBROKER_PROVIDER_CACHE_ENABLED': 'False',
                'VNBROKER_CLIENT_CACHE_ENABLED': 'False',
            },
            clear=False,
        ):
            first = vnbroker_adapter._build_stock_client(symbol='FPT', source='VCI')
            second = vnbroker_adapter._build_stock_client(symbol='FPT', source='VCI')

        self.assertEqual(provider.calls, 2)
        self.assertNotEqual(first['instance'], second['instance'])

    @patch('portfolio.adapters.vnbroker_adapter.logger.warning')
    @patch('portfolio.adapters.vnbroker_adapter._import_vnbroker')
    def test_build_stock_client_logs_missing_data_payload_warning(self, mock_import, mock_warning):
        class _vnbrokerStub:
            def stock(self, symbol, source):
                raise KeyError('data')

        mock_import.return_value = _vnbrokerStub

        with self.assertRaises(ExternalSystemException) as ctx:
            vnbroker_adapter._build_stock_client(symbol='FPT', source='AUTO')

        self.assertEqual(ctx.exception.code, 'vnbroker_error')
        mock_warning.assert_called()

    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_financial_ratio_dataframe_uses_timeout_wrapper(self, mock_build_stock, mock_run_timeout):
        fake_client = type('StockClient', (), {'finance': type('FinanceClient', (), {'ratio': lambda *a, **k: {'ok': True}})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = {'rows': 1}

        result = vnbroker_adapter.fetch_financial_ratio_dataframe('FPT')

        self.assertEqual(result, {'rows': 1})
        mock_build_stock.assert_called_once_with(symbol='FPT', source='AUTO')
        self.assertEqual(mock_run_timeout.call_count, 1)

    @patch('portfolio.adapters.vnbroker_adapter._resolve_financial_ratio_sources', return_value=['AUTO', 'TCBS'])
    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_financial_ratio_dataframe_fallbacks_to_next_source(
        self,
        mock_build_stock,
        mock_run_timeout,
        _mock_sources,
    ):
        first_client = type('StockClient', (), {'finance': type('FinanceClient', (), {'ratio': lambda *a, **k: None})()})()
        second_client = type('StockClient', (), {'finance': type('FinanceClient', (), {'ratio': lambda *a, **k: None})()})()
        mock_build_stock.side_effect = [first_client, second_client]
        mock_run_timeout.side_effect = [
            ExternalSystemException('primary failed', code='vnbroker_error'),
            pd.DataFrame([{'year': 2025, 'pe': 10.2}]),
        ]

        result = vnbroker_adapter.fetch_financial_ratio_dataframe('FPT')

        self.assertEqual(result.attrs.get('financial_ratio_source'), 'TCBS')
        self.assertEqual(mock_build_stock.call_count, 2)

    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_history_dataframe_uses_selected_source(self, mock_build_stock, mock_run_timeout):
        fake_client = type('StockClient', (), {'quote': type('QuoteClient', (), {'history': lambda *a, **k: {'ok': True}})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = {'rows': 5}

        result = vnbroker_adapter.fetch_history_dataframe('HPG', start='2026-01-01', end='2026-02-01', interval='1D', source='KBS')

        self.assertEqual(result, {'rows': 5})
        mock_build_stock.assert_called_once_with(symbol='HPG', source='KBS')
        self.assertEqual(mock_run_timeout.call_count, 1)

    @patch('portfolio.adapters.vnbroker_adapter._resolve_intraday_sources', return_value=['VCI', 'KBS'])
    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_intraday_dataframe_fallbacks_to_next_runtime_provider(
        self,
        mock_build_stock,
        mock_run_timeout,
        _mock_sources,
    ):
        first_client = type('StockClient', (), {'quote': type('QuoteClient', (), {'intraday': lambda *a, **k: None})()})()
        second_client = type('StockClient', (), {'quote': type('QuoteClient', (), {'intraday': lambda *a, **k: None})()})()
        mock_build_stock.side_effect = [first_client, second_client]
        mock_run_timeout.side_effect = [
            ExternalSystemException('provider init failed', code='vnbroker_error'),
            pd.DataFrame([
                {'time': '2026-04-16T14:08:59+07:00', 'price': 81000, 'volume': 200, 'match_type': 'buy'},
            ]),
        ]

        result = vnbroker_adapter.fetch_intraday_dataframe('MWG', page_size=5)

        self.assertEqual(mock_build_stock.call_count, 2)
        self.assertEqual(result['price'].iloc[0], 81.0)
        self.assertEqual(result.attrs.get('intraday_source'), 'KBS')
        self.assertEqual(result.attrs.get('price_unit_canonical'), 'THOUSAND_VND')

    @patch('portfolio.adapters.vnbroker_adapter._resolve_listing_sources', return_value=['KBS'])
    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_listing_symbols_dataframe_uses_runtime_provider_chain(
        self,
        mock_build_stock,
        mock_run_timeout,
        _mock_sources,
    ):
        fake_client = type('StockClient', (), {'listing': type('ListingClient', (), {'all_symbols': lambda *a, **k: {'ok': True}})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = {'rows': 1}

        result = vnbroker_adapter.fetch_listing_symbols_dataframe('HPG')

        self.assertEqual(result, {'rows': 1})
        mock_build_stock.assert_called_once_with(symbol='HPG', source='KBS')
        self.assertEqual(mock_run_timeout.call_count, 1)

    @patch('portfolio.adapters.vnbroker_adapter._resolve_listing_sources', return_value=['VCI'])
    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_symbols_by_industries_dataframe_uses_adapter_runtime_chain(
        self,
        mock_build_stock,
        mock_run_timeout,
        _mock_sources,
    ):
        fake_client = type('StockClient', (), {'listing': type('ListingClient', (), {'symbols_by_industries': lambda *a, **k: None})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = pd.DataFrame([{'symbol': 'VCB', 'industry_code': 101, 'industry_name': 'Ngan hang'}])

        result = vnbroker_adapter.fetch_symbols_by_industries_dataframe(anchor_symbol='ACB', source='VCI')

        self.assertEqual(result.iloc[0]['symbol'], 'VCB')
        mock_build_stock.assert_called_once_with(symbol='ACB', source='VCI')

    @patch('portfolio.adapters.vnbroker_adapter._resolve_listing_sources', return_value=['VCI'])
    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_symbols_by_group_series_returns_series(
        self,
        mock_build_stock,
        mock_run_timeout,
        _mock_sources,
    ):
        fake_client = type('StockClient', (), {'listing': type('ListingClient', (), {'symbols_by_group': lambda *a, **k: None})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = pd.Series(['VCB', 'BID'])

        result = vnbroker_adapter.fetch_symbols_by_group_series('VN30', anchor_symbol='ACB', source='VCI')

        self.assertEqual(result.tolist(), ['VCB', 'BID'])
        mock_build_stock.assert_called_once_with(symbol='ACB', source='VCI')

    @patch('portfolio.adapters.vnbroker_adapter._resolve_listing_sources', return_value=['VCI'])
    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_symbols_by_exchange_dataframe_returns_dataframe(
        self,
        mock_build_stock,
        mock_run_timeout,
        _mock_sources,
    ):
        fake_client = type('StockClient', (), {'listing': type('ListingClient', (), {'symbols_by_exchange': lambda *a, **k: None})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = pd.DataFrame([{'symbol': 'VCB', 'organ_name': 'Vietcombank', 'exchange': 'HOSE'}])

        result = vnbroker_adapter.fetch_symbols_by_exchange_dataframe(anchor_symbol='ACB', source='VCI')

        self.assertEqual(result.iloc[0]['exchange'], 'HOSE')
        mock_build_stock.assert_called_once_with(symbol='ACB', source='VCI')

    def test_normalize_price_board_dataframe_keeps_raw_vnbroker_price_units(self):
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

        result = vnbroker_adapter._normalize_price_board_dataframe(source_df)

        self.assertEqual(result[('match', 'match_price')].iloc[0], 63.0)
        self.assertEqual(result[('listing', 'ref_price')].iloc[0], 61.4)
        self.assertEqual(result[('listing', 'ceiling')].iloc[0], 67.0)
        self.assertEqual(result[('listing', 'floor')].iloc[0], 58.0)
        self.assertEqual(result[('bid_ask', 'bid_1_price')].iloc[0], 63.0)
        self.assertEqual(result[('bid_ask', 'ask_1_price')].iloc[0], 62.9)
        self.assertEqual(result[('match', 'open_price')].iloc[0], 63.1)
        self.assertEqual(result[('match', 'accumulated_volume')].iloc[0], 100000)

    def test_normalize_price_board_dataframe_maps_flat_rows_to_parseable_multiindex(self):
        source_df = pd.DataFrame(
            [
                {
                    'symbol': 'FPT',
                    'ref_price': 118.0,
                    'match_price': 119.2,
                    'highest': 120.0,
                    'lowest': 117.3,
                    'open_price': 118.4,
                    'accumulated_volume': 987654,
                },
                {
                    'symbol': 'HPG',
                    'ref_price': 25.1,
                    'match_price': 25.6,
                    'highest': 25.8,
                    'lowest': 25.0,
                    'open_price': 25.2,
                    'accumulated_volume': 123456,
                },
            ]
        )

        result = vnbroker_adapter._normalize_price_board_dataframe(source_df)

        self.assertEqual(result[('listing', 'symbol')].tolist(), ['FPT', 'HPG'])
        self.assertEqual(result[('listing', 'ref_price')].tolist(), [118.0, 25.1])
        self.assertEqual(result[('match', 'match_price')].tolist(), [119.2, 25.6])
        self.assertEqual(result[('match', 'accumulated_volume')].tolist(), [987654, 123456])

    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    def test_fetch_price_board_dataframe_preserves_canonical_multiindex_payload(self, mock_build_stock, mock_run_timeout):
        fake_client = type('StockClient', (), {'trading': type('TradingClient', (), {'price_board': lambda *a, **k: None})()})()
        mock_build_stock.return_value = fake_client
        mock_run_timeout.return_value = pd.DataFrame(
            [[63.0, 61.4]],
            columns=pd.MultiIndex.from_tuples([
                ('match', 'match_price'),
                ('listing', 'ref_price'),
            ]),
        )

        result = vnbroker_adapter.fetch_price_board_dataframe(['VNM'], anchor_symbol='VNM', source='KBS')

        self.assertEqual(result[('match', 'match_price')].iloc[0], 63.0)
        self.assertEqual(result[('listing', 'ref_price')].iloc[0], 61.4)

    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    @patch('portfolio.adapters.vnbroker_adapter._resolve_price_board_sources', return_value=['VCI', 'KBS'])
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
            ExternalSystemException('429 Too Many Requests', code='vnbroker_rate_limited'),
            pd.DataFrame(
                [[63.0, 61.4]],
                columns=pd.MultiIndex.from_tuples([
                    ('match', 'match_price'),
                    ('listing', 'ref_price'),
                ]),
            ),
        ]

        result = vnbroker_adapter.fetch_price_board_dataframe(['VNM'], anchor_symbol='VNM')

        self.assertEqual(result[('match', 'match_price')].iloc[0], 0.063)
        self.assertEqual(mock_build_stock.call_count, 2)

    @patch('portfolio.adapters.vnbroker_adapter._run_with_timeout')
    @patch('portfolio.adapters.vnbroker_adapter._build_stock_client')
    @patch('portfolio.adapters.vnbroker_adapter._resolve_price_board_sources', return_value=['KBS', 'VCI'])
    def test_fetch_price_board_dataframe_fallbacks_on_unusable_payload(
        self,
        _mock_sources,
        mock_build_stock,
        mock_run_timeout,
    ):
        first_client = type('StockClient', (), {'trading': type('TradingClient', (), {'price_board': lambda *a, **k: None})()})()
        second_client = type('StockClient', (), {'trading': type('TradingClient', (), {'price_board': lambda *a, **k: None})()})()
        mock_build_stock.side_effect = [first_client, second_client]
        mock_run_timeout.side_effect = [
            pd.DataFrame([{'foo': 'bar'}]),
            pd.DataFrame(
                [['VNM', 63.0, 61.4]],
                columns=pd.MultiIndex.from_tuples([
                    ('listing', 'symbol'),
                    ('match', 'match_price'),
                    ('listing', 'ref_price'),
                ]),
            ),
        ]

        result = vnbroker_adapter.fetch_price_board_dataframe(['VNM'], anchor_symbol='VNM')

        self.assertEqual(result[('listing', 'symbol')].iloc[0], 'VNM')
        self.assertEqual(result[('match', 'match_price')].iloc[0], 63.0)
        self.assertEqual(mock_build_stock.call_count, 2)
