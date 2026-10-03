"""BL-01: SAML fail-closed signature mode selection + strict rejection.

- Prod-like env (no DJANGO_DEBUG, no explicit mode) must default to strict.
- Strict must reject unsigned responses (no Signature element).
- noop remains available explicitly and in dev/test.
"""
import base64
import os
import sys
from datetime import datetime, timedelta, timezone
from unittest import mock

from django.test import SimpleTestCase

from identity_access.saml_service import (
    SAMLService,
    SAMLSignatureError,
    _default_signature_mode,
)


def _unsigned_response_b64(email='alice@corp.com'):
    now = datetime.now(timezone.utc)
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
            with mock.patch.object(sys, 'argv', ['manage.py', 'check']):
                self.assertEqual(_default_signature_mode(), 'strict')
                self.assertEqual(_svc().signature_mode, 'strict')

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
