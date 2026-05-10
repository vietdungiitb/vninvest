from django.conf import settings
from django.test import SimpleTestCase

from vninvest_core.celery import app


class SignalMaterializerScheduleTests(SimpleTestCase):
    def test_runtime_and_settings_schedule_use_market_serving_materializer(self):
        runtime_entry = app.conf.beat_schedule['materialize-unified-alerts-2m']
        settings_entry = settings.CELERY_BEAT_SCHEDULE['materialize-unified-alerts-2m']

        self.assertEqual(
            runtime_entry['task'],
            'market_serving.materializers.materialize_unified_alerts',
        )
        self.assertEqual(runtime_entry['task'], settings_entry['task'])
        self.assertEqual(sorted(app.conf.beat_schedule.keys()), sorted(settings.CELERY_BEAT_SCHEDULE.keys()))

    def test_runtime_schedule_does_not_double_schedule_whale_feed_materialization(self):
        self.assertNotIn('materialize-whale-feed-aggregate', app.conf.beat_schedule)
        self.assertNotIn('materialize-whale-feed-aggregate', settings.CELERY_BEAT_SCHEDULE)