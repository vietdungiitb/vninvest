"""R4.2 — scope khoá + lịch xoay khoá Fernet (plan `:1191-1210`).

Bốn điều chỉnh so với plan, ghi lại để agent sau không "sửa về đúng plan":

1. **Phải giữ tên biến cũ.** `_get_fernet_key()` (`identity_access/security.py:10`)
   đọc **một** env `AI_CREDENTIAL_FERNET_KEY`. Key ring mới coi biến đó là **V1**, và
   ciphertext **không** có tiền tố (tức đã mã hoá bằng V1) vẫn phải giải mã được.
   Nếu bỏ tên cũ, **ngay lần deploy đầu tiên mọi khoá BYOK của toàn bộ user sẽ
   không giải mã được** — sự cố mất dữ liệu hàng loạt, không phải lỗi nhỏ.
2. **Fernet token là opaque.** Không có cách nào đọc ra "token này mã hoá bằng key
   nào" mà không thử lần lượt. Vì vậy bản mã hoá mới ghi tiền tố `vN:` — đây là
   **dữ liệu trong cột cũ**, chính là lý do AC3 ("thêm V2 không cần migration DB")
   mới đúng: hạ tầng mới nằm ở env + tiền tố, **không** nằm ở schema.
3. **AC1 cần phân biệt "suy luận" với "quản trị".** `test-connection`
   (`portfolio_analytics_views.py:1999`) **giải mã khoá của user** để probe
   provider — đó là thao tác quản trị, nên khoá scope `management` **được** dùng
   ở đó. Chặn nhầm sẽ khiến admin không kiểm tra được kết nối. Chỉ đường **suy
   luận** (`advisory/views.py:500`) mới bị chặn với scope `management`.
4. **Khoá quá hạn grace ⇒ fail-closed**, nhưng **không** xoá dữ liệu: sau `grace_until`
   thì khoá cũ **không còn được thử nữa**, trả lỗi có mã để vận hành biết phải
   xử lý gì. Không âm thầm giải mã bằng khoá đã hết hạn — đó là giữ hành vi cũ
   trong khi trông như đã xoay khoá.
"""
import base64
import os
from datetime import timedelta
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from advisory.models import UserAICredential

User = get_user_model()


def make_key() -> str:
    return Fernet.generate_key().decode()


class KeyRingTests(TestCase):
    """AC2 / AC3 / AC4 — key ring V1/V2 + grace."""

    def setUp(self):
        self.v1 = make_key()
        self.v2 = make_key()

    def _encrypt_with(self, raw_key: str, plain: str) -> str:
        return Fernet(raw_key.encode()).encrypt(plain.encode()).decode()

    def test_ac3_current_env_is_v1_and_legacy_ciphertext_still_decrypts(self):
        """AC3 + cảnh báo (1): env cũ = V1, ciphertext không tiền tố vẫn đọc được."""
        from identity_access.security import decrypt_user_api_key

        legacy = self._encrypt_with(self.v1, 'sk-legacy')
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V1': '',
            'AI_CREDENTIAL_FERNET_KEY_V2': '',
        }, clear=False):
            self.assertEqual(decrypt_user_api_key(legacy), 'sk-legacy')

    def test_ac3_adding_v2_needs_no_db_migration(self):
        """AC3: chỉ thêm env V2, dữ liệu cũ (mã hoá bằng V1) vẫn giải mã được."""
        from identity_access.security import decrypt_user_api_key

        old_data = self._encrypt_with(self.v1, 'sk-v1-data')
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V2': self.v2,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v2',
        }, clear=False):
            # Dữ liệu cũ đọc được trong lúc grace.
            with mock.patch.dict(os.environ, {'AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL': ''}, clear=False):
                self.assertEqual(decrypt_user_api_key(old_data), 'sk-v1-data')

    def test_ac2_old_key_valid_inside_grace_then_fail_closed(self):
        """AC2: trong `grace_until` thì còn đọc được; quá hạn thì fail-closed."""
        from identity_access.security import decrypt_user_api_key

        old_data = self._encrypt_with(self.v1, 'sk-v1-data')
        future = (timezone.now() + timedelta(days=7)).isoformat()
        past = (timezone.now() - timedelta(days=7)).isoformat()

        # Trong grace → vẫn giải mã được.
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V2': self.v2,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v2',
            'AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL': future,
        }, clear=False):
            self.assertEqual(decrypt_user_api_key(old_data), 'sk-v1-data')

        # Quá hạn → fail-closed, KHÔNG âm thầm đọc bằng khoá cũ.
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V2': self.v2,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v2',
            'AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL': past,
        }, clear=False):
            with self.assertRaises(RuntimeError):
                decrypt_user_api_key(old_data)

    def test_ac4_warns_when_using_key_past_grace_window(self):
        """AC4: dùng khoá **không phải active** phải ghi log cảnh báo có mã."""
        from identity_access import security

        old_data = self._encrypt_with(self.v1, 'sk-v1-data')
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V2': self.v2,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v2',
            'AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL': '',
        }, clear=False):
            with self.assertLogs(security.logger, level='WARNING') as logs:
                self.assertEqual(security.decrypt_user_api_key(old_data), 'sk-v1-data')
        self.assertTrue(
            any('fernet_key_version_fallback' in line for line in logs.output),
            f'khong co canh bao co ma: {logs.output}',
        )

    def test_prefixed_ciphertext_pins_exact_version(self):
        """Bản mã có tiền tố `vN:` ⇒ chỉ thử đúng key đó, không mò key khác."""
        from identity_access import security

        token = f"v2:{self._encrypt_with(self.v2, 'sk-v2-data')}"
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V2': self.v2,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v2',
            'AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL': '',
        }, clear=False):
            self.assertEqual(security.decrypt_user_api_key(token), 'sk-v2-data')
            # Sai version trong tiền tố ⇒ lỗi, không đoán bừa key khác.
            with self.assertRaises(RuntimeError):
                security.decrypt_user_api_key(f"v9:{self._encrypt_with(self.v2, 'x')}")

    def test_encrypt_uses_active_version_and_marks_it(self):
        from identity_access import security

        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_V2': self.v2,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v2',
        }, clear=False):
            token = security.encrypt_user_api_key('sk-new')
        self.assertTrue(token.startswith('v2:'), f'phai danh dau version, nhan "{token[:8]}"')

    def test_no_env_key_uses_synthetic_v0_and_says_so(self):
        """Không có env nào ⇒ dùng khoá tổng hợp `v0` băm từ `SECRET_KEY`.

        **Không** nâng thành lỗi: trước R4.2 hệ thống rơi về đúng đường này, và mọi
        môi trường không set `AI_CREDENTIAL_FERNET_KEY` sẽ **không lưu được khoá API**
        ngay lúc deploy nếu ta đổi thành raise. Điểm R4.2 thêm là **gọi tên nó `v0`**
        để vận hành thấy dữ liệu nào đang mã hoá bằng khoá tổng hợp, thay vì âm thầm
        coi nó là V1 rồi tưởng dữ liệu cũ hỏng.
        """
        from identity_access import security

        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': '',
            'AI_CREDENTIAL_FERNET_KEY_V2': '',
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': '',
        }, clear=False):
            token = security.encrypt_user_api_key('sk-x')
            self.assertTrue(token.startswith('v0:'), f'phai danh dau v0, nhan "{token[:8]}"')
            self.assertEqual(security.decrypt_user_api_key(token), 'sk-x')
            status = security.key_ring_status()
            self.assertEqual(status['versions'], ['v0'])
            self.assertEqual(status['active_version'], 'v0')

    def test_key_ring_status_never_leaks_key_material(self):
        """L-S02: bản tóm tắt cho vận hành KHÔNG được chứa khoá."""
        from identity_access import security

        self.v1 = make_key()
        with mock.patch.dict(os.environ, {
            'AI_CREDENTIAL_FERNET_KEY': '',
            'AI_CREDENTIAL_FERNET_KEY_V1': self.v1,
            'AI_CREDENTIAL_FERNET_KEY_ACTIVE': 'v1',
        }, clear=False):
            status = security.key_ring_status()
        self.assertNotIn(self.v1, repr(status))
        self.assertNotIn(base64.urlsafe_b64decode(self.v1).hex(), repr(status))


class KeyScopeTests(TestCase):
    """AC1 — scope `management` không được dùng cho suy luận."""

    def setUp(self):
        self.user = User.objects.create_user(username='r42-user', password='testpass123')
        self.cred, _ = UserAICredential.objects.get_or_create(user=self.user)

    def test_scope_defaults_to_inference(self):
        self.assertEqual(self.cred.key_scope, UserAICredential.KeyScopeChoices.INFERENCE)

    def test_inference_scope_allows_key(self):
        from advisory.key_scope import is_inference_allowed

        self.cred.key_scope = UserAICredential.KeyScopeChoices.INFERENCE
        self.assertTrue(is_inference_allowed(self.cred))

    def test_management_scope_blocked_for_inference(self):
        from advisory.key_scope import is_inference_allowed

        self.cred.key_scope = UserAICredential.KeyScopeChoices.MANAGEMENT
        self.assertFalse(is_inference_allowed(self.cred))

    def test_resolve_user_key_returns_reason_not_secret(self):
        """Khoá bị chặn thì trả **lý do**, không trả khoá (và không log khoá)."""
        from advisory.key_scope import resolve_user_key_for_inference

        self.cred.key_scope = UserAICredential.KeyScopeChoices.MANAGEMENT
        self.cred.encrypted_api_key = 'v1:whatever'
        key, reason = resolve_user_key_for_inference(self.cred, lambda raw: 'sk-should-not-be-used')
        self.assertEqual(key, '')
        self.assertEqual(reason, 'key_scope_management')

    def test_inference_scope_passes_key_through(self):
        from advisory.key_scope import resolve_user_key_for_inference

        self.cred.key_scope = UserAICredential.KeyScopeChoices.INFERENCE
        self.cred.encrypted_api_key = 'v1:whatever'
        key, reason = resolve_user_key_for_inference(self.cred, lambda raw: 'sk-ok')
        self.assertEqual(key, 'sk-ok')
        self.assertEqual(reason, '')


class RotationMetadataTests(TestCase):
    """AC5 — dữ liệu mốc xoay khoá đủ để UI hiện thời điểm xoay kế tiếp."""

    def setUp(self):
        self.user = User.objects.create_user(username='r42-meta', password='testpass123')
        self.cred, _ = UserAICredential.objects.get_or_create(user=self.user)

    def test_key_payload_exposes_rotation_timestamps(self):
        from advisory.key_scope import rotation_status

        self.cred.key_rotated_at = timezone.now()
        self.cred.grace_until = timezone.now() + timedelta(days=30)
        payload = rotation_status(self.cred)
        self.assertIn('key_rotated_at', payload)
        self.assertIn('grace_until', payload)
        self.assertIn('days_until_grace_end', payload)
        self.assertIs(payload['within_grace'], True)

    def test_never_exposes_ciphertext(self):
        from advisory.key_scope import rotation_status

        self.cred.encrypted_api_key = 'v1:secret-token'
        payload = rotation_status(self.cred)
        self.assertNotIn('v1:secret-token', repr(payload))
        self.assertNotIn('encrypted_api_key', payload)


class ManagementScopeHttpTests(TestCase):
    """AC1 ở tầng HTTP: scope sai thì advisory **không** dùng khoá cá nhân.

    Chứng minh bằng cách kiểm tra orchestrator **nhận được khoá nào**, chứ không
    kiểm tra hàm trả về — vì AC1 nói về *hành vi của API suy luận*, mà hàm trả về
    chỉ là cách cài đặt.
    """

    def setUp(self):
        from calendar import monthrange
        from unittest import mock

        from django.contrib.auth import get_user_model
        from django.utils import timezone as dj_timezone
        from rest_framework.test import APIClient

        from commercial.models import QuotaRecord
        from identity_access.models import CoreTenant

        # Fixture bê **nguyên văn** từ `test_advisory_api_routes.py:36-52`: thử tự
        # bịa (`grant_tenant(role='editor')`) thì endpoint trả 403 và test xanh
        # giả — đúng thứ đã xảy ra một lần ở phiên này.
        user = get_user_model().objects.create_user(username='r42-http', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=user,
            tenant_code='r42-tenant',
            display_name='R42 Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        today = dj_timezone.localdate()
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
            api_calls_used=0, api_calls_limit=5,
            symbols_used=0, symbols_limit=-1,
            users_used=0, users_limit=-1,
            storage_mb_used=0, storage_mb_limit=-1,
        )
        self.user = user
        self.cred, _ = UserAICredential.objects.get_or_create(user=user)
        self.cred.ai_provider = UserAICredential.ProviderChoices.OPENAI
        self.cred.encrypted_api_key = 'v0:ciphertext'
        self.cred.key_scope = UserAICredential.KeyScopeChoices.MANAGEMENT
        self.cred.save()
        self.client = APIClient()
        self.client.force_authenticate(user=user)
        self._mock = mock

    def test_advisory_refresh_never_uses_management_scoped_key(self):
        """Khoá scope=management không được chạm vào đường suy luận.

        Khoá cá nhân đi vào hàng đợi **qua `effective_context['api_key']`**
        (`advisory/views.py:748` gọi `generate_advisory_task.delay(...)`), không
        qua một object orchestrator. Vì vậy test bắt đúng chỗ đó: nếu khoá cá nhân
        lọt vào payload của task thì nó sẽ **thực sự** được dùng để suy luận, dù
        code trên đường đi có vẻ "chỉ kiểm tra".
        """
        from unittest import mock

        from identity_access import security

        captured = {}

        def fake_delay(_record_id, effective_context, *_args, **_kwargs):
            captured['api_key'] = (effective_context or {}).get('api_key')
            return mock.Mock(id='job-1')

        with mock.patch.dict(os.environ, {'AI_CREDENTIAL_FERNET_KEY_ACTIVE': ''}, clear=False), \
                mock.patch.object(security, 'decrypt_user_api_key', return_value='sk-personal'), \
                mock.patch('advisory.tasks.generate_advisory_task') as task:
            task.delay.side_effect = fake_delay
            response = self.client.post(
                '/core/v1/advisory/refresh/VIC/', {}, format='json',
            )

        self.assertIsInstance(response.status_code, int)
        # Chống **xanh giả**: nếu URL sai (404) thì `captured` rỗng và
        # `assertNotEqual(None, 'sk-personal')` vẫn xanh — đúng thứ đã xảy ra một
        # lần ở phiên này. Phải chứng minh request **thực sự** tới nơi enqueue.
        self.assertIsNotNone(
            captured.get('api_key'),
            f'khong co gi tri api_key trong payload — endpoint co chay khong? {response.status_code}',
        )
        self.assertNotEqual(captured.get('api_key'), 'sk-personal')

    def test_inference_scoped_key_is_forwarded_to_task(self):
        """Đối chiếu: scope `inference` thì khoá **được** đưa vào hàng đợi.

        Không có test này thì "luôn không dùng khoá cá nhân" cũng xanh — tức là
        R4.2 có thể âm thầm phá BYOK cho tất cả user mà vẫn "xanh".
        """
        from unittest import mock

        from identity_access import security

        self.cred.key_scope = UserAICredential.KeyScopeChoices.INFERENCE
        self.cred.save()
        captured = {}

        def fake_delay(_record_id, effective_context, *_args, **_kwargs):
            captured['api_key'] = (effective_context or {}).get('api_key')
            return mock.Mock(id='job-1')

        with mock.patch.dict(os.environ, {'AI_CREDENTIAL_FERNET_KEY_ACTIVE': ''}, clear=False), \
                mock.patch.object(security, 'decrypt_user_api_key', return_value='sk-personal'), \
                mock.patch('advisory.tasks.generate_advisory_task') as task:
            task.delay.side_effect = fake_delay
            self.client.post(
                '/core/v1/advisory/refresh/VIC/', {}, format='json',
            )

        self.assertEqual(captured.get('api_key'), 'sk-personal')

    def test_cc_get_exposes_rotation_block_without_secrets(self):
        response = self.client.get('/core/v1/workspace/ai-command-center/')
        self.assertEqual(response.status_code, 200)
        payload = response.data['data']
        rotation = payload['ai_key_rotation']
        self.assertEqual(rotation['key_scope'], 'management')
        self.assertIn('next_rotation_at', rotation)
        self.assertNotIn('ciphertext', repr(rotation))

    def test_cc_put_rejects_unknown_scope(self):
        response = self.client.put(
            '/core/v1/workspace/ai-command-center/',
            {'ai_key_scope': 'root'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.cred.refresh_from_db()
        self.assertEqual(self.cred.key_scope, UserAICredential.KeyScopeChoices.MANAGEMENT)

    def test_cc_put_accepts_known_scope(self):
        response = self.client.put(
            '/core/v1/workspace/ai-command-center/',
            {'ai_key_scope': 'inference'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.cred.refresh_from_db()
        self.assertEqual(self.cred.key_scope, UserAICredential.KeyScopeChoices.INFERENCE)