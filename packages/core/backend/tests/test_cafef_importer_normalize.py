"""Backfill 2026: importer must drop widget-only fields before ORM create."""
from market_data.cafef.importer import normalize_row


def test_normalize_row_keeps_only_model_fields():
    row = {
        'symbol': 'TPB', 'date': '2026-01-05', 'close_raw': 16.6,
        'close_adjusted': 13.93, 'open_raw': 17.15, 'high_raw': 17.2,
        'low_raw': 16.55, 'volume': 9746200, 'value': 164.04,
        'change_pct': -2.92,
        'time': '...', 'open': 17.15, 'high': 17.2, 'low': 16.55,
        'close': 16.6, 'put_through_volume': 260519,
        'put_through_value': 4.52, 'price_basis': 'both',
        'coverage': 'ok', 'fetched_at': '...',
    }
    out = normalize_row(row)
    assert set(out) == {
        'symbol', 'date', 'close_raw', 'close_adjusted', 'open_raw',
        'high_raw', 'low_raw', 'volume', 'value', 'change_pct', 'source',
    }
    assert out['source'] == 'cafef'
    assert out['close_adjusted'] == 13.93
