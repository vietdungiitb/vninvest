from datetime import date, timedelta
from unittest.mock import patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from portfolio.models import IntradayTick
from portfolio.views_dark_money_history import dark_money_history_api


class TestDarkMoneyHistoryApi(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username='dark-money-api-user',
            email='dark-money-api@example.com',
            password='test-pass-123',
        )
        self.trade_date = date.today() - timedelta(days=1)

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnstock_adapter.fetch_history_dataframe')
    def test_deduplicates_exact_intraday_ticks_before_whale_aggregation(
        self,
        mock_fetch_history_dataframe,
        mock_resolve_threshold_vnd,
        mock_build_reference_price_by_trade_date,
    ):
        mock_fetch_history_dataframe.return_value = pd.DataFrame([
            {
                'time': self.trade_date,
                'open': 15.0,
                'high': 15.3,
                'low': 14.9,
                'close': 15.2,
                'volume': 1000,
            }
        ])
        mock_resolve_threshold_vnd.return_value = (1_000_000, 'test')
        mock_build_reference_price_by_trade_date.return_value = {self.trade_date: 15.0}

        IntradayTick.objects.create(
            symbol='SHB',
            trade_date=self.trade_date,
            trade_time='09:15:00',
            price=15.2,
            volume=5_000_000,
            side='BUY',
        )
        IntradayTick.objects.create(
            symbol='SHB',
            trade_date=self.trade_date,
            trade_time='09:15:00',
            price=15.2,
            volume=5_000_000,
            side='BUY',
        )

        request = self.factory.get('/api/stock-management/stocks/SHB/dark-money-history/?period=3M&interval=1D')
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, 'SHB')

        assert response.status_code == 200
        whale_signals = response.data['whale_signals']
        assert len(whale_signals) == 1
        assert whale_signals[0]['matched_value'] == 76_000_000_000
        assert response.data['smfi_components']['whale_buy_total'] == 76_000_000_000
        assert response.data['smfi_components']['whale_sell_total'] == 0