from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_serving.models import SymbolSnapshot
from user_workspace.models import Portfolio, Transaction


User = get_user_model()


class PortfolioAnalyticsNativeRoutesApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='portfolio-native-user',
            email='portfolio-native@test.local',
            password='pass123',
        )
        self.other_user = User.objects.create_user(
            username='portfolio-native-other',
            email='portfolio-native-other@test.local',
            password='pass123',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.portfolio = Portfolio.objects.create(user=self.user, name='Danh mục chính')
        self.other_portfolio = Portfolio.objects.create(user=self.other_user, name='Danh mục khác')

        Transaction.objects.create(
            portfolio=self.portfolio,
            symbol='VCB',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate(),
            price=Decimal('50000'),
            quantity=120,
            fee=Decimal('1000'),
        )

        SymbolSnapshot.objects.create(
            symbol='VCB',
            session_date=timezone.localdate(),
            price=Decimal('52000'),
            price_change=Decimal('1500'),
            price_change_pct=Decimal('2.9700'),
            volume=250000,
            reference_price=Decimal('50500'),
            high=Decimal('52200'),
            low=Decimal('49800'),
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )

    def _assert_native_matches_legacy(self, native_path, legacy_path):
        native_response = self.client.get(native_path)
        legacy_response = self.client.get(legacy_path)

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(legacy_response.status_code, status.HTTP_200_OK)
        self.assertEqual(native_response.json(), legacy_response.json())
        return native_response.json()

    def test_core_v1_workspace_portfolio_analytics_routes_match_legacy_contracts(self):
        holdings_payload = self._assert_native_matches_legacy(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/holdings/',
            f'/api/portfolio/portfolios/{self.portfolio.id}/holdings/',
        )
        self.assertEqual(holdings_payload[0]['symbol'], 'VCB')
        self.assertEqual(holdings_payload[0]['quantity'], 120)

        summary_payload = self._assert_native_matches_legacy(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/summary/',
            f'/api/portfolio/portfolios/{self.portfolio.id}/summary/',
        )
        self.assertEqual(summary_payload['portfolio_id'], self.portfolio.id)
        self.assertEqual(summary_payload['portfolio_name'], 'Danh mục chính')
        self.assertEqual(summary_payload['num_holdings'], 1)

        analytics_payload = self._assert_native_matches_legacy(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/analytics/?days=30',
            f'/api/portfolio/portfolios/{self.portfolio.id}/analytics/?days=30',
        )
        self.assertEqual(analytics_payload['summary']['portfolio_id'], self.portfolio.id)
        self.assertEqual(analytics_payload['note'], 'full_analytics_available_via_sub_endpoints')

        technicals_payload = self._assert_native_matches_legacy(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/technicals/',
            f'/api/portfolio/portfolios/{self.portfolio.id}/technicals/',
        )
        self.assertEqual(technicals_payload[0]['symbol'], 'VCB')
        self.assertEqual(technicals_payload[0]['price_change_pct'], '2.9700')

    def test_core_v1_workspace_portfolio_analytics_routes_enforce_user_ownership(self):
        for suffix in ('holdings/', 'summary/', 'analytics/', 'technicals/'):
            response = self.client.get(f'/core/v1/workspace/portfolios/{self.other_portfolio.id}/{suffix}')
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_core_v1_workspace_portfolio_analytics_routes_require_authentication(self):
        anonymous_client = APIClient()

        for path in (
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/holdings/',
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/summary/',
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/analytics/',
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/technicals/',
        ):
            response = anonymous_client.get(path)
            self.assertIn(
                response.status_code,
                {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
            )