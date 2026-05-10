from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig, WhaleAdvisory


class ApiRouteWhaleAdvisoryDeleteCurrentTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_delete_current_whale_advisory_endpoint_deletes_latest_for_symbol(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        old_record = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=5_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='old',
            ai_detail='old detail',
            ai_model='gpt-4o',
        )
        latest_record = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_000_000_000,
            side='SELL',
            threshold=3_000_000_000,
            ai_summary='latest',
            ai_detail='latest detail',
            ai_model='gpt-4o',
        )

        response = self.client.delete('/api/portfolio/ai-advisory/FPT/current/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['deleted_id'], latest_record.id)
        self.assertTrue(WhaleAdvisory.objects.filter(id=old_record.id).exists())
        self.assertFalse(WhaleAdvisory.objects.filter(id=latest_record.id).exists())

    def test_delete_current_whale_advisory_endpoint_returns_404_when_missing(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()

        response = self.client.delete('/api/portfolio/ai-advisory/SSI/current/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(response.data['ok'])

    def test_delete_current_whale_advisory_endpoint_returns_business_403_for_community(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'free', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_000_000_000,
            side='SELL',
            threshold=3_000_000_000,
            ai_summary='latest',
            ai_detail='latest detail',
            ai_model='gpt-4o',
        )

        response = self.client.delete('/api/portfolio/ai-advisory/FPT/current/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'plan_upgrade_required')
