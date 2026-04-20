from datetime import timedelta

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from portfolio.tasks_realtime import _is_prefetch_cache_fresh, collect_and_publish_realtime


class TasksRealtimeTests(SimpleTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def test_is_prefetch_cache_fresh_true_for_recent_prefetch_payload(self):
        now_iso = timezone.now().isoformat()
        cache.set(
            'ticker:FPT',
            {
                'symbol': 'FPT',
                'source': 'prefetch',
                'last_date': now_iso,
            },
            timeout=60,
        )

        self.assertTrue(_is_prefetch_cache_fresh('FPT', freshness_seconds=10))

    def test_is_prefetch_cache_fresh_false_when_payload_old(self):
        old_iso = (timezone.now() - timedelta(seconds=20)).isoformat()
        cache.set(
            'ticker:FPT',
            {
                'symbol': 'FPT',
                'source': 'prefetch',
                'last_date': old_iso,
            },
            timeout=60,
        )

        self.assertFalse(_is_prefetch_cache_fresh('FPT', freshness_seconds=5))

    @override_settings(REALTIME_ENABLED=True, REALTIME_INTRADAY_POLL_ENABLED=False)
    def test_collect_and_publish_realtime_skips_when_intraday_disabled(self):
        result = collect_and_publish_realtime.run(user_id=None)

        self.assertEqual(result.get('status'), 'ok')
        self.assertTrue(result.get('intraday_disabled', False))
