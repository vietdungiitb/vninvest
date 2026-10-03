"""
SAFE-02 + LED-06 — idempotency trên bảng có UNIQUE constraint.

7 case bắt buộc của SAFE-02, cộng các ca mà bản cache **không** làm được.

Vì sao bản cache trước đó không đủ: `cache.add` chỉ atomic **trong một process**.
Test dưới đây không thể chứng minh điều đó (một test runner là một process),
nhưng UNIQUE constraint thì **có thể** chứng minh: cố tạo hai dòng trùng key và
đòi database từ chối — đó là cơ chế thật sự chặn double order khi nhiều worker.
"""
from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from identity_access.models import CoreTenant
from user_workspace.models import IdempotencyRecord
from user_workspace.services import idempotency
from user_workspace.services.idempotency import (
    IdempotencyKeyError,
    IdempotencyTenantUnresolved,
)
from user_workspace.tests.envelope import unwrapped_json

SCOPE = 'place-order'


class _Fixture(TestCase):
    def setUp(self):
        self.tenant = CoreTenant.objects.create(
            tenant_code='idem-a', display_name='idem-a',
            owner_user=User.objects.create_user(username='idem-a', password='x'),
            status=CoreTenant.StatusChoices.ACTIVE)
        self.other_tenant = CoreTenant.objects.create(
            tenant_code='idem-b', display_name='idem-b',
            owner_user=User.objects.create_user(username='idem-b', password='x'),
            status=CoreTenant.StatusChoices.ACTIVE)
        self.user = self.tenant.owner_user

    def _claim(self, key='K1', fp='FP1', tenant=None, user=None):
        return idempotency.claim(
            user_id=(user or self.user).id, scope=SCOPE, key=key,
            fingerprint=fp, tenant_id=tenant or self.tenant,
        )


class Safe02RequiredCases(_Fixture):
    """6 case trong danh sách bắt buộc của SAFE-02 §6."""

    def test_ac1_duplicate_request_creates_one_record(self):
        """Gửi cùng key 2 lần ⇒ đếm bản ghi = 1 (không phải 2 order)."""
        first = self._claim()
        self.assertTrue(first.acquired)
        idempotency.store_result(
            user_id=self.user.id, scope=SCOPE, key='K1', fingerprint='FP1',
            result={'ok': True}, tenant_id=self.tenant, response_code=201)
        second = self._claim()
        self.assertTrue(second.replay)
        self.assertEqual(second.result, {'ok': True})
        self.assertEqual(second.response_code, 201)
        self.assertEqual(IdempotencyRecord.objects.count(), 1)

    def test_ac2_same_key_different_payload_is_409(self):
        self._claim(key='K1', fp='FP1')
        idempotency.store_result(
            user_id=self.user.id, scope=SCOPE, key='K1', fingerprint='FP1',
            result={'ok': True}, tenant_id=self.tenant)
        clash = self._claim(key='K1', fp='FP-DIFFERENT')
        self.assertTrue(clash.conflict)
        self.assertFalse(clash.acquired)

    def test_ac3_missing_key_raises(self):
        for bad in (None, '', '   '):
            with self.subTest(key=bad):
                with self.assertRaises(IdempotencyKeyError):
                    idempotency.claim(
                        user_id=self.user.id, scope=SCOPE, key=bad,
                        fingerprint='FP1', tenant_id=self.tenant)

    def test_ac4_concurrent_requests_produce_one_row(self):
        """**Cơ chế thật sự chống double order** — UNIQUE constraint của DB.

        Hai lần `create()` với cùng key: cái thứ hai phải bị database từ chối.
        Không có cách nào thắng được ở bất kỳ số process nào.
        """
        fields = dict(
            tenant=self.tenant, actor=self.user, scope=SCOPE, key='RACE',
            request_hash='h', expires_at=timezone.now() + timedelta(days=7),
        )
        IdempotencyRecord.objects.create(**fields)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                IdempotencyRecord.objects.create(**fields)

    def test_ac5_expired_record_frees_the_key(self):
        self._claim(key='K5', fp='FP1')
        idempotency.store_result(
            user_id=self.user.id, scope=SCOPE, key='K5', fingerprint='FP1',
            result={'ok': True}, tenant_id=self.tenant)
        IdempotencyRecord.objects.filter(key='K5').update(
            expires_at=timezone.now() - timedelta(seconds=1))

        again = self._claim(key='K5', fp='FP1')
        self.assertTrue(
            again.acquired,
            'bản ghi quá 7 ngày thì key phải tái dùng được (AC5)',
        )

    def test_different_scopes_are_independent(self):
        self.assertTrue(self._claim(key='K9', fp='FP1').acquired)
        other = idempotency.claim(
            user_id=self.user.id, scope='cancel-order', key='K9',
            fingerprint='FP1', tenant_id=self.tenant)
        self.assertTrue(other.acquired)
        self.assertEqual(IdempotencyRecord.objects.count(), 2)

    def test_different_tenants_are_independent(self):
        other_user = self.other_tenant.owner_user
        self.assertTrue(self._claim(key='K9', fp='FP1').acquired)
        other = idempotency.claim(
            user_id=other_user.id, scope=SCOPE, key='K9',
            fingerprint='FP1', tenant_id=self.other_tenant)
        self.assertTrue(other.acquired)
        self.assertEqual(IdempotencyRecord.objects.count(), 2)

    def test_same_tenant_different_actors_are_independent(self):
        other_user = self.other_tenant.owner_user
        TenantMemberFactory = self._member
        TenantMemberFactory(other_user, self.tenant)
        self.assertTrue(self._claim(key='K9', fp='FP1').acquired)
        other = idempotency.claim(
            user_id=other_user.id, scope=SCOPE, key='K9',
            fingerprint='FP1', tenant_id=self.tenant)
        self.assertTrue(other.acquired)

    def _member(self, user, tenant):
        from identity_access.models import TenantMember

        member, _ = TenantMember.objects.get_or_create(
            tenant=tenant, user=user, defaults={'role': 'editor'})
        return member


class Safe02UnresolvedTenantTests(_Fixture):
    """D-03: không có `tenant` ⇒ **từ chối**, không phải namespace dùng chung."""

    def test_claim_without_tenant_raises_instead_of_sharing_a_namespace(self):
        with self.assertRaises(IdempotencyTenantUnresolved):
            idempotency.claim(
                user_id=self.user.id, scope=SCOPE, key='K1',
                fingerprint='FP1', tenant_id=None)

    def test_claim_with_unknown_public_id_raises(self):
        with self.assertRaises(IdempotencyTenantUnresolved):
            idempotency.claim(
                user_id=self.user.id, scope=SCOPE, key='K1',
                fingerprint='FP1', tenant_id='khong-ton-tai')

    def test_release_without_tenant_writes_nothing(self):
        with self.assertRaises(IdempotencyTenantUnresolved):
            idempotency.claim(
                user_id=self.user.id, scope=SCOPE, key='K1',
                fingerprint='FP1', tenant_id=None)
        self.assertEqual(IdempotencyRecord.objects.count(), 0)

    def test_core_tenant_instance_is_accepted(self):
        """View truyền đối tượng `CoreTenant`; phải dùng được cả hai dạng."""
        self.assertTrue(self._claim(key='K1', tenant=self.tenant).acquired)
        self.assertTrue(self._claim(key='K2', tenant=self.tenant.public_id).acquired)


class InProgressAndReleaseTests(_Fixture):
    def test_second_claim_while_first_is_running_reports_in_progress(self):
        self.assertTrue(self._claim(key='K1', fp='FP1').acquired)
        second = self._claim(key='K1', fp='FP1')
        self.assertTrue(second.in_progress)
        self.assertFalse(second.acquired)
        self.assertFalse(second.replay)

    def test_release_frees_the_key_for_a_retry(self):
        self._claim(key='K1', fp='FP1')
        idempotency.release(
            user_id=self.user.id, scope=SCOPE, key='K1', tenant_id=self.tenant)
        self.assertEqual(IdempotencyRecord.objects.count(), 0)
        self.assertTrue(self._claim(key='K1', fp='FP1').acquired)

    def test_store_result_refuses_a_mismatched_fingerprint(self):
        self._claim(key='K1', fp='FP1')
        stored = idempotency.store_result(
            user_id=self.user.id, scope=SCOPE, key='K1', fingerprint='FP-OTHER',
            result={'x': 1}, tenant_id=self.tenant)
        self.assertFalse(stored, 'request thất bại không được đè lên key của request khác')
        self.assertIsNone(IdempotencyRecord.objects.get(key='K1').response_code)


class EndToEndHttpIdempotencyTests(TestCase):
    """AC1 của SAFE-02 đo trên **HTTP thật**, không phải gọi hàm.

    "Gửi cùng `Idempotency-Key` 2 lần ⇒ đếm bản ghi order = 1". Ở đây đếm
    **số lần broker bị gọi** — đó mới là thứ tiền thật rời đi, và nó là thứ
    idempotency sinh ra để chặn.
    """

    URL = '/core/v1/broker/dnse/place-order/'

    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient

        from identity_access.models import CoreTenant, TenantMember

        self.owner = User.objects.create_user(username='e2e-owner', password='x')
        self.tenant = CoreTenant.objects.create(
            tenant_code='e2e-idem', display_name='e2e', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE)
        self.member = TenantMember.objects.create(
            tenant=self.tenant, user=self.owner, role='admin')
        # `APIClient`, KHÔNG phải `self.client` của `TestCase`. Client của
        # Django không hiểu `format='json'` nên body không được mã hoá JSON và
        # view trả 400 "Thiếu payload đặt lệnh" — lỗi ở fixture, không phải ở
        # code. Đây là bẫy đã mắc: ba test đầu đỏ vì lý do hoàn toàn khác.
        self.client = APIClient()
        self.client.force_login(self.owner)
        self.client.defaults['HTTP_X_TENANT_ID'] = self.tenant.public_id

    def _payload(self, symbol='VNM', quantity=100):
        return {
            'mode': 'paper',
            'market_type': 'STOCK', 'order_category': 'NORMAL',
            'trading_token': 'TT-1',
            'payload': {
                'account_no': 'ACC1', 'symbol': symbol, 'side': 'BUY',
                'price': 10000, 'quantity': quantity,
            },
        }

    def test_same_key_twice_calls_the_broker_once(self):
        from unittest import mock

        with mock.patch(
            'user_workspace.views_dnse._get_active_dnse_client'
        ) as get_client:
            client = get_client.return_value
            client.post_order.return_value = {'order_id': 'O-1'}

            first = self.client.post(
                self.URL, self._payload(), format='json',
                HTTP_IDEMPOTENCY_KEY='E2E-KEY-1')
            second = self.client.post(
                self.URL, self._payload(), format='json',
                HTTP_IDEMPOTENCY_KEY='E2E-KEY-1')

        self.assertEqual(client.post_order.call_count, 1,
                         'cùng Idempotency-Key phải chỉ gọi broker MỘT lần')
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertTrue(unwrapped_json(second)['idempotent_replay'])
        self.assertFalse(unwrapped_json(first)['idempotent_replay'])
        self.assertEqual(IdempotencyRecord.objects.count(), 1)

    def test_same_key_different_payload_is_409(self):
        from unittest import mock

        with mock.patch(
            'user_workspace.views_dnse._get_active_dnse_client'
        ) as get_client:
            get_client.return_value.post_order.return_value = {'order_id': 'O-1'}
            self.client.post(self.URL, self._payload(), format='json',
                             HTTP_IDEMPOTENCY_KEY='E2E-KEY-2')
            clash = self.client.post(
                self.URL, self._payload(symbol='HNG'), format='json',
                HTTP_IDEMPOTENCY_KEY='E2E-KEY-2')
        self.assertEqual(clash.status_code, 409, clash.content)
        self.assertEqual(clash.json()['code'], 'idempotency_key_conflict')

    def test_missing_key_is_rejected(self):
        resp = self.client.post(self.URL, self._payload(), format='json')
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(resp.json()['code'], 'idempotency_key_required')

    def test_record_is_scoped_to_the_tenant(self):
        from django.contrib.auth.models import User

        from identity_access.models import CoreTenant, TenantMember

        with self.subTest('tenant khac cung key thi van la lenh moi'):
            other_owner = User.objects.create_user(username='e2e-other', password='x')
            other_tenant = CoreTenant.objects.create(
                tenant_code='e2e-idem-b', display_name='e2e-b',
                owner_user=other_owner,
                status=CoreTenant.StatusChoices.ACTIVE)
            TenantMember.objects.create(
                tenant=other_tenant, user=other_owner, role='admin')

            from unittest import mock

            with mock.patch(
                'user_workspace.views_dnse._get_active_dnse_client'
            ) as get_client:
                get_client.return_value.post_order.return_value = {'order_id': 'O'}
                self.client.post(self.URL, self._payload(), format='json',
                                 HTTP_IDEMPOTENCY_KEY='SHARED-KEY')
                self.client.defaults['HTTP_X_TENANT_ID'] = other_tenant.public_id
                self.client.force_login(other_owner)
                second = self.client.post(
                    self.URL, self._payload(), format='json',
                    HTTP_IDEMPOTENCY_KEY='SHARED-KEY')

            self.assertEqual(second.status_code, 200, second.content)
            self.assertFalse(
                unwrapped_json(second)['idempotent_replay'],
                'cùng key ở tenant KHÁC phải là lệnh mới, không được replay',
            )
        self.assertEqual(IdempotencyRecord.objects.count(), 2)

class FingerprintHashingTests(_Fixture):
    """`request_hash` phai vua khop cot 64 ky tu, vua KHONG luu payload
    don hang vao bang idempotency — bang nay ton tai lau hon cache va kho
    xoa hon nhieu."""

    def test_request_hash_is_64_hex_chars(self):
        self._claim(key='K1', fp='a-very-long-order-payload-' * 20)
        record = IdempotencyRecord.objects.get(key='K1')
        self.assertEqual(len(record.request_hash), 64)
        int(record.request_hash, 16)  # phải là hex hợp lệ

    def test_payload_is_not_stored_in_the_hash(self):
        self._claim(key='K1', fp='account_no=ACC1&symbol=VNM&token=SECRET')
        record = IdempotencyRecord.objects.get(key='K1')
        self.assertNotIn('SECRET', record.request_hash)
        self.assertNotIn('VNM', record.request_hash)

    def test_same_fingerprint_yields_same_hash(self):
        self._claim(key='K1', fp='X')
        self._claim(key='K2', fp='X')
        hashes = list(
            IdempotencyRecord.objects.filter(key__in=['K1', 'K2'])
            .values_list('request_hash', flat=True)
        )
        self.assertEqual(len(set(hashes)), 1)


class PurgeTests(_Fixture):
    """D-12: TTL 7 ngày không tự dọn — phải có ai đó xoá."""

    def test_purge_removes_only_expired_rows(self):
        from datetime import timedelta as td

        self._claim(key='K1', fp='FP1')
        self._claim(key='K2', fp='FP2')
        IdempotencyRecord.objects.filter(key='K1').update(
            expires_at=timezone.now() - td(seconds=1))

        deleted = idempotency.purge_expired()
        self.assertEqual(deleted, 1)
        self.assertEqual(
            list(IdempotencyRecord.objects.values_list('key', flat=True)), ['K2'])

    def test_management_command_reports_the_count(self):
        from io import StringIO

        from django.core.management import call_command

        self._claim(key='K1', fp='FP1')
        IdempotencyRecord.objects.update(
            expires_at=timezone.now() - timedelta(days=1))
        out = StringIO()
        call_command('purge_idempotency_records', stdout=out)
        self.assertIn('1', out.getvalue())
        self.assertEqual(IdempotencyRecord.objects.count(), 0)

