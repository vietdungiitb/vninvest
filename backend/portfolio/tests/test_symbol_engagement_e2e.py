"""
E2E Smoke Tests – Symbol Engagement Warm-up: 3 Entry Points
============================================================
Kiểm tra end-to-end rằng khi thêm mã qua API, hook `activate_symbol_engagement`
được gọi đúng với source tương ứng cho từng entry point:

  1. TrackedSymbol  → POST /api/stock-management/tracked-symbols/
  2. WatchlistItem  → POST /api/portfolio/watchlist/groups/<id>/items/
  3. Transaction    → POST /api/portfolio/subaccounts/<id>/transactions/

Mỗi test dùng `patch` tại layer service để cô lập Celery/Redis khỏi môi trường test.
"""
import json
from unittest.mock import call, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from portfolio.models import Portfolio, SubAccount, WatchlistGroup

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(username='smokeuser', password='smokepass123'):
    user = User.objects.create_user(username=username, password=password)
    return user


# ---------------------------------------------------------------------------
# Entry Point 1: TrackedSymbol
# ---------------------------------------------------------------------------

class TestTrackedSymbolEngagementHook(TestCase):
    """POST /api/stock-management/tracked-symbols/ phải trigger warmup."""

    def setUp(self):
        cache.clear()
        self.user = _make_user('tracked_user')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    @patch('portfolio.services_symbol_engagement.is_intraday_fresh', return_value=False)
    @patch('django.db.transaction.on_commit', side_effect=lambda f: f())
    @patch('portfolio.views_stock_management.get_price_changes', return_value={})
    def test_tracked_symbol_add_triggers_engagement(self, mock_prices, mock_on_commit, mock_fresh, mock_warmup):
        url = reverse('portfolio_stock:tracked-symbol-list')
        resp = self.client.post(
            url,
            data=json.dumps({'symbol': 'VNM'}),
            content_type='application/json',
        )
        self.assertIn(resp.status_code, [200, 201], msg=f"Expected 201, got {resp.status_code}: {resp.content}")
        # on_commit fires synchronously inside TestCase transaction
        mock_warmup.assert_called_once()
        call_kwargs = mock_warmup.call_args.kwargs
        self.assertEqual(call_kwargs['kwargs']['symbol'], 'VNM')
        self.assertEqual(call_kwargs['kwargs']['reason'], 'tracked_add')

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    @patch('portfolio.views_stock_management.get_price_changes', return_value={})
    def test_duplicate_tracked_symbol_no_engagement(self, mock_prices, mock_warmup):
        """Thêm mã đã tồn tại phải trả 409 và KHÔNG trigger warmup lần 2."""
        from decimal import Decimal
        from portfolio.models import TrackedSymbol
        TrackedSymbol.objects.create(user=self.user, symbol='VNM', whale_alert_threshold_million=Decimal('500.00'))

        url = reverse('portfolio_stock:tracked-symbol-list')
        resp = self.client.post(
            url,
            data=json.dumps({'symbol': 'VNM'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 409)
        mock_warmup.assert_not_called()


# ---------------------------------------------------------------------------
# Entry Point 2: WatchlistItem
# ---------------------------------------------------------------------------

class TestWatchlistItemEngagementHook(TestCase):
    """POST /api/portfolio/watchlist/groups/<id>/items/ phải trigger warmup."""

    def setUp(self):
        cache.clear()
        self.user = _make_user('watchlist_user')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.group = WatchlistGroup.objects.create(user=self.user, name='Nhóm test')

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    @patch('portfolio.services_symbol_engagement.is_intraday_fresh', return_value=False)
    @patch('django.db.transaction.on_commit', side_effect=lambda f: f())
    def test_watchlist_add_triggers_engagement(self, mock_on_commit, mock_fresh, mock_warmup):
        url = reverse('watchlist-item-create', kwargs={'group_id': self.group.pk})
        resp = self.client.post(
            url,
            data=json.dumps({'symbol': 'HPG'}),
            content_type='application/json',
        )
        self.assertIn(resp.status_code, [200, 201], msg=f"Expected 201, got {resp.status_code}: {resp.content}")
        mock_warmup.assert_called_once()
        call_kwargs = mock_warmup.call_args.kwargs
        self.assertEqual(call_kwargs['kwargs']['symbol'], 'HPG')
        self.assertEqual(call_kwargs['kwargs']['reason'], 'watchlist_add')

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    def test_watchlist_add_wrong_user_forbidden(self, mock_warmup):
        """Group của user khác → 404 và KHÔNG trigger warmup."""
        other_user = _make_user('other_watchlist_user')
        other_group = WatchlistGroup.objects.create(user=other_user, name='Nhóm khác')
        url = reverse('watchlist-item-create', kwargs={'group_id': other_group.pk})
        resp = self.client.post(
            url,
            data=json.dumps({'symbol': 'HPG'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 404)
        mock_warmup.assert_not_called()


# ---------------------------------------------------------------------------
# Entry Point 3: Transaction (holding)
# ---------------------------------------------------------------------------

class TestTransactionEngagementHook(TestCase):
    """POST /api/portfolio/subaccounts/<id>/transactions/ phải trigger warmup."""

    def setUp(self):
        cache.clear()
        self.user = _make_user('holding_user')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.portfolio = Portfolio.objects.create(user=self.user, name='Danh mục test')
        self.sub_account = SubAccount.objects.create(
            portfolio=self.portfolio,
            name='Tiểu khoản test',
            type=SubAccount.TypeChoices.CASH,
        )

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    @patch('portfolio.services_symbol_engagement.is_intraday_fresh', return_value=False)
    @patch('django.db.transaction.on_commit', side_effect=lambda f: f())
    def test_transaction_buy_triggers_engagement(self, mock_on_commit, mock_fresh, mock_warmup):
        url = reverse('transaction-list', kwargs={'sub_account_id': self.sub_account.pk})
        payload = {
            'symbol': 'VIC',
            'transaction_type': 'BUY',
            'date': '2026-04-23',
            'price': '50000.00',
            'quantity': '100',
            'fee': '0',
        }
        resp = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertIn(resp.status_code, [200, 201], msg=f"Expected 201, got {resp.status_code}: {resp.content}")
        mock_warmup.assert_called_once()
        call_kwargs = mock_warmup.call_args.kwargs
        self.assertEqual(call_kwargs['kwargs']['symbol'], 'VIC')
        self.assertEqual(call_kwargs['kwargs']['reason'], 'holding_add')

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    def test_transaction_other_user_subaccount_forbidden(self, mock_warmup):
        """SubAccount của user khác → 4xx và KHÔNG trigger warmup."""
        other_user = _make_user('other_holding_user')
        other_portfolio = Portfolio.objects.create(user=other_user, name='Danh mục khác')
        other_sub = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Tiểu khoản khác',
            type=SubAccount.TypeChoices.CASH,
        )
        url = reverse('transaction-list', kwargs={'sub_account_id': other_sub.pk})
        payload = {
            'symbol': 'VIC',
            'transaction_type': 'BUY',
            'date': '2026-04-23',
            'price': '50000.00',
            'quantity': '100',
            'fee': '0',
        }
        resp = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertIn(resp.status_code, [403, 404], msg=f"Expected 403/404, got {resp.status_code}")
        mock_warmup.assert_not_called()
