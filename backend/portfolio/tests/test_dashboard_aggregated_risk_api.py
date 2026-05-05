from datetime import date, datetime, timezone as datetime_timezone
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import OrderFlowSignal, Portfolio, SubAccount, Transaction, WhaleAlertEvent


class DashboardAggregatedRiskApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='dashboard-risk-user',
            email='dashboard-risk-user@example.com',
            password='User@123456',
        )
        self.portfolio = Portfolio.objects.create(user=self.user, name='Danh mục rủi ro')
        self.sub_account = SubAccount.objects.create(
            portfolio=self.portfolio,
            name='Cơ sở',
            type=SubAccount.TypeChoices.CASH,
        )
        Transaction.objects.create(
            sub_account=self.sub_account,
            symbol='FPT',
            transaction_type=Transaction.TransactionType.BUY,
            date=date(2026, 4, 28),
            price=100000,
            quantity=100,
            fee=0,
        )
        Transaction.objects.create(
            sub_account=self.sub_account,
            symbol='VCB',
            transaction_type=Transaction.TransactionType.BUY,
            date=date(2026, 4, 28),
            price=90000,
            quantity=50,
            fee=0,
        )

    def test_dashboard_aggregated_risk_snapshot_uses_selected_portfolio(self):
        self.client.force_authenticate(user=self.user)

        with patch('portfolio.views_dashboard_risk.MarketDataService.get_latest_snapshot') as mock_latest_snapshot, patch(
            'portfolio.views_dashboard_risk.market_data_service.get_realtime_tickers'
        ) as mock_realtime_tickers:
            mock_latest_snapshot.return_value = {
                'FPT': {'close_price': 105000},
                'VCB': {'close_price': 91000},
            }
            mock_realtime_tickers.return_value = {
                'FPT': {
                    'symbol': 'FPT',
                    'current_price': 105000,
                    'freshness_seconds': 5,
                    'stale': False,
                    'source': 'realtime_cache',
                },
                'VCB': {
                    'symbol': 'VCB',
                    'current_price': 91000,
                    'freshness_seconds': 120,
                    'stale': True,
                    'source': 'realtime_cache',
                },
            }

            WhaleAlertEvent.objects.create(
                event_id='whale:VCB:1',
                symbol='VCB',
                side='BUY',
                matched_value_vnd=900_000_000,
                threshold_vnd=500_000_000,
                threshold_policy_version='threshold-v1',
                severity='urgent',
                event_score=8.4,
                confidence='high',
                source='redis_stream',
                source_layer='live',
                trade_date=date(2026, 4, 28),
                occurred_at=datetime(2026, 4, 28, 9, 15, tzinfo=datetime_timezone.utc),
                payload_json={'symbol': 'VCB'},
            )
            OrderFlowSignal.objects.create(
                symbol='FPT',
                signal_type='iceberg',
                strength=72.0,
                confidence='high',
                tick_rate=8.0,
                small_order_ratio=0.72,
                cvd_at_signal=1500,
                price_at_signal=0,
                window_seconds=300,
                components_json={},
                event_id='dark_flow:FPT:1',
                severity='warning',
                trade_date=date(2026, 4, 28),
            )
            OrderFlowSignal.objects.create(
                symbol='VCB',
                signal_type='absorption',
                strength=54.0,
                confidence='medium',
                tick_rate=6.0,
                small_order_ratio=0.55,
                cvd_at_signal=1200,
                price_at_signal=0,
                window_seconds=300,
                components_json={},
                event_id='dark_flow:VCB:1',
                severity='warning',
                trade_date=date(2026, 4, 28),
            )

            response = self.client.get('/api/dashboard/aggregated-risk/', {'portfolio_id': self.portfolio.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'dashboard_aggregated_risk_snapshot')
        self.assertEqual(data['portfolio']['id'], self.portfolio.id)
        self.assertEqual(data['portfolio']['selection_source'], 'query_param')
        self.assertEqual(data['position_count'], 2)
        self.assertEqual(data['stale_positions_count'], 1)
        self.assertEqual(data['stale_positions_pct'], 50.0)
        self.assertEqual(data['whale_exposure_symbol_count'], 1)
        self.assertEqual(data['whale_exposure_total_vnd'], 900_000_000)
        self.assertEqual(data['dark_flow_signal_count'], 2)
        self.assertEqual(data['dark_flow_avg_strength'], 63.0)
        self.assertEqual(data['whale_exposure_symbols'][0]['symbol'], 'VCB')
        self.assertEqual(data['stale_positions'][0]['symbol'], 'VCB')
