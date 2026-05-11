from django.conf import settings
from django.test import SimpleTestCase

from vninvest_core.celery import app


class SignalMaterializerScheduleTests(SimpleTestCase):
    def test_runtime_and_settings_schedule_use_market_serving_materializer(self):
        expected_task_routes = {
            'market_serving.materializers.materialize_symbol_snapshot': 'realtime_prefetch',
            'market_serving.materializers.materialize_session_facts': 'realtime_prefetch',
            'market_serving.materializers.materialize_unified_alerts': 'analytics_heavy',
        }
        expected_schedule_queues = {
            'materialize-symbol-snapshot-60s': 'realtime_prefetch',
            'materialize-session-facts-5m': 'realtime_prefetch',
            'materialize-unified-alerts-2m': 'analytics_heavy',
        }

        self.assertEqual(sorted(app.conf.beat_schedule.keys()), sorted(settings.CELERY_BEAT_SCHEDULE.keys()))

        for task_name, queue_name in expected_task_routes.items():
            self.assertEqual(app.conf.task_routes[task_name]['queue'], queue_name)

        for schedule_name, queue_name in expected_schedule_queues.items():
            runtime_entry = app.conf.beat_schedule[schedule_name]
            settings_entry = settings.CELERY_BEAT_SCHEDULE[schedule_name]

            self.assertEqual(runtime_entry['task'], settings_entry['task'])
            self.assertEqual(runtime_entry['options']['queue'], queue_name)
            self.assertEqual(settings_entry['options']['queue'], queue_name)

    def test_runtime_schedule_does_not_double_schedule_whale_feed_materialization(self):
        self.assertNotIn('materialize-whale-feed-aggregate', app.conf.beat_schedule)
        self.assertNotIn('materialize-whale-feed-aggregate', settings.CELERY_BEAT_SCHEDULE)