"""Fallback XLSX phải clamp EndDate — CafeF trả 503 cho ngày tương lai."""
from datetime import date

from market_data.cafef.fetcher import resolve_end


def test_current_year_is_clamped_to_today():
    assert resolve_end(2026, date(2026, 11, 27)) == date(2026, 11, 27)


def test_past_year_keeps_december_31():
    assert resolve_end(2025, date(2026, 11, 27)) == date(2025, 12, 31)


def test_future_year_is_clamped_to_today():
    assert resolve_end(2027, date(2026, 11, 27)) == date(2026, 11, 27)
