"""
Prefetch Time Policy domain config typed schema.
6 profiles: pre_open / market_open / lunch_break / pre_close / post_close / offhours
"""
from dataclasses import dataclass, field
from typing import Any

VALID_PROFILES = frozenset({
    'pre_open', 'market_open', 'lunch_break',
    'pre_close', 'post_close', 'offhours',
})


@dataclass
class PrefetchTimePolicyConfig:
    """Typed config cho Prefetch & Cache scheduling."""

    # Profile hiện tại
    active_profile: str = 'market_open'

    # Interval theo profile (giây)
    pre_open_interval_seconds: int = 120
    market_open_interval_seconds: int = 30
    lunch_break_interval_seconds: int = 300
    pre_close_interval_seconds: int = 30
    post_close_interval_seconds: int = 600
    offhours_interval_seconds: int = 3600

    # Batch settings
    batch_size: int = 50
    max_concurrent_workers: int = 4

    # Symbol universe
    universe_group_ids: list = field(default_factory=list)

    # Cache TTL
    cache_ttl_seconds: int = 25

    # Enable/disable
    enabled: bool = True
    skip_non_trading_days: bool = True

    def validate(self) -> list[str]:
        errors = []
        if self.active_profile not in VALID_PROFILES:
            errors.append(
                f"active_profile '{self.active_profile}' không hợp lệ. "
                f"Phải là một trong: {sorted(VALID_PROFILES)}"
            )
        for profile in VALID_PROFILES:
            attr = f'{profile}_interval_seconds'
            val = getattr(self, attr, None)
            if val is not None and val < 10:
                errors.append(f'{attr} phải >= 10 giây')
        if self.batch_size < 1:
            errors.append('batch_size phải >= 1')
        if self.max_concurrent_workers < 1:
            errors.append('max_concurrent_workers phải >= 1')
        if self.cache_ttl_seconds < 5:
            errors.append('cache_ttl_seconds phải >= 5')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'PrefetchTimePolicyConfig':
        known = set(cls.__dataclass_fields__.keys())
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)

    def get_interval_for_profile(self, profile: str) -> int:
        attr = f'{profile}_interval_seconds'
        return getattr(self, attr, self.offhours_interval_seconds)

    def to_dict(self) -> dict[str, Any]:
        return {
            'active_profile': self.active_profile,
            'pre_open_interval_seconds': self.pre_open_interval_seconds,
            'market_open_interval_seconds': self.market_open_interval_seconds,
            'lunch_break_interval_seconds': self.lunch_break_interval_seconds,
            'pre_close_interval_seconds': self.pre_close_interval_seconds,
            'post_close_interval_seconds': self.post_close_interval_seconds,
            'offhours_interval_seconds': self.offhours_interval_seconds,
            'batch_size': self.batch_size,
            'max_concurrent_workers': self.max_concurrent_workers,
            'universe_group_ids': self.universe_group_ids,
            'cache_ttl_seconds': self.cache_ttl_seconds,
            'enabled': self.enabled,
            'skip_non_trading_days': self.skip_non_trading_days,
        }
