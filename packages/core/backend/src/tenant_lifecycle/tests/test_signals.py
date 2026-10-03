from django.contrib.auth.models import User
from django.test import TestCase

from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent


class TenantLifecycleSignalsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tl-signal-owner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='tl-signal-tenant',
            display_name='TL Signal Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_status_change_creates_lifecycle_event(self):
        TenantLifecycleEvent.objects.filter(tenant=self.tenant).delete()

        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save(update_fields=['status', 'updated_at'])

        event = TenantLifecycleEvent.objects.filter(tenant=self.tenant).latest('created_at')
        self.assertEqual(event.event_type, TenantLifecycleEvent.EventType.STATUS_CHANGED)
        self.assertEqual(event.old_value, {'status': CoreTenant.StatusChoices.ACTIVE})
        self.assertEqual(event.new_value, {'status': CoreTenant.StatusChoices.SUSPENDED})

    def test_signal_noop_when_status_unchanged(self):
        initial_count = TenantLifecycleEvent.objects.filter(tenant=self.tenant).count()

        self.tenant.display_name = 'TL Signal Tenant Updated'
        self.tenant.save(update_fields=['display_name', 'updated_at'])

        after_count = TenantLifecycleEvent.objects.filter(tenant=self.tenant).count()
        self.assertEqual(initial_count, after_count)
