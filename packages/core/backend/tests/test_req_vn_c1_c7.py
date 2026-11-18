"""REQ-VN-01..06 & C1-C7 closure tests (TDD fail-before -> pass-after).

Covers:
- C1 (REQ-VN-01): dead `market_data/public_urls.py` removed while live `core_urls.py` routes still reverse.
- C2 (REQ-VN-02): `StockManagementOrderFlowView.get` enforces `market:read` for machine PATs.
- C6 (S-05 Addendum): `AlertCenterAcknowledgeView.post` & `AlertCenterMutePreferenceView.post` enforce `signals:read`.
- C7 (S-05 Addendum): `StockManagementPriceAlerts*View` (GET/POST/PATCH/DELETE/mark-triggered) enforce `market:read`.
- C3/C4/C5 (REQ-VN-03..05): truthful docstrings on `IntradayTapeView`, `RealtimeIntradayView`,
  `ws_ticket`, `WsTicketView`, and `StockManagementFinancialsView`.
"""
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access import ws_ticket
from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
    UserProfile,
)
from identity_access.views_ws_ticket import WsTicketView
from market_data.models import StockProfile
from market_data.stock_mgmt_native_views import StockManagementFinancialsView
from market_data.views import IntradayTapeView
from market_serving.native_views import RealtimeIntradayView
from signal_intelligence.models import UnifiedAlert
from user_workspace.models import PriceAlert, Watchlist, WatchlistItem


class ReqVnC1C7ClosureTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='reqvn_owner',
            email='reqvn@test.com',
            password='testpass123',
        )
        UserProfile.objects.create(user=self.owner, whale_alert_threshold=100)
        self.tenant = CoreTenant.objects.create(
            public_id='reqvn-tenant-uuid',
            tenant_code='reqvn',
            display_name='ReqVN Tenant',
            owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant,
            user=self.owner,
            role=TenantMember.RoleChoices.OWNER,
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='REQVN_SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read'],
        )
        _, self.token_no_scope = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=[],
            label='reqvn:noscope',
            audit_reason='test',
            is_human_session=False,
        )
        _, self.token_scoped = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=['market:read', 'signals:read'],
            label='reqvn:scoped',
            audit_reason='test',
            is_human_session=False,
        )
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corporation',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Technology',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        watchlist = Watchlist.objects.create(
            user=self.owner,
            tenant=self.tenant,
            name='ReqVN Default',
            is_default=True,
        )
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        now = timezone.now()
        self.alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            freshness_state='fresh',
            title='Whale VCI',
            body='ReqVN alert body',
            value=Decimal('1000000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='reqvn-vci-alert',
            evidence={'source': 'test'},
        )
        self.price_alert = PriceAlert.objects.create(
            user=self.owner,
            tenant=self.tenant,
            symbol='FPT',
            alert_type=PriceAlert.AlertType.ABOVE,
            price_threshold=Decimal('120000'),
            cooldown_seconds=300,
            is_enabled=True,
            status=PriceAlert.AlertStatus.ACTIVE,
        )

    def _pat(self, token):
        c = APIClient()
        c.credentials(
            HTTP_AUTHORIZATION=f'Bearer {token}',
            HTTP_X_TENANT_ID=str(self.tenant.public_id),
        )
        return c

    def test_c1_public_urls_removed(self):
        dead_path = Path(settings.BASE_DIR) / 'market_data' / 'public_urls.py'
        self.assertFalse(dead_path.exists())
        self.assertEqual(
            reverse('market_data:market-data-price-alerts'),
            '/core/v1/stock-management/price-alerts/',
        )
        self.assertEqual(
            reverse('market_data:market-data-stock-financials', kwargs={'symbol': 'FPT'}),
            '/core/v1/stock-management/stocks/FPT/financials/',
        )

    def test_c2_order_flow_pat_scope(self):
        url = '/core/v1/stock-management/stocks/FPT/order-flow/'
        resp_denied = self._pat(self.token_no_scope).get(url)
        self.assertEqual(resp_denied.status_code, 403)
        self.assertIn('scope', str(resp_denied.json()).lower())

        resp_scoped = self._pat(self.token_scoped).get(url)
        self.assertEqual(resp_scoped.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        resp_human = self.client.get(url)
        self.assertEqual(resp_human.status_code, 200)

    def test_c6_alert_center_ack_and_mute_pat_scope(self):
        ack_url = f'/core/v1/signals/alert-center/events/{self.alert.alert_id}/ack'
        mute_url = '/core/v1/signals/alert-center/preferences/mute'
        mute_payload = {'symbol': 'VCI', 'alert_family': 'whale', 'mute_minutes': 15}

        ack_denied = self._pat(self.token_no_scope).post(ack_url, {}, format='json')
        self.assertEqual(ack_denied.status_code, 403)
        self.assertIn('scope', str(ack_denied.json()).lower())

        mute_denied = self._pat(self.token_no_scope).post(mute_url, mute_payload, format='json')
        self.assertEqual(mute_denied.status_code, 403)
        self.assertIn('scope', str(mute_denied.json()).lower())

        # Acknowledge BEFORE mute because active mute excludes symbol from delivery policy.
        ack_ok = self._pat(self.token_scoped).post(ack_url, {}, format='json')
        self.assertEqual(ack_ok.status_code, 200)

        mute_ok = self._pat(self.token_scoped).post(mute_url, mute_payload, format='json')
        self.assertEqual(mute_ok.status_code, 200)

    def test_c7_price_alerts_crud_pat_scope(self):
        list_url = '/core/v1/stock-management/price-alerts/'
        detail_url = f'/core/v1/stock-management/price-alerts/{self.price_alert.pk}/'
        trigger_url = f'/core/v1/stock-management/price-alerts/{self.price_alert.pk}/mark-triggered/'

        no_scope = self._pat(self.token_no_scope)
        self.assertEqual(no_scope.get(list_url).status_code, 403)
        self.assertEqual(
            no_scope.post(
                list_url,
                {'symbol': 'FPT', 'condition': 'BELOW', 'target_price': 90000},
                format='json',
            ).status_code,
            403,
        )
        self.assertEqual(no_scope.patch(detail_url, {'is_active': False}, format='json').status_code, 403)
        self.assertEqual(no_scope.post(trigger_url, {}, format='json').status_code, 403)
        self.assertEqual(no_scope.delete(detail_url).status_code, 403)

        scoped = self._pat(self.token_scoped)
        self.assertEqual(scoped.get(list_url).status_code, 200)
        created = scoped.post(
            list_url,
            {'symbol': 'FPT', 'condition': 'BELOW', 'target_price': 90000},
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        new_id = created.json()['data']['id']
        new_detail = f'/core/v1/stock-management/price-alerts/{new_id}/'
        self.assertEqual(scoped.patch(new_detail, {'is_active': False}, format='json').status_code, 200)
        self.assertEqual(scoped.post(f'{new_detail}mark-triggered/', {}, format='json').status_code, 200)
        self.assertEqual(scoped.delete(new_detail).status_code, 204)

    def test_c3_c4_c5_docstrings_truthful(self):
        doc_fin = StockManagementFinancialsView.__doc__ or ''
        self.assertNotIn('graceful empty', doc_fin.lower())
        self.assertIn('INVALID_PERIOD', doc_fin)
        self.assertIn('FINANCIALS_YEAR_UNAVAILABLE', doc_fin)

        doc_tape = IntradayTapeView.__doc__ or ''
        self.assertNotIn('redis cache', doc_tape.lower())
        self.assertIn('canonical', doc_tape.lower())

        doc_rt = RealtimeIntradayView.__doc__ or ''
        self.assertIn('LEGACY/COMPAT', doc_rt)
        self.assertIn('/core/v1/market-data/intraday-tape/', doc_rt)

        doc_wt_mod = ws_ticket.__doc__ or ''
        self.assertIn('human', doc_wt_mod.lower())
        self.assertNotIn('(bearer pat)', doc_wt_mod.lower())

        doc_wt_view = WsTicketView.__doc__ or ''
        self.assertIn('human', doc_wt_view.lower())
        self.assertIn('403', doc_wt_view)
