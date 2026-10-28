"""BL-01: SAML fail-closed signature mode selection + strict rejection.

- Prod-like env (no DJANGO_DEBUG, no explicit mode) must default to strict.
- Strict must reject unsigned responses (no Signature element).
- noop remains available explicitly and in dev/test.
"""
import base64
import os
import sys
from datetime import datetime, timedelta, UTC
from unittest import mock

from django.test import SimpleTestCase

from identity_access.saml_service import (
    SAMLService,
    SAMLParseError,
    SAMLSignatureError,
    _default_signature_mode,
)


def _unsigned_response_b64(email='alice@corp.com'):
    now = datetime.now(UTC)
    nb = (now - timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')
    noa = (now + timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')
    xml = (
        '<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" '
        'xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp-1" '
        f'IssueInstant="{noa}">'
        '<saml2:Issuer>https://idp.test.com/sso</saml2:Issuer>'
        '<saml2p:Status><saml2p:StatusCode '
        'Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status>'
        '<saml2:Assertion ID="_assert-1">'
        '<saml2:Subject><saml2:NameID '
        'Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">'
        f'{email}</saml2:NameID></saml2:Subject>'
        f'<saml2:Conditions NotBefore="{nb}" NotOnOrAfter="{noa}"/>'
        '</saml2:Assertion></saml2p:Response>'
    )
    return base64.b64encode(xml.encode('utf-8')).decode('ascii')


def _svc(mode=''):
    return SAMLService(
        sp_entity_id='https://app.test.com/saml/metadata',
        sp_acs_url='https://app.test.com/sso/callback',
        idp_entity_id='https://idp.test.com/sso',
        idp_sso_url='https://idp.test.com/sso/saml',
        idp_x509_cert='FAKE-CERT',
        signature_mode=mode,
    )


class SignatureModeSelectionTests(SimpleTestCase):
    def test_prod_like_defaults_to_strict(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('SAML_SIGNATURE_VERIFICATION_MODE', None)
            os.environ.pop('DJANGO_DEBUG', None)
            # Neutralise every test-runner signal: a production-like environment
            # must default to strict regardless of which runner is executing.
            os.environ['DJANGO_TESTING'] = 'false'
            os.environ.pop('PYTEST_CURRENT_TEST', None)
            with mock.patch.object(sys, 'argv', ['manage.py', 'check']):
                self.assertEqual(_default_signature_mode(), 'strict')
                self.assertEqual(_svc().signature_mode, 'strict')

    def test_argv_containing_test_as_substring_does_not_downgrade(self):
        """Regression: the old check was a SUBSTRING scan over all of argv.

        `'test' in sys.argv or any('test' in arg for arg in sys.argv)` returned
        True for `/srv/latest/...`, `contest`, `protest`, `pytest` - silently
        turning signature verification into "accept anything" in production.

        argv[0] is included on purpose: the executable path is exactly where a
        deployment path like `/srv/latest/bin/gunicorn` would appear.
        """
        for argv in (
            ['/srv/latest/bin/gunicorn', 'app:serve'],
            ['manage.py', 'contest'],
            ['manage.py', 'protest'],
            ['/opt/pytest/bin/pytest', 'src/identity_access/tests'],
        ):
            with self.subTest(argv=argv):
                with mock.patch.dict(os.environ, {}, clear=False):
                    os.environ.pop('SAML_SIGNATURE_VERIFICATION_MODE', None)
                    os.environ.pop('DJANGO_DEBUG', None)
                    os.environ['DJANGO_TESTING'] = 'false'
                    os.environ.pop('PYTEST_CURRENT_TEST', None)
                    with mock.patch.object(sys, 'argv', argv):
                        self.assertEqual(
                            _default_signature_mode(),
                            'strict',
                            f'argv={argv} must not downgrade to noop',
                        )

    def test_debug_defaults_to_noop(self):
        with mock.patch.dict(os.environ, {'DJANGO_DEBUG': 'true', 'SAML_SIGNATURE_VERIFICATION_MODE': ''}):
            with mock.patch.object(sys, 'argv', ['manage.py', 'check']):
                self.assertEqual(_default_signature_mode(), 'noop')

    def test_unknown_mode_fails_closed_to_strict(self):
        with mock.patch.dict(os.environ, {'SAML_SIGNATURE_VERIFICATION_MODE': 'bogus'}):
            with mock.patch.object(sys, 'argv', ['manage.py', 'check']):
                self.assertEqual(_default_signature_mode(), 'strict')

    def test_explicit_noop_still_allowed(self):
        with mock.patch.dict(os.environ, {'SAML_SIGNATURE_VERIFICATION_MODE': 'noop'}):
            with mock.patch.object(sys, 'argv', ['manage.py', 'check']):
                self.assertEqual(_svc().signature_mode, 'noop')

    def test_constructor_override_wins(self):
        with mock.patch.dict(os.environ, {'SAML_SIGNATURE_VERIFICATION_MODE': 'strict'}):
            with mock.patch.object(sys, 'argv', ['manage.py', 'check']):
                self.assertEqual(_svc(mode='noop').signature_mode, 'noop')


class StrictRejectionTests(SimpleTestCase):
    def test_strict_rejects_unsigned_response(self):
        svc = _svc(mode='strict')
        with self.assertRaises(SAMLSignatureError):
            svc.parse_response(_unsigned_response_b64())

    def test_noop_passes_unsigned_response(self):
        svc = _svc(mode='noop')
        result = svc.parse_response(_unsigned_response_b64())
        self.assertEqual(result['email'], 'alice@corp.com')


class IssuerBindingTests(SimpleTestCase):
    """The issuer is what binds an assertion to the tenant it was issued for.

    This check is independent of signature verification, so it still protects
    while BL-01b (real crypto verification) is outstanding. Before the fix a
    mismatch was only logged, so a response minted by tenant A's IdP was
    accepted for tenant B.
    """

    def test_matching_issuer_is_accepted(self):
        svc = _svc(mode='noop')  # isolate issuer binding from signature mode
        result = svc.parse_response(_unsigned_response_b64())
        self.assertEqual(result['issuer'], 'https://idp.test.com/sso')

    def test_foreign_issuer_is_rejected(self):
        svc = _svc(mode='noop')
        payload = _unsigned_response_b64()
        # Rewrite the Issuer to another tenant's IdP.
        import base64 as _b64
        raw = _b64.b64decode(payload).decode('utf-8')
        tampered = raw.replace(
            'https://idp.test.com/sso', 'https://evil-idp.attacker/sso'
        )
        tampered_b64 = _b64.b64encode(tampered.encode('utf-8')).decode('ascii')

        with self.assertRaises(SAMLParseError) as ctx:
            svc.parse_response(tampered_b64)
        self.assertIn('issuer mismatch', str(ctx.exception).lower())
