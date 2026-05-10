from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig, WhaleAdvisory


class ApiRouteWhaleAdvisoryAccessTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_whale_advisory_endpoint_requires_pro(self):
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat ngan',
            ai_detail='Phan tich chi tiet',
        )

        response = self.client.get('/api/portfolio/ai-advisory/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_whale_advisory_endpoint_masks_detail_for_pro(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='VCB',
            matched_value=9_200_000_000,
            side='SELL',
            threshold=5_000_000_000,
            ai_summary='Tom tat pro',
            ai_detail='Chi tiet premium',
            ai_model='gpt-4o',
        )

        response = self.client.get('/api/portfolio/ai-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ai_summary'], 'Tom tat pro')
        self.assertEqual(response.data[0]['ai_detail'], '')
        self.assertIn('next_refresh_at', response.data[0])
        self.assertIn('refresh_count', response.data[0])
        self.assertIn('source', response.data[0])
        self.assertIn('advisory_type', response.data[0])
        self.assertIn('severity', response.data[0])

    def test_whale_advisory_endpoint_returns_detail_for_premium(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='HPG',
            matched_value=7_100_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat premium',
            ai_detail='Chi tiet premium day du',
            ai_model='gpt-4o',
        )

        response = self.client.get('/api/portfolio/ai-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['ai_detail'], 'Chi tiet premium day du')

    def test_whale_advisory_endpoint_can_filter_ready_for_refresh(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='AAA',
            matched_value=5_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='Ready advisory',
            ai_detail='Ready detail',
            ai_model='gpt-4o',
            next_refresh_at=timezone.now() - timedelta(minutes=5),
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BBB',
            matched_value=5_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='Pending advisory',
            ai_detail='Pending detail',
            ai_model='gpt-4o',
            next_refresh_at=timezone.now() + timedelta(hours=2),
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )

        response = self.client.get('/api/portfolio/ai-advisory/?refresh_status=ready')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['symbol'], 'AAA')
