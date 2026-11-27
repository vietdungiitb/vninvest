"""Ops/CI gate — check_price_integrity fail-before tests."""
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

_CMD = 'market_data.management.commands.check_price_integrity'
_CLEAN = {'ok': True, 'violations': [], 'counts': {}, 'rows': 1, 'cafef_rows': 1}
_DIRTY = {
    'ok': False,
    'violations': ['residual_adjusted_legacy'],
    'counts': {'residual_adjusted_legacy': 1},
    'rows': 1,
    'cafef_rows': 0,
}


def test_clean_report_exits_zero():
    out = StringIO()
    with patch(f'{_CMD}.collect_rows', return_value=[]), \
         patch(f'{_CMD}.audit_rows', return_value=_CLEAN):
        call_command('check_price_integrity', stdout=out)
    assert 'ok' in out.getvalue().lower()


def test_dirty_report_raises_command_error():
    with patch(f'{_CMD}.collect_rows', return_value=[]), \
         patch(f'{_CMD}.audit_rows', return_value=_DIRTY), \
         pytest.raises(CommandError) as info:
        call_command('check_price_integrity', stdout=StringIO())
    assert 'residual_adjusted_legacy' in str(info.value)


def test_command_passes_since_to_collector():
    with patch(f'{_CMD}.collect_rows', return_value=[]) as collect, \
         patch(f'{_CMD}.audit_rows', return_value=_CLEAN):
        call_command('check_price_integrity', since='2026-01-01', stdout=StringIO())
    assert collect.call_args.kwargs['since'] == '2026-01-01'
