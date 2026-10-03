"""
Global Screener domain config typed schema.
Rules list + validation.
"""
from dataclasses import dataclass, field
from typing import Any


VALID_RULE_TYPES = frozenset({
    'price_change_pct', 'volume_spike_ratio', 'cvd_threshold',
    'whale_count', 'dark_pool_ratio', 'rsi_level',
    'ma_cross', 'bollinger_band_break', 'custom',
})


@dataclass
class ScreenerDomainConfig:
    """Typed config cho Global Screener service."""

    # Rules
    rules: list = field(default_factory=list)

    # Scheduling
    enabled: bool = True
    scan_interval_seconds: int = 60
    max_symbols_per_scan: int = 2000

    # Alerting
    alert_cooldown_seconds: int = 300
    max_alerts_per_symbol_per_hour: int = 5

    # Output
    result_retention_hours: int = 24
    publish_to_redis: bool = True
    redis_channel_prefix: str = 'screener:results:'

    def validate(self) -> list[str]:
        errors = []
        for i, rule in enumerate(self.rules):
            rule_type = rule.get('type', '')
            if rule_type not in VALID_RULE_TYPES:
                errors.append(
                    f"Rule[{i}].type '{rule_type}' không hợp lệ. "
                    f"Phải là một trong: {sorted(VALID_RULE_TYPES)}"
                )
            if 'threshold' not in rule and 'value' not in rule:
                errors.append(f"Rule[{i}] phải có 'threshold' hoặc 'value'")
        if self.scan_interval_seconds < 10:
            errors.append('scan_interval_seconds phải >= 10')
        if self.max_symbols_per_scan < 1:
            errors.append('max_symbols_per_scan phải >= 1')
        if self.alert_cooldown_seconds < 30:
            errors.append('alert_cooldown_seconds phải >= 30')
        if self.result_retention_hours < 1:
            errors.append('result_retention_hours phải >= 1')
        if self.redis_channel_prefix and not self.redis_channel_prefix.endswith(':'):
            errors.append("redis_channel_prefix phải kết thúc bằng ':'")
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'ScreenerDomainConfig':
        known = set(cls.__dataclass_fields__.keys())
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)

    def to_dict(self) -> dict[str, Any]:
        return {
            'rules': self.rules,
            'enabled': self.enabled,
            'scan_interval_seconds': self.scan_interval_seconds,
            'max_symbols_per_scan': self.max_symbols_per_scan,
            'alert_cooldown_seconds': self.alert_cooldown_seconds,
            'max_alerts_per_symbol_per_hour': self.max_alerts_per_symbol_per_hour,
            'result_retention_hours': self.result_retention_hours,
            'publish_to_redis': self.publish_to_redis,
            'redis_channel_prefix': self.redis_channel_prefix,
        }
