"""Paced CafeF fetch: retry với backoff, không đốt quota theo burst."""
from unittest.mock import patch

from market_data.cafef.importer import fetch_year_paced

_BULK = 'vnbroker.reference.client.bulk_year'


def test_paced_fetch_retries_with_exponential_backoff():
    rows = [{'symbol': 'TPB', 'date': '2026-01-05'}]
    with patch(_BULK) as bulk, patch('time.sleep') as mock_sleep:
        bulk.side_effect = [RuntimeError('503'), RuntimeError('503'), rows]
        out = fetch_year_paced('HOSE', 2026, base_delay=10, attempts=3)
    assert out == rows
    assert [c.args[0] for c in mock_sleep.call_args_list] == [10, 20]


def test_paced_fetch_gives_up_after_attempts():
    with patch(_BULK) as bulk, patch('time.sleep'):
        bulk.side_effect = RuntimeError('503')
        try:
            fetch_year_paced('HOSE', 2026, base_delay=1, attempts=2)
        except RuntimeError as exc:
            assert '503' in str(exc)
        else:
            raise AssertionError('expected RuntimeError')
        assert bulk.call_count == 2


def test_paced_fetch_clamps_end_date_to_today_for_current_year():
    with patch(_BULK) as bulk, patch('time.sleep'):
        bulk.return_value = []
        fetch_year_paced('HOSE', 2026, attempts=1)
    kwargs = bulk.call_args.kwargs
    assert kwargs['use_cache'] is False
    assert kwargs['end_date'].year == 2026
    assert kwargs['end_date'].month <= 12


def test_backoff_can_be_disabled_for_tests(monkeypatch):
    monkeypatch.setenv('CAFEF_BACKOFF_BASE', '0')
    with patch(_BULK) as bulk, patch('time.sleep') as mock_sleep:
        bulk.side_effect = [RuntimeError('503'), []]
        fetch_year_paced('HOSE', 2026, attempts=2)
    assert [c.args[0] for c in mock_sleep.call_args_list] == [0]
