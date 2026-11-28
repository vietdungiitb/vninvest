"""Phase 3 — pure adjustment service (fail-before, 2026-11-28)."""
from datetime import date
from decimal import Decimal

import pytest

from market_data.corporate_actions.adjustment import (
    compute_event_factor,
    recompute_adjusted,
)


def _event(**kw):
    base = {
        'cash': Decimal('0'), 'stock_ratio_pct': Decimal('0'),
        'rights_ratio_pct': Decimal('0'), 'rights_issue_price': None,
        'parse_status': 'structured', 'ambiguous': False,
        'ex_date': date(2026, 11, 27),
    }
    base.update(kw)
    return base


def test_dividend_factor_matches_fpt_ex_date():
    f = compute_event_factor(_event(cash=Decimal('1000')), Decimal('44500'))
    assert abs(f - Decimal('0.9775280899')) < Decimal('0.000000001')
    assert Decimal('44500') * f == Decimal('43498.75') or abs(
        Decimal('44500') * f - Decimal('43500')
    ) < Decimal('1')


def test_rights_formula_uses_all_three_components():
    ev = _event(
        cash=Decimal('1000'), stock_ratio_pct=Decimal('10'),
        rights_ratio_pct=Decimal('20'), rights_issue_price=Decimal('10000'),
    )
    expected = (Decimal('44500') + Decimal('2000') - Decimal('1000')) / (
        Decimal('44500') * Decimal('1.3')
    )
    got = compute_event_factor(ev, Decimal('44500'))
    assert abs(got - expected) < Decimal('0.000000001')


def test_partial_event_is_rejected_not_applied():
    ev = _event(cash=Decimal('1000'), parse_status='parsed_from_text')
    with pytest.raises(ValueError, match='PARTIAL_EVENT'):
        compute_event_factor(ev, Decimal('44500'))


def test_recompute_applies_factor_only_to_dates_before_ex_date():
    rows = [
        {'date': date(2026, 11, 26), 'base_close': Decimal('44500')},
        {'date': date(2026, 11, 27), 'base_close': Decimal('44600')},
    ]
    events = [{'ex_date': date(2026, 11, 27), 'factor': Decimal('0.9775280899')}]
    out = recompute_adjusted(rows, events)
    assert out[0]['adj_close'] != out[0]['base_close']
    assert out[1]['adj_close'] == out[1]['base_close']


def test_recompute_skips_event_already_reflected_in_base_as_of():
    rows = [{
        'date': date(2026, 11, 26),
        'base_as_of': date(2026, 11, 27),  # provider đã phản ánh event 27/11
        'base_close': Decimal('43500'),
    }]
    events = [{'ex_date': date(2026, 11, 27), 'factor': Decimal('0.9775280899')}]
    out = recompute_adjusted(rows, events)
    assert out[0]['adj_close'] == Decimal('43500')  # KHÔNG nhân thêm


def test_recompute_is_idempotent():
    rows = [{'date': date(2026, 11, 26), 'base_close': Decimal('44500')}]
    events = [{'ex_date': date(2026, 11, 27), 'factor': Decimal('0.9775280899')}]
    first = recompute_adjusted(rows, events)
    second = recompute_adjusted(first, events)
    assert [r['adj_close'] for r in first] == [r['adj_close'] for r in second]
