"""
Unit tests cho Screener Rule CRUD endpoints (S5-BE).

Coverage:
  - POST /api/soc/screener/rules/          → 201 (create)
  - PUT  /api/soc/screener/rules/<id>/     → 200 (update) / 404 (not found)
  - DELETE /api/soc/screener/rules/<id>/delete/ → 204 (delete) / 404 (not found)
"""
import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ConfigChangeAudit, OwnershipRecord
from service_ops.registry import ensure_service_registry

from service_ops.tests.envelope import unwrapped_json

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
        data = unwrapped_json(response)
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
        rule_id = unwrapped_json(create_resp)['rule_id']

        # Verify appears in GET list
        list_resp = self.client.get('/api/soc/screener/rules/')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        rules = unwrapped_json(list_resp).get('rules', [])
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
        return unwrapped_json(resp)['rule_id']

    def test_update_rule_returns_200(self):
        rule_id = self._create_rule('Update Me')
        update_payload = {'name': 'Updated Name', 'enabled': False}

        response = self.client.put(
            f'/api/soc/screener/rules/{rule_id}/',
            update_payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped_json(response)
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
        data = unwrapped_json(response)
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
        rules = unwrapped_json(list_resp).get('rules', [])
        self.assertNotIn(rule_id, [r['id'] for r in rules])

    def test_delete_rule_not_found_returns_404(self):
        response = self.client.delete('/api/soc/screener/rules/nonexistent_rule_id/delete/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = unwrapped_json(response)
        self.assertEqual(data['code'], 'RULE_NOT_FOUND')

    # ---------------------------------------------------------------
    # SC-11: type validation — only VALID_RULE_TYPES accepted
    # ---------------------------------------------------------------

    def test_create_rule_rejects_invalid_type(self):
        response = self.client.post('/api/soc/screener/rules/', {
            'name': 'Bad', 'type': 'not_a_type', 'value': [],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(response)['code'], 'INVALID_RULE_TYPE')

    def test_update_rule_rejects_invalid_type(self):
        rule_id = self._create_rule('Type Guard')
        response = self.client.put(
            f'/api/soc/screener/rules/{rule_id}/', {'type': 'nope'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(response)['code'], 'INVALID_RULE_TYPE')

    # ---------------------------------------------------------------
    # SC-11: audit trail for rule mutations
    # ---------------------------------------------------------------

    def test_rule_create_writes_audit_trail(self):
        rule_id = self._create_rule('Audited')

        audit = ConfigChangeAudit.objects.filter(action='rule_create').order_by('-id').first()
        self.assertIsNotNone(audit)
        self.assertIn(rule_id, json.dumps(audit.after_snapshot))

    def test_rule_delete_writes_audit_trail(self):
        rule_id = self._create_rule('Gone')
        self.client.delete(f'/api/soc/screener/rules/{rule_id}/delete/')

        audit = ConfigChangeAudit.objects.filter(action='rule_delete').order_by('-id').first()
        self.assertIsNotNone(audit)
        self.assertNotIn(rule_id, json.dumps(audit.after_snapshot))

    # ---------------------------------------------------------------
    # SC-07: ownership enforcement on rule CRUD
    # ---------------------------------------------------------------

    def _make_read_only(self):
        OwnershipRecord.objects.update_or_create(
            domain='screener',
            defaults={
                'owner_team': 'core',
                'write_mode': 'read-only',
                'write_surface': '',
                'locked_fields': [],
                'compatibility_domains': [],
            },
        )

    def test_rule_crud_blocked_when_read_only(self):
        self._make_read_only()

        create_resp = self.client.post('/api/soc/screener/rules/', {
            'name': 'Nope', 'type': 'custom', 'value': [],
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(unwrapped_json(create_resp)['code'], 'OWNERSHIP_WRITE_DENIED')

        # Seed a rule while writable, then block update/delete.
        OwnershipRecord.objects.filter(domain='screener').delete()
        rule_id = self._create_rule('Locked')
        self._make_read_only()

        put_resp = self.client.put(
            f'/api/soc/screener/rules/{rule_id}/', {'name': 'X'}, format='json')
        self.assertEqual(put_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(unwrapped_json(put_resp)['code'], 'OWNERSHIP_WRITE_DENIED')

        del_resp = self.client.delete(f'/api/soc/screener/rules/{rule_id}/delete/')
        self.assertEqual(del_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(unwrapped_json(del_resp)['code'], 'OWNERSHIP_WRITE_DENIED')
