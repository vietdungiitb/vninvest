"""S5 — drift verdict must map to one explicit action, never a silent write."""
import importlib.util
from pathlib import Path

import pytest

_MODULE = Path(__file__).resolve().parents[1] / 'src/market_data/cafef/drift.py'


def _load():
    spec = importlib.util.spec_from_file_location('cafef_drift', _MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('verdict,expected', [
    ('adjusted_confirmed', 'observe'),
    ('rebase_suspected', 'rebase'),
    ('double_adjust_suspected', 'alert'),
    ('PROVIDER_ERROR', 'alert'),
    ('something_new', 'alert'),
])
def test_verdict_maps_to_action(verdict, expected):
    assert _load().classify_drift(verdict) == expected
