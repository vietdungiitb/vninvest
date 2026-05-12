from django.conf import settings
from django.test import SimpleTestCase


class NewsEnrichmentScheduleTests(SimpleTestCase):
    def test_offhours_enrichment_beat_jobs_route_to_offhours_queue(self):
        digest_entry = settings.CELERY_BEAT_SCHEDULE['portfolio-daily-news-digest']
        sentiment_entry = settings.CELERY_BEAT_SCHEDULE['sync-news-sentiment']
        history_entry = settings.CELERY_BEAT_SCHEDULE['offpeak-vnbroker-ingest']
        fundamentals_entry = settings.CELERY_BEAT_SCHEDULE['sync-stock-profiles-from-snapshot']

        self.assertEqual(digest_entry['task'], 'portfolio.tasks.generate_all_portfolio_news_digests_task')
        self.assertEqual(sentiment_entry['task'], 'portfolio.tasks_sentiment.sync_news_sentiment')
        self.assertEqual(history_entry['task'], 'portfolio.tasks.offpeak_vnbroker_ingest')
        self.assertEqual(
            fundamentals_entry['task'],
            'portfolio.tasks_stock_profile_sync.sync_stock_profiles_from_snapshot',
        )
        self.assertEqual(digest_entry['options']['queue'], 'enrichment_offhours')
        self.assertEqual(sentiment_entry['options']['queue'], 'enrichment_offhours')
        self.assertEqual(history_entry['options']['queue'], 'enrichment_offhours')
        self.assertEqual(fundamentals_entry['options']['queue'], 'enrichment_offhours')