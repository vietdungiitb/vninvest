"""
Tests for vninvest_core.client_ip - the single source of truth for client IP.

The central regression test is ``SpoofedForwardedForIsIgnoredTests``: it proves a
client can no longer choose the address that rate limiters, audit rows and the
PAT CIDR allow-list see. If someone reverts to reading the left-most
``X-Forwarded-For`` entry (or to trusting the header unconditionally), the first
test in that class fails.
"""
from django.test import RequestFactory, SimpleTestCase, override_settings

from vninvest_core.client_ip import (
    UNKNOWN_IP,
    get_client_ip,
    get_client_subnet,
)


class SpoofedForwardedForIsIgnoredTests(SimpleTestCase):
    """THE vulnerability: an untrusted peer must not be able to pick its IP."""

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_untrusted_peer_spoofed_xff_returns_remote_addr(self):
        """Untrusted peer + spoofed X-Forwarded-For -> REMOTE_ADDR, not the header."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='198.51.100.7',
            HTTP_X_FORWARDED_FOR='1.1.1.1',
        )
        result = get_client_ip(request)
        self.assertEqual(result, '198.51.100.7')
        # The left-most header entry is attacker-controlled - never trust it.
        self.assertNotEqual(result, '1.1.1.1')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_untrusted_peer_spoofed_xff_chain_returns_remote_addr(self):
        """A whole injected chain is ignored when the peer is untrusted."""
        request = RequestFactory().get(
            '/core/v1/auth/login/',
            REMOTE_ADDR='198.51.100.7',
            HTTP_X_FORWARDED_FOR='1.1.1.1, 10.0.0.1, 172.16.0.9',
        )
        self.assertEqual(get_client_ip(request), '198.51.100.7')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_peer_not_in_allowlist_ignores_header(self):
        """Being on a different host than the allow-list entry is not enough."""
        request = RequestFactory().get(
            '/core/v1/auth/login/',
            REMOTE_ADDR='10.0.0.6',  # one octet off the trusted proxy
            HTTP_X_FORWARDED_FOR='1.1.1.1',
        )
        self.assertEqual(get_client_ip(request), '10.0.0.6')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_header_alone_never_wins_over_missing_remote_addr(self):
        """With no trusted peer and no REMOTE_ADDR, header must not be used."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            HTTP_X_FORWARDED_FOR='1.1.1.1, 2.2.2.2',
        )
        request.META.pop('REMOTE_ADDR', None)
        self.assertEqual(get_client_ip(request), UNKNOWN_IP)


class TrustedProxyForwardedForTests(SimpleTestCase):
    """When the peer IS trusted, the last XFF entry is the real client."""

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_trusted_peer_takes_last_xff_entry(self):
        """The proxy appends the real client, so read the LAST entry."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='1.1.1.1, 2.2.2.2',
        )
        result = get_client_ip(request)
        self.assertEqual(result, '2.2.2.2')
        self.assertNotEqual(result, '1.1.1.1')

    @override_settings(TRUSTED_PROXY_IPS=['::1'])
    def test_trusted_peer_ipv6_takes_last_xff_entry(self):
        """IPv6 peer in the allow-list is honoured too.

        Note the canonical COMPRESSED IPv6 form - that is what
        ``ipaddress.ip_address().str()`` produces and therefore what every
        caller gets and must compare/bucket on.
        """
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='::1',
            HTTP_X_FORWARDED_FOR='1.1.1.1, 2001:db8::dead:beef',
        )
        self.assertEqual(get_client_ip(request), '2001:db8::dead:beef')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/24'])
    def test_trusted_peer_cidr_entry(self):
        """A CIDR entry trusts a whole network (e.g. a Docker bridge)."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.42',
            HTTP_X_FORWARDED_FOR='1.1.1.1, 203.0.113.9',
        )
        self.assertEqual(get_client_ip(request), '203.0.113.9')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_trusted_peer_without_header_returns_remote_addr(self):
        """No header -> fall back to the peer."""
        request = RequestFactory().get(
            '/core/v1/auth/register/', REMOTE_ADDR='10.0.0.5'
        )
        self.assertEqual(get_client_ip(request), '10.0.0.5')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_trusted_peer_with_only_malformed_header_returns_remote_addr(self):
        """A garbage header must not blank out the client IP."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='not-an-ip, also-not-an-ip',
        )
        self.assertEqual(get_client_ip(request), '10.0.0.5')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_malformed_entries_are_skipped_and_last_valid_wins(self):
        """Malformed entries are ignored, the last VALID entry is used."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='1.1.1.1, garbage, 999.999.999.999, 203.0.113.9, ???',
        )
        self.assertEqual(get_client_ip(request), '203.0.113.9')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_empty_xff_entries_are_dropped(self):
        """Trailing/duplicate commas and stray spaces must not win."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR=' 1.1.1.1 , , 203.0.113.9 ,  ',
        )
        self.assertEqual(get_client_ip(request), '203.0.113.9')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_xff_entry_with_port_suffix(self):
        """Proxies may append a port to the address."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='1.1.1.1, 203.0.113.9:51234',
        )
        self.assertEqual(get_client_ip(request), '203.0.113.9')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_malformed_trusted_proxy_entry_does_not_raise(self):
        """A misconfigured allow-list entry is skipped, never a 500."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='203.0.113.9',
        )
        with override_settings(TRUSTED_PROXY_IPS=['not-an-ip', '999.0.0.0/8', None, '']):
            self.assertEqual(get_client_ip(request), '10.0.0.5')


class FallbackContractTests(SimpleTestCase):
    """get_client_ip never returns '' and never raises."""

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_missing_remote_addr_returns_unknown(self):
        request = RequestFactory().get('/core/v1/auth/register/')
        request.META.pop('REMOTE_ADDR', None)
        self.assertEqual(get_client_ip(request), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_empty_remote_addr_returns_unknown(self):
        request = RequestFactory().get('/core/v1/auth/register/', REMOTE_ADDR='')
        self.assertEqual(get_client_ip(request), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_whitespace_remote_addr_returns_unknown(self):
        request = RequestFactory().get('/core/v1/auth/register/', REMOTE_ADDR='   ')
        self.assertEqual(get_client_ip(request), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_malformed_remote_addr_returns_unknown(self):
        request = RequestFactory().get('/core/v1/auth/register/', REMOTE_ADDR='/tmp/sock')
        self.assertEqual(get_client_ip(request), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_unknown_is_not_a_valid_ip_literal(self):
        """The fallback must not look like a real, routable address."""
        request = RequestFactory().get('/core/v1/auth/register/')
        request.META.pop('REMOTE_ADDR', None)
        self.assertNotEqual(UNKNOWN_IP, '0.0.0.0')
        self.assertNotEqual(UNKNOWN_IP, '')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_request_without_meta_attribute_does_not_raise(self):
        """A stub without META must degrade, not explode."""

        class _NoMeta:
            pass

        self.assertEqual(get_client_ip(_NoMeta()), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_repeated_header_exposed_as_list(self):
        """Some WSGI servers expose repeated headers as a sequence."""
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='198.51.100.7',
            HTTP_X_FORWARDED_FOR=['1.1.1.1', '203.0.113.9'],
        )
        self.assertEqual(get_client_ip(request), '198.51.100.7')


class GetClientSubnetTests(SimpleTestCase):
    """Subnet bucketing for the registration rate limiters."""

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_ipv4_default_is_slash_24(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='203.0.113.42',
            HTTP_X_FORWARDED_FOR='1.1.1.1',
        )
        self.assertEqual(get_client_subnet(request), '203.0.113.0')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_ipv4_custom_prefix(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/', REMOTE_ADDR='203.0.113.42'
        )
        self.assertEqual(get_client_subnet(request, bits=16), '203.0.0.0')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_ipv4_slash_32_is_the_host_itself(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/', REMOTE_ADDR='203.0.113.42'
        )
        self.assertEqual(get_client_subnet(request, bits=32), '203.0.113.42')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_ipv6_default_prefix(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/', REMOTE_ADDR='2001:db8::dead:beef'
        )
        self.assertEqual(
            get_client_subnet(request, bits=64),
            '2001:db8::',
        )

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.5'])
    def test_ipv6_subnet_uses_forwarded_client_not_proxy(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/',
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='2001:db8::1, 2001:db8:abcd::42',
        )
        self.assertEqual(
            get_client_subnet(request, bits=48),
            '2001:db8:abcd::',
        )

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_malformed_client_ip_returns_unknown_subnet(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/', REMOTE_ADDR='not-an-ip'
        )
        self.assertEqual(get_client_subnet(request), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_missing_remote_addr_returns_unknown_subnet(self):
        request = RequestFactory().get('/core/v1/auth/register/')
        request.META.pop('REMOTE_ADDR', None)
        self.assertEqual(get_client_subnet(request), UNKNOWN_IP)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_invalid_prefix_does_not_raise(self):
        request = RequestFactory().get(
            '/core/v1/auth/register/', REMOTE_ADDR='203.0.113.42'
        )
        self.assertEqual(get_client_subnet(request, bits=99), UNKNOWN_IP)
