"""Typed runtime config for the market-data SSOT queue tiers."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class QueueTierRuntimeConfig:
    poll_interval_seconds: int = 300
    max_batch_size: int = 100

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any] | None,
        *,
        default: 'QueueTierRuntimeConfig | None' = None,
    ) -> 'QueueTierRuntimeConfig':
        baseline = default or cls()
        payload = data if isinstance(data, dict) else {}
        return cls(
            poll_interval_seconds=int(payload.get('poll_interval_seconds', baseline.poll_interval_seconds) or baseline.poll_interval_seconds),
            max_batch_size=int(payload.get('max_batch_size', baseline.max_batch_size) or baseline.max_batch_size),
        )

    def validate(self, field_prefix: str) -> list[str]:
        errors: list[str] = []
        if self.poll_interval_seconds < 10:
            errors.append(f'{field_prefix}.poll_interval_seconds phải >= 10 giây')
        if self.max_batch_size < 1:
            errors.append(f'{field_prefix}.max_batch_size phải >= 1')
        return errors

    def to_dict(self) -> dict[str, int]:
        return {
            'poll_interval_seconds': self.poll_interval_seconds,
            'max_batch_size': self.max_batch_size,
        }


@dataclass
class MarketDataRuntimeConfig:
    decay_days: int = 7
    hot_user_demand: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(poll_interval_seconds=30, max_batch_size=50)
    )
    warm_liquid_market: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(poll_interval_seconds=120, max_batch_size=100)
    )
    cold_full_market: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(poll_interval_seconds=900, max_batch_size=200)
    )
    recovery_backlog: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(poll_interval_seconds=600, max_batch_size=50)
    )

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'MarketDataRuntimeConfig':
        payload = data if isinstance(data, dict) else {}
        defaults = cls()
        decay_days = int(payload.get('decay_days', defaults.decay_days) or defaults.decay_days)
        return cls(
            decay_days=decay_days,
            hot_user_demand=QueueTierRuntimeConfig.from_dict(
                payload.get('hot_user_demand'),
                default=defaults.hot_user_demand,
            ),
            warm_liquid_market=QueueTierRuntimeConfig.from_dict(
                payload.get('warm_liquid_market'),
                default=defaults.warm_liquid_market,
            ),
            cold_full_market=QueueTierRuntimeConfig.from_dict(
                payload.get('cold_full_market'),
                default=defaults.cold_full_market,
            ),
            recovery_backlog=QueueTierRuntimeConfig.from_dict(
                payload.get('recovery_backlog'),
                default=defaults.recovery_backlog,
            ),
        )

    def validate(self) -> list[str]:
        errors: list[str] = []
        if self.decay_days < 1:
            errors.append('decay_days phải >= 1')
        errors.extend(self.hot_user_demand.validate('hot_user_demand'))
        errors.extend(self.warm_liquid_market.validate('warm_liquid_market'))
        errors.extend(self.cold_full_market.validate('cold_full_market'))
        errors.extend(self.recovery_backlog.validate('recovery_backlog'))
        return errors

    def to_dict(self) -> dict[str, Any]:
        return {
            'decay_days': self.decay_days,
            'hot_user_demand': self.hot_user_demand.to_dict(),
            'warm_liquid_market': self.warm_liquid_market.to_dict(),
            'cold_full_market': self.cold_full_market.to_dict(),
            'recovery_backlog': self.recovery_backlog.to_dict(),
        }