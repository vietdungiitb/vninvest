"""
Unit tests cho Screener Rule CRUD endpoints (S5-BE).

Coverage:
  - POST /api/soc/screener/rules/          → 201 (create)
  - PUT  /api/soc/screener/rules/<id>/     → 200 (update) / 404 (not found)
  - DELETE /api/soc/screener/rules/<id>/delete/ → 204 (delete) / 404 (not found)
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry

User = get_user_model()


class ScreenerRuleCRUDTestCase(TestCase):
    """S5-BE: Test Screener Rule CRUD endpoints."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='screener-crud-admin',
            email='screener-crud@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    # ---------------------------------------------------------------
    # POST /api/soc/screener/rules/ — create rule
    # ---------------------------------------------------------------

    def test_create_rule_returns_201(self):
        payload = {
            'name': 'Test Whale Rule',
            'type': 'whale_count',
            'value': [{'field': 'whale_count', 'op': 'gte', 'value': 3}],
            'enabled': True,
        }
        response = self.client.post('/api/soc/screener/rules/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn('rule_id', data)
        self.assertEqual(data['name'], 'Test Whale Rule')
        self.assertEqual(data['type'], 'whale_count')
        self.assertTrue(data['enabled'])
        self.assertTrue(data['rule_id'].startswith('rule_'))

    def test_create_rule_persists_to_config(self):
        payload = {
            'name': 'Persist Test Rule',
            'type': 'volume_spike_ratio',
            'value': [{'field': 'vol_ratio', 'op': 'gte', 'value': 2.0}],
        }
        create_resp = self.client.post('/api/soc/screener/rules/', payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        rule_id = create_resp.json()['rule_id']

        # Verify appears in GET list
        list_resp = self.client.get('/api/soc/screener/rules/')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        rules = list_resp.json().get('rules', [])
        rule_ids = [r['id'] for r in rules]
        self.assertIn(rule_id, rule_ids)

    # ---------------------------------------------------------------
    # PUT /api/soc/screener/rules/<rule_id>/ — update rule
    # ---------------------------------------------------------------

    def _create_rule(self, name='Auto Rule', rule_type='custom'):
        resp = self.client.post('/api/soc/screener/rules/', {
            'name': name,
            'type': rule_type,
            'value': [{'field': 'value', 'op': 'gte', 'value': 1}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.json()['rule_id']

    def test_update_rule_returns_200(self):
        rule_id = self._create_rule('Update Me')
        update_payload = {'name': 'Updated Name', 'enabled': False}

        response = self.client.put(
            f'/api/soc/screener/rules/{rule_id}/',
            update_payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['rule_id'], rule_id)
        self.assertEqual(data['name'], 'Updated Name')
        self.assertFalse(data['enabled'])

    def test_update_rule_not_found_returns_404(self):
        response = self.client.put(
            '/api/soc/screener/rules/nonexistent_rule_id/',
            {'name': 'Fail'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertEqual(data['code'], 'RULE_NOT_FOUND')

    # ---------------------------------------------------------------
    # DELETE /api/soc/screener/rules/<rule_id>/delete/ — delete rule
    # ---------------------------------------------------------------

    def test_delete_rule_returns_204(self):
        rule_id = self._create_rule('Delete Me')

        response = self.client.delete(f'/api/soc/screener/rules/{rule_id}/delete/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_rule_removes_from_list(self):
        rule_id = self._create_rule('Remove From List')

        self.client.delete(f'/api/soc/screener/rules/{rule_id}/delete/')

        list_resp = self.client.get('/api/soc/screener/rules/')
        rules = list_resp.json().get('rules', [])
        self.assertNotIn(rule_id, [r['id'] for r in rules])

    def test_delete_rule_not_found_returns_404(self):
        response = self.client.delete('/api/soc/screener/rules/nonexistent_rule_id/delete/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertEqual(data['code'], 'RULE_NOT_FOUND')
