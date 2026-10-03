"""
Slice C follow-up — SessionFacts materializer refresh coverage (phát hiện verify Slice A).

Covers:
- không whale rows → upserted=0, coverage_refreshed=0
- có whale rows → upsert SessionFacts + refresh coverage cho symbol đó
"""
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from market_data.models import GlobalSymbolCoverage, GlobalSymbolRegistry
from market_serving.models import SessionFacts
from market_serving.session_facts_engine import compute_session_facts_for_all_active


def _rows(n=4):
    base = timezone.now().replace(second=0, microsecond=0) - timedelta(hours=2)
    return [
        {
            'side': 'buy' if i % 2 == 0 else 'sell',
            'matched_value': 500_000_000 + i * 10_000_000,
            'executed_at': base + timedelta(minutes=15 * i),
        }
        for i in range(n)
    ]


def _whale_qs_mock(symbols):
    qs = MagicMock()
    qs.filter.return_value = qs
    qs.order_by.return_value = qs
    qs.values_list.return_value.distinct.return_value = list(symbols)
    return qs


class SessionFactsCoverageRefreshTest(TestCase):
    def test_empty_universe_returns_zero_coverage(self):
        with patch('signal_intelligence.models.WhaleAlertCanonical') as whale_mock:
            whale_mock.objects.filter.return_value = _whale_qs_mock([])
            result = compute_session_facts_for_all_active()
        self.assertEqual(result['upserted'], 0)
        self.assertEqual(result['coverage_refreshed'], 0)
        self.assertIn('coverage_refreshed', result)

    def test_upsert_triggers_coverage_refresh(self):
        GlobalSymbolRegistry.objects.create(symbol='VHM', is_active=True)
        with patch('signal_intelligence.models.WhaleAlertCanonical') as whale_mock, patch(
            'market_serving.session_facts_engine._load_session_rows', return_value=_rows()
        ):
            whale_mock.objects.filter.return_value = _whale_qs_mock(['VHM'])
            result = compute_session_facts_for_all_active()

        self.assertEqual(result['upserted'], 1)
        self.assertEqual(result['coverage_refreshed'], 1)
        self.assertTrue(SessionFacts.objects.filter(symbol='VHM').exists())
        cov = GlobalSymbolCoverage.objects.filter(
            registry__symbol='VHM', dataset='daily_prices').first()
        if cov is not None:
            self.assertIsNotNone(cov.last_verified_at)
