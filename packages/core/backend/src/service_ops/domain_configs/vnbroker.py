"""VNBroker domain config typed schema."""
from dataclasses import dataclass, field
from typing import Any

from ..provider_catalog import (
    get_default_provider_ids,
    get_supported_provider_ids,
    normalize_provider_id,
)

SUPPORTED_VNBROKER_PROVIDERS = frozenset(get_supported_provider_ids('vnbroker'))
DEFAULT_VNBROKER_PREFERRED_PROVIDER = 'vci'


def _normalize_provider_list(provider_ids: list | None) -> list[str]:
    normalized = []
    for provider_id in provider_ids or []:
        normalized_id = normalize_provider_id(provider_id)
        if normalized_id and normalized_id not in normalized:
            normalized.append(normalized_id)
    return normalized


DEFAULT_FALLBACK_PROVIDERS = [
    provider_id
    for provider_id in get_default_provider_ids('vnbroker')
    if provider_id != DEFAULT_VNBROKER_PREFERRED_PROVIDER
]


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


@dataclass
class VnbrokerTimeoutConfig:
    connect: float = 10.0
    read: float = 30.0
    write: float = 10.0
    pool: float = 5.0

    def validate(self) -> list[str]:
        errors = []
        if not _is_number(self.connect) or not (1.0 <= float(self.connect) <= 60.0):
            errors.append('timeout.connect phải trong khoảng [1.0, 60.0]')
        if not _is_number(self.read) or not (5.0 <= float(self.read) <= 300.0):
            errors.append('timeout.read phải trong khoảng [5.0, 300.0]')
        if not _is_number(self.write) or not (1.0 <= float(self.write) <= 60.0):
            errors.append('timeout.write phải trong khoảng [1.0, 60.0]')
        if not _is_number(self.pool) or not (1.0 <= float(self.pool) <= 60.0):
            errors.append('timeout.pool phải trong khoảng [1.0, 60.0]')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'VnbrokerTimeoutConfig':
        payload = dict(data or {})
        return cls(
            connect=payload.get('connect', payload.get('connect_timeout', 10.0)),
            read=payload.get('read', payload.get('read_timeout', 30.0)),
            write=payload.get('write', payload.get('write_timeout', 10.0)),
            pool=payload.get('pool', payload.get('pool_connections', 5.0)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            'connect': self.connect,
            'read': self.read,
            'write': self.write,
            'pool': self.pool,
        }


@dataclass
class VnbrokerProviderConfig:
    """Cấu hình riêng cho từng provider."""
    timeout: VnbrokerTimeoutConfig | None = None
    max_retries: int | None = None
    retry_delay_seconds: float | None = None
    requests_per_minute: int | None = None
    burst_limit: int | None = None

    def validate(self, provider_id: str) -> list[str]:
        errors = []
        if self.timeout:
            errors.extend([f'{provider_id}: {err}' for err in self.timeout.validate()])
        if self.max_retries is not None and (not isinstance(self.max_retries, int) or not (0 <= self.max_retries <= 10)):
            errors.append(f'{provider_id}: max_retries phải trong khoảng [0, 10]')
        if self.retry_delay_seconds is not None and (not _is_number(self.retry_delay_seconds) or float(self.retry_delay_seconds) < 0):
            errors.append(f'{provider_id}: retry_delay_seconds phải >= 0')
        if self.requests_per_minute is not None and (not isinstance(self.requests_per_minute, int) or self.requests_per_minute < 1):
            errors.append(f'{provider_id}: requests_per_minute phải >= 1')
        if self.burst_limit is not None and (not isinstance(self.burst_limit, int) or self.burst_limit < 1):
            errors.append(f'{provider_id}: burst_limit phải >= 1')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'VnbrokerProviderConfig':
        if not data:
            return cls()
        payload = dict(data or {})
        timeout_payload = payload.get('timeout')
        return cls(
            timeout=VnbrokerTimeoutConfig.from_dict(timeout_payload) if timeout_payload else None,
            max_retries=payload.get('max_retries'),
            retry_delay_seconds=payload.get('retry_delay_seconds'),
            requests_per_minute=payload.get('requests_per_minute'),
            burst_limit=payload.get('burst_limit'),
        )

    def to_dict(self) -> dict[str, Any] | None:
        result = {}
        if self.timeout:
            result['timeout'] = self.timeout.to_dict()
        if self.max_retries is not None:
            result['max_retries'] = self.max_retries
        if self.retry_delay_seconds is not None:
            result['retry_delay_seconds'] = self.retry_delay_seconds
        if self.requests_per_minute is not None:
            result['requests_per_minute'] = self.requests_per_minute
        if self.burst_limit is not None:
            result['burst_limit'] = self.burst_limit
        return result if result else None


@dataclass
class VnbrokerDomainConfig:
    """Typed config cho VNBroker data adapter."""

    timeout: VnbrokerTimeoutConfig = field(default_factory=VnbrokerTimeoutConfig)
    max_retries: int = 3
    retry_delay_seconds: float = 2.0

    # Per-provider overrides
    per_provider_config: dict[str, VnbrokerProviderConfig] = field(default_factory=dict)

    # Providers
    preferred_provider: str = DEFAULT_VNBROKER_PREFERRED_PROVIDER
    fallback_providers: list[str] = field(default_factory=lambda: list(DEFAULT_FALLBACK_PROVIDERS))
    enabled: bool = True

    # Circuit breaker
    circuit_breaker_threshold: int = 5
    circuit_breaker_window_seconds: int = 60
    circuit_breaker_cooldown_seconds: int = 300

    # Rate limiting
    requests_per_minute: int = 60
    burst_limit: int = 10

    def validate(self) -> list[str]:
        """Trả về danh sách lỗi; list rỗng = valid."""
        errors = self.timeout.validate()
        for provider_id, provider_cfg in self.per_provider_config.items():
            errors.extend(provider_cfg.validate(provider_id))
        if not isinstance(self.max_retries, int) or not (0 <= self.max_retries <= 10):
            errors.append('max_retries phải trong khoảng [0, 10]')
        if not _is_number(self.retry_delay_seconds) or float(self.retry_delay_seconds) < 0:
            errors.append('retry_delay_seconds phải >= 0')
        if self.preferred_provider not in SUPPORTED_VNBROKER_PROVIDERS:
            errors.append(f"preferred_provider '{self.preferred_provider}' không hợp lệ")
        invalid_fallbacks = [
            provider_id
            for provider_id in self.fallback_providers
            if provider_id not in SUPPORTED_VNBROKER_PROVIDERS
        ]
        if invalid_fallbacks:
            errors.append(
                'fallback_providers không hợp lệ: ' + ', '.join(invalid_fallbacks)
            )
        if self.preferred_provider in self.fallback_providers:
            errors.append('fallback_providers không được chứa preferred_provider')
        if self.circuit_breaker_threshold < 1:
            errors.append('circuit_breaker_threshold phải >= 1')
        if self.requests_per_minute < 1:
            errors.append('requests_per_minute phải >= 1')
        if self.burst_limit < 1:
            errors.append('burst_limit phải >= 1')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'VnbrokerDomainConfig':
        payload = dict(data or {})
        timeout_payload = payload.get('timeout') if isinstance(payload.get('timeout'), dict) else payload
        preferred_provider = normalize_provider_id(
            payload.get('preferred_provider', payload.get('primary_provider', DEFAULT_VNBROKER_PREFERRED_PROVIDER))
        )
        fallback_providers = _normalize_provider_list(payload.get('fallback_providers'))
        if not fallback_providers:
            fallback_providers = [
                provider_id
                for provider_id in DEFAULT_FALLBACK_PROVIDERS
                if provider_id != preferred_provider
            ]

        return cls(
            timeout=VnbrokerTimeoutConfig.from_dict(timeout_payload),
            max_retries=payload.get('max_retries', 3),
            retry_delay_seconds=payload.get('retry_delay_seconds', payload.get('retry_backoff_factor', 2.0)),
            circuit_breaker_threshold=payload.get('circuit_breaker_threshold', 5),
            circuit_breaker_window_seconds=payload.get('circuit_breaker_window_seconds', 60),
            circuit_breaker_cooldown_seconds=payload.get('circuit_breaker_cooldown_seconds', 300),
            preferred_provider=preferred_provider or DEFAULT_VNBROKER_PREFERRED_PROVIDER,
            fallback_providers=fallback_providers,
            enabled=payload.get('enabled', True),
            requests_per_minute=payload.get('requests_per_minute', 60),
            burst_limit=payload.get('burst_limit', 10),
            per_provider_config={
                provider_id: VnbrokerProviderConfig.from_dict(cfg_dict)
                for provider_id, cfg_dict in (payload.get('per_provider_config') or {}).items()
            },
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            'timeout': self.timeout.to_dict(),
            'max_retries': self.max_retries,
            'retry_delay_seconds': self.retry_delay_seconds,
            'preferred_provider': self.preferred_provider,
            'fallback_providers': self.fallback_providers,
            'enabled': self.enabled,
            'circuit_breaker_threshold': self.circuit_breaker_threshold,
            'circuit_breaker_window_seconds': self.circuit_breaker_window_seconds,
            'circuit_breaker_cooldown_seconds': self.circuit_breaker_cooldown_seconds,
            'requests_per_minute': self.requests_per_minute,
            'burst_limit': self.burst_limit,
            'per_provider_config': {
                provider_id: cfg.to_dict()
                for provider_id, cfg in self.per_provider_config.items()
                if cfg.to_dict()
            },
        }
