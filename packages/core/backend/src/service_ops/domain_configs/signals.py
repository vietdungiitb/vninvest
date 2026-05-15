"""
Signal Intelligence domain config typed schema.
Whale / dark_pool / screener detection + retention policies.
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SignalServicesDomainConfig:
    """
    Typed config cho Signal Intelligence services.

    NOTE: domain signals có write_mode=bridge-write → SOC không thể áp dụng
    config này trực tiếp. Đây là read/preview-only từ góc nhìn SOC.
    """

    # Whale detection
    whale_threshold_vnd: int = 500_000_000  # 500 triệu VNĐ
    whale_top_pct: float = 0.10  # Top 10%
    whale_enabled: bool = True

    # Dark pool detection
    dark_pool_threshold_vnd: int = 1_000_000_000  # 1 tỷ VNĐ
    dark_pool_block_ratio_min: float = 0.05
    dark_pool_enabled: bool = True

    # Screener signals
    screener_signal_enabled: bool = True
    screener_signal_cooldown_seconds: int = 300

    # Retention
    # SOC-T06 policy: intraday ticks are hot/short-lived staging data — minimum 7 days.
    intraday_tick_retention_days: int = 7
    canonical_event_retention_days: int = 365
    bucket_fact_retention_days: int = 90
    forensic_window_days: int = 30

    # Celery tasks
    detection_task_interval_seconds: int = 60
    aggregation_task_interval_seconds: int = 300

    # Universe
    universe_group_ids: list = field(default_factory=list)

    def validate(self) -> list[str]:
        errors = []
        if self.whale_threshold_vnd < 1_000_000:
            errors.append('whale_threshold_vnd phải >= 1.000.000 VNĐ')
        if not (0 < self.whale_top_pct <= 1):
            errors.append('whale_top_pct phải trong khoảng (0, 1]')
        if self.dark_pool_threshold_vnd < 1_000_000:
            errors.append('dark_pool_threshold_vnd phải >= 1.000.000 VNĐ')
        if not (0 < self.dark_pool_block_ratio_min < 1):
            errors.append('dark_pool_block_ratio_min phải trong khoảng (0, 1)')
        if self.intraday_tick_retention_days < 7:
            errors.append('intraday_tick_retention_days phải >= 7 ngày (hot retention floor)')
        if self.canonical_event_retention_days < 180:
            errors.append('canonical_event_retention_days phải >= 180 ngày (long-lived canonical events floor)')
        if self.detection_task_interval_seconds < 10:
            errors.append('detection_task_interval_seconds phải >= 10')
        return errors

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'SignalServicesDomainConfig':
        known = set(cls.__dataclass_fields__.keys())
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)

    def to_dict(self) -> dict[str, Any]:
        return {
            'whale_threshold_vnd': self.whale_threshold_vnd,
            'whale_top_pct': self.whale_top_pct,
            'whale_enabled': self.whale_enabled,
            'dark_pool_threshold_vnd': self.dark_pool_threshold_vnd,
            'dark_pool_block_ratio_min': self.dark_pool_block_ratio_min,
            'dark_pool_enabled': self.dark_pool_enabled,
            'screener_signal_enabled': self.screener_signal_enabled,
            'screener_signal_cooldown_seconds': self.screener_signal_cooldown_seconds,
            'intraday_tick_retention_days': self.intraday_tick_retention_days,
            'canonical_event_retention_days': self.canonical_event_retention_days,
            'bucket_fact_retention_days': self.bucket_fact_retention_days,
            'forensic_window_days': self.forensic_window_days,
            'detection_task_interval_seconds': self.detection_task_interval_seconds,
            'aggregation_task_interval_seconds': self.aggregation_task_interval_seconds,
            'universe_group_ids': self.universe_group_ids,
        }
