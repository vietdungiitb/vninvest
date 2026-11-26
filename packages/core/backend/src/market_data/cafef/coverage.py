"""Coverage guard for CafeF persist (S2).

A batch with no CafeF source, or where fewer than half of the legacy rows can
be matched, must HALT before any row is re-labelled `unmapped_cafef`.
"""
from __future__ import annotations

MIN_MATCH_RATIO = 0.5


def validate_coverage(matched: int, legacy_count: int, allow_low: bool = False) -> None:
    """Raise ValueError with a stable reason code when coverage is unsafe."""
    if matched <= 0:
        raise ValueError('coverage_guard:cafef_rows_empty')
    if (
        legacy_count > 0
        and matched / legacy_count < MIN_MATCH_RATIO
        and not allow_low
    ):
        raise ValueError('coverage_guard:below_50pct')
