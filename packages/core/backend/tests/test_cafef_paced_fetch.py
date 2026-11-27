"""Paced CafeF fetch: retry với backoff, không đốt quota theo burst."""
from unittest.mock import patch

from market_data.cafef.importer import fetch_year_paced


def test_paced_fetch_retries_with_exponential_backoff():
    rows = [{'symbol': 'TPB', 'date': '2026-01-05'}]
    with patch('vnbroker.Vnbroker') as mock_vn, patch('time.sleep') as mock_sleep:
        ref = mock_vn.return_value.reference.return_value
        ref.bulk_year.side_effect = [RuntimeError('503'), RuntimeError('503'), rows]
        out = fetch_year_paced('HOSE', 2026, base_delay=10, attempts=3)
    assert out == rows
    assert [c.args[0] for c in mock_sleep.call_args_list] == [10, 20]


def test_paced_fetch_gives_up_after_attempts():
    with patch('vnbroker.Vnbroker') as mock_vn, patch('time.sleep'):
        ref = mock_vn.return_value.reference.return_value
        ref.bulk_year.side_effect = RuntimeError('503')
        try:
            fetch_year_paced('HOSE', 2026, base_delay=1, attempts=2)
        except RuntimeError as exc:
            assert '503' in str(exc)
        else:
            raise AssertionError('expected RuntimeError')
        assert ref.bulk_year.call_count == 2
