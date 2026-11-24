"""M3 — pause writer jobs trong cửa sổ chuyển đổi giá (TDD)."""
import importlib
import os
import sys

from django.test import SimpleTestCase

PAUSED = (
    'daily-backfill-prices-1700',
    'deep-history-bootstrap-weekly',
    'pre5y-history-backfill-weekly',
    'sync-corporate-actions-nightly',
    'detect-market-anomaly-alerts-5m',
)


def _reload_settings(paused):
    os.environ['PRICE_MIGRATION_PAUSED'] = '1' if paused else '0'
    mod = importlib.import_module('vninvest_core.settings')
    return importlib.reload(mod)


class PauseTests(SimpleTestCase):
    def tearDown(self):
        _reload_settings(False)  # trả schedule về trạng thái mặc định trước
        os.environ.pop('PRICE_MIGRATION_PAUSED', None)  # rồi xoá env — sạch thật

    def test_paused_jobs_removed(self):
        mod = _reload_settings(True)
        for key in PAUSED:
            self.assertNotIn(key, mod.CELERY_BEAT_SCHEDULE, key)

    def test_normal_jobs_kept(self):
        mod = _reload_settings(True)
        self.assertIn('broker-sync-positions-30m', mod.CELERY_BEAT_SCHEDULE)

    def test_flag_off_keeps_jobs(self):
        mod = _reload_settings(False)
        self.assertIn('daily-backfill-prices-1700', mod.CELERY_BEAT_SCHEDULE)
