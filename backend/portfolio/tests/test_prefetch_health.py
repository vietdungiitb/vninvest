from datetime import datetime, timedelta
from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone

from config.health import build_prefetch_health_snapshot, prefetch_health


class PrefetchHealthSnapshotTests(SimpleTestCase):
    @patch('config.health.cache.get')
    def test_fresh_ok_meta_with_sample_cache_miss_stays_healthy(self, mock_cache_get):
        generated_at = (timezone.now() - timedelta(seconds=30)).isoformat()
        meta = {
            'status': 'ok',
            'generated_at': generated_at,
            'symbols': 120,
            'sample_symbols': ['HPG', 'FPT', 'VCB'],
            'policy': {
                'effective_interval_seconds': 90,
                'query_enabled': True,
            },
        }

        def cache_side_effect(key):
            if key == 'ticker:prefetch:meta':
                return meta
            return None

        mock_cache_get.side_effect = cache_side_effect

        snapshot = build_prefetch_health_snapshot()

        self.assertTrue(snapshot['healthy'])
        self.assertEqual(snapshot['status'], 'ok')
        self.assertEqual(snapshot['reason'], 'ok')
        self.assertEqual(snapshot['warning'], 'sample_cache_miss')
        self.assertEqual(snapshot['sample_cache_hits'], 0)
        self.assertEqual(snapshot['sample_cache_total'], 3)

    @patch('config.health.cache.get')
    def test_stale_ok_meta_remains_unhealthy_even_when_status_is_ok(self, mock_cache_get):
        generated_at = (timezone.now() - timedelta(seconds=400)).isoformat()
        meta = {
            'status': 'ok',
            'generated_at': generated_at,
            'symbols': 120,
            'sample_symbols': ['HPG'],
            'policy': {
                'effective_interval_seconds': 90,
                'query_enabled': True,
            },
        }

        def cache_side_effect(key):
            if key == 'ticker:prefetch:meta':
                return meta
            return {'symbol': 'HPG'}

        mock_cache_get.side_effect = cache_side_effect

        snapshot = build_prefetch_health_snapshot()

        self.assertFalse(snapshot['healthy'])
        self.assertEqual(snapshot['reason'], 'stale_prefetch_meta')
        self.assertIsNone(snapshot['warning'])

    @patch('config.health.cache.get')
    def test_prefetch_health_endpoint_returns_200_for_fresh_sample_cache_miss(self, mock_cache_get):
        generated_at = (timezone.now() - timedelta(seconds=30)).isoformat()
        meta = {
            'status': 'ok',
            'generated_at': generated_at,
            'symbols': 64,
            'sample_symbols': ['HPG', 'FPT'],
            'policy': {
                'effective_interval_seconds': 90,
                'query_enabled': True,
            },
        }

        def cache_side_effect(key):
            if key == 'ticker:prefetch:meta':
                return meta
            return None

        mock_cache_get.side_effect = cache_side_effect

        response = prefetch_health(request=None)

        self.assertEqual(response.status_code, 200)
