"""W8 P3 preset cộng đồng — BE tests for rule sharing (is_public) + fork.

Covers: share toggle via PUT detail, public catalog scoping (same-tenant
member sees, other tenant does not), fork copies rules_json with "(bản sao)"
name, fork 404 for private foreign rules.
"""
from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from user_workspace.tests.envelope import unwrapped_json
from user_workspace.models import ScreenerRule

User = get_user_model()

LIST_URL = "/core/v1/screener/rules/"
PUBLIC_URL = "/core/v1/screener/rules/public/"
DETAIL_URL = "/core/v1/screener/rules/{pk}/"
FORK_URL = "/core/v1/screener/rules/{pk}/fork/"

RULES = [{"field": "close", "op": "gt", "value": 5, "logic": "AND"}]


class ScreenerCommunityTestCase(TestCase):
    def setUp(self):
        dj_cache.clear()
        self.owner = User.objects.create_user(username="comm-owner", email="o@test.local", password="pass123")
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner, tenant_code="comm_t", display_name="Comm T", status="active", plan="pro"
        )
        self.member = User.objects.create_user(username="comm-member", email="m@test.local", password="pass123")
        TenantMember.objects.create(tenant=self.tenant, user=self.member, role="viewer")
        self.stranger = User.objects.create_user(username="comm-stranger", email="s@test.local", password="pass123")
        CoreTenant.objects.create(
            owner_user=self.stranger, tenant_code="stranger_t", display_name="S", status="active", plan="pro"
        )
        self.owner_c = APIClient()
        self.owner_c.force_authenticate(user=self.owner)
        self.member_c = APIClient()
        self.member_c.force_authenticate(user=self.member)
        self.stranger_c = APIClient()
        self.stranger_c.force_authenticate(user=self.stranger)
        self.rule = ScreenerRule.objects.create(
            user=self.owner, tenant=self.tenant, name="SharedAlpha", rules_json=RULES, is_active=True
        )

    def test_share_toggle_via_put(self):
        resp = self.owner_c.put(DETAIL_URL.format(pk=self.rule.pk), {"is_public": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(unwrapped_json(resp)["is_public"])
        self.assertEqual(unwrapped_json(resp)["owner_username"], "comm-owner")
        self.rule.refresh_from_db()
        self.assertTrue(self.rule.is_public)

    def test_public_catalog_same_tenant_member_sees(self):
        self.rule.is_public = True
        self.rule.save()
        resp = self.member_c.get(PUBLIC_URL)
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in unwrapped_json(resp)]
        self.assertIn(self.rule.id, ids)

    def test_public_catalog_hides_private_and_other_tenant(self):
        # Private by default
        self.assertEqual(unwrapped_json(self.member_c.get(PUBLIC_URL)), [])
        self.assertEqual(unwrapped_json(self.stranger_c.get(PUBLIC_URL)), [])
        # Even after sharing, other tenant cannot see
        self.rule.is_public = True
        self.rule.save()
        self.assertEqual(unwrapped_json(self.stranger_c.get(PUBLIC_URL)), [])

    def test_fork_copies_rule_for_member(self):
        self.rule.is_public = True
        self.rule.save()
        resp = self.member_c.post(FORK_URL.format(pk=self.rule.pk), {}, format="json")
        self.assertEqual(resp.status_code, 201)
        data = unwrapped_json(resp)
        self.assertEqual(data["rules_json"], RULES)
        self.assertFalse(data["is_public"])
        self.assertIn("bản sao", data["name"])
        self.assertEqual(ScreenerRule.objects.filter(user=self.member).count(), 1)

    def test_fork_private_foreign_rule_404(self):
        resp = self.member_c.post(FORK_URL.format(pk=self.rule.pk), {}, format="json")
        self.assertEqual(resp.status_code, 404)
        resp = self.stranger_c.post(FORK_URL.format(pk=self.rule.pk), {}, format="json")
        self.assertEqual(resp.status_code, 404)
