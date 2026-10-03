"""P0-3: SSRF guard for user-supplied `custom_endpoint`.

No DB, no network: every case uses an IP literal, `localhost`, or a patched
`getaddrinfo`. That matters because a guard test that depends on live DNS is a
test that fails on someone else's network.
"""
from unittest import mock

from django.test import SimpleTestCase

from user_workspace.endpoint_safety import (
    ALLOWLIST_ENV,
    UnsafeEndpointError,
    assert_safe_outbound_url,
)


class SchemeValidationTests(SimpleTestCase):
    def test_rejects_non_http_schemes(self):
        for url in (
            'file:///etc/passwd',
            'gopher://127.0.0.1:11211/_stats',
            'dict://127.0.0.1:11211/stats',
            'ftp://example.com/x',
        ):
            with self.subTest(url=url):
                with self.assertRaises(UnsafeEndpointError):
                    assert_safe_outbound_url(url)

    def test_rejects_userinfo_disguised_host(self):
        # urlparse reports hostname=127.0.0.1 here; a naive check on the string
        # would see "public.example" and allow it.
        with self.assertRaises(UnsafeEndpointError):
            assert_safe_outbound_url('http://public.example.com@127.0.0.1/v1')

    def test_rejects_empty_and_hostless(self):
        for url in ('', '   ', 'http://', 'not-a-url'):
            with self.subTest(url=url):
                with self.assertRaises(UnsafeEndpointError):
                    assert_safe_outbound_url(url)

    def test_rejects_absurd_length(self):
        with self.assertRaises(UnsafeEndpointError):
            assert_safe_outbound_url('http://a.example/' + 'x' * 400)


class AddressRangeTests(SimpleTestCase):
    def test_blocks_cloud_metadata(self):
        # The single highest-value block: instance credentials live here.
        with self.assertRaises(UnsafeEndpointError) as ctx:
            assert_safe_outbound_url('http://169.254.169.254/latest/meta-data/')
        self.assertIn('metadata', str(ctx.exception))

    def test_blocks_rfc1918_ranges(self):
        for url in (
            'http://10.0.0.5/v1',
            'http://172.16.4.1/v1',
            'http://192.168.1.1/v1',
        ):
            with self.subTest(url=url):
                with self.assertRaises(UnsafeEndpointError):
                    assert_safe_outbound_url(url)

    def test_blocks_loopback_by_default(self):
        for url in ('http://127.0.0.1:11434/v1', 'http://[::1]:11434/v1'):
            with self.subTest(url=url):
                with self.assertRaises(UnsafeEndpointError):
                    assert_safe_outbound_url(url)

    def test_allows_loopback_when_provider_is_local(self):
        # The `local` provider exists to reach a co-located Ollama/vLLM.
        for url in ('http://127.0.0.1:11434/v1', 'http://localhost:11434/v1'):
            with self.subTest(url=url):
                self.assertEqual(
                    assert_safe_outbound_url(url, allow_loopback=True), url
                )

    def test_allow_loopback_does_not_unlock_link_local(self):
        # Regression guard: one flag must not open every door.
        with self.assertRaises(UnsafeEndpointError):
            assert_safe_outbound_url('http://169.254.169.254/', allow_loopback=True)

    def test_blocks_ipv4_mapped_ipv6(self):
        # ::ffff:127.0.0.1 is loopback wearing an IPv6 costume.
        with self.assertRaises(UnsafeEndpointError):
            assert_safe_outbound_url('http://[::ffff:127.0.0.1]:11434/v1')

    def test_blocks_unspecified(self):
        with self.assertRaises(UnsafeEndpointError):
            assert_safe_outbound_url('http://0.0.0.0:8080/v1')


class HostnameResolutionTests(SimpleTestCase):
    def test_rejects_hostname_resolving_to_private(self):
        with mock.patch(
            'user_workspace.endpoint_safety.resolve_endpoint_ips',
            return_value=['10.1.2.3'],
        ):
            with self.assertRaises(UnsafeEndpointError):
                assert_safe_outbound_url('https://sneaky.example.com/v1')

    def test_rejects_when_any_resolved_address_is_private(self):
        # Multi-A record with one poisoned entry must fail closed.
        with mock.patch(
            'user_workspace.endpoint_safety.resolve_endpoint_ips',
            return_value=['93.184.216.34', '127.0.0.1'],
        ):
            with self.assertRaises(UnsafeEndpointError):
                assert_safe_outbound_url('https://mixed.example.com/v1')

    def test_allows_public_hostname(self):
        with mock.patch(
            'user_workspace.endpoint_safety.resolve_endpoint_ips',
            return_value=['93.184.216.34'],
        ):
            self.assertEqual(
                assert_safe_outbound_url('https://api.openai.com/v1'),
                'https://api.openai.com/v1',
            )

    def test_allowlist_permits_private_host(self):
        with mock.patch.dict('os.environ', {ALLOWLIST_ENV: 'ai.internal.corp'}):
            with mock.patch(
                'user_workspace.endpoint_safety.resolve_endpoint_ips',
                return_value=['10.20.30.40'],
            ):
                self.assertEqual(
                    assert_safe_outbound_url('https://ai.internal.corp/v1'),
                    'https://ai.internal.corp/v1',
                )

    def test_allowlist_still_refuses_metadata(self):
        with mock.patch.dict('os.environ', {ALLOWLIST_ENV: 'ai.internal.corp'}):
            with mock.patch(
                'user_workspace.endpoint_safety.resolve_endpoint_ips',
                return_value=['169.254.169.254'],
            ):
                with self.assertRaises(UnsafeEndpointError):
                    assert_safe_outbound_url('https://ai.internal.corp/v1')


class OfflineLiteralTests(SimpleTestCase):
    """Literal IPs must be classified without touching DNS."""

    def test_public_literal_needs_no_resolution(self):
        with mock.patch(
            'user_workspace.endpoint_safety.resolve_endpoint_ips',
            side_effect=AssertionError('DNS phải được bỏ qua với IP literal'),
        ):
            self.assertEqual(
                assert_safe_outbound_url('https://93.184.216.34/v1'),
                'https://93.184.216.34/v1',
            )
