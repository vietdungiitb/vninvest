import os
import sys
import time
import hmac
import hashlib
from datetime import timedelta
from unittest.mock import patch, MagicMock

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from identity_access.models import CoreTenant, CoreServiceAccount, CorePATCredential
from advertising.models import AdCampaign, AdDailySummary, AdImpressionLog, AdClickLog
from advertising.tasks import rebuild_ads_cache_index, aggregate_ad_metrics


class AdvertisingBaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username='ad-owner', password='testpass123')
        
        # Free Tenant
        self.free_tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='free-tenant',
            display_name='Free Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        
        # Premium Tenant
        self.premium_owner = User.objects.create_user(username='premium-owner', password='testpass123')
        self.premium_tenant = CoreTenant.objects.create(
            owner_user=self.premium_owner,
            tenant_code='premium-tenant',
            display_name='Premium Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        # Setup service account & PAT credentials for auth testing
        self.free_sa = CoreServiceAccount.objects.create(
            tenant=self.free_tenant,
            name='free-sa',
            status=CoreServiceAccount.StatusChoices.ACTIVE
        )
        self.free_pat = CorePATCredential.objects.create(
            service_account=self.free_sa,
            label='free-pat',
            token_prefix='vni_free_tkn',
            token_secret_hash='hashedsecret1',
            scopes=[]
        )

        self.premium_sa = CoreServiceAccount.objects.create(
            tenant=self.premium_tenant,
            name='premium-sa',
            status=CoreServiceAccount.StatusChoices.ACTIVE
        )
        self.premium_pat = CorePATCredential.objects.create(
            service_account=self.premium_sa,
            label='premium-pat',
            token_prefix='vni_prem_tkn',
            token_secret_hash='hashedsecret2',
            scopes=[]
        )

        # Create active general Ad campaign
        self.campaign_all = AdCampaign.objects.create(
            name="General SSI Promo",
            campaign_type=AdCampaign.CampaignType.PARTNER_AD,
            status=AdCampaign.Status.ACTIVE,
            banner_url="https://cdn.vninvest.vn/banners/ssi_1x.webp",
            banner_width=300,
            banner_height=50,
            destination_url="https://vninvest.vn/promo/ssi",
            weight=100,
            start_date=timezone.now() - timedelta(days=1),
            end_date=timezone.now() + timedelta(days=2)
        )

        # Create active symbol-targeted Ad campaign
        self.campaign_targeted = AdCampaign.objects.create(
            name="Targeted TCB Promo",
            campaign_type=AdCampaign.CampaignType.PARTNER_AD,
            status=AdCampaign.Status.ACTIVE,
            banner_url="https://cdn.vninvest.vn/banners/tcb_1x.webp",
            banner_width=300,
            banner_height=50,
            destination_url="https://vninvest.vn/promo/tcb",
            weight=50,
            start_date=timezone.now() - timedelta(days=1),
            end_date=timezone.now() + timedelta(days=2),
            targeting_rules={"target_symbols": ["TCB"]}
        )


class AdServingAPITests(AdvertisingBaseTests):
    @patch('advertising.views._get_redis_client')
    def test_anonymous_and_free_serve_returns_ads(self, mock_get_redis):
        # Mock Redis returning general campaign
        mock_redis = MagicMock()
        mock_redis.sunion.return_value = {str(self.campaign_all.id).encode('utf-8')}
        mock_get_redis.return_value = mock_redis

        response = self.client.get('/api/v1/content/display/', {'slot_size': '300x50'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['show_ads'])
        self.assertFalse(response.data['hide_trademark'])
        self.assertEqual(response.data['ad']['campaign_id'], str(self.campaign_all.id))
        self.assertIn('sig', response.data['ad']['click_tracking_url'])

    @patch('advertising.views._get_redis_client')
    def test_premium_serve_disables_ads(self, mock_get_redis):
        # Authenticate with Premium PAT (Requires mock of credential retrieval or user session)
        self.client.force_authenticate(user=self.premium_owner)
        
        response = self.client.get('/api/v1/content/display/', {'slot_size': '300x50'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['show_ads'])
        self.assertTrue(response.data['hide_trademark'])
        self.assertIsNone(response.data['ad'])


class MetricsTrackingAPITests(AdvertisingBaseTests):
    def get_valid_sig(self, campaign_id, tenant_id, client_ip, expires_at):
        msg = f"{campaign_id}:{tenant_id}:{client_ip}:{expires_at}"
        secret = "dev-ad-signing-secret-replace-in-production"
        return hmac.new(secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).hexdigest()

    @patch('advertising.views._get_redis_client')
    def test_log_view_verifies_signature_and_queues(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis

        expires_at = int(time.time()) + 100
        client_ip = '127.0.0.1'
        sig = self.get_valid_sig(str(self.campaign_all.id), '', client_ip, expires_at)

        payload = {
            'campaign_id': str(self.campaign_all.id),
            'symbol': 'SSI',
            'tenant_id': '',
            'expires_at': expires_at,
            'sig': sig
        }

        response = self.client.post('/api/v1/metrics/log/view/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['tracked'])
        # Verify it queued into Redis Stream
        mock_redis.xadd.assert_called_once()

    def test_log_view_rejects_expired_signature(self):
        expires_at = int(time.time()) - 10  # expired
        client_ip = '127.0.0.1'
        sig = self.get_valid_sig(str(self.campaign_all.id), '', client_ip, expires_at)

        payload = {
            'campaign_id': str(self.campaign_all.id),
            'symbol': 'SSI',
            'tenant_id': '',
            'expires_at': expires_at,
            'sig': sig
        }

        response = self.client.post('/api/v1/metrics/log/view/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CachingAndCeleryTaskTests(AdvertisingBaseTests):
    @patch('advertising.tasks._get_redis_client')
    def test_rebuild_ads_cache_index(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_redis.scan_iter.return_value = []
        mock_get_redis.return_value = mock_redis

        result = rebuild_ads_cache_index()
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['campaigns_count'], 2)
        # Verify set addition was called for slot size 300x50
        mock_redis.sadd.assert_called()

    @patch('advertising.tasks._get_redis_client')
    def test_aggregate_ad_metrics_consumes_and_updates_db(self, mock_get_redis):
        mock_redis = MagicMock()
        # Mock XREADGROUP response for impressions
        mock_msg_id = b'1623635000000-0'
        mock_payload = {
            b'campaign_id': str(self.campaign_all.id).encode('utf-8'),
            b'tenant_id': str(self.free_tenant.public_id).encode('utf-8'),
            b'symbol': b'SSI',
            b'ip_address': b'127.0.0.1',
            b'user_agent': b'test-agent'
        }
        
        # Configure mock responses for xreadgroup calls (Impression then Click)
        mock_redis.xreadgroup.side_effect = [
            [(b'ads:impressions:stream', [(mock_msg_id, mock_payload)])],  # First call (Impressions)
            []  # Second call (Clicks)
        ]
        mock_get_redis.return_value = mock_redis

        # Run Celery Task
        result = aggregate_ad_metrics()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['processed']['impression'], 1)

        # Assert data was aggregated to DB models
        summary = AdDailySummary.objects.filter(
            campaign=self.campaign_all,
            tenant=self.free_tenant,
            symbol='SSI'
        ).first()
        self.assertIsNotNone(summary)
        self.assertEqual(summary.impressions_count, 1)

        # Assert raw log was written
        log_count = AdImpressionLog.objects.filter(campaign=self.campaign_all).count()
        self.assertEqual(log_count, 1)

        # Assert XACK was called to acknowledge message
        mock_redis.xack.assert_called_once()
        mock_redis.xdel.assert_called_once()
