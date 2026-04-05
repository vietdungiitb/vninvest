from unittest.mock import patch

from django.test import SimpleTestCase

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
