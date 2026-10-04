"""B1 - advisory quota refund phai credit DUNG tenant, ke ca khi nguoi tieu la MEMBER.

## Bang chung goc

`advisory/tasks.py` (sau khi sua) het resolve tenant bang
`CoreTenant.objects.filter(owner_user=user).first()`. `CoreTenant.owner_user` la
**OneToOneField** (`identity_access/models.py:67`, `related_name='core_tenant'`),
va comment cua `TenantMember` (`identity_access/models.py:600-601`) noi ro: *"Owner is
implicitly a member ... and is not required to have a TenantMember row."*

=> `.first()` chi tra ve tenant khi nguoi tieu **la owner**. Mot **member** khong phai
owner se nhan `None` va **khong bao gio duoc hoan quota** - im lang, vi
`tasks.py:250-251` nuot moi exception.

Hai test ben duoi lap nghich chieu:

| Test | Chu nhan |
|---|---|
| `test_refund_credits_tenant_when_user_is_owner` | owner -> phai hoan (huong cu chay) |
| `test_refund_credits_tenant_when_user_is_only_member` | member -> **truoc khi sua: KHONG hoan** |

## Khong dung `TestCase` sua cach vay

Khong sua model, khong them cot, khong migration. `_refund_advisory_quota` la ham
doc-rac + ghi 1 `QuotaRecord`, nen `TestCase` (booc transaction) la du va nhanh.
"""

import os
import sys
from calendar import monthrange

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from advisory.models import AdvisoryRecord
from advisory.tasks import _refund_advisory_quota
from commercial.models import QuotaRecord
from identity_access.models import CoreTenant, TenantMember


class AdvisoryQuotaRefundTenantScopeTests(TestCase):
    """Hoan quota phai ve tenant da tieu - ke ca khi nguoi tieu la member."""

    def setUp(self):
        self.today = timezone.localdate()
        self.period_start = self.today.replace(day=1)
        self.period_end = self.today.replace(
            day=monthrange(self.today.year, self.today.month)[1]
        )

        self.owner = User.objects.create_user(username='refund-owner', password='testpass123')
        self.member = User.objects.create_user(username='refund-member', password='testpass123')

        self.tenant = CoreTenant.objects.create(
            tenant_code='refund-tenant',
            owner_user=self.owner,
        )

    def _quota_with_used(self, value):
        return QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=self.period_start,
            period_end=self.period_end,
            api_calls_used=value,
            api_calls_limit=10,
        )

    def _record_for(self, user):
        return AdvisoryRecord.objects.create(
            user=user,
            symbol='VNM',
            session_date=self.today,
            status=AdvisoryRecord.StatusChoices.PENDING,
            structured_output={},
        )

    def test_refund_credits_tenant_when_user_is_owner(self):
        """Hanh 1: owner la implicit member -> phai hoan. HUONG CU chay."""
        TenantMember.objects.get_or_create(
            tenant=self.tenant,
            user=self.owner,
            defaults={'role': TenantMember.RoleChoices.OWNER},
        )
        quota = self._quota_with_used(1)
        record = self._record_for(self.owner)

        _refund_advisory_quota(record)

        quota.refresh_from_db()
        self.assertEqual(
            quota.api_calls_used,
            0,
            'Owner da tieu 1 quota, hoan phai giam ve 0',
        )

    def test_refund_credits_tenant_when_user_is_only_member(self):
        """Hanh 2: MEMBER (khong phai owner) da tieu quota -> phai duoc hoan.

        Truoc khi sua: `CoreTenant.objects.filter(owner_user=member).first()`
        tra None => khong co gi duoc hoan => test FAIL. Sau khi sua: PASS.
        """
        TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member,
            role=TenantMember.RoleChoices.VIEWER,
        )
        quota = self._quota_with_used(1)
        record = self._record_for(self.member)

        _refund_advisory_quota(record)

        quota.refresh_from_db()
        self.assertEqual(
            quota.api_calls_used,
            0,
            'Member da tieu 1 quota cung tenant, hoan phai giam ve 0',
        )

    def test_refund_does_not_go_below_zero(self):
        """Bien bao ve: hoan khong duoc tao duong am."""
        quota = self._quota_with_used(0)
        record = self._record_for(self.owner)

        _refund_advisory_quota(record)

        quota.refresh_from_db()
        self.assertGreaterEqual(quota.api_calls_used, 0)

    def test_refund_without_user_is_noop(self):
        """Record khong co user -> khong sua gi, khong nem loi."""
        quota = self._quota_with_used(1)
        record = self._record_for(self.owner)
        record.user = None
        record.save(update_fields=['user'])

        _refund_advisory_quota(record)

        quota.refresh_from_db()
        self.assertEqual(quota.api_calls_used, 1)

    def test_refund_uses_session_date_period_not_today(self):
        """Charging path derives the period from `session_date`.

        `_manual_trigger_period` (advisory/views.py) uses the advisory's session
        date. Refunding against the current month credited the wrong period for a
        back-dated advisory.
        """
        from datetime import date

        back_dated = date(2026, 7, 15)
        july = QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=date(2026, 7, 1),
            period_end=date(2026, 7, 31),
            api_calls_used=1,
            api_calls_limit=10,
        )
        record = self._record_for(self.owner)
        record.session_date = back_dated
        record.save(update_fields=['session_date'])

        _refund_advisory_quota(record)

        july.refresh_from_db()
        self.assertEqual(
            july.api_calls_used, 0,
            'Refund must credit the July period the charge was recorded in',
        )

    def test_refund_refuses_when_membership_is_ambiguous(self):
        """A member of two tenants has no recoverable charging tenant.

        `AdvisoryRecord` has no tenant FK, so crediting an arbitrary tenant would
        corrupt another tenant's balance. The function must refuse and forfeit the
        refund rather than guess.
        """
        from identity_access.models import CoreTenant as CT

        other_owner = User.objects.create_user(
            username='refund-owner-2', password='testpass123',
        )
        other_tenant = CT.objects.create(
            tenant_code='refund-tenant-2', owner_user=other_owner,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.member,
            role=TenantMember.RoleChoices.VIEWER,
        )
        TenantMember.objects.create(
            tenant=other_tenant, user=self.member,
            role=TenantMember.RoleChoices.VIEWER,
        )
        quota = self._quota_with_used(1)
        record = self._record_for(self.member)

        _refund_advisory_quota(record)

        quota.refresh_from_db()
        self.assertEqual(
            quota.api_calls_used, 1,
            'Ambiguous membership must forfeit the refund, not credit a guess',
        )