"""W2.3 (P2b) — SOC signals rule management guard tests: list, request (audit), feedback, performance.

Bridge-write honored: request chỉ ghi ConfigChangeAudit(action='request'), không apply trực tiếp.
Precision proxy per rule từ deliveries (ack = positive, muted/suppressed = negative), null khi thiếu data.
"""
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ConfigChangeAudit
from service_ops.registry import ensure_service_registry
from service_ops.tests.envelope import unwrapped
from signal_intelligence.models import UnifiedAlert, UserAlertDelivery

User = get_user_model()


class SocSignalsRulesApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-rules-admin',
            email='soc-rules-admin@test.local',
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
            source_ref='rules-guard-whale',
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
            metadata={'source': 'rules-test'},
        )

    def test_rule_list_returns_config_rows_with_metrics(self):
        """GET /signals/rules/ → 8 rows, mỗi row có rule_key/kind/enabled/value + metric keys."""
        response = self.client.get('/api/soc/signals/rules/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rules = unwrapped(response)['rules']
        self.assertEqual(len(rules), 8)
        first = {rule['rule_key'] for rule in rules}
        self.assertIn('whale_threshold_vnd', first)
        self.assertIn('screener_signal_cooldown_seconds', first)
        rule = next(r for r in rules if r['rule_key'] == 'whale_threshold_vnd')
        self.assertEqual(rule['kind'], 'threshold')
        self.assertEqual(rule['value'], 500_000_000)
        self.assertIn('precision_proxy', rule)
        self.assertIn('hit_rate', rule)
        self.assertIn('alert_count', rule)

    def test_rule_request_creates_audit_request_action(self):
        """POST /signals/rules/request/ → ConfigChangeAudit action='request', không apply."""
        before_count = ConfigChangeAudit.objects.filter(action='request').count()

        response = self.client.post('/api/soc/signals/rules/request/', {
            'rule_key': 'whale_threshold_vnd',
            'threshold_vnd': 200_000_000,
            'change_reason': 'Giảm ngưỡng whale theo phản hồi tuần',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(unwrapped(response)['pending'])
        self.assertIsNotNone(unwrapped(response)['request_id'])
        self.assertEqual(unwrapped(response)['rule_key'], 'whale_threshold_vnd')
        self.assertEqual(unwrapped(response)['after']['whale_threshold_vnd'], 200_000_000)
        self.assertEqual(unwrapped(response)['before']['whale_threshold_vnd'], 500_000_000)

        audits = ConfigChangeAudit.objects.filter(action='request')
        self.assertEqual(audits.count(), before_count + 1)
        audit = audits.first()
        self.assertEqual(audit.actor, 'soc-rules-admin')
        self.assertEqual(audit.change_summary, 'Giảm ngưỡng whale theo phản hồi tuần')
        self.assertEqual(audit.after_snapshot.get('whale_threshold_vnd'), 200_000_000)

    def test_rule_request_invalid_key_400(self):
        response = self.client.post('/api/soc/signals/rules/request/', {
            'rule_key': 'not_a_real_rule',
            'threshold_vnd': 200_000_000,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped(response)['code'], 'INVALID_RULE_KEY')

    def test_rule_request_rejected_on_invalid_value_400(self):
        """threshold dưới floor 1.000.000 VNĐ → validate config chặn, không tạo audit."""
        response = self.client.post('/api/soc/signals/rules/request/', {
            'rule_key': 'whale_threshold_vnd',
            'threshold_vnd': 1000,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped(response)['code'], 'RULE_CHANGE_REJECTED')
        self.assertEqual(ConfigChangeAudit.objects.filter(action='request').count(), 0)

    def test_rule_feedback_down_suppresses_delivery(self):
        """thumbs down → acknowledged→suppressed + suppression_reason + feedback metadata."""
        delivery = self._create_delivery(UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        delivery.acknowledged_at = timezone.now()
        delivery.save(update_fields=['acknowledged_at'])

        response = self.client.post('/api/soc/signals/rules/feedback/', {
            'alert_id': str(self.alert.alert_id),
            'signal': 'down',
            'reason': 'False positive phiên ATC',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delivery.refresh_from_db()
        self.assertEqual(delivery.delivery_state, UserAlertDelivery.DeliveryStateChoices.SUPPRESSED)
        self.assertEqual(delivery.suppression_reason, 'False positive phiên ATC')
        self.assertEqual(delivery.metadata.get('feedback_signal'), 'down')
        self.assertEqual(unwrapped(response)['signal'], 'down')

    def test_rule_feedback_up_acknowledges_new_delivery(self):
        """thumbs up → new→acknowledged."""
        delivery = self._create_delivery(UserAlertDelivery.DeliveryStateChoices.NEW)

        response = self.client.post('/api/soc/signals/rules/feedback/', {
            'alert_id': str(self.alert.alert_id),
            'signal': 'up',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delivery.refresh_from_db()
        self.assertEqual(delivery.delivery_state, UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        self.assertIsNotNone(delivery.acknowledged_at)
        self.assertEqual(delivery.metadata.get('feedback_signal'), 'up')

    def test_feedback_unknown_alert_404(self):
        response = self.client.post('/api/soc/signals/rules/feedback/', {
            'alert_id': str(uuid.uuid4()),
            'signal': 'up',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(unwrapped(response)['code'], 'ALERT_NOT_FOUND')

    def test_performance_proxy_and_top_noisy(self):
        """3 ack + 1 suppressed belong whale → precision 0.75, hit 1.0, top_noisy whale đầu bảng."""
        for index in range(3):
            alert = UnifiedAlert.objects.create(
                alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
                symbol='VCI',
                severity=UnifiedAlert.SeverityChoices.HIGH,
                title=f'Whale buy detected #{index}',
                value=Decimal('1250000000.00'),
                session_date=timezone.now().date(),
                triggered_at=timezone.now() - timedelta(minutes=index),
                source_ref=f'rules-perf-acked-{index}',
            )
            UserAlertDelivery.objects.create(
                user=self.user,
                alert=alert,
                delivery_state=UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED,
                metadata={'source': 'rules-test'},
            )
        suppressed_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale buy suppressed',
            value=Decimal('1250000000.00'),
            session_date=timezone.now().date(),
            triggered_at=timezone.now(),
            source_ref='rules-perf-suppressed',
        )
        UserAlertDelivery.objects.create(
            user=self.user,
            alert=suppressed_alert,
            delivery_state=UserAlertDelivery.DeliveryStateChoices.SUPPRESSED,
            suppression_reason='false positive',
            metadata={'source': 'rules-test'},
        )

        response = self.client.get('/api/soc/signals/rules/performance/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        overall = unwrapped(response)['overall']
        self.assertEqual(overall['alert_count'], 4)
        self.assertEqual(overall['acked'], 3)
        self.assertEqual(overall['suppressed'], 1)
        self.assertEqual(overall['precision_proxy'], 0.75)
        self.assertEqual(overall['hit_rate'], 1.0)

        whale = next(f for f in unwrapped(response)['by_family'] if f['alert_family'] == 'whale')
        self.assertEqual(whale['alert_count'], 4)
        self.assertEqual(whale['precision_proxy'], 0.75)

        self.assertTrue(unwrapped(response)['top_noisy'])
        self.assertEqual(unwrapped(response)['top_noisy'][0]['alert_count'], 4)
        self.assertEqual(unwrapped(response)['top_noisy'][0]['alert_family'], 'whale')