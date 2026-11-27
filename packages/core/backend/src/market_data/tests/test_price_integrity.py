"""Durable data-integrity invariants — fail-before tests (S7)."""
from datetime import date
from decimal import Decimal

import pytest

from market_data.cafef.integrity import (
    PriceIntegrityError,
    assert_integrity,
    audit_rows,
)


def _row(**overrides):
    row = {
        'symbol': 'TPB',
        'date': date(2026, 1, 5),
        'price_source': 'cafef',
        'close': Decimal('16.60'),
        'adj_close': Decimal('13.93'),
        'adj_factor': Decimal('13.93') / Decimal('16.60'),
    }
    row.update(overrides)
    return row


def test_clean_cafef_rows_pass():
    report = audit_rows([_row()])
    assert report['ok'] is True
    assert report['violations'] == []


def test_residual_adjusted_legacy_is_flagged():
    report = audit_rows([_row(price_source='vnbroker_legacy')])
    assert 'residual_adjusted_legacy' in report['violations']
    assert report['counts']['residual_adjusted_legacy'] == 1


def test_unmapped_cafef_with_adjustment_is_flagged():
    report = audit_rows([_row(price_source='unmapped_cafef')])
    assert 'unmapped_with_adjustment' in report['violations']


def test_factor_out_of_bounds_is_flagged():
    report = audit_rows([_row(adj_factor=Decimal('1.20'))])
    assert 'factor_out_of_bounds' in report['violations']


def test_factor_inconsistent_with_ratio_is_flagged():
    # close 16.60, adj_close 13.93 -> ratio ~0.839; factor 0.5 is wrong.
    report = audit_rows([_row(adj_factor=Decimal('0.5'))])
    assert 'factor_close_mismatch' in report['violations']


def test_raw_only_rows_are_valid():
    report = audit_rows([_row(adj_close=None, adj_factor=None)])
    assert report['ok'] is True


def test_adjustment_without_factor_is_flagged():
    report = audit_rows([_row(adj_factor=None)])
    assert 'orphan_adjustment' in report['violations']


def test_factor_without_adjustment_is_flagged():
    report = audit_rows([_row(adj_close=None)])
    assert 'orphan_adjustment' in report['violations']


def test_mixed_basis_within_symbol_is_flagged():
    rows = [
        _row(),
        _row(date=date(2026, 1, 6), price_source='vnbroker_legacy'),
    ]
    assert 'mixed_basis_symbol' in audit_rows(rows)['violations']


def test_coverage_below_minimum_is_flagged():
    rows = [
        _row(),
        _row(date=date(2026, 1, 6), price_source='unmapped_cafef',
             adj_close=None, adj_factor=None),
    ]
    report = audit_rows(rows, min_coverage=Decimal('0.95'))
    assert 'coverage_below_min' in report['violations']


def test_coverage_check_is_opt_in():
    rows = [_row(), _row(date=date(2026, 1, 6), price_source='vnbroker_legacy',
                         adj_close=None, adj_factor=None)]
    assert 'coverage_below_min' not in audit_rows(rows)['violations']


def test_assert_integrity_raises_with_stable_codes():
    with pytest.raises(PriceIntegrityError) as info:
        assert_integrity([_row(price_source='vnbroker_legacy')])
    assert 'residual_adjusted_legacy' in str(info.value)


def test_assert_integrity_passes_clean_rows():
    assert assert_integrity([_row()]) is True


def test_violation_codes_are_sorted_and_unique():
    rows = [
        _row(price_source='vnbroker_legacy', adj_factor=Decimal('2.0')),
        _row(date=date(2026, 1, 6), price_source='vnbroker_legacy',
             adj_factor=Decimal('3.0')),
    ]
    codes = audit_rows(rows)['violations']
    assert codes == sorted(set(codes))
    assert codes.count('factor_out_of_bounds') == 1
