import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from advisory.models import AdvisorySession
from identity_access.models import UserProfile, CoreTenant
from advisory.tasks import reset_daily_token_budgets

class AdvisoryTasksTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='task-test-user',
            password='testpassword123'
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='task-tenant-code',
            plan=CoreTenant.PlanChoices.STARTER,
            status=CoreTenant.StatusChoices.ACTIVE
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            tenant=self.tenant,
            preferences={'daily_tokens_used': 500}
        )
        self.session = AdvisorySession.objects.create(
            user=self.user,
            symbol='SSI',
            session_date=timezone.localdate(),
            tokens_used=1500,
            token_budget=2000
        )
        
    def test_reset_daily_token_budgets_resets_counters(self):
        # 1. Trước khi chạy task, các đếm token khác 0
        self.assertEqual(AdvisorySession.objects.get(pk=self.session.pk).tokens_used, 1500)
        self.assertEqual(UserProfile.objects.get(pk=self.profile.pk).preferences['daily_tokens_used'], 500)
        
        # 2. Thực hiện chạy Celery Task
        result = reset_daily_token_budgets()
        
        # 3. Khẳng định (Assertions) các giá trị đã được reset về 0
        self.assertEqual(AdvisorySession.objects.get(pk=self.session.pk).tokens_used, 0)
        self.assertEqual(UserProfile.objects.get(pk=self.profile.pk).preferences['daily_tokens_used'], 0)
        self.assertIn("Reset", result)
