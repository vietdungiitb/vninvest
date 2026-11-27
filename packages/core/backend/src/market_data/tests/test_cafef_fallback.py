"""Fallback provider-adjusted khi CafeF mất kết nối — fail-before tests."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd

from market_data.cafef.fallback import fetch_provider_series, validate_fallback


def _frame():
    return pd.DataFrame({
        'time': pd.to_datetime(['2026-01-05', '2026-01-06']),
        'open': [1.0, 2.0], 'high': [1.0, 2.0], 'low': [1.0, 2.0],
        'close': [13934.04, 14311.77], 'volume': [1, 2],
    })


def test_fetch_provider_series_normalizes_history():
    with patch('vnbroker.Vnbroker') as vn:
        vn.return_value.stock.return_value.quote.history.return_value = _frame()
        rows = fetch_provider_series('TPB', date(2026, 1, 1), date(2026, 1, 10))
    assert len(rows) == 2
    assert rows[0]['date'] == date(2026, 1, 5)
    assert Decimal(str(rows[0]['close'])) == Decimal('13934.04')


def test_fetch_provider_series_uses_adjusted_true():
    with patch('vnbroker.Vnbroker') as vn:
        vn.return_value.stock.return_value.quote.history.return_value = _frame()
        fetch_provider_series('TPB', date(2026, 1, 1), date(2026, 1, 10), provider='VCI')
    call = vn.return_value.stock.call_args
    assert call.args == ('TPB',)
    assert call.kwargs['source'] == 'VCI'
    assert vn.return_value.stock.return_value.quote.history.call_args.kwargs['adjusted'] is True


def test_validate_fallback_accepts_full_series():
    old = [{'date': date(2026, 1, 5), 'price_source': 'vnbroker_legacy'},
           {'date': date(2026, 1, 6), 'price_source': 'unmapped_cafef'}]
    new = [{'date': date(2026, 1, 5), 'close': 1}, {'date': date(2026, 1, 6), 'close': 2}]
    assert validate_fallback(old, new) == (True, 'ok')


def test_validate_fallback_rejects_cafef_rows_to_avoid_mixing():
    old = [{'date': date(2026, 1, 5), 'price_source': 'cafef'}]
    new = [{'date': date(2026, 1, 5), 'close': 1}]
    assert validate_fallback(old, new) == (False, 'cafef_rows_present')


def test_validate_fallback_accepts_orm_like_rows():
    # E2E 2026-11-27: apply_provider_fallback truyen DailyPrice object, khong phai dict.
    old = [SimpleNamespace(date=date(2026, 1, 5), price_source='vnbroker_legacy')]
    new = [{'date': date(2026, 1, 5), 'close': Decimal('13934.04')}]
    assert validate_fallback(old, new) == (True, 'ok')


def test_validate_fallback_rejects_low_coverage():
    old = [{'date': date(2026, 1, d), 'price_source': 'vnbroker_legacy'} for d in (1, 2, 3, 4)]
    new = [{'date': date(2026, 1, 1), 'close': 1}]
    assert validate_fallback(old, new) == (False, 'insufficient_coverage')
