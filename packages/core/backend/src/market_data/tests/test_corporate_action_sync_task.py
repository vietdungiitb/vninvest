"""Task 5 — nightly incremental sync (fail-before)."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils.module_loading import import_string

from data_ingest.tasks import sync_all_corporate_actions, sync_corporate_actions
from market_data.models import CorporateAction, DailyPrice

ENV_ON = {'CORPORATE_ACTIONS_ENABLED': 'true'}


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class SyncCorporateActionsTests(TestCase):
    def _seed(self, iso='2026-01-01'):
        return CorporateAction.objects.create(
            symbol='VNM', action_type='DIV', ex_date=date.fromisoformat(iso),
            cash_amount_per_share=Decimal('1000'), currency='VND', source='VCI',
            source_event_id='seed-1', raw_title='seed', parse_status='parsed_from_text',
        )

    @patch.dict('os.environ', ENV_ON)
    @patch('market_data.corporate_actions.adjustment.apply_adjustments', return_value=3)
    @patch('market_data.corporate_actions.adjustment.compute_adj_factors', return_value=[])
    @patch('market_data.corporate_actions.ingest.upsert_corporate_actions', return_value=(1, 0))
    @patch('market_data.corporate_actions.ingest.fetch_corporate_actions', return_value=[{'source': 'VCI'}])
    def test_incremental_only_new_ex_dates(self, fetch, upsert, compute, apply):
        self._seed()
        stats = sync_corporate_actions('VNM')
        expected_from = date(2026, 1, 1) - timedelta(days=7)
        self.assertEqual(fetch.call_args.kwargs.get('from_date', fetch.call_args.args[1] if len(fetch.call_args.args) > 1 else None), expected_from)
        self.assertEqual(stats['fetched'], 1)

    @patch.dict('os.environ', ENV_ON)
    @patch('market_data.corporate_actions.adjustment.apply_adjustments', return_value=2)
    @patch('market_data.corporate_actions.adjustment.compute_adj_factors', return_value=[])
    @patch('market_data.corporate_actions.ingest.upsert_corporate_actions', return_value=(0, 1))
    @patch('market_data.corporate_actions.ingest.fetch_corporate_actions', return_value=[{}, {}])
    def test_stats_shape(self, fetch, upsert, compute, apply):
        stats = sync_corporate_actions('VNM', from_date=date(2024, 1, 1))
        for key in ('fetched', 'created', 'updated', 'factors', 'applied'):
            self.assertIn(key, stats)
        self.assertEqual(stats['applied'], 2)

    @patch.dict('os.environ', {'CORPORATE_ACTIONS_ENABLED': 'false'})
    @patch('market_data.corporate_actions.ingest.fetch_corporate_actions')
    def test_flag_off_skips(self, fetch):
        stats = sync_corporate_actions('VNM')
        self.assertTrue(stats.get('skipped'))
        fetch.assert_not_called()


class SyncAllCorporateActionsTests(TestCase):
    """Orchestrator cho MỌI mã có DailyPrice — fail-before cho beat gap."""

    def _price(self, symbol):
        return DailyPrice.objects.create(
            symbol=symbol, date=date(2024, 1, 1),
            open=Decimal('10'), high=Decimal('11'), low=Decimal('9'),
            close=Decimal('10'), volume=100,
        )

    @patch.dict('os.environ', ENV_ON)
    @patch('data_ingest.tasks.sync_corporate_actions.apply_async')
    def test_orchestrator_dispatches_every_price_symbol(self, apply_async):
        self._price('VNM')
        self._price('FPT')
        stats = sync_all_corporate_actions(countdown_seconds=2)
        called = sorted(call.args[0][0] for call in apply_async.call_args_list)
        self.assertEqual(called, ['FPT', 'VNM'])
        # countdown là execution option, KHÔNG được lọt vào kwargs của task (L-E06).
        for call in apply_async.call_args_list:
            self.assertIn('countdown', call.kwargs)
            self.assertNotIn('countdown', call.args[1] if len(call.args) > 1 else {})
        self.assertEqual(stats['queued'], 2)

    @patch.dict('os.environ', {'CORPORATE_ACTIONS_ENABLED': 'false'})
    @patch('data_ingest.tasks.sync_corporate_actions.apply_async')
    def test_orchestrator_flag_off_skips(self, apply_async):
        self._price('VNM')
        stats = sync_all_corporate_actions()
        self.assertTrue(stats.get('skipped'))
        apply_async.assert_not_called()

    @patch.dict('os.environ', {'CORPORATE_ACTIONS_ENABLED': 'false'})
    def test_beat_kwargs_can_invoke_orchestrator(self):
        """Beat hiện tại truyền kwargs gì cũng phải gọi được task (không TypeError)."""
        entry = settings.CELERY_BEAT_SCHEDULE['sync-corporate-actions-nightly']
        task = import_string(entry['task'])
        result = task(**entry.get('kwargs', {}))
        self.assertTrue(result.get('skipped'))
