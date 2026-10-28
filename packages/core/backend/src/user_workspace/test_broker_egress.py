"""P1-SEC-01: egress allowlist cho endpoint broker — chặn SSRF + credential exfiltration.

Trước slice này `base_url` của TCBS là text tự do (`broker/tcbs.py:47-55`) và được
truyền thẳng vào client (`broker/adapters.py:292-295`) ⇒ user tự chọn host nhận
`api_key`. Test ở đây pin hành vi fail-closed + code lỗi không echo giá trị người dùng.

Hermetic: KHÔNG network, KHÔNG cần `vnbroker` (client factory luôn mock).
Chạy: python manage.py test user_workspace.test_broker_egress
"""
import os
import sys
import types
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from user_workspace.broker import tcbs as tcbs_schema
from user_workspace.broker.adapters import BrokerEgressError, get_broker_adapter
from user_workspace.broker.egress import (
    EgressPolicyError,
    allowed_hosts_for,
    resolve_base_url,
    validate_base_url,
)

TCBS_PROD = 'https://openapi.tcbs.com.vn'
TCBS_HOST = 'openapi.tcbs.com.vn'


def _stub_module(path, **members):
    """Cài stub module vào sys.modules (như test_broker_adapters.py) + trả dict để cleanup."""
    saved = {}
    parts = path.split('.')
    for i in range(1, len(parts) + 1):
        name = '.'.join(parts[:i])
        saved[name] = sys.modules.get(name)
        mod = types.ModuleType(name)
        mod.__path__ = []
        sys.modules[name] = mod
    leaf = sys.modules[path]
    for key, value in members.items():
        setattr(leaf, key, value)
    parent = '.'.join(parts[:-1])
    if parent in sys.modules:
        setattr(sys.modules[parent], parts[-1], leaf)
    return saved


def _unstub(saved):
    for name, mod in saved.items():
        if mod is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = mod


class BaseUrlSchemeTests(SimpleTestCase):
    """AC-1: scheme không phải https (trừ loopback được cấu hình tường minh) ⇒ từ chối."""

    def test_plain_http_external_rejected(self):
        with self.assertRaises(EgressPolicyError) as ctx:
            validate_base_url('tcbs', 'http://evil.example.com')
        self.assertEqual(ctx.exception.code, 'broker_egress_scheme_not_allowed')

    def test_non_http_schemes_rejected(self):
        for url in ('file:///etc/passwd', 'gopher://openapi.tcbs.com.vn', 'ftp://openapi.tcbs.com.vn'):
            with self.subTest(url=url):
                with self.assertRaises(EgressPolicyError) as ctx:
                    validate_base_url('tcbs', url)
                self.assertEqual(ctx.exception.code, 'broker_egress_scheme_not_allowed')

    def test_http_loopback_rejected_by_default(self):
        with self.assertRaises(EgressPolicyError) as ctx:
            validate_base_url('tcbs', 'http://127.0.0.1:8000')
        self.assertEqual(ctx.exception.code, 'broker_egress_scheme_not_allowed')

    def test_http_loopback_allowed_only_with_explicit_env(self):
        env = {'BROKER_EGRESS_ALLOW_HTTP_LOOPBACK': '1'}
        with patch.dict(os.environ, env, clear=False):
            self.assertEqual(validate_base_url('tcbs', 'http://127.0.0.1:8000'),
                             'http://127.0.0.1:8000')
        # Tắt lại ⇒ fail-closed
        with patch.dict(os.environ, {'BROKER_EGRESS_ALLOW_HTTP_LOOPBACK': '0'}, clear=False):
            with self.assertRaises(EgressPolicyError):
                validate_base_url('tcbs', 'http://127.0.0.1:8000')

    def test_malformed_url_rejected(self):
        for url in ('openapi.tcbs.com.vn', 'https://', '://x', 'not a url'):
            with self.subTest(url=url):
                with self.assertRaises(EgressPolicyError) as ctx:
                    validate_base_url('tcbs', url)
                self.assertEqual(ctx.exception.code, 'broker_egress_invalid_url')


class MetadataAndIpLiteralTests(SimpleTestCase):
    """AC-2 + AC-4: chặn IP literal / loopback / link-local / metadata (169.254.169.254)."""

    def test_cloud_metadata_http_rejected(self):
        with self.assertRaises(EgressPolicyError):
            validate_base_url('tcbs', 'http://169.254.169.254/latest/meta-data/')

    def test_cloud_metadata_https_rejected(self):
        with self.assertRaises(EgressPolicyError) as ctx:
            validate_base_url('tcbs', 'https://169.254.169.254/latest/meta-data/')
        self.assertEqual(ctx.exception.code, 'broker_egress_private_address_blocked')

    def test_loopback_literal_rejected(self):
        for url in ('https://127.0.0.1', 'https://127.0.0.1:8443/x', 'https://[::1]/',
                    'https://localhost'):
            with self.subTest(url=url):
                with self.assertRaises(EgressPolicyError) as ctx:
                    validate_base_url('tcbs', url)
                # `localhost` là hostname nên bị chặn ở allowlist, IP literal ở tầng IP —
                # cả 3 code đều là "từ chối", điều kiện bắt buộc là không lọt.
                self.assertIn(ctx.exception.code, {
                    'broker_egress_ip_literal_blocked', 'broker_egress_private_address_blocked',
                    'broker_egress_host_not_allowed',
                })

    def test_private_ranges_rejected(self):
        for url in ('https://10.0.0.5', 'https://192.168.1.1', 'https://172.16.0.1',
                    'https://[fd00::1]/'):
            with self.subTest(url=url):
                with self.assertRaises(EgressPolicyError) as ctx:
                    validate_base_url('tcbs', url)
                self.assertEqual(ctx.exception.code, 'broker_egress_private_address_blocked')

    def test_private_allowed_only_with_explicit_env(self):
        env = {'BROKER_EGRESS_ALLOW_PRIVATE_IPS': '1'}
        with patch.dict(os.environ, env, clear=False):
            self.assertEqual(validate_base_url('tcbs', 'https://10.0.0.5'), 'https://10.0.0.5')

    def test_ip_literal_never_reaches_host_allowlist(self):
        # IP literal phải bị chặn ở tầng IP, không lọt qua được allowlist exact-match.
        with patch.dict(os.environ, {'BROKER_EGRESS_EXTRA_HOSTS': 'tcbs:10.0.0.5'}, clear=False):
            with self.assertRaises(EgressPolicyError) as ctx:
                validate_base_url('tcbs', 'https://10.0.0.5')
            self.assertEqual(ctx.exception.code, 'broker_egress_private_address_blocked')


class HostAllowlistTests(SimpleTestCase):
    """AC-3 + AC-5: chỉ host trong allowlist provider; KHÔNG suffix-match lỏng."""

    def test_production_host_accepted(self):
        self.assertEqual(validate_base_url('tcbs', TCBS_PROD), TCBS_PROD)
        self.assertEqual(validate_base_url('ssi', 'https://fc-tradeapi.ssi.com.vn'),
                         'https://fc-tradeapi.ssi.com.vn')
        self.assertEqual(validate_base_url('dnse', 'https://openapi.dnse.com.vn'),
                         'https://openapi.dnse.com.vn')

    def test_sibling_provider_hosts_accepted(self):
        # Audit §E3: SSI có cả tradeapi lẫn tradehub
        self.assertEqual(validate_base_url('ssi', 'https://fc-tradehub.ssi.com.vn'),
                         'https://fc-tradehub.ssi.com.vn')

    def test_suffix_lookalike_rejected(self):
        for url in (
            'https://evil-tcbs.com.vn.attacker.net',
            'https://openapi.tcbs.com.vn.attacker.net',
            'https://not-openapi.tcbs.com.vn',
            'https://xopenapi.tcbs.com.vn',
            'https://openapi.tcbs.com.vn.evil.io',
        ):
            with self.subTest(url=url):
                with self.assertRaises(EgressPolicyError) as ctx:
                    validate_base_url('tcbs', url)
                self.assertEqual(ctx.exception.code, 'broker_egress_host_not_allowed')

    def test_public_ip_literal_always_rejected(self):
        # IP public không bao giờ nằm trong allowlist, kể cả khi deploy mở cờ sandbox.
        for env in ({}, {'BROKER_EGRESS_ALLOW_PRIVATE_IPS': '1'}):
            with self.subTest(env=env), patch.dict(os.environ, env, clear=False):
                with self.assertRaises(EgressPolicyError) as ctx:
                    validate_base_url('tcbs', 'https://8.8.8.8')
                self.assertEqual(ctx.exception.code, 'broker_egress_ip_literal_blocked')

    def test_trailing_dot_and_case_accepted(self):
        # So khớp phải không phân biệt hoa/thường và dấu chấm cuối (DNS semantics),
        # nhưng KHÔNG tự viết lại URL người dùng nhập.
        self.assertEqual(validate_base_url('tcbs', f'{TCBS_PROD}/'), TCBS_PROD)
        self.assertEqual(validate_base_url('tcbs', 'https://OPENAPI.TCBS.COM.VN'),
                         'https://OPENAPI.TCBS.COM.VN')
        self.assertEqual(validate_base_url('tcbs', 'https://openapi.tcbs.com.vn.'),
                         'https://openapi.tcbs.com.vn.')

    def test_path_is_preserved(self):
        self.assertEqual(validate_base_url('tcbs', f'{TCBS_PROD}/gaia/v1/'),
                         'https://openapi.tcbs.com.vn/gaia/v1')

    def test_url_with_userinfo_rejected(self):
        with self.assertRaises(EgressPolicyError) as ctx:
            validate_base_url('tcbs', f'https://user:pass@{TCBS_HOST}/x')
        self.assertEqual(ctx.exception.code, 'broker_egress_url_credentials_not_allowed')

    def test_host_allowlist_is_per_provider(self):
        with self.assertRaises(EgressPolicyError):
            validate_base_url('ssi', TCBS_PROD)
        with self.assertRaises(EgressPolicyError):
            validate_base_url('tcbs', 'https://openapi.dnse.com.vn')

    def test_unknown_provider_rejected(self):
        with self.assertRaises(EgressPolicyError) as ctx:
            validate_base_url('xyz', TCBS_PROD)
        self.assertEqual(ctx.exception.code, 'broker_egress_unknown_provider')


class ExtraHostsAreServerSideOnlyTests(SimpleTestCase):
    """Mở rộng allowlist CHỈ qua env server-side, không nhận tùy ý từ client."""

    def test_env_extra_host_accepted_for_its_provider(self):
        env = {'BROKER_EGRESS_EXTRA_HOSTS': 'tcbs:sandbox.tcbs.internal, ssi:internal.ssi.vn'}
        with patch.dict(os.environ, env, clear=False):
            self.assertEqual(validate_base_url('tcbs', 'https://sandbox.tcbs.internal'),
                             'https://sandbox.tcbs.internal')
            self.assertEqual(validate_base_url('ssi', 'https://internal.ssi.vn'),
                             'https://internal.ssi.vn')

    def test_env_extra_host_scoped_to_provider(self):
        env = {'BROKER_EGRESS_EXTRA_HOSTS': 'tcbs:sandbox.tcbs.internal'}
        with patch.dict(os.environ, env, clear=False):
            with self.assertRaises(EgressPolicyError):
                validate_base_url('ssi', 'https://sandbox.tcbs.internal')
            self.assertNotIn('sandbox.tcbs.internal', allowed_hosts_for('ssi'))

    def test_allowed_hosts_for_is_immutable_view(self):
        hosts = allowed_hosts_for('tcbs')
        self.assertIn(TCBS_HOST, hosts)
        self.assertIsInstance(hosts, (frozenset, tuple, set))


class DefaultBaseUrlTests(SimpleTestCase):
    """AC-6: base_url rỗng ⇒ dùng default của provider, KHÔNG lỗi."""

    def test_empty_uses_provider_default(self):
        for empty in (None, '', '   '):
            with self.subTest(value=empty):
                self.assertEqual(resolve_base_url('tcbs', empty), TCBS_PROD)
        self.assertEqual(resolve_base_url('ssi', ''), 'https://fc-tradeapi.ssi.com.vn')
        self.assertEqual(resolve_base_url('dnse', ''), 'https://openapi.dnse.com.vn')


class TcbsSchemaFailsClosedTests(SimpleTestCase):
    """AC-7: validate_secrets / test_connection gọi validator, trả code, KHÔNG echo giá trị."""

    def test_validate_secrets_rejects_bad_base_url_with_code(self):
        errors = tcbs_schema.validate_secrets(
            {'api_key': 'K', 'base_url': 'https://openapi.tcbs.com.vn.attacker.net'})
        self.assertIn('base_url', errors)
        message = str(errors['base_url'])
        self.assertEqual(message, 'broker_egress_host_not_allowed')
        # KHÔNG echo giá trị người dùng nhập (có thể chứa host nội bộ/khoá đã rot)
        self.assertNotIn('attacker', message)
        self.assertNotIn('tcbs.com.vn', message)

    def test_validate_secrets_rejects_metadata_endpoint(self):
        errors = tcbs_schema.validate_secrets(
            {'api_key': 'K', 'base_url': 'https://169.254.169.254/latest/meta-data/'})
        self.assertEqual(errors.get('base_url'), 'broker_egress_private_address_blocked')
        self.assertNotIn('169.254', str(errors['base_url']))

    def test_validate_secrets_accepts_default_and_allowlisted(self):
        self.assertEqual(tcbs_schema.validate_secrets({'api_key': 'K'}), {})
        self.assertEqual(
            tcbs_schema.validate_secrets({'api_key': 'K', 'base_url': TCBS_PROD}), {})
        self.assertEqual(
            tcbs_schema.validate_secrets({'api_key': 'K', 'base_url': ''}), {})

    def test_validate_secrets_still_requires_api_key(self):
        self.assertEqual(tcbs_schema.validate_secrets({}), {'api_key': 'required'})

    def test_test_connection_does_not_silently_fall_back_to_default(self):
        factory = MagicMock(return_value=MagicMock())
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            result = tcbs_schema.test_connection(
                {'api_key': 'K', 'base_url': 'https://evil.example.com'})
            insecure = tcbs_schema.test_connection(
                {'api_key': 'K', 'base_url': 'http://evil.example.com'})
        finally:
            _unstub(saved)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'broker_egress_host_not_allowed')
        self.assertNotIn('unverified', result)
        self.assertEqual(insecure['error'], 'broker_egress_scheme_not_allowed')
        factory.assert_not_called()



class CapabilityMatrixVersionedTests(SimpleTestCase):
    """C-04: capability matrix là dữ liệu versioned, không phải hằng trong view.

    `views_broker.py` hardcode FULLY_SUPPORTED = {dnse,ssi,tcbs} trong khi tcbs/ssi chưa
    xác minh contract. File view nằm ngoài phạm vi slice này nên test chỉ pin DATA —
    coordinator nối vào view sau.
    """

    def test_matrix_is_versioned(self):
        from user_workspace.broker.base import capability_matrix
        matrix = capability_matrix()
        self.assertTrue(matrix['version'])
        self.assertEqual(set(matrix['providers']), {'dnse', 'ssi', 'tcbs'})

    def test_only_dnse_fully_supported(self):
        from user_workspace.broker.base import is_fully_supported
        self.assertTrue(is_fully_supported('dnse'))
        self.assertFalse(is_fully_supported('ssi'))
        self.assertFalse(is_fully_supported('tcbs'))
        self.assertFalse(is_fully_supported('xyz'))

    def test_pending_review_lists_unverified_providers(self):
        from user_workspace.broker.base import providers_pending_capability_review
        self.assertEqual(providers_pending_capability_review(), ['ssi', 'tcbs'])

    def test_no_provider_claims_trade_yet(self):
        from user_workspace.broker.base import PROVIDER_CAPABILITIES
        for provider, caps in PROVIDER_CAPABILITIES.items():
            with self.subTest(provider=provider):
                self.assertFalse(caps['trade'], 'pha read-only chưa provider nào bật trade')


class AdapterAppliesValidatorTests(SimpleTestCase):
    """Defense in depth: validator chạy lúc DỰNG CLIENT, không chỉ lúc lưu config."""

    def _build(self, base_url):
        factory = MagicMock(return_value=MagicMock())
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            adapter = get_broker_adapter('tcbs', api_key='TK', base_url=base_url)
            return factory, adapter
        finally:
            _unstub(saved)

    def test_bad_base_url_blocks_client_construction(self):
        factory = MagicMock(return_value=MagicMock())
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            adapter = get_broker_adapter('tcbs', api_key='TK',
                                         base_url='http://evil.example.com')
            with self.assertRaises(BrokerEgressError) as ctx:
                adapter.list_accounts()
            self.assertEqual(ctx.exception.code, 'broker_egress_scheme_not_allowed')
            factory.assert_not_called()
        finally:
            _unstub(saved)

    def test_metadata_base_url_blocks_client_construction(self):
        factory = MagicMock(return_value=MagicMock())
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            adapter = get_broker_adapter(
                'tcbs', api_key='TK', base_url='https://169.254.169.254/latest/')
            with self.assertRaises(BrokerEgressError):
                adapter.get_balance('105C1')
            factory.assert_not_called()
        finally:
            _unstub(saved)

    def test_allowlisted_base_url_reaches_client(self):
        client = MagicMock()
        client.get_account_list.return_value = [{'accountNo': '105C1'}]
        factory = MagicMock(return_value=client)
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            adapter = get_broker_adapter('tcbs', api_key='TK', base_url=TCBS_PROD)
            adapter.list_accounts()
            _, kwargs = factory.call_args
            self.assertEqual(kwargs.get('base_url'), TCBS_PROD)
        finally:
            _unstub(saved)

    def test_blank_base_url_omits_kwarg_so_client_uses_own_default(self):
        client = MagicMock()
        client.get_account_list.return_value = [{'accountNo': '105C1'}]
        factory = MagicMock(return_value=client)
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            adapter = get_broker_adapter('tcbs', api_key='TK', base_url='')
            adapter.list_accounts()
            _, kwargs = factory.call_args
            self.assertIsNone(kwargs.get('base_url'))
        finally:
            _unstub(saved)

    def test_egress_error_is_broker_adapter_error_subclass(self):
        from user_workspace.broker.adapters import BrokerAdapterError
        factory, adapter = self._build('http://evil.example.com')
        with self.assertRaises(BrokerAdapterError):
            adapter.list_accounts()
