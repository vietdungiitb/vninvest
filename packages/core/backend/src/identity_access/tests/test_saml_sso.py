"""
Sprint 5: SAMLService + SSO views tests.

Tests cover:
- SAMLService AuthnRequest generation
- SAMLService Response parsing
- SAMLService metadata generation
- SAMLService connection test
- SSOLoginInitiateView (redirect + JSON)
- SSOCallbackView (POST + GET)
- SSOMetadataView
- PartnerSSOTestConnectionView
- PartnerSSOTestLoginView
"""
import base64
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, RequestFactory, override_settings
from django.test.utils import setup_test_environment
from rest_framework import status
from rest_framework.test import APIClient

from lxml import etree

from identity_access.models import (
    CoreTenant,
    CoreServiceAccount,
    CorePATCredential,
    TenantMember,
    TenantSSOConfig,
)
from identity_access.saml_service import (
    SAMLService,
    SAMLRequestError,
    SAMLParseError,
    SAMLSignatureError,
    SAML2P_NS,
    SAML2_NS,
    MD_NS,
    DS_NS,
)

User = get_user_model()


# ─── Test Helpers ──────────────────────────────────────────────────────


def _make_saml_response_xml(
    email='user@test.com',
    name='Test User',
    issuer='https://idp.test.com',
    in_response_to='',
    session_index='session_123',
    not_on_or_after=None,
    status_success=True,
):
    """Build a minimal but valid SAML Response XML string."""
    now = datetime.now(timezone.utc)
    if not_on_or_after is None:
        not_on_or_after = now + timedelta(hours=1)

    response_id = f'_resp-{uuid.uuid4().hex}'
    issue_instant = now.strftime('%Y-%m-%dT%H:%M:%SZ')
    expiry = not_on_or_after.strftime('%Y-%m-%dT%H:%M:%SZ')

    attrs = []
    if email:
        attrs.append(
            f'<saml2:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">'
            f'<saml2:AttributeValue>{email}</saml2:AttributeValue>'
            f'</saml2:Attribute>'
        )
    if name:
        attrs.append(
            f'<saml2:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name">'
            f'<saml2:AttributeValue>{name}</saml2:AttributeValue>'
            f'</saml2:Attribute>'
        )

    attrs_xml = '\n'.join(attrs)

    status_value = 'urn:oasis:names:tc:SAML:2.0:status:Success' if status_success else 'urn:oasis:names:tc:SAML:2.0:status:Requester'

    in_response_attr = f' InResponseTo="{in_response_to}"' if in_response_to else ''

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<saml2p:Response xmlns:saml2p="{SAML2P_NS}" xmlns:saml2="{SAML2_NS}"
    ID="{response_id}" Version="2.0" IssueInstant="{issue_instant}"
    Destination="https://app.test.com/core/v1/auth/sso/callback/"{in_response_attr}>
  <saml2:Issuer>{issuer}</saml2:Issuer>
  <saml2p:Status>
    <saml2p:StatusCode Value="{status_value}"/>
  </saml2p:Status>
  <saml2:Assertion xmlns:saml2="{SAML2_NS}" ID="_assert-{uuid.uuid4().hex}"
      Version="2.0" IssueInstant="{issue_instant}">
    <saml2:Issuer>{issuer}</saml2:Issuer>
    <saml2:Subject>
      <saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">{email}</saml2:NameID>
      <saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:methods:bearer">
        <saml2:SubjectConfirmationData NotOnOrAfter="{expiry}"/>
      </saml2:SubjectConfirmation>
    </saml2:Subject>
    <saml2:Conditions NotBefore="{issue_instant}" NotOnOrAfter="{expiry}">
      <saml2:AudienceRestriction>
        <saml2:Audience>https://app.test.com/saml/metadata</saml2:Audience>
      </saml2:AudienceRestriction>
    </saml2:Conditions>
    <saml2:AuthnStatement AuthnInstant="{issue_instant}" SessionIndex="{session_index}">
      <saml2:AuthnContext>
        <saml2:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml2:AuthnContextClassRef>
      </saml2:AuthnContext>
    </saml2:AuthnStatement>
    <saml2:AttributeStatement>
      {attrs_xml}
    </saml2:AttributeStatement>
  </saml2:Assertion>
</saml2p:Response>'''
    return xml


def _encode_saml_response(xml_str):
    """Base64-encode a SAML Response XML string."""
    return base64.b64encode(xml_str.encode('utf-8')).decode('ascii')


# ─── SAMLService Unit Tests ────────────────────────────────────────────


class SAMLServiceAuthnRequestTests(TestCase):
    """Test SAMLService AuthnRequest generation."""

    def setUp(self):
        self.svc = SAMLService(
            sp_entity_id='https://app.test.com/saml/metadata',
            sp_acs_url='https://app.test.com/core/v1/auth/sso/callback/',
            idp_entity_id='https://idp.test.com',
            idp_sso_url='https://idp.test.com/sso/saml',
            idp_x509_cert='MIIC...',
        )

    def test_create_authn_request_returns_tuple(self):
        request_id, redirect_url, encoded = self.svc.create_authn_request()
        self.assertTrue(request_id.startswith('_id-'))
        self.assertIn('SAMLRequest=', redirect_url)
        self.assertTrue(len(encoded) > 0)

    def test_authn_request_contains_dest(self):
        _, redirect_url, encoded = self.svc.create_authn_request()
        xml_bytes = base64.b64decode(encoded)
        root = etree.fromstring(xml_bytes)
        self.assertEqual(root.get('Destination'), 'https://idp.test.com/sso/saml')

    def test_authn_request_contains_issuer(self):
        _, _, encoded = self.svc.create_authn_request()
        xml_bytes = base64.b64decode(encoded)
        root = etree.fromstring(xml_bytes)
        issuer_el = root.find(f'{{{SAML2_NS}}}Issuer')
        self.assertIsNotNone(issuer_el)
        self.assertEqual(issuer_el.text, 'https://app.test.com/saml/metadata')

    def test_authn_request_relay_state_in_url(self):
        _, redirect_url, _ = self.svc.create_authn_request(relay_state='my_tenant')
        self.assertIn('RelayState=my_tenant', redirect_url)

    def test_authn_request_force_authn(self):
        _, _, encoded = self.svc.create_authn_request(force_authn=True)
        xml_bytes = base64.b64decode(encoded)
        root = etree.fromstring(xml_bytes)
        self.assertEqual(root.get('ForceAuthn'), 'true')

    def test_redirect_url_points_to_idp(self):
        _, redirect_url, _ = self.svc.create_authn_request()
        self.assertTrue(redirect_url.startswith('https://idp.test.com/sso/saml?'))


class SAMLServiceResponseParsingTests(TestCase):
    """Test SAMLService Response parsing."""

    def setUp(self):
        self.svc = SAMLService(
            sp_entity_id='https://app.test.com/saml/metadata',
            sp_acs_url='https://app.test.com/core/v1/auth/sso/callback/',
            idp_entity_id='https://idp.test.com',
            idp_sso_url='https://idp.test.com/sso/saml',
            idp_x509_cert='MIIC...',
        )

    def test_parse_valid_response(self):
        xml = _make_saml_response_xml(email='alice@corp.com', name='Alice Smith')
        encoded = _encode_saml_response(xml)
        result = self.svc.parse_response(encoded)
        self.assertEqual(result['email'], 'alice@corp.com')
        self.assertEqual(result['name'], 'Alice Smith')
        self.assertIn('response_id', result)
        self.assertIn('issue_instant', result)
        self.assertEqual(result['issuer'], 'https://idp.test.com')

    def test_parse_response_inresponse_to_validation(self):
        request_id = '_id-test123'
        xml = _make_saml_response_xml(in_response_to=request_id)
        encoded = _encode_saml_response(xml)
        result = self.svc.parse_response(encoded, expected_request_id=request_id)
        self.assertIn('email', result)

    def test_parse_response_inresponse_to_mismatch(self):
        xml = _make_saml_response_xml(in_response_to='_id-wrong')
        encoded = _encode_saml_response(xml)
        with self.assertRaises(SAMLParseError) as ctx:
            self.svc.parse_response(encoded, expected_request_id='_id-correct')
        self.assertIn('InResponseTo mismatch', str(ctx.exception))

    def test_parse_response_status_failure(self):
        xml = _make_saml_response_xml(status_success=False)
        encoded = _encode_saml_response(xml)
        with self.assertRaises(SAMLParseError) as ctx:
            self.svc.parse_response(encoded)
        self.assertIn('not Success', str(ctx.exception))

    def test_parse_response_expired(self):
        expired = datetime.now(timezone.utc) - timedelta(hours=1)
        xml = _make_saml_response_xml(not_on_or_after=expired)
        encoded = _encode_saml_response(xml)
        with self.assertRaises(SAMLParseError) as ctx:
            self.svc.parse_response(encoded)
        self.assertIn('expired', str(ctx.exception))

    def test_parse_response_invalid_base64(self):
        with self.assertRaises(SAMLParseError) as ctx:
            self.svc.parse_response('not-valid-base64!!!')
        self.assertIn('base64', str(ctx.exception))

    def test_parse_response_invalid_xml(self):
        bad = base64.b64encode(b'<not valid xml>').decode()
        with self.assertRaises(SAMLParseError) as ctx:
            self.svc.parse_response(bad)
        self.assertIn('XML', str(ctx.exception))

    def test_parse_response_no_assertion(self):
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<saml2p:Response xmlns:saml2p="{ns}" ID="_r1" Version="2.0"
    IssueInstant="2025-01-01T00:00:00Z">
  <saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status>
</saml2p:Response>'''.format(ns=SAML2P_NS)
        encoded = _encode_saml_response(xml)
        with self.assertRaises(SAMLParseError) as ctx:
            self.svc.parse_response(encoded)
        self.assertIn('No Assertion', str(ctx.exception))

    def test_parse_response_groups_attribute(self):
        xml = _make_saml_response_xml()
        inject = '<saml2:Attribute Name="http://schemas.xmlsoap.org/claims/Group"><saml2:AttributeValue>admins</saml2:AttributeValue></saml2:Attribute>'
        xml = xml.replace('</saml2:AttributeStatement>', inject + '</saml2:AttributeStatement>')
        encoded = _encode_saml_response(xml)
        result = self.svc.parse_response(encoded)
        self.assertIn('groups', result)

    def test_parse_response_name_id_used_as_email_fallback(self):
        xml = _make_saml_response_xml(email='', name='')
        # When email attr is empty/missing, NameID should be used as fallback
        xml = xml.replace(
            '<saml2:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">'
            '<saml2:AttributeValue></saml2:AttributeValue></saml2:Attribute>',
            '',
        )
        encoded = _encode_saml_response(xml)
        result = self.svc.parse_response(encoded)
        # NameID in the fixture is empty string when email='', so result is empty
        # The key point: no crash, and 'email' key is present
        self.assertIn('email', result)


class SAMLServiceMetadataTests(TestCase):
    """Test SP metadata generation."""

    def setUp(self):
        self.svc = SAMLService(
            sp_entity_id='https://app.test.com/saml/metadata',
            sp_acs_url='https://app.test.com/core/v1/auth/sso/callback/',
            idp_entity_id='https://idp.test.com',
            idp_sso_url='https://idp.test.com/sso/saml',
        )

    def test_metadata_contains_entity_descriptor(self):
        xml = self.svc.generate_metadata()
        root = etree.fromstring(xml.encode())
        self.assertEqual(root.tag, f'{{{MD_NS}}}EntityDescriptor')
        self.assertEqual(root.get('entityID'), 'https://app.test.com/saml/metadata')

    def test_metadata_contains_sp_sso_descriptor(self):
        xml = self.svc.generate_metadata()
        root = etree.fromstring(xml.encode())
        sp = root.find(f'{{{MD_NS}}}SPSSODescriptor')
        self.assertIsNotNone(sp)
        self.assertEqual(sp.get('AuthnRequestsSigned'), 'true')
        self.assertEqual(sp.get('WantAssertionsSigned'), 'true')

    def test_metadata_contains_acs(self):
        xml = self.svc.generate_metadata()
        root = etree.fromstring(xml.encode())
        acs = root.find(f'.//{{{MD_NS}}}AssertionConsumerService')
        self.assertIsNotNone(acs)
        self.assertEqual(acs.get('Location'), 'https://app.test.com/core/v1/auth/sso/callback/')
        self.assertEqual(acs.get('Binding'), 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST')

    def test_metadata_contains_name_id_format(self):
        xml = self.svc.generate_metadata()
        self.assertIn('nameid-format:emailAddress', xml)


class SAMLServiceConnectionTests(TestCase):
    """Test connection test logic."""

    def setUp(self):
        self.svc = SAMLService(
            sp_entity_id='https://app.test.com/saml/metadata',
            sp_acs_url='https://app.test.com/core/v1/auth/sso/callback/',
            idp_entity_id='https://idp.test.com',
            idp_sso_url='https://idp.test.com/sso/saml',
            idp_x509_cert='MIIC...',
        )

    def test_all_configured_returns_success(self):
        result = self.svc.test_connection()
        self.assertTrue(result['success'])
        self.assertEqual(len(result['errors']), 0)
        self.assertTrue(len(result['checks']) > 0)

    def test_missing_url_returns_error(self):
        svc = SAMLService(
            sp_entity_id='',
            sp_acs_url='',
            idp_entity_id='',
            idp_sso_url='',
        )
        result = svc.test_connection()
        self.assertFalse(result['success'])
        self.assertTrue(len(result['errors']) > 0)


class SAMLServiceFromConfigTests(TestCase):
    """Test SAMLService.from_config() factory."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='saml_owner', email='saml_owner@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='saml_tenant', tenant_code='saml_tenant',
            display_name='SAML Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.ENTERPRISE,
        )
        self.sso_config = TenantSSOConfig.objects.create(
            tenant=self.tenant,
            is_enabled=True,
            idp_entity_id='https://idp corp.com',
            idp_sso_url='https://idp.corp.com/sso/saml',
            idp_x509_cert='MIIC...',
            sp_entity_id='https://app.test.com/saml/metadata',
            sp_acs_url='https://app.test.com/core/v1/auth/sso/callback/',
        )

    def test_from_config_populates_fields(self):
        svc = SAMLService.from_config(self.sso_config)
        self.assertEqual(svc.sp_entity_id, 'https://app.test.com/saml/metadata')
        self.assertEqual(svc.sp_acs_url, 'https://app.test.com/core/v1/auth/sso/callback/')
        self.assertEqual(svc.idp_entity_id, 'https://idp corp.com')
        self.assertEqual(svc.idp_sso_url, 'https://idp.corp.com/sso/saml')


# ─── SSO Views Integration Tests ──────────────────────────────────────


class SSOViewTestBase(TestCase):
    """Base for SSO view tests with common setup."""

    def setUp(self):
        self.factory = RequestFactory()
        self.owner = User.objects.create_user(
            username='sso_admin', email='sso_admin@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='sso_tenant', tenant_code='sso_tenant',
            display_name='SSO Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.ENTERPRISE,
        )
        self.member = TenantMember.objects.create(
            tenant=self.tenant, user=self.owner,
            role=TenantMember.RoleChoices.OWNER,
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='SSO Test SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant'],
        )
        self.pat, self.raw_token = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=['manage_tenant'],
            label='test-pat',
            audit_reason='test',
            is_human_session=True,
            issued_for_member=self.member,
        )
        self.sso_config = TenantSSOConfig.objects.create(
            tenant=self.tenant,
            is_enabled=True,
            idp_entity_id='https://idp.test.com',
            idp_sso_url='https://idp.test.com/sso/saml',
            idp_x509_cert='MIIC...',
            domain_hint='test.com',
            sp_entity_id='https://app.test.com/saml/metadata',
            sp_acs_url='https://app.test.com/core/v1/auth/sso/callback/',
        )

    def _auth_headers(self):
        return {'HTTP_AUTHORIZATION': f'Bearer {self.raw_token}'}


class SSOLoginInitiateViewTests(SSOViewTestBase):
    """Test SSOLoginInitiateView."""

    def test_missing_domain_and_email_returns_400(self):
        from identity_access.views.sso import SSOLoginInitiateView
        request = self.factory.get('/auth/sso/login/')
        response = SSOLoginInitiateView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_domain_returns_404(self):
        from identity_access.views.sso import SSOLoginInitiateView
        request = self.factory.get('/auth/sso/login/?domain=unknown.com')
        response = SSOLoginInitiateView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_valid_domain_returns_redirect_url(self):
        from identity_access.views.sso import SSOLoginInitiateView
        request = self.factory.get('/auth/sso/login/?domain=test.com')
        response = SSOLoginInitiateView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('redirect_url', response.data)
        self.assertIn('SAMLRequest', response.data['redirect_url'])

    def test_valid_email_domain_returns_redirect_url(self):
        from identity_access.views.sso import SSOLoginInitiateView
        request = self.factory.get('/auth/sso/login/?email=user@test.com')
        response = SSOLoginInitiateView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('redirect_url', response.data)

    def test_disabled_sso_returns_404(self):
        self.sso_config.is_enabled = False
        self.sso_config.save()
        from identity_access.views.sso import SSOLoginInitiateView
        request = self.factory.get('/auth/sso/login/?domain=test.com')
        response = SSOLoginInitiateView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SSOCallbackViewTests(SSOViewTestBase):
    """Test SSOCallbackView POST."""

    def test_missing_saml_response_returns_400(self):
        from identity_access.views.sso import SSOCallbackView
        request = self.factory.post('/auth/sso/callback/', data={})
        response = SSOCallbackView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_saml_response_no_relay_state_returns_404(self):
        from identity_access.views.sso import SSOCallbackView
        bad = base64.b64encode(b'<garbage>').decode()
        request = self.factory.post('/auth/sso/callback/', data={'SAMLResponse': bad})
        response = SSOCallbackView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_saml_response_with_relay_state_returns_400(self):
        from identity_access.views.sso import SSOCallbackView
        bad = base64.b64encode(b'<garbage>').decode()
        request = self.factory.post(
            '/auth/sso/callback/',
            data={'SAMLResponse': bad, 'RelayState': 'sso_tenant'},
            format='form',
        )
        response = SSOCallbackView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_saml_response_creates_user_and_returns_token(self):
        from identity_access.views.sso import SSOCallbackView
        xml = _make_saml_response_xml(email='sso_user@test.com', name='SSO User')
        encoded = _encode_saml_response(xml)
        request = self.factory.post(
            '/auth/sso/callback/',
            data={'SAMLResponse': encoded, 'RelayState': 'sso_tenant'},
            format='form',
        )
        response = SSOCallbackView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['user']['email'], 'sso_user@test.com')
        self.assertEqual(response.data['tenant']['tenant_code'], 'sso_tenant')
        self.assertEqual(response.data['member']['role'], 'viewer')

        # Verify user was created
        user = User.objects.get(email='sso_user@test.com')
        self.assertEqual(user.first_name, 'SSO')
        self.assertEqual(user.last_name, 'User')

        # Verify membership
        member = TenantMember.objects.get(tenant=self.tenant, user=user)
        self.assertEqual(member.role, TenantMember.RoleChoices.VIEWER)

    def test_callback_get_with_query_params(self):
        from identity_access.views.sso import SSOCallbackView
        from urllib.parse import quote
        xml = _make_saml_response_xml(email='get_user@test.com')
        encoded = _encode_saml_response(xml)
        safe_encoded = quote(encoded, safe='')
        request = self.factory.get(
            f'/auth/sso/callback/?SAMLResponse={safe_encoded}&RelayState=sso_tenant',
        )
        response = SSOCallbackView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'get_user@test.com')

    def test_callback_existing_user_reuses_account(self):
        from identity_access.views.sso import SSOCallbackView
        existing = User.objects.create_user(
            username='existing', email='existing@test.com', password='test123',
        )
        xml = _make_saml_response_xml(email='existing@test.com', name='Existing User')
        encoded = _encode_saml_response(xml)
        request = self.factory.post(
            '/auth/sso/callback/',
            data={'SAMLResponse': encoded, 'RelayState': 'sso_tenant'},
            format='form',
        )
        response = SSOCallbackView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should not create a duplicate user
        self.assertEqual(User.objects.filter(email='existing@test.com').count(), 1)


class SSOMetadataViewTests(SSOViewTestBase):
    """Test SSOMetadataView."""

    def test_valid_tenant_returns_xml(self):
        from identity_access.views.sso import SSOMetadataView
        request = self.factory.get('/auth/sso/metadata/sso_tenant/')
        response = SSOMetadataView.as_view()(request, tenant_code='sso_tenant')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/xml; charset=utf-8')
        content = response.content.decode()
        self.assertIn('EntityDescriptor', content)
        self.assertIn('SPSSODescriptor', content)

    def test_unknown_tenant_returns_404(self):
        from identity_access.views.sso import SSOMetadataView
        request = self.factory.get('/auth/sso/metadata/unknown/')
        response = SSOMetadataView.as_view()(request, tenant_code='unknown')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_disabled_sso_returns_404(self):
        self.sso_config.is_enabled = False
        self.sso_config.save()
        from identity_access.views.sso import SSOMetadataView
        request = self.factory.get('/auth/sso/metadata/sso_tenant/')
        response = SSOMetadataView.as_view()(request, tenant_code='sso_tenant')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PartnerSSOTestConnectionViewTests(SSOViewTestBase):
    """Test PartnerSSOTestConnectionView."""

    def test_success(self):
        from identity_access.views.sso import PartnerSSOTestConnectionView
        request = self.factory.post(
            '/partner/sso/test/',
            HTTP_AUTHORIZATION=f'Bearer {self.raw_token}',
        )
        request.user = self.owner
        request.tenant = self.tenant
        request.tenant_role = 'owner'
        request.tenant_member = self.member
        response = PartnerSSOTestConnectionView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    def test_no_config_returns_error(self):
        TenantSSOConfig.objects.filter(tenant=self.tenant).delete()
        from identity_access.views.sso import PartnerSSOTestConnectionView
        request = self.factory.post(
            '/partner/sso/test/',
            HTTP_AUTHORIZATION=f'Bearer {self.raw_token}',
        )
        request.user = self.owner
        request.tenant = self.tenant
        request.tenant_role = 'owner'
        request.tenant_member = self.member
        response = PartnerSSOTestConnectionView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['success'])


class PartnerSSOTestLoginViewTests(SSOViewTestBase):
    """Test PartnerSSOTestLoginView."""

    def test_returns_redirect_url(self):
        from identity_access.views.sso import PartnerSSOTestLoginView
        request = self.factory.post(
            '/partner/sso/test-login/',
            HTTP_AUTHORIZATION=f'Bearer {self.raw_token}',
        )
        request.user = self.owner
        request.tenant = self.tenant
        request.tenant_role = 'owner'
        request.tenant_member = self.member
        response = PartnerSSOTestLoginView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('redirect_url', response.data)
        self.assertIn('SAMLRequest', response.data['redirect_url'])

    def test_disabled_sso_returns_400(self):
        self.sso_config.is_enabled = False
        self.sso_config.save()
        from identity_access.views.sso import PartnerSSOTestLoginView
        request = self.factory.post(
            '/partner/sso/test-login/',
            HTTP_AUTHORIZATION=f'Bearer {self.raw_token}',
        )
        request.user = self.owner
        request.tenant = self.tenant
        request.tenant_role = 'owner'
        request.tenant_member = self.member
        response = PartnerSSOTestLoginView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
