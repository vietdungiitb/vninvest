"""B2.1: Broker system config typed schema (mức hệ thống).

Mẫu: domain_configs/vnbroker.py (VnbrokerDomainConfig) — validate/to_dict/from_dict.
Lưu trữ: tái dùng ServiceConfig versioned (service_key 'broker_config', is_current),
audit qua ConfigChangeAudit. Không tạo model mới.
"""
from dataclasses import dataclass, field
from typing import Any

BROKER_CONFIG_SERVICE_KEY = 'broker_config'

SUPPORTED_BROKER_PROVIDERS = ('dnse', 'ssi', 'tcbs')

VALID_PURPOSES = ('backfill', 'snapshot', 'signal')

# Mapping purpose → provider mặc định (§4.4 DE_XUAT, chốt D4).
DEFAULT_PURPOSE_PROVIDER = {
    'backfill': 'dnse',
    'snapshot': 'ssi',
    'signal': 'dnse',
}


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


@dataclass
class BrokerTimeoutConfig:
    connect: float = 10.0
    read: float = 30.0

    def validate(self) -> list[str]:
        errors = []
        if not _is_number(self.connect) or not (1.0 <= float(self.connect) <= 60.0):
            errors.append('timeout.connect phải trong khoảng [1.0, 60.0]')
        if not _is_number(self.read) or not (5.0 <= float(self.read) <= 300.0):
            errors.append('timeout.read phải trong khoảng [5.0, 300.0]')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'BrokerTimeoutConfig':
        payload = dict(data or {})
        return cls(
            connect=payload.get('connect', 10.0),
            read=payload.get('read', 30.0),
        )

    def to_dict(self) -> dict[str, Any]:
        return {'connect': self.connect, 'read': self.read}


@dataclass
class BrokerProviderEntry:
    """Cấu hình hệ thống cho một broker provider."""

    enabled: bool = True
    routing_order: int = 0
    timeout: BrokerTimeoutConfig | None = None
    max_retries: int = 3
    requests_per_minute: int = 60
    burst_limit: int = 10
    purpose_allowlist: list[str] = field(default_factory=list)

    def validate(self, provider_id: str) -> list[str]:
        errors = []
        if self.timeout:
            errors.extend([f'{provider_id}: {err}' for err in self.timeout.validate()])
        if not isinstance(self.max_retries, int) or not (0 <= self.max_retries <= 10):
            errors.append(f'{provider_id}: max_retries phải trong khoảng [0, 10]')
        if not isinstance(self.requests_per_minute, int) or self.requests_per_minute < 1:
            errors.append(f'{provider_id}: requests_per_minute phải >= 1')
        if not isinstance(self.burst_limit, int) or self.burst_limit < 1:
            errors.append(f'{provider_id}: burst_limit phải >= 1')
        if not isinstance(self.routing_order, int) or self.routing_order < 0:
            errors.append(f'{provider_id}: routing_order phải >= 0')
        unknown = [p for p in self.purpose_allowlist if p not in VALID_PURPOSES]
        if unknown:
            errors.append(f'{provider_id}: purpose không hợp lệ: ' + ', '.join(unknown))
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'BrokerProviderEntry':
        payload = dict(data or {})
        timeout_payload = payload.get('timeout')
        purposes = payload.get('purpose_allowlist') or []
        return cls(
            enabled=payload.get('enabled', True),
            routing_order=payload.get('routing_order', 0),
            timeout=BrokerTimeoutConfig.from_dict(timeout_payload) if timeout_payload else None,
            max_retries=payload.get('max_retries', 3),
            requests_per_minute=payload.get('requests_per_minute', 60),
            burst_limit=payload.get('burst_limit', 10),
            purpose_allowlist=[str(p) for p in purposes if str(p) in VALID_PURPOSES],
        )

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            'enabled': self.enabled,
            'routing_order': self.routing_order,
            'max_retries': self.max_retries,
            'requests_per_minute': self.requests_per_minute,
            'burst_limit': self.burst_limit,
            'purpose_allowlist': list(self.purpose_allowlist),
        }
        if self.timeout:
            result['timeout'] = self.timeout.to_dict()
        return result


@dataclass
class BrokerSystemConfig:
    """Typed config hệ thống cho brokerage (3 providers + global guards)."""

    entries: dict[str, BrokerProviderEntry] = field(default_factory=dict)
    kill_switch_write: bool = False
    quiet_hours_start: str = '17:00'
    quiet_hours_end: str = '08:30'

    def validate(self) -> list[str]:
        """Trả về danh sách lỗi; rỗng = valid."""
        errors = []
        for provider_id, entry in self.entries.items():
            if provider_id not in SUPPORTED_BROKER_PROVIDERS:
                errors.append(f"provider '{provider_id}' không hỗ trợ (dnse/ssi/tcbs)")
                continue
            errors.extend(entry.validate(provider_id))
        # Mỗi purpose phải có ≥1 provider enabled được phép
        for purpose in VALID_PURPOSES:
            ok = any(
                e.enabled and purpose in e.purpose_allowlist
                for e in self.entries.values()
            )
            if not ok:
                errors.append(f"purpose '{purpose}' không có provider enabled nào phục vụ")
        # routing_order không trùng giữa các provider enabled
        orders = [
            e.routing_order for e in self.entries.values() if e.enabled
        ]
        if len(orders) != len(set(orders)):
            errors.append('routing_order bị trùng giữa các provider enabled')
        for label, value in (('quiet_hours_start', self.quiet_hours_start),
                             ('quiet_hours_end', self.quiet_hours_end)):
            parts = str(value).split(':')
            if (len(parts) != 2 or not all(p.isdigit() for p in parts)
                    or not (0 <= int(parts[0]) <= 23) or not (0 <= int(parts[1]) <= 59)):
                errors.append(f'{label} phải dạng HH:MM')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'BrokerSystemConfig':
        payload = dict(data or {})
        raw_entries = payload.get('entries') or {}
        return cls(
            entries={
                provider_id: BrokerProviderEntry.from_dict(cfg)
                for provider_id, cfg in raw_entries.items()
            } or default_entries(),
            kill_switch_write=bool(payload.get('kill_switch_write', False)),
            quiet_hours_start=str(payload.get('quiet_hours_start', '17:00')),
            quiet_hours_end=str(payload.get('quiet_hours_end', '08:30')),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            'entries': {
                provider_id: entry.to_dict()
                for provider_id, entry in self.entries.items()
            },
            'kill_switch_write': self.kill_switch_write,
            'quiet_hours_start': self.quiet_hours_start,
            'quiet_hours_end': self.quiet_hours_end,
        }

    def provider_for_purpose(self, purpose: str) -> str | None:
        """Provider enabled có routing_order nhỏ nhất phục vụ purpose (D4)."""
        candidates = [
            (entry.routing_order, provider_id)
            for provider_id, entry in self.entries.items()
            if entry.enabled and purpose in entry.purpose_allowlist
        ]
        if not candidates:
            return None
        return sorted(candidates)[0][1]


def default_entries() -> dict[str, BrokerProviderEntry]:
    """Defaults §4.4: DNSE backfill, SSI snapshot (market-only), TCBS dự phòng."""
    return {
        'dnse': BrokerProviderEntry(
            enabled=True, routing_order=0,
            purpose_allowlist=['backfill', 'signal'],
        ),
        'ssi': BrokerProviderEntry(
            enabled=True, routing_order=1,
            purpose_allowlist=['snapshot'],
        ),
        'tcbs': BrokerProviderEntry(
            enabled=True, routing_order=2,
            purpose_allowlist=['snapshot'],
        ),
    }


def get_default_broker_system_config() -> BrokerSystemConfig:
    return BrokerSystemConfig(entries=default_entries())
