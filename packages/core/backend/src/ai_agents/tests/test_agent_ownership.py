"""Slice D2 — Agent registry ownership (list/detail/patch/delete/name unique).

D-AC3..AC6.
"""

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from ai_agents.models import AgentRegistry

LIST_URL = '/core/v1/ai/agents/'


def detail_url(pk):
    return f'{LIST_URL}{pk}/'


class AgentOwnershipTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username='agent_user_a', password='x')
        self.user_b = User.objects.create_user(username='agent_user_b', password='x')
        self.staff = User.objects.create_user(
            username='agent_staff', password='x', is_staff=True,
        )
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)

        self.agent_a = AgentRegistry.objects.create(
            name='Agent Alpha', created_by=self.user_a,
        )
        self.agent_b = AgentRegistry.objects.create(
            name='Agent Beta', created_by=self.user_b,
        )

    def test_d_ac3_list_excludes_other_users(self):
        body = self.client_a.get(LIST_URL).json()
        names = [row['name'] for row in body['results']]
        self.assertEqual(names, ['Agent Alpha'])

    def test_d_ac3b_staff_list_all(self):
        body = self.staff_client.get(LIST_URL).json()
        names = {row['name'] for row in body['results']}
        self.assertEqual(names, {'Agent Alpha', 'Agent Beta'})

    def test_d_ac3c_detail_other_user_404(self):
        response = self.client_a.get(detail_url(self.agent_b.id))
        self.assertEqual(response.status_code, 404)

    def test_d_ac3d_detail_own_200(self):
        response = self.client_a.get(detail_url(self.agent_a.id))
        self.assertEqual(response.status_code, 200)

    def test_d_ac4_patch_other_user_403(self):
        response = self.client_a.patch(
            detail_url(self.agent_b.id), {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.agent_b.refresh_from_db()
        self.assertTrue(self.agent_b.is_active)

    def test_d_ac4b_delete_other_user_403(self):
        response = self.client_a.delete(detail_url(self.agent_b.id))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(AgentRegistry.objects.filter(pk=self.agent_b.id).exists())

    def test_d_ac4c_patch_own_200(self):
        response = self.client_a.patch(
            detail_url(self.agent_a.id), {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.agent_a.refresh_from_db()
        self.assertFalse(self.agent_a.is_active)

    def test_d_ac4d_delete_own_204(self):
        response = self.client_a.delete(detail_url(self.agent_a.id))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(AgentRegistry.objects.filter(pk=self.agent_a.id).exists())

    def test_d_ac4e_staff_patch_any_200(self):
        response = self.staff_client.patch(
            detail_url(self.agent_b.id), {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_d_ac5_same_name_different_creators_ok(self):
        AgentRegistry.objects.create(name='Shared Name', created_by=self.user_b)
        response = self.client_a.post(
            LIST_URL, {'name': 'Shared Name', 'agent_type': 'custom'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

    def test_d_ac5b_same_name_same_creator_rejected(self):
        AgentRegistry.objects.create(name='Dup Name', created_by=self.user_a)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AgentRegistry.objects.create(name='Dup Name', created_by=self.user_a)

    def test_post_sets_created_by(self):
        response = self.client_a.post(
            LIST_URL, {'name': 'Created Now', 'agent_type': 'custom'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['created_by'], self.user_a.id)

    def test_unauthenticated_forbidden(self):
        from rest_framework.test import APIClient as C
        self.assertIn(C().get(LIST_URL).status_code, (401, 403))
