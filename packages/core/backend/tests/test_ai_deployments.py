"""R2.1 (plan Rev.2): AIDeployment + AIFallbackChain + active_deployment.

AC1: migration sach (makemigrations --check).
AC2: active_deployment NULL -> hanh vi nhu cu (8 test config_isolation xanh).
AC3: chain rong => khong failover ([]).
AC4: unique (name, scope, owner).
AC5: 2 user khong cham deployment cua nhau.
AC6: weight ngoai [0,100] -> ValidationError.

TDD fail-before: model chua ton tai (ImportError) tren code cu.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django  # noqa: E402

django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.core.exceptions import ValidationError  # noqa: E402
from django.db import IntegrityError, transaction  # noqa: E402
from django.test import TestCase  # noqa: E402

from advisory.deployments import (  # noqa: E402
    pick_active_deployment,
    pick_deployment,
    resolve_fallback_chain,
)
from advisory.models import AIDeployment, AIFallbackChain, UserAICredential  # noqa: E402


class DeploymentModelTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='r21-a', password='x')
        self.b = User.objects.create_user(username='r21-b', password='x')

    def _dep(self, user, name='main', **kw):
        params = {
            'name': name, 'owner_scope': 'user', 'owner_user': user,
            'provider': 'openai', 'model': 'gpt-4o-mini', 'weight': 100,
        }
        params.update(kw)
        return AIDeployment.objects.create(**params)

    def test_ac3_empty_chain_no_failover(self):
        AIFallbackChain.objects.create(
            name='c', owner_scope='user', owner_user=self.a, deployment_ids=[],
        )
        self.assertEqual(resolve_fallback_chain(self.a), [])
        self.assertIsNone(pick_deployment(self.a))

    def test_ac4_unique_name_scope_owner(self):
        self._dep(self.a, name='dup')
        # IntegrityError làm hỏng transaction TestCase ⇒ bọc savepoint.
        with transaction.atomic(), self.assertRaises(IntegrityError):
            self._dep(self.a, name='dup')
        # user khác được trùng tên (isolation theo owner)
        self._dep(self.b, name='dup')

    def test_ac5_isolation_two_users(self):
        da = self._dep(self.a, name='a-main')
        self._dep(self.b, name='b-main')
        mine_a = list(AIDeployment.objects.filter(owner_user=self.a))
        self.assertEqual([d.pk for d in mine_a], [da.pk])
        chain = AIFallbackChain.objects.create(
            name='c', owner_scope='user', owner_user=self.a,
            deployment_ids=[da.pk, 999999],
        )
        _ = chain
        resolved = resolve_fallback_chain(self.a)
        self.assertEqual([d.pk for d in resolved], [da.pk])

    def test_ac6_weight_out_of_range_rejected(self):
        bad = AIDeployment(
            name='w', owner_scope='user', owner_user=self.a,
            provider='openai', model='x', weight=101,
        )
        with self.assertRaises(ValidationError):
            bad.full_clean()
        bad.weight = -1
        with self.assertRaises(ValidationError):
            bad.full_clean()

    def test_active_deployment_pick_and_null(self):
        # NULL (mặc định) => None, hành vi cũ giữ nguyên (AC2).
        UserAICredential.objects.create(user=self.a)
        self.assertIsNone(pick_active_deployment(self.a))
        self.assertIsNone(pick_deployment(self.a))
        dep = self._dep(self.a, name='sel')
        cred = UserAICredential.objects.get(user=self.a)
        cred.active_deployment = dep
        cred.save()
        self.assertEqual(pick_active_deployment(self.a).pk, dep.pk)
        self.assertEqual(pick_deployment(self.a).pk, dep.pk)
        # deployment tắt => coi như chưa chọn.
        dep.enabled = False
        dep.save()
        self.assertIsNone(pick_active_deployment(self.a))
