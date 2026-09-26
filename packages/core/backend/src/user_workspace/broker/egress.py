"""P1-SEC-01: allowlist egress cho endpoint broker (SSRF + credential exfiltration).

VÌ SAO FILE NÀY TỒN TẠI
-----------------------
`base_url` của TCBS là field text tự do (`broker/tcbs.py`) và trước đây được truyền
thẳng vào client (`broker/adapters.py` `_new_client`). Hệ quả: user tự chọn endpoint
⇒ `api_key` (secret) bị gửi tới host do user chỉ định, không có filter nào. Đó là
SSRF kèm credential exfiltration, không phải rủi ro lý thuyết.

NGUYÊN TẮC (fail-closed)
-----------------------
1. Rỗng ⇒ dùng default của provider (client tự lo default nếu không truyền).
2. Sai scheme (không phải https) ⇒ từ chối, trừ loopback + env bật tường minh.
3. URL có userinfo (`https://u:p@host`) ⇒ từ chối (rò credential qua log/proxy).
4. IP literal / loopback / private / link-local (metadata `169.254.169.254`) ⇒ từ chối,
   trừ khi env `BROKER_EGRESS_ALLOW_PRIVATE_IPS` bật tường minh (sandbox nội bộ).
5. Host ngoài allowlist ⇒ từ chối. So khớp là EXACT match, không suffix match —
   nếu dùng suffix lỏng thì `openapi.tcbs.com.vn.attacker.net` lọt.

MỞ RỘNG ALLOWLIST
-----------------
CHỈ qua env server-side (`BROKER_EGRESS_EXTRA_HOSTS="tcbs:host1,ssi:host2"`).
Không có đường nào để client tự thêm host sau khi deploy: allowlist là dữ liệu
server-side, người dùng chỉ chọn trong tập đã duyệt.

Nguồn default host (`docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §E3):
- DNSE `https://openapi.dnse.com.vn` (mục DNSE LightSpeed)
- SSI `https://fc-tradeapi.ssi.com.vn` + `https://fc-tradehub.ssi.com.vn` (FastConnect)
- TCBS `https://openapi.tcbs.com.vn` (cURL chính thức `POST /gaia/v1/oauth2/openapi/token`)
Sandbox/uỷ quyền thứ ba KHÔNG có trong tài liệu ⇒ không đoán, phải khai báo qua env.
"""
from __future__ import annotations

import ipaddress
import os
from urllib.parse import urlsplit

EGRESS_POLICY_VERSION = '2026-09-26.1'

# Code lỗi trả ra ngoài. Message = CODE, không bao giờ echo giá trị người dùng nhập
# (giá trị đó có thể chứa host nội bộ hoặc khoá đã bị rot).
CODE_SCHEME_NOT_ALLOWED = 'broker_egress_scheme_not_allowed'
CODE_INVALID_URL = 'broker_egress_invalid_url'
CODE_UNKNOWN_PROVIDER = 'broker_egress_unknown_provider'
CODE_URL_CREDENTIALS = 'broker_egress_url_credentials_not_allowed'
CODE_IP_LITERAL = 'broker_egress_ip_literal_blocked'
CODE_PRIVATE_ADDRESS = 'broker_egress_private_address_blocked'
CODE_HOST_NOT_ALLOWED = 'broker_egress_host_not_allowed'

# Env server-side (không có đường client nào thêm được host sau deploy).
ENV_EXTRA_HOSTS = 'BROKER_EGRESS_EXTRA_HOSTS'
ENV_ALLOW_PRIVATE_IPS = 'BROKER_EGRESS_ALLOW_PRIVATE_IPS'
ENV_HTTP_LOOPBACK = 'BROKER_EGRESS_ALLOW_HTTP_LOOPBACK'

# provider → default base_url + host được phép.
PROVIDER_EGRESS_POLICY: dict[str, dict] = {
    'dnse': {
        'default_base_url': 'https://openapi.dnse.com.vn',
        'allowed_hosts': frozenset({'openapi.dnse.com.vn'}),
    },
    'ssi': {
        'default_base_url': 'https://fc-tradeapi.ssi.com.vn',
        'allowed_hosts': frozenset({'fc-tradeapi.ssi.com.vn', 'fc-tradehub.ssi.com.vn'}),
    },
    'tcbs': {
        'default_base_url': 'https://openapi.tcbs.com.vn',
        'allowed_hosts': frozenset({'openapi.tcbs.com.vn'}),
    },
}

_LOOPBACK_HOSTNAMES = frozenset({'localhost', 'localhost.localdomain', 'ip6-localhost'})


class EgressPolicyError(Exception):
    """Vi phạm egress policy. `code` là hằng số công khai, không chứa input người dùng."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _env_flag(name: str) -> bool:
    return str(os.environ.get(name, '') or '').strip().lower() in ('1', 'true', 'yes', 'on')


def _loopback_trusted() -> bool:
    """Loopback chỉ được tin khi deploy bật sandbox tường minh (một trong hai cờ)."""
    return _env_flag(ENV_HTTP_LOOPBACK) or _env_flag(ENV_ALLOW_PRIVATE_IPS)


def _extra_hosts(provider: str) -> frozenset[str]:
    """Host bổ sung do server khai báo qua env — theo format `provider:host`."""
    raw = str(os.environ.get(ENV_EXTRA_HOSTS, '') or '')
    hosts = set()
    for item in raw.replace(';', ',').split(','):
        name, _, host = item.strip().partition(':')
        if not host or name.strip().lower() != provider:
            continue
        cleaned = host.strip().lower().rstrip('.')
        if cleaned:
            hosts.add(cleaned)
    return frozenset(hosts)


def allowed_hosts_for(provider: str) -> frozenset[str]:
    """Allowlist hiệu hành của provider (default + env). Trả về copy, không sửa được."""
    policy = PROVIDER_EGRESS_POLICY.get(str(provider or '').strip().lower())
    if policy is None:
        return frozenset()
    return frozenset(policy['allowed_hosts']) | _extra_hosts(str(provider).strip().lower())


def default_base_url(provider: str) -> str:
    """Base URL mặc định của provider. Provider lạ ⇒ raise (fail-closed)."""
    policy = PROVIDER_EGRESS_POLICY.get(str(provider or '').strip().lower())
    if policy is None:
        raise EgressPolicyError(CODE_UNKNOWN_PROVIDER)
    return policy['default_base_url']


def _normalize_host(host: str) -> str:
    return (host or '').strip().lower().rstrip('.')


def _check_ip_literal(host: str) -> bool:
    """Chặn IP literal + dải nội bộ/metadata. Trả True nếu là địa chỉ nội bộ đã được
    deploy tin cậy (chỉ xảy ra khi env sandbox bật tường minh) ⇒ bỏ qua allowlist host.

    Thứ tự code lỗi có chủ đích: dải nội bộ (loopback/private/link-local/metadata) báo
    `private_address_blocked` vì đó mới là lý do bảo mật; IP public báo
    `ip_literal_blocked` vì allowlist chỉ chứa hostname, IP không bao giờ hợp lệ.
    """
    try:
        address = ipaddress.ip_address(host.strip('[]'))
    except ValueError:
        return False  # hostname, không phải IP literal
    internal = (address.is_loopback or address.is_private or address.is_link_local
                or address.is_multicast or address.is_unspecified or address.is_reserved)
    if not internal:
        # IP public: không bao giờ nằm trong allowlist, kể cả khi mở cờ sandbox.
        raise EgressPolicyError(CODE_IP_LITERAL)
    trusted = _loopback_trusted() if address.is_loopback else _env_flag(ENV_ALLOW_PRIVATE_IPS)
    if not trusted:
        raise EgressPolicyError(CODE_PRIVATE_ADDRESS)
    return True


def _check_scheme(scheme: str, host: str) -> None:
    normalized = (scheme or '').strip().lower()
    if normalized == 'https':
        return
    # http chỉ dành cho sandbox loopback, phải bật env tường minh.
    if normalized == 'http' and _env_flag(ENV_HTTP_LOOPBACK):
        bare = _normalize_host(host)
        is_loopback = bare in _LOOPBACK_HOSTNAMES
        if not is_loopback:
            try:
                is_loopback = ipaddress.ip_address(bare.strip('[]')).is_loopback
            except ValueError:
                is_loopback = False
        if is_loopback:
            return
    raise EgressPolicyError(CODE_SCHEME_NOT_ALLOWED)


def validate_base_url(provider: str, base_url: str | None) -> str:
    """Trả base_url đã kiểm (bỏ dấu `/` cuối). Raise EgressPolicyError khi vi phạm.

    Rỗng/None ⇒ trả default của provider (không lỗi). Provider lạ ⇒ luôn raise.
    """
    normalized_provider = str(provider or '').strip().lower()
    policy = PROVIDER_EGRESS_POLICY.get(normalized_provider)
    if policy is None:
        raise EgressPolicyError(CODE_UNKNOWN_PROVIDER)

    raw = str(base_url or '').strip()
    if not raw:
        return policy['default_base_url']

    try:
        parts = urlsplit(raw)
    except ValueError as exc:
        raise EgressPolicyError(CODE_INVALID_URL) from exc

    if not parts.scheme:
        raise EgressPolicyError(CODE_INVALID_URL)
    # Scheme kiểm TRƯỚC netloc: `file:///etc/passwd` có scheme nhưng rỗng netloc,
    # phải báo sai scheme chứ không báo "URL hỏng".
    _check_scheme(parts.scheme, parts.hostname or '')
    # userinfo trong URL = rò secret qua log/proxy/access log
    if parts.username or parts.password or '@' in parts.netloc:
        raise EgressPolicyError(CODE_URL_CREDENTIALS)
    if not parts.netloc:
        raise EgressPolicyError(CODE_INVALID_URL)

    host = _normalize_host(parts.hostname or '')
    if not host:
        raise EgressPolicyError(CODE_INVALID_URL)

    # IP trước allowlist: metadata endpoint bị chặn với đúng lý do dù có trong allowlist.
    # Địa chỉ nội bộ đã được deploy tin cậy thì bỏ qua allowlist hostname (không có hostname).
    if _check_ip_literal(host):
        return raw.rstrip('/')

    # Hostname phải qua allowlist exact match.
    if host not in allowed_hosts_for(normalized_provider):
        raise EgressPolicyError(CODE_HOST_NOT_ALLOWED)

    return raw.rstrip('/')


def resolve_base_url(provider: str, base_url: str | None) -> str:
    """Alias rõ nghĩa cho validate_base_url (dùng ở lớp adapter)."""
    return validate_base_url(provider, base_url)
