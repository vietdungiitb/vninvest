"""
VNBroker domain config typed schema.
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class VnbrokerDomainConfig:
    """Typed config cho VNBroker data adapter."""

    # Timeout settings
    connect_timeout: float = 5.0
    read_timeout: float = 30.0
    pool_connections: int = 5
    max_retries: int = 3
    retry_backoff_factor: float = 0.5

    # Providers
    primary_provider: str = 'vci'
    fallback_providers: list = field(default_factory=lambda: ['tcbs', 'ssi'])
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
        errors = []
        if self.connect_timeout <= 0:
            errors.append('connect_timeout phải > 0')
        if self.read_timeout <= 0:
            errors.append('read_timeout phải > 0')
        if self.pool_connections < 1:
            errors.append('pool_connections phải >= 1')
        if self.max_retries < 0:
            errors.append('max_retries phải >= 0')
        if self.primary_provider not in ('vci', 'tcbs', 'ssi', 'wifeed'):
            errors.append(f"primary_provider '{self.primary_provider}' không hợp lệ")
        if self.circuit_breaker_threshold < 1:
            errors.append('circuit_breaker_threshold phải >= 1')
        if self.requests_per_minute < 1:
            errors.append('requests_per_minute phải >= 1')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'VnbrokerDomainConfig':
        known = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)

    def to_dict(self) -> dict[str, Any]:
        return {
            'connect_timeout': self.connect_timeout,
            'read_timeout': self.read_timeout,
            'pool_connections': self.pool_connections,
            'max_retries': self.max_retries,
            'retry_backoff_factor': self.retry_backoff_factor,
            'primary_provider': self.primary_provider,
            'fallback_providers': self.fallback_providers,
            'enabled': self.enabled,
            'circuit_breaker_threshold': self.circuit_breaker_threshold,
            'circuit_breaker_window_seconds': self.circuit_breaker_window_seconds,
            'circuit_breaker_cooldown_seconds': self.circuit_breaker_cooldown_seconds,
            'requests_per_minute': self.requests_per_minute,
            'burst_limit': self.burst_limit,
        }
