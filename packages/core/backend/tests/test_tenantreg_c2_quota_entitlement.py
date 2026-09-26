"""Slice C / C2 - plan entitlement is one canonical table, and it is enforced.

C2 defect (verified file:line before the fix):
  commercial/models.py:44   api_calls_limit = BigIntegerField(default=-1)  (-1 = unlimited)
  commercial/tasks.py:140    get_or_create(..., defaults={'api_calls_used': 0})
  -> api_calls_limit was NEVER set by any production code path, so every tenant was
     unlimited forever: the middleware guard skips negative limits, X-Quota-Warning
     never appeared, and tenant_lifecycle.tasks.auto_suspend_quota_overflow
     (api_calls_limit__gt=-1) could never match a row.
  Meanwhile CoreTenant.api_calls_limit (identity_access/models.py:105) defaulted to
  10000 for EVERY plan, and identity_access/middleware.py:_get_tenant_quota_limit
  (:442-461) reads only QuotaRecord and falls back to -1.
"""

from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from commercial.models import QuotaRecord
from commercial.plan_catalog import (
    ALL_PLAN_CODES,
    PAID_PLAN_CODES,
    PLAN_ENTITLEMENTS,
    UNLIMITED,
    get_api_calls_limit,
    get_meter_entitlement,
    get_plan_entitlement,
    is_paid_plan,
    is_plan_derived_api_calls_limit,
)
from commercial.tasks import METER_ENTITLEMENT_BY_PLAN, backfill_quota_entitlements, flush_quota_counters
from identity_access.models import CoreTenant


User = get_user_model()


class CanonicalPlanEntitlementTests(TestCase):
    def test_c2_every_core_plan_code_has_an_entitlement_row(self):
        for code, _label in CoreTenant.PlanChoices.choices:
            self.assertIn(code, PLAN_ENTITLEMENTS, f'{code} missing from PLAN_ENTITLEMENTS')
        self.assertEqual(set(ALL_PLAN_CODES), set(PLAN_ENTITLEMENTS))

    def test_c2_unknown_plan_falls_back_to_free_not_unlimited(self):
        # fail-closed: a typo'd plan must not silently become unlimited
        self.assertEqual(get_api_calls_limit('nonsense'), get_api_calls_limit('free'))
        self.assertEqual(get_api_calls_limit(None), get_api_calls_limit('free'))
        self.assertEqual(get_api_calls_limit(''), get_api_calls_limit('free'))

    def test_c2_api_call_values_match_what_customers_were_quoted(self):
        # identity_access/views_webhooks.py:196-201 features_map is the only place in
        # the repo that ever stated api_calls numbers, and it is the endpoint the
        # plan-change preview shows. free must not be 10000.
        self.assertEqual(get_api_calls_limit('free'), 1000)
        self.assertEqual(get_api_calls_limit('starter'), 10000)
        self.assertEqual(get_api_calls_limit('pro'), 50000)
        self.assertEqual(get_api_calls_limit('enterprise'), UNLIMITED)

    def test_c2_meter_entitlement_table_is_derived_not_hand_written(self):
        self.assertEqual(set(METER_ENTITLEMENT_BY_PLAN), {'ai_regenerate', 'exports'})
        for meter in ('ai_regenerate', 'exports'):
            for plan in ALL_PLAN_CODES:
                self.assertEqual(
                    METER_ENTITLEMENT_BY_PLAN[meter][plan],
                    get_meter_entitlement(plan, meter),
                )
        # the documented shape: free/starter excluded, pro+ unlimited
        self.assertEqual(METER_ENTITLEMENT_BY_PLAN['ai_regenerate']['free'], 0)
        self.assertEqual(METER_ENTITLEMENT_BY_PLAN['ai_regenerate']['pro'], UNLIMITED)
        self.assertEqual(METER_ENTITLEMENT_BY_PLAN['exports']['starter'], 0)

    def test_c2_paid_plan_set_matches_legacy_helpers_table(self):
        # identity_access/views/helpers.py:137-143
        self.assertEqual(
            set(PAID_PLAN_CODES),
            {CoreTenant.PlanChoices.STARTER, CoreTenant.PlanChoices.PRO,
             CoreTenant.PlanChoices.ENTERPRISE, CoreTenant.PlanChoices.CUSTOM,
             CoreTenant.PlanChoices.INTERNAL},
        )
        self.assertFalse(is_paid_plan('free'))
        self.assertTrue(is_paid_plan('enterprise'))

    def test_c2_plan_derived_detector_protects_negotiated_numbers(self):
        self.assertTrue(is_plan_derived_api_calls_limit(10000))
        self.assertTrue(is_plan_derived_api_calls_limit(-1))
        self.assertTrue(is_plan_derived_api_calls_limit('1000'))
        # a hand-negotiated enterprise allowance must be recognised as an override
        self.assertFalse(is_plan_derived_api_calls_limit(2_000_000))
        self.assertFalse(is_plan_derived_api_calls_limit(None))
        self.assertFalse(is_plan_derived_api_calls_limit('abc'))

    def test_c2_max_active_pats_is_unlimited_so_no_customer_gets_blocked(self):
        for plan in ALL_PLAN_CODES:
            self.assertEqual(
                get_plan_entitlement(plan)['max_active_pats'],
                UNLIMITED,
                'a finite PAT cap would make issue_for_service_account raise '
                'ValidationError for paying customers (models.py:337-348)',
            )


class TenantCarriesPlanLimitTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='c2owner', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c2_tenant',
            display_name='C2 tenant',
        )

    def test_c2_new_tenant_gets_free_limit_not_the_10000_default(self):
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, CoreTenant.PlanChoices.FREE)
        self.assertEqual(self.tenant.api_calls_limit, 1000)

    def test_c2_plan_change_reseeds_the_limit_even_with_update_fields(self):
        # manage_subscriptions_lifecycle saves with update_fields=['plan', ...];
        # a plain save() override would be silently dropped there.
        self.tenant.plan = CoreTenant.PlanChoices.PRO
        self.tenant.save(update_fields=['plan', 'updated_at'])
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.api_calls_limit, 50000)

    def test_c2_negotiated_override_is_preserved_across_plan_change(self):
        CoreTenant.objects.filter(pk=self.tenant.pk).update(api_calls_limit=2_000_000)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.api_calls_limit, 2_000_000)

        self.tenant.plan = CoreTenant.PlanChoices.ENTERPRISE
        self.tenant.save(update_fields=['plan', 'updated_at'])
        self.tenant.refresh_from_db()
        self.assertEqual(
            self.tenant.api_calls_limit,
            2_000_000,
            'a hand-negotiated limit must not be clobbered by the plan sync',
        )

    def test_c2_custom_plan_keeps_unlimited(self):
        self.tenant.plan = CoreTenant.PlanChoices.CUSTOM
        self.tenant.save(update_fields=['plan', 'updated_at'])
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.api_calls_limit, UNLIMITED)


class QuotaRecordSeedingTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='c2qowner', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c2q_tenant',
            display_name='C2 quota tenant',
        )

    def test_c2_flush_quota_counters_seeds_the_limit_at_period_open(self):
        from commercial.tasks import _current_billing_period

        today = timezone.now().date()
        period_start, period_end = _current_billing_period(today)
        # The test cache is LocMem, which has no scan_iter, so _iter_quota_counter_keys
        # yields nothing. Patch the counter source instead of the cache backend so the
        # real get_or_create path is exercised.
        raw_key = f'quota:api_calls:{self.tenant.public_id}:{today.isoformat()}'
        with patch('commercial.tasks._iter_quota_counter_keys', return_value=iter([raw_key])), \
             patch('commercial.tasks._cache_get_int', return_value=7):
            result = flush_quota_counters(str(today))

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['processed'], 1)
        record = QuotaRecord.objects.get(
            tenant=self.tenant,
            period_start=period_start,
            period_end=period_end,
        )
        self.assertEqual(record.api_calls_used, 7)
        self.assertEqual(
            record.api_calls_limit,
            1000,
            'flush_quota_counters is the ONLY creator of QuotaRecord in production; '
            'it must seed the limit or the tenant stays unlimited forever',
        )

    def test_c2_backfill_repairs_an_existing_unlimited_record(self):
        today = timezone.now().date()
        from commercial.tasks import _current_billing_period
        period_start, period_end = _current_billing_period(today)
        record = QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=period_start,
            period_end=period_end,
            api_calls_used=0,
            api_calls_limit=-1,  # the state every live row is in today
        )

        stats = backfill_quota_entitlements()

        record.refresh_from_db()
        self.assertEqual(stats['limits_repaired'], 1)
        self.assertEqual(record.api_calls_limit, 1000)

    def test_c2_backfill_creates_a_current_period_record_for_every_live_tenant(self):
        # this is what lets the untouched middleware read a real limit
        self.assertFalse(QuotaRecord.objects.exists())
        stats = backfill_quota_entitlements()
        self.assertEqual(stats['records_created'], 1)
        self.assertEqual(QuotaRecord.objects.count(), 1)
        self.assertEqual(QuotaRecord.objects.get().api_calls_limit, 1000)

    def test_c2_backfill_is_idempotent(self):
        backfill_quota_entitlements()
        second = backfill_quota_entitlements()
        self.assertEqual(second['records_created'], 0)
        self.assertEqual(second['limits_repaired'], 0)
        self.assertEqual(second['tenant_limits_repaired'], 0)
        self.assertEqual(QuotaRecord.objects.count(), 1)

    def test_c2_backfill_dry_run_writes_nothing(self):
        stats = backfill_quota_entitlements(dry_run=True)
        self.assertTrue(stats['dry_run'])
        self.assertEqual(stats['records_created'], 1)
        self.assertEqual(QuotaRecord.objects.count(), 0, 'dry-run must not write')

    def test_c2_backfill_preserves_negotiated_record_limit(self):
        from commercial.tasks import _current_billing_period
        today = timezone.now().date()
        period_start, period_end = _current_billing_period(today)
        record = QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=period_start,
            period_end=period_end,
            api_calls_limit=2_000_000,
        )
        stats = backfill_quota_entitlements()
        record.refresh_from_db()
        self.assertEqual(record.api_calls_limit, 2_000_000)
        self.assertEqual(stats['overrides_preserved'], 1)

    def test_c2_backfill_skips_deprovisioned_tenants_by_default(self):
        CoreTenant.objects.filter(pk=self.tenant.pk).update(
            status=CoreTenant.StatusChoices.DEPROVISIONED
        )
        stats = backfill_quota_entitlements()
        self.assertEqual(stats['tenants_scanned'], 0)
        self.assertFalse(QuotaRecord.objects.exists())

        stats_all = backfill_quota_entitlements(include_deprovisioned=True)
        self.assertEqual(stats_all['tenants_scanned'], 1)
        self.assertEqual(QuotaRecord.objects.count(), 1)

    def test_c2_backfill_result_is_reportable_for_review(self):
        # The operator must be able to see exactly which tenants lose headroom before
        # applying, because free 10000 -> 1000 can throttle existing free tenants.
        stats = backfill_quota_entitlements(dry_run=True)
        self.assertTrue(stats['dry_run'])
        self.assertTrue(stats['changes'])
        self.assertTrue(all(isinstance(change, str) for change in stats['changes']))
        self.assertIn(str(self.tenant.public_id), '\n'.join(stats['changes']))
