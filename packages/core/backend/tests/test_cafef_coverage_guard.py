"""S2 — persist phải HALT khi coverage CafeF không đạt (fail-before)."""
import importlib.util
from pathlib import Path

import pytest

_MODULE = Path(__file__).resolve().parents[1] / 'src/market_data/cafef/coverage.py'


def _load():
    spec = importlib.util.spec_from_file_location('cafef_coverage', _MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_zero_matched_rows_halts():
    with pytest.raises(ValueError, match='coverage_guard:cafef_rows_empty'):
        _load().validate_coverage(matched=0, legacy_count=100)


def test_below_half_coverage_halts():
    with pytest.raises(ValueError, match='coverage_guard:below_50pct'):
        _load().validate_coverage(matched=10, legacy_count=100)


def test_explicit_override_allows_low_coverage():
    _load().validate_coverage(matched=10, legacy_count=100, allow_low=True)


def test_healthy_coverage_is_silent():
    assert _load().validate_coverage(matched=60, legacy_count=100) is None
