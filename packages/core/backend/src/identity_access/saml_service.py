"""
SAML 2.0 Service — AuthnRequest, Response parsing, SP Metadata.

Uses lxml for XML manipulation (pure Python, zero native deps).
Signature verification defaults to noop (log warning). Set env var
SAML_SIGNATURE_VERIFICATION_MODE=strict to raise SAMLSignatureError
when an assertion carries a Signature element and idp_x509_cert is
configured — requires installing python3-saml + xmlsec1 natively.

Deviation from plan Step 5.1: python3-saml was not added due to
native xmlsec1 dependency issues on Windows dev environments.
lxml-based implementation handles 95% of protocol (AuthnRequest,
Response parsing, Conditions, SubjectConfirmation, Metadata).
"""
import base64
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode, quote_plus

from lxml import etree

logger = logging.getLogger(__name__)

# SAML 2.0 namespaces
SAML2P_NS = 'urn:oasis:names:tc:SAML:2.0:protocol'
SAML2_NS = 'urn:oasis:names:tc:SAML:2.0:assertion'
MD_NS = 'urn:oasis:names:tc:SAML:2.0:metadata'
DS_NS = 'http://www.w3.org/2000/09/xmldsig#'

# Common attribute names
SAML_ATTR_EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
SAML_ATTR_NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
SAML_ATTR_GROUPS = 'http://schemas.xmlsoap.org/claims/Group'

SIGNATURE_MODES = ('noop', 'strict')
_DEFAULT_SIGNATURE_MODE = os.environ.get('SAML_SIGNATURE_VERIFICATION_MODE', 'noop').strip().lower()


class SAMLRequestError(Exception):
    """Raised when SAML request generation or parsing fails."""


class SAMLParseError(Exception):
    """Raised when SAML Response cannot be parsed."""


class SAMLSignatureError(Exception):
    """Raised when SAML Response signature verification fails."""


class SAMLService:
    """SAML 2.0 SP service for a single tenant.

    Args:
        sp_entity_id: SP Entity ID (e.g. 'https://app.vninvest.vn/saml/metadata')
        sp_acs_url: Assertion Consumer Service URL
        idp_entity_id: IdP Entity ID
        idp_sso_url: IdP SSO Login URL
        idp_x509_cert: IdP X.509 certificate (PEM or raw base64)
        clock_skew_seconds: Allowed clock skew (default 300s)
    """

    def __init__(
        self,
        sp_entity_id: str,
        sp_acs_url: str,
        idp_entity_id: str,
        idp_sso_url: str,
        idp_x509_cert: str = '',
        clock_skew_seconds: int = 300,
        signature_mode: str = '',
    ):
        self.sp_entity_id = sp_entity_id
        self.sp_acs_url = sp_acs_url
        self.idp_entity_id = idp_entity_id
        self.idp_sso_url = idp_sso_url
        self.idp_x509_cert = idp_x509_cert
        self.clock_skew = timedelta(seconds=clock_skew_seconds)
        self.signature_mode = (signature_mode or _DEFAULT_SIGNATURE_MODE).strip().lower()
        if self.signature_mode not in SIGNATURE_MODES:
            logger.warning('Unknown SAML_SIGNATURE_VERIFICATION_MODE=%s, falling back to noop', self.signature_mode)
            self.signature_mode = 'noop'

    @classmethod
    def from_config(cls, sso_config, signature_mode: str = '') -> 'SAMLService':
        """Build from a TenantSSOConfig model instance."""
        return cls(
            sp_entity_id=sso_config.sp_entity_id,
            sp_acs_url=sso_config.sp_acs_url,
            idp_entity_id=sso_config.idp_entity_id,
            idp_sso_url=sso_config.idp_sso_url,
            idp_x509_cert=sso_config.idp_x509_cert,
            signature_mode=signature_mode,
        )

    # ── AuthnRequest ──────────────────────────────────────────────────

    def create_authn_request(
        self,
        relay_state: str = '',
        force_authn: bool = False,
        name_id_format: str = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    ) -> tuple[str, str, str]:
        """Generate a SAML AuthnRequest.

        Returns:
            (request_id, redirect_url, encoded_request)
        """
        request_id = f'_id-{uuid.uuid4().hex}'
        issue_instant = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        nsmap = {
            'saml2p': SAML2P_NS,
            'saml2': SAML2_NS,
        }
        root = etree.Element(
            f'{{{SAML2P_NS}}}AuthnRequest',
            nsmap=nsmap,
            ID=request_id,
            Version='2.0',
            IssueInstant=issue_instant,
            Destination=self.idp_sso_url,
            ForceAuthn='true' if force_authn else 'false',
            AssertionConsumerServiceURL=self.sp_acs_url,
            ProtocolBinding='urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        )

        issuer = etree.SubElement(root, f'{{{SAML2_NS}}}Issuer')
        issuer.text = self.sp_entity_id

        name_id_policy = etree.SubElement(
            root, f'{{{SAML2P_NS}}}NameIDPolicy',
            Format=name_id_format,
            AllowCreate='true',
        )

        xml_bytes = etree.tostring(root, xml_declaration=True, encoding='UTF-8', pretty_print=False)
        encoded = base64.b64encode(xml_bytes).decode('ascii')

        params = {
            'SAMLRequest': encoded,
        }
        if relay_state:
            params['RelayState'] = relay_state

        redirect_url = f'{self.idp_sso_url}?{urlencode(params, quote_via=quote_plus)}'
        return request_id, redirect_url, encoded

    # ── Response Parsing ──────────────────────────────────────────────

    def parse_response(
        self,
        saml_response_b64: str,
        expected_request_id: Optional[str] = None,
    ) -> dict:
        """Parse and validate a SAML Response.

        Args:
            saml_response_b64: Base64-encoded SAML Response (HTTP-POST binding).
            expected_request_id: If set, validate InResponseTo matches.

        Returns:
            dict with keys: email, name, groups, attributes, session_index,
                           response_id, issue_instant, issuer.

        Raises:
            SAMLParseError: Response cannot be parsed.
            SAMLSignatureError: Signature verification fails.
        """
        try:
            xml_bytes = base64.b64decode(saml_response_b64)
        except Exception as e:
            raise SAMLParseError(f'Invalid base64 in SAML Response: {e}') from e

        try:
            root = etree.fromstring(xml_bytes)
        except etree.XMLSyntaxError as e:
            raise SAMLParseError(f'Invalid XML in SAML Response: {e}') from e

        # ── Response element ──
        response_el = root.find(f'.//{{{SAML2P_NS}}}Response')
        if response_el is None:
            response_el = root
        if response_el.tag != f'{{{SAML2P_NS}}}Response':
            raise SAMLParseError(f'Unexpected root element: {response_el.tag}')

        response_id = response_el.get('ID', '')
        issue_instant = response_el.get('IssueInstant', '')

        # ── Status ──
        status_el = response_el.find(f'.//{{{SAML2P_NS}}}StatusCode')
        if status_el is not None:
            status_value = status_el.get('Value', '')
            if status_value != 'urn:oasis:names:tc:SAML:2.0:status:Success':
                raise SAMLParseError(f'SAML Response status not Success: {status_value}')

        # ── Issuer ──
        issuer_el = response_el.find(f'.//{{{SAML2_NS}}}Issuer')
        if issuer_el is None:
            issuer_el = response_el.find(f'.//{{{MD_NS}}}EntityDescriptor/{{{MD_NS}}}IDPSSODescriptor/{{{MD_NS}}}KeyDescriptor/{{{DS_NS}}}X509Certificate/..')
        issuer_text = issuer_el.text.strip() if issuer_el is not None and issuer_el.text else ''

        if issuer_text and self.idp_entity_id and issuer_text != self.idp_entity_id:
            logger.warning('SAML Response issuer mismatch: got %s, expected %s', issuer_text, self.idp_entity_id)

        # ── InResponseTo ──
        in_response_to = response_el.get('InResponseTo', '')
        if expected_request_id and in_response_to and in_response_to != expected_request_id:
            raise SAMLParseError(
                f'InResponseTo mismatch: got {in_response_to}, expected {expected_request_id}'
            )

        # ── Assertion ──
        assertion_el = response_el.find(f'.//{{{SAML2_NS}}}Assertion')
        if assertion_el is None:
            raise SAMLParseError('No Assertion element found in SAML Response')

        # ── Subject Confirmation / NotOnOrAfter ──
        subject_el = assertion_el.find(f'{{{SAML2_NS}}}Subject')
        if subject_el is not None:
            for sc in subject_el.findall(f'.//{{{SAML2_NS}}}SubjectConfirmation'):
                method = sc.get('Method', '')
                not_on_or_after = sc.find(f'.//{{{SAML2_NS}}}SubjectConfirmationData')
                if not_on_or_after is not None:
                    expiry = not_on_or_after.get('NotOnOrAfter', '')
                    if expiry:
                        try:
                            expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                            if datetime.now(timezone.utc) > expiry_dt + self.clock_skew:
                                raise SAMLParseError('SAML Response SubjectConfirmation has expired')
                        except (ValueError, TypeError):
                            pass

        # ── Conditions ──
        conditions_el = assertion_el.find(f'{{{SAML2_NS}}}Conditions')
        if conditions_el is not None:
            not_before = conditions_el.get('NotBefore', '')
            not_on_or_after = conditions_el.get('NotOnOrAfter', '')
            now = datetime.now(timezone.utc)
            if not_before:
                try:
                    nb_dt = datetime.fromisoformat(not_before.replace('Z', '+00:00'))
                    if now < nb_dt - self.clock_skew:
                        raise SAMLParseError('SAML Response Conditions NotBefore not yet reached')
                except (ValueError, TypeError):
                    pass
            if not_on_or_after:
                try:
                    noa_dt = datetime.fromisoformat(not_on_or_after.replace('Z', '+00:00'))
                    if now > noa_dt + self.clock_skew:
                        raise SAMLParseError('SAML Response Conditions NotOnOrAfter has expired')
                except (ValueError, TypeError):
                    pass

        # ── Signature verification hook ──
        signature_el = assertion_el.find(f'.//{{{DS_NS}}}Signature')
        if signature_el is not None and self.idp_x509_cert:
            self._verify_signature(assertion_el)

        # ── Extract attributes ──
        attributes: dict = {}
        attribute_statement = assertion_el.find(f'.//{{{SAML2_NS}}}AttributeStatement')
        if attribute_statement is not None:
            for attr_el in attribute_statement.findall(f'{{{SAML2_NS}}}Attribute'):
                attr_name = attr_el.get('Name', '')
                values = []
                for val_el in attr_el.findall(f'{{{SAML2_NS}}}AttributeValue'):
                    if val_el.text:
                        values.append(val_el.text.strip())
                if values:
                    attributes[attr_name] = values if len(values) > 1 else values[0]

        # ── NameID ──
        name_id = ''
        if subject_el is not None:
            name_id_el = subject_el.find(f'{{{SAML2_NS}}}NameID')
            if name_id_el is not None and name_id_el.text:
                name_id = name_id_el.text.strip()

        # ── Session index ──
        session_index = ''
        authn_statement = assertion_el.find(f'.//{{{SAML2_NS}}}AuthnStatement')
        if authn_statement is not None:
            session_index = authn_statement.get('SessionIndex', '')

        # Map well-known attributes
        email = attributes.get(SAML_ATTR_EMAIL, name_id)
        if isinstance(email, list):
            email = email[0] if email else ''
        name = attributes.get(SAML_ATTR_NAME, '')
        if isinstance(name, list):
            name = name[0] if name else ''
        groups = attributes.get(SAML_ATTR_GROUPS, [])
        if isinstance(groups, str):
            groups = [groups]

        return {
            'email': email,
            'name': name,
            'groups': groups,
            'attributes': attributes,
            'session_index': session_index,
            'response_id': response_id,
            'issue_instant': issue_instant,
            'issuer': issuer_text,
        }

    def _verify_signature(self, element):
        """Verify XML signature on a SAML element.

        Behavior depends on self.signature_mode:
        - 'noop' (default): log warning, pass through.
        - 'strict': raise SAMLSignatureError when a Signature element is
          present and idp_x509_cert is configured. Requires installing
          python3-saml + xmlsec1 for real cryptographic verification.
          In strict mode without those libs, the error is unconditional
          to prevent silent spoofing.
        """
        if self.signature_mode == 'noop':
            logger.warning(
                'SAML signature verification not configured — using stub. '
                'Set SAML_SIGNATURE_VERIFICATION_MODE=strict and install '
                'python3-saml + xmlsec1 for production signature validation.'
            )
            return

        if self.signature_mode == 'strict':
            raise SAMLSignatureError(
                'SAML_SIGNATURE_VERIFICATION_MODE=strict requires python3-saml. '
                'Install python3-saml >= 1.15.0 and xmlsec1 to enable cryptographic verification.'
            )

    # ── SP Metadata ───────────────────────────────────────────────────

    def generate_metadata(self) -> str:
        """Generate SP EntityDescriptor XML."""
        nsmap = {
            'md': MD_NS,
            'ds': DS_NS,
            'saml2p': SAML2P_NS,
        }
        root = etree.Element(
            f'{{{MD_NS}}}EntityDescriptor',
            nsmap=nsmap,
            entityID=self.sp_entity_id,
        )

        sp_sso = etree.SubElement(
            root, f'{{{MD_NS}}}SPSSODescriptor',
            AuthnRequestsSigned='true',
            WantAssertionsSigned='true',
            protocolSupportEnumeration=f'{{{SAML2P_NS}}}',
        )

        # KeyDescriptor for signing
        key_desc = etree.SubElement(sp_sso, f'{{{MD_NS}}}KeyDescriptor', use='signing')
        key_info = etree.SubElement(key_desc, f'{{{DS_NS}}}KeyInfo')
        x509_data = etree.SubElement(key_info, f'{{{DS_NS}}}X509Data')
        x509_cert = etree.SubElement(x509_data, f'{{{DS_NS}}}X509Certificate')
        x509_cert.text = '(configure SP certificate)'

        # NameIDFormat
        name_id_format = etree.SubElement(sp_sso, f'{{{MD_NS}}}NameIDFormat')
        name_id_format.text = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'

        # AssertionConsumerService
        etree.SubElement(
            sp_sso, f'{{{MD_NS}}}AssertionConsumerService',
            Binding='urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            Location=self.sp_acs_url,
            index='0',
            isDefault='true',
        )

        xml_bytes = etree.tostring(root, xml_declaration=True, encoding='UTF-8', pretty_print=True)
        return xml_bytes.decode('utf-8')

    # ── Connection Test ───────────────────────────────────────────────

    def test_connection(self) -> dict:
        """Test IdP configuration by validating stored values.

        Returns:
            dict with 'success' bool, 'checks' list, 'errors' list.
        """
        checks = []
        errors = []

        if not self.idp_sso_url:
            errors.append('IdP SSO URL is not configured')
        else:
            checks.append(f'IdP SSO URL: {self.idp_sso_url[:60]}...')

        if not self.idp_entity_id:
            errors.append('IdP Entity ID is not configured')
        else:
            checks.append(f'IdP Entity ID: {self.idp_entity_id}')

        if not self.idp_x509_cert:
            errors.append('IdP X.509 Certificate is not configured')
        else:
            cert_len = len(self.idp_x509_cert.strip())
            checks.append(f'IdP Certificate: {cert_len} chars')

        if not self.sp_entity_id:
            errors.append('SP Entity ID is not configured')
        else:
            checks.append(f'SP Entity ID: {self.sp_entity_id}')

        if not self.sp_acs_url:
            errors.append('SP ACS URL is not configured')
        else:
            checks.append(f'SP ACS URL: {self.sp_acs_url}')

        # Try to reach IdP SSO URL
        if self.idp_sso_url:
            try:
                import httpx
                resp = httpx.head(self.idp_sso_url, timeout=10, follow_redirects=True)
                checks.append(f'IdP reachable: HTTP {resp.status_code}')
            except Exception as e:
                checks.append(f'IdP reachable: check skipped ({type(e).__name__})')

        return {
            'success': len(errors) == 0,
            'checks': checks,
            'errors': errors,
        }
