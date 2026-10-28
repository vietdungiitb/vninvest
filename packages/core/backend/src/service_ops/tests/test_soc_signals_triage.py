"""W2.2 (P2b) — SOC signals triage guard tests: ack transitions + mute upsert qua API SOC.

Tái dùng pattern test_delivery_service.py (transition guards) nhưng đi qua
HTTP layer service_ops (scope deliveries của operator user, IsAdminUser).
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry
from service_ops.tests.envelope import unwrapped
from signal_intelligence.models import (
    UnifiedAlert,
    UserAlertDelivery,
    UserAlertPreference,
)

User = get_user_model()


class SocSignalsTriageApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-triage-admin',
            email='soc-triage-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

        now = timezone.now()
        cls.alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale buy detected',
            body='Large order flow detected',
            value=Decimal('1250000000.00'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now - timedelta(minutes=5),
            source_ref='triage-guard-whale',
            metadata={'rule_name': 'whale_flow'},
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_delivery(self, state):
        return UserAlertDelivery.objects.create(
            user=self.user,
            alert=self.alert,
            delivery_state=state,
            metadata={'source': 'triage-test'},
        )

    def _ack_url(self, delivery):
        return f'/api/soc/signals/deliveries/{delivery.delivery_id}/ack/'

    def test_ack_new_delivery_transitions_to_acknowledged(self):
        """Guard 1: new → ack qua POST ack (giữ nguyên engine acknowledge_delivery)."""
        delivery = self._create_delivery(UserAlertDelivery.DeliveryStateChoices.NEW)

        response = self.client.post(self._ack_url(delivery))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delivery.refresh_from_db()
        self.assertEqual(delivery.delivery_state, UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        self.assertIsNotNone(delivery.acknowledged_at)
        self.assertTrue(unwrapped(response)['transitioned'])

    def test_ack_seen_delivery_transitions_to_acknowledged(self):
        """Guard 2: seen → ack (operator đã expand xem rồi mới ack)."""
        delivery = self._create_delivery(UserAlertDelivery.DeliveryStateChoices.SEEN)

        response = self.client.post(self._ack_url(delivery))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delivery.refresh_from_db()
        self.assertEqual(delivery.delivery_state, UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        self.assertTrue(unwrapped(response)['transitioned'])

    def test_ack_already_acknowledged_is_idempotent(self):
        """Guard 3: ack lại delivery đã ack → giữ nguyên, không đổi acknowledged_at."""
        delivery = self._create_delivery(UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        delivery.acknowledged_at = timezone.now() - timedelta(hours=1)
        delivery.save(update_fields=['acknowledged_at'])
        ack_at_before = delivery.acknowledged_at

        response = self.client.post(self._ack_url(delivery))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delivery.refresh_from_db()
        self.assertEqual(delivery.delivery_state, UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        self.assertEqual(delivery.acknowledged_at, ack_at_before)
        self.assertFalse(unwrapped(response)['transitioned'])

    def test_mute_upserts_preference_with_reason(self):
        """Guard 4: POST mute → upsert UserAlertPreference (mute_until tương lai + lý do audit)."""
        url = '/api/soc/signals/deliveries/mute/'

        response = self.client.post(url, {
            'symbol': 'vci',
            'mute_minutes': 60,
            'reason': 'Nhiễu trong phiên ATC',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        preference = UserAlertPreference.objects.get(user=self.user, symbol='VCI', alert_family='')
        self.assertIsNotNone(preference.mute_until)
        self.assertGreater(preference.mute_until, timezone.now())
        self.assertEqual(preference.metadata.get('reason'), 'Nhiễu trong phiên ATC')
        self.assertEqual(unwrapped(response)['symbol'], 'VCI')
