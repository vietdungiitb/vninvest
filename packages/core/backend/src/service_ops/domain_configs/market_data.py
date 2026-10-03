"""Typed runtime config for the market-data SSOT queue tiers."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class QueueTierRuntimeConfig:
    poll_interval_seconds: int = 300
    max_batch_size: int = 100
    max_dispatch_per_cycle: int = 100

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
            max_dispatch_per_cycle=int(
                payload.get('max_dispatch_per_cycle', baseline.max_dispatch_per_cycle)
                or baseline.max_dispatch_per_cycle
            ),
        )

    def validate(self, field_prefix: str) -> list[str]:
        errors: list[str] = []
        if self.poll_interval_seconds < 10:
            errors.append(f'{field_prefix}.poll_interval_seconds phải >= 10 giây')
        if self.poll_interval_seconds > 3600:
            errors.append(f'{field_prefix}.poll_interval_seconds phải <= 3600 giây (1 giờ)')
        if self.max_batch_size < 1:
            errors.append(f'{field_prefix}.max_batch_size phải >= 1')
        if self.max_batch_size > 500:
            errors.append(f'{field_prefix}.max_batch_size phải <= 500')
        if self.max_dispatch_per_cycle < 1:
            errors.append(f'{field_prefix}.max_dispatch_per_cycle phải >= 1')
        if self.max_dispatch_per_cycle > 1000:
            errors.append(f'{field_prefix}.max_dispatch_per_cycle phải <= 1000')
        return errors

    def to_dict(self) -> dict[str, int]:
        return {
            'poll_interval_seconds': self.poll_interval_seconds,
            'max_batch_size': self.max_batch_size,
            'max_dispatch_per_cycle': self.max_dispatch_per_cycle,
        }


@dataclass
class MarketDataRuntimeConfig:
    decay_days: int = 7
    parity_snapshot_retention_days: int = 30
    hot_user_demand: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(
            poll_interval_seconds=30,
            max_batch_size=50,
            max_dispatch_per_cycle=50,
        )
    )
    warm_liquid_market: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(
            poll_interval_seconds=120,
            max_batch_size=50,
            max_dispatch_per_cycle=50,
        )
    )
    cold_full_market: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(
            poll_interval_seconds=900,
            max_batch_size=200,
            max_dispatch_per_cycle=200,
        )
    )
    recovery_backlog: QueueTierRuntimeConfig = field(
        default_factory=lambda: QueueTierRuntimeConfig(
            poll_interval_seconds=600,
            max_batch_size=50,
            max_dispatch_per_cycle=50,
        )
    )

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> 'MarketDataRuntimeConfig':
        payload = data if isinstance(data, dict) else {}
        defaults = cls()
        decay_days = int(payload.get('decay_days', defaults.decay_days) or defaults.decay_days)
        parity_snapshot_retention_days = int(
            payload.get('parity_snapshot_retention_days', defaults.parity_snapshot_retention_days)
            or defaults.parity_snapshot_retention_days
        )
        return cls(
            decay_days=decay_days,
            parity_snapshot_retention_days=parity_snapshot_retention_days,
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
        if self.decay_days > 365:
            errors.append('decay_days phải <= 365')
        if self.parity_snapshot_retention_days < 1:
            errors.append('parity_snapshot_retention_days phải >= 1')
        if self.parity_snapshot_retention_days > 365:
            errors.append('parity_snapshot_retention_days phải <= 365')
        tiers = (
            ('hot_user_demand', self.hot_user_demand),
            ('warm_liquid_market', self.warm_liquid_market),
            ('cold_full_market', self.cold_full_market),
            ('recovery_backlog', self.recovery_backlog),
        )
        for field_prefix, tier in tiers:
            errors.extend(tier.validate(field_prefix))
            if tier.max_dispatch_per_cycle > tier.max_batch_size * 2:
                errors.append(
                    f'{field_prefix}.max_dispatch_per_cycle không nên vượt quá '
                    f'{tier.max_batch_size * 2} (= max_batch_size × 2, hiện {tier.max_dispatch_per_cycle})'
                )
        return errors

    def to_dict(self) -> dict[str, Any]:
        return {
            'decay_days': self.decay_days,
            'parity_snapshot_retention_days': self.parity_snapshot_retention_days,
            'hot_user_demand': self.hot_user_demand.to_dict(),
            'warm_liquid_market': self.warm_liquid_market.to_dict(),
            'cold_full_market': self.cold_full_market.to_dict(),
            'recovery_backlog': self.recovery_backlog.to_dict(),
        }

    @classmethod
    def get_schema(cls) -> list[dict[str, Any]]:
        """Schema động (C6 — CFG-09): defaults & bounds khớp từng trường, FE render form theo đây."""
        defaults = cls()
        tier_bounds = [
            ('hot_user_demand', defaults.hot_user_demand),
            ('warm_liquid_market', defaults.warm_liquid_market),
            ('cold_full_market', defaults.cold_full_market),
            ('recovery_backlog', defaults.recovery_backlog),
        ]
        fields: list[dict[str, Any]] = [
            {'key': 'decay_days', 'type': 'int', 'min': 1, 'max': 365, 'default': defaults.decay_days,
             'help': 'Số ngày giữ dữ liệu thị trường tươi cho phân tích chuỗi khoảng giá.'},
            {'key': 'parity_snapshot_retention_days', 'type': 'int', 'min': 1, 'max': 365, 'default': defaults.parity_snapshot_retention_days,
             'help': 'Số ngày giữ snapshot cross-check giữa core và nhà môi giới.'},
        ]
        for tier_key, tier in tier_bounds:
            fields.extend([
                {'key': f'{tier_key}.poll_interval_seconds', 'type': 'int', 'min': 10, 'max': 3600,
                 'default': tier.poll_interval_seconds, 'help': 'Chu kỳ quét (giây) cho tầng này.'},
                {'key': f'{tier_key}.max_batch_size', 'type': 'int', 'min': 1, 'max': 500,
                 'default': tier.max_batch_size, 'help': 'Số tối đa symbols mỗi chu kỳ.'},
                {'key': f'{tier_key}.max_dispatch_per_cycle', 'type': 'int', 'min': 1, 'max': 1000,
                 'default': tier.max_dispatch_per_cycle, 'help': 'Số lệnh điều phối tối đa mỗi chu kỳ (không quá 2× batch).'},
            ])
        return fields