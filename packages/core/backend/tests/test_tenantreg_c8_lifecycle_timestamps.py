"""Slice C / C8 — activated_at / suspended_at must describe the CURRENT state.

Defect (verified file:line before the fix):
  identity_access/models.py:92-93 declared both timestamps but nothing ever cleared
  them. A tenant suspended at T and later reactivated kept a stale suspended_at, so
  every consumer that reads the timestamp instead of `status` is wrong — most
  concretely tenant_lifecycle/tasks.py:112-118 auto_deprovision_stale filters
  `status=suspended, suspended_at__lt=cutoff`, and a reactivated tenant that later
  trips a different suspension path would be deprovisioned while healthy and paying.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase

from identity_access.models import CoreTenant


User = get_user_model()


class LifecycleTimestampTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='c8owner', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c8_tenant',
            display_name='C8 tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_c8_active_tenant_records_activated_at(self):
        self.tenant.refresh_from_db()
        self.assertIsNotNone(self.tenant.activated_at)

    def test_c8_suspension_stamps_suspended_at(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertIsNotNone(self.tenant.suspended_at)

    def test_c8_reactivation_clears_the_stale_suspended_at(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertIsNotNone(self.tenant.suspended_at)

        self.tenant.status = CoreTenant.StatusChoices.ACTIVE
        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertIsNone(
            self.tenant.suspended_at,
            'a stale suspended_at makes auto_deprovision_stale '
            '(tenant_lifecycle/tasks.py:112-118) eventually deprovision a healthy tenant',
        )

    def test_c8_reactivation_keeps_the_original_activated_at(self):
        first = self.tenant.activated_at
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save()
        self.tenant.status = CoreTenant.StatusChoices.ACTIVE
        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.activated_at, first)

    def test_c8_deprovision_clears_both_timestamps(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save()
        self.tenant.status = CoreTenant.StatusChoices.DEPROVISIONED
        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertIsNone(self.tenant.suspended_at)
        self.assertIsNone(self.tenant.activated_at)

    def test_c8_trial_status_does_not_invent_a_suspension(self):
        self.tenant.status = CoreTenant.StatusChoices.TRIAL
        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertIsNone(self.tenant.suspended_at)
        self.assertIsNone(self.tenant.activated_at)

    def test_c8_update_fields_path_also_clears(self):
        # a save() override would be silently dropped for update_fields callers
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save(update_fields=['status', 'updated_at'])
        self.tenant.refresh_from_db()
        self.assertIsNotNone(self.tenant.suspended_at)

        self.tenant.status = CoreTenant.StatusChoices.ACTIVE
        self.tenant.save(update_fields=['status', 'updated_at'])
        self.tenant.refresh_from_db()
        self.assertIsNone(self.tenant.suspended_at)

    def test_c8_suspension_does_not_restamp_an_already_stamped_suspension(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save()
        self.tenant.refresh_from_db()
        first_stamp = self.tenant.suspended_at

        self.tenant.save()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.suspended_at, first_stamp)
