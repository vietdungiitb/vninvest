"""
ServiceOwnershipMatrix — SSOT ownership cho 5 domains của SOC.

Constants được copy từ admin_ops (không import để tránh circular dep).
Frontend derive write capability từ can_apply.
"""
from typing import Any

# ── Writable modes (bản sao từ SignalControlCenter.jsx) ──────────────────────
WRITABLE_MODES = frozenset({
    'canonical', 'native-write', 'bridge-write',
    'write-through', 'write-enabled', 'direct-writer',
})

SOC_APPLY_MODES = frozenset({
    'canonical', 'native-write', 'write-through', 'write-enabled', 'direct-writer',
})

# ── Ownership records mặc định cho 5 domain của SOC ──────────────────────────
# Copy constant từ admin_ops/views.py — không import
DEFAULT_DOMAIN_OWNERSHIP: dict[str, dict[str, Any]] = {
    'vnbroker': {
        'mode': 'native-write',
        'owner_team': 'core',
        'write_surface': 'service_ops',
        'can_apply': True,
        'locked_fields': [],
        'compatibility_domains': [],
    },
    'prefetch': {
        'mode': 'native-write',
        'owner_team': 'core',
        'write_surface': 'service_ops',
        'can_apply': True,
        'locked_fields': [],
        'compatibility_domains': [],
    },
    'signals': {
        'mode': 'bridge-write',
        'owner_team': 'signal_intelligence',
        'write_surface': 'signal_intelligence app (global_signal_policy_helpers.py)',
        'can_apply': False,
        'locked_fields': [
            'whale_threshold_vnd',
            'dark_pool_threshold_vnd',
            'universe_group_ids',
        ],
        'compatibility_domains': ['admin_ops'],
        'write_block_message': (
            'Cấu hình tín hiệu được quản lý bởi signal_intelligence. '
            'SOC không thể ghi trực tiếp. '
            'Vui lòng dùng Signal Control Center trong Admin Ops.'
        ),
    },
    'screener': {
        'mode': 'native-write',
        'owner_team': 'core',
        'write_surface': 'service_ops',
        'can_apply': True,
        'locked_fields': [],
        'compatibility_domains': [],
    },
    'matrix': {
        'mode': 'native-write',
        'owner_team': 'core',
        'write_surface': 'service_ops',
        'can_apply': True,
        'locked_fields': [],
        'compatibility_domains': [],
    },
    'dataops_market_data': {
        'mode': 'native-write',
        'owner_team': 'core',
        'write_surface': 'service_ops',
        'can_apply': True,
        'locked_fields': [],
        'compatibility_domains': ['matrix'],
    },
}


class ServiceOwnershipMatrix:
    """
    Quản lý ownership record cho các domain của SOC.

    Sử dụng DEFAULT_DOMAIN_OWNERSHIP làm baseline; có thể override
    từ DB (OwnershipRecord) trong runtime.
    """

    def __init__(self, overrides: 'dict[str, dict] | None' = None):
        self._records: dict[str, dict[str, Any]] = dict(DEFAULT_DOMAIN_OWNERSHIP)
        if overrides:
            for domain, record in overrides.items():
                self._records[domain] = record

    def is_domain_writable(self, domain: str) -> bool:
        """Trả True nếu SOC có quyền ghi vào domain này."""
        record = self._records.get(domain, {})
        return record.get('mode', '') in WRITABLE_MODES and record.get('can_apply', False)

    def get_write_block_reason(self, domain: str) -> 'str | None':
        """
        Trả None nếu domain có thể ghi.
        Trả string message tiếng Việt nếu bị block.
        """
        if self.is_domain_writable(domain):
            return None
        record = self._records.get(domain)
        if record is None:
            return f"Domain '{domain}' không được nhận dạng trong ownership matrix."
        custom_msg = record.get('write_block_message', '')
        if custom_msg:
            return custom_msg
        mode = record.get('mode', 'unknown')
        owner = record.get('owner_team', 'không xác định')
        surface = record.get('write_surface', 'không xác định')
        return (
            f"Domain '{domain}' có chế độ {mode}. "
            f"Chủ sở hữu: {owner}. "
            f"Bề mặt ghi: {surface}."
        )

    def get_domain_ownership(self, domain: str) -> 'dict[str, Any] | None':
        """Trả ownership record cho domain, hoặc None nếu không tìm thấy."""
        return self._records.get(domain)

    def all_domains(self) -> list[str]:
        return list(self._records.keys())

    def to_response_dict(self, domain: str) -> dict[str, Any]:
        """Trả dict dùng trong API response (loại bỏ trường nội bộ)."""
        record = self._records.get(domain, {})
        return {
            'domain': domain,
            'mode': record.get('mode', 'unknown'),
            'writer': record.get('write_surface', '') or record.get('owner_team', ''),
            'owner_team': record.get('owner_team', ''),
            'write_surface': record.get('write_surface', ''),
            'can_apply': record.get('can_apply', False),
            'locked_fields': record.get('locked_fields', []),
            'compatibility_domains': record.get('compatibility_domains', []),
        }


# Singleton cho toàn app — override bằng DB nếu cần
_default_matrix = ServiceOwnershipMatrix()


def get_ownership_matrix() -> ServiceOwnershipMatrix:
    """Factory function — trả singleton mặc định."""
    return _default_matrix


def build_ownership_matrix_from_db() -> ServiceOwnershipMatrix:
    """
    Xây dựng matrix từ OwnershipRecord DB.
    Dùng khi muốn runtime override (thường trong views).
    """
    from .models import OwnershipRecord
    overrides: dict[str, dict] = {}
    for rec in OwnershipRecord.objects.all():
        overrides[rec.domain] = {
            'mode': rec.write_mode,
            'owner_team': rec.owner_team,
            'write_surface': rec.write_surface,
            'can_apply': rec.write_mode in SOC_APPLY_MODES,
            'locked_fields': rec.locked_fields or [],
            'compatibility_domains': rec.compatibility_domains or [],
        }
    if overrides:
        return ServiceOwnershipMatrix(overrides=overrides)
    return _default_matrix
