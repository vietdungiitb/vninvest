from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import GlobalScreenerRule, ScreenerScheduleConfig, UserConfig


CONFIG_URL = '/api/portfolio/admin/screener/config/'
RULES_URL = '/api/portfolio/admin/screener/rules/'
RULE_DETAIL_URL = lambda pk: f'/api/portfolio/admin/screener/rules/{pk}/'
RUN_MANUAL_URL = '/api/portfolio/admin/screener/run-manual/'


def _login_staff(client, username='admin_staff'):
    user = User.objects.get(username=username)
    cfg, _ = UserConfig.objects.get_or_create(user=user)
    if not cfg.email_verified:
        cfg.email_verified = True
        cfg.save(update_fields=['email_verified', 'updated_at'])
    resp = client.post('/api/auth/token/', {'username': username, 'password': 'Test@123456'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")


class AdminScreenerPermissionTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username='admin_staff', password='Test@123456', is_staff=True)
        User.objects.create_user(username='regular_user', password='Test@123456')

    def test_unauthenticated_config_returns_401(self):
        resp = self.client.get(CONFIG_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_regular_user_config_returns_403(self):
        _login_staff(self.client, 'regular_user')
        resp = self.client.get(CONFIG_URL)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_user_config_returns_200(self):
        _login_staff(self.client, 'admin_staff')
        resp = self.client.get(CONFIG_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class AdminScreenerConfigTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username='admin_staff', password='Test@123456', is_staff=True)
        _login_staff(self.client, 'admin_staff')

    def test_get_returns_default_config(self):
        resp = self.client.get(CONFIG_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('cron_expression', resp.data)
        self.assertIn('is_user_custom_screener_enabled', resp.data)

    def test_put_updates_config(self):
        resp = self.client.put(CONFIG_URL, {
            'cron_expression': '*/10 * * * *',
            'is_user_custom_screener_enabled': False,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['cron_expression'], '*/10 * * * *')
        self.assertFalse(resp.data['is_user_custom_screener_enabled'])
        latest = ScreenerScheduleConfig.objects.order_by('-updated_at', '-created_at', '-pk').first()
        self.assertIsNotNone(latest)
        self.assertEqual(latest.cron_expression, '*/10 * * * *')


class AdminGlobalScreenerRuleTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username='admin_staff', password='Test@123456', is_staff=True)
        _login_staff(self.client, 'admin_staff')

    def _rule_payload(self, name='Luật dòng tiền'):
        return {
            'name': name,
            'rules_json': [
                {'field': 'whale_intensity', 'op': 'gte', 'value': 80},
                {'field': 'dark_flow_strength', 'op': 'gte', 'value': 70},
            ],
            'is_active': True,
        }

    def test_list_empty(self):
        resp = self.client.get(RULES_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])

    def test_create_update_delete_rule(self):
        create_resp = self.client.post(RULES_URL, self._rule_payload(), format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        rule_id = create_resp.data['id']
        self.assertEqual(create_resp.data['name'], 'Luật dòng tiền')

        update_resp = self.client.put(RULE_DETAIL_URL(rule_id), {
            'name': 'Luật dòng tiền đã cập nhật',
            'is_active': False,
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['name'], 'Luật dòng tiền đã cập nhật')
        self.assertFalse(update_resp.data['is_active'])

        delete_resp = self.client.delete(RULE_DETAIL_URL(rule_id))
        self.assertEqual(delete_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(GlobalScreenerRule.objects.filter(pk=rule_id).exists())


class AdminGlobalScreenerManualRunTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username='admin_staff', password='Test@123456', is_staff=True)
        _login_staff(self.client, 'admin_staff')

    @patch('portfolio.views_screener_admin.run_global_screener_manual_task.apply_async')
    def test_manual_run_queues_background_task(self, mock_apply_async):
        mock_apply_async.return_value.id = 'task-123'
        resp = self.client.post(RUN_MANUAL_URL)
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(resp.data['status'], 'queued')
        self.assertEqual(resp.data['task_id'], 'task-123')
        mock_apply_async.assert_called_once_with(kwargs={}, countdown=0)
