"""S6 — NAV with historical quantities must use raw close, not adj_close."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from user_workspace.portfolio_analytics_views import _nav_series


def _row(day, close, adj_close, factor):
    return SimpleNamespace(
        date=day, symbol='X', close=Decimal(close), adj_close=Decimal(adj_close),
        adj_factor=Decimal(factor), price_source='cafef',
    )


class NavBasisContract(SimpleTestCase):
    @patch('market_data.pricing.pilot_adjusted_enabled', return_value=True)
    @patch('market_data.models.DailyPrice.objects.filter')
    @patch('user_workspace.portfolio_analytics_views._ledger_quantity_deltas')
    def test_ledger_quantities_multiply_raw_close(self, mock_deltas, mock_filter, _mock_flag):
        # Split on day 2 doubles the share count; day-1 adj_close already
        # divides by the split factor, so multiplying Q(t) x adj_close would
        # double-count the split.
        mock_filter.return_value.order_by.return_value = [
            _row(date(2024, 1, 1), '100', '50', '0.5'),
            _row(date(2024, 1, 2), '60', '60', '1.0'),
        ]
        mock_deltas.return_value = {
            date(2024, 1, 1): {'X': Decimal(100)},
            date(2024, 1, 2): {'X': Decimal(100)},  # SPLIT +100
        }
        series = _nav_series(
            {'X': {'quantity': Decimal(200)}}, ['X'], date(2024, 1, 1),
            portfolio=object(), tenant=None,
        )
        self.assertEqual(len(series), 2)
        self.assertEqual(series[0]['nav'], 10000.0)  # 100 shares x raw 100
        self.assertEqual(series[1]['nav'], 12000.0)  # 200 shares x raw 60

    @patch('market_data.pricing.pilot_adjusted_enabled', return_value=True)
    @patch('market_data.models.DailyPrice.objects.filter')
    def test_holdings_proxy_keeps_adj_close(self, mock_filter, _mock_flag):
        # Control: without LedgerEntry there is no historical Q(t), so the
        # adjusted series is still the right basis.
        mock_filter.return_value.order_by.return_value = [
            _row(date(2024, 1, 1), '100', '50', '0.5'),
        ]
        series = _nav_series(
            {'X': {'quantity': Decimal(200)}}, ['X'], date(2024, 1, 1),
        )
        self.assertEqual(series[0]['nav'], 10000.0)
