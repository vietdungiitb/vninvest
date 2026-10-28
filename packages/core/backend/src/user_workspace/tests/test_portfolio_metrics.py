"""S-00b - endpoint metrics phai tra SO THAT, va KHONG bia so khi thieu du lieu.

Tien de bi phan bien (audit B1/B2):
- `risk_metrics` / `benchmark_metrics` / `performance` / `freshness` trong
  `ledger/analytics.py` la CODE CHET - 0 caller ngoai test.
- `sharpe`/`sortino`/`correlation` KHONG ton tai o backend
  (`grep -c` = 2 comment, 0, 0) nen endpoint khong duoc khai 3 metric do.

Rang buoc D7: thieu du lieu => `null` + `reason_code`, KHONG phai 0.
Test nay khoa ca 2 ve: (a) route ton tai, (b) khong bao gio tra 0 gia cho
thieu du lieu.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import resolve, reverse
from rest_framework.test import APIRequestFactory

from identity_access.models import CoreTenant
from user_workspace.models import Portfolio, Transaction


def _unwrap(resp):
    body = resp.data
    assert 'data' in body, f"phai la envelope {{data, meta}}, nhan {sorted(body)}"
    return body['data'], body.get('meta') or {}


def _tenant(username):
    """Cung cap `_tenant` giống `test_review_findings_wave2.py` để lấy CoreTenant."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return CoreTenant.objects.create(
        tenant_code=f'm-{username}',
        display_name=username,
        owner_user=User.objects.create_user(username=username, password='x'),
        status=CoreTenant.StatusChoices.ACTIVE,
    )


class MetricsRouteTests(TestCase):
    def test_metrics_route_resolves(self):
        path = reverse('user_workspace:portfolio-metrics', kwargs={'portfolio_id': 1})
        self.assertIn('/workspace/portfolios/1/metrics/', path)
        from user_workspace.portfolio_analytics_views import PortfolioMetricsView
        self.assertIs(getattr(resolve(path).func, 'cls', None), PortfolioMetricsView)

    def test_metrics_is_read_only(self):
        from user_workspace.portfolio_analytics_views import PortfolioMetricsView
        perms = [p.__name__ for p in PortfolioMetricsView.permission_classes]
        self.assertIn('IsAuthenticated', perms)
        self.assertNotIn('WorkspacePermission', perms)


class MetricsHonestyTests(TestCase):
    """Khong co holding => moi metric null + reason. KHONG co so 0 gia."""

    def setUp(self):
        self.tenant = _tenant('metrics-t')
        self.portfolio = Portfolio.objects.create(
            user=self.tenant.owner_user, tenant=self.tenant, name='p')

    def _get(self):
        request = APIRequestFactory().get('/metrics/')
        request.user = self.tenant.owner_user
        request.tenant = self.tenant
        from user_workspace.portfolio_analytics_views import PortfolioMetricsView
        return PortfolioMetricsView.as_view()(request, portfolio_id=self.portfolio.pk)

    def test_no_holdings_returns_null_metrics_with_reason(self):
        data, _meta = _unwrap(self._get())
        self.assertEqual(data['reason'], 'no_holdings')
        self.assertIsNone(data['performance'])
        self.assertIsNone(data['risk'])
        self.assertIsNone(data['benchmark'])
        self.assertIsNone(data['freshness'])

    def test_holdings_without_price_history_yields_reason_not_zero(self):
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=Decimal('70000'), quantity=1000)
        data, _meta = _unwrap(self._get())
        # Không có DailyPrice nào cho VNM ⇒ không có NAV history.
        self.assertEqual(data['observations'], 0)
        self.assertIsNone(data['performance'])
        self.assertIsNone(data['risk'])
        self.assertIsNone(data['benchmark'])
        for key in ('performance_reason', 'risk_reason', 'benchmark_reason'):
            self.assertEqual(data[key], 'insufficient_nav_history', key)

    def test_endpoint_never_exposes_sharpe_sortino_correlation(self):
        """3 metric nay backend khong tinh - khai ra se la bia so."""
        data, _meta = _unwrap(self._get())
        blob = repr(data)
        for banned in ('sharpe', 'sortino', 'correlation'):
            self.assertNotIn(banned, blob.lower(),
                             f"endpoint phai KHONG tra {banned} - backend khong tinh")

    def test_endpoint_never_exposes_performance_return_1y_when_empty(self):
        data, _meta = _unwrap(self._get())
        self.assertNotIn('return_1y', data)
        self.assertNotIn('return_1y_pct', data)


class NavSeriesTests(TestCase):
    def test_days_missing_a_price_are_skipped_not_zeroed(self):
        from market_data.models import DailyPrice
        from user_workspace.portfolio_analytics_views import _nav_series

        d0, d1 = date(2026, 1, 5), date(2026, 1, 6)
        DailyPrice.objects.create(symbol='VNM', date=d0, close=Decimal('70'),
                                  open=Decimal('70'), high=Decimal('70'), low=Decimal('70'), volume=0)
        DailyPrice.objects.create(symbol='VNM', date=d1, close=Decimal('75'),
                                  open=Decimal('75'), high=Decimal('75'), low=Decimal('75'), volume=0)
        holdings = {
            'VNM': {'quantity': Decimal('100'), 'avg_cost': Decimal('60')},
            'FPT': {'quantity': Decimal('10'), 'avg_cost': Decimal('90')},
        }
        series = _nav_series(holdings, list(holdings), d0 - timedelta(days=1))
        # Cả 2 ngày đều thiếu FPT ⇒ series rỗng, KHÔNG có ngày nào nav = 0.
        self.assertEqual(series, [])
