from django.conf import settings
from django.test import SimpleTestCase

from vninvest_core.celery import app
from vninvest_core.queue_policy import CELERY_TASK_QUEUES, SCHEDULER_QUEUE_MAP, TASK_ROUTES


class SignalMaterializerScheduleTests(SimpleTestCase):
    def test_runtime_and_settings_schedule_use_market_serving_materializer(self):
        self.assertEqual(tuple(queue.name for queue in app.conf.task_queues), tuple(queue.name for queue in CELERY_TASK_QUEUES))
        self.assertEqual(app.conf.task_routes, TASK_ROUTES)
        self.assertEqual(sorted(app.conf.beat_schedule.keys()), sorted(settings.CELERY_BEAT_SCHEDULE.keys()))

        for schedule_name, queue_name in SCHEDULER_QUEUE_MAP.items():
            if schedule_name not in settings.CELERY_BEAT_SCHEDULE:
                continue
            runtime_entry = app.conf.beat_schedule[schedule_name]
            settings_entry = settings.CELERY_BEAT_SCHEDULE[schedule_name]

            self.assertEqual(runtime_entry['task'], settings_entry['task'])
            self.assertEqual(runtime_entry['options']['queue'], queue_name)
            self.assertEqual(settings_entry['options']['queue'], queue_name)

        self.assertEqual(SCHEDULER_QUEUE_MAP['materialize-session-facts-5m'], 'realtime_prefetch')
        self.assertNotIn('materialize-session-facts-2m', SCHEDULER_QUEUE_MAP)

    def test_signal_intelligence_critical_tasks_route_to_target_queues(self):
        self.assertEqual(app.conf.task_routes['signal_intelligence.tasks.run_signal_detection_job']['queue'], 'manual_on_demand')
        self.assertEqual(
            app.conf.task_routes['signal_intelligence.materializers.materialize_unified_alerts']['queue'],
            'analytics_heavy',
        )
        self.assertEqual(
            app.conf.task_routes['signal_intelligence.materializers.materialize_whale_feed_aggregate']['queue'],
            'analytics_heavy',
        )

    def test_runtime_schedule_does_not_double_schedule_whale_feed_materialization(self):
        self.assertNotIn('materialize-whale-feed-aggregate', app.conf.beat_schedule)
        self.assertNotIn('materialize-whale-feed-aggregate', settings.CELERY_BEAT_SCHEDULE)