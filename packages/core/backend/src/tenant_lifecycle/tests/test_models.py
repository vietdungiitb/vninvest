from django.contrib.auth.models import User
from django.test import TestCase

from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent


class TenantLifecycleEventModelTests(TestCase):
    def test_event_model_persists_metadata(self):
        user = User.objects.create_user(username='tl-model-owner', password='testpass123')
        tenant = CoreTenant.objects.create(
            owner_user=user,
            tenant_code='tl-model-tenant',
            display_name='TL Model Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        event = TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.STATUS_CHANGED,
            actor_type='system',
            old_value={'status': 'active'},
            new_value={'status': 'suspended'},
            metadata={'reason': 'quota'},
        )

        self.assertEqual(event.metadata['reason'], 'quota')
        self.assertEqual(event.tenant_id, tenant.id)
