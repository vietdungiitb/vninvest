"""
SC-03 bridge: evaluate Global Screener rules with the real user-engine
row builder + condition evaluator.

Semantics (evidence, not invention):
- docs/IMPLEMENTATION_PLAN_SOC_CONFIG_UI_20260516.md (rule modal mock):
  a global rule's `value` holds a conditions array
  [{"field": ..., "op": ..., "value": ...}] in user-screener format.
- docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md:36,151,243:
  '{"name":"Test Rule","type":"whale_count","value":[{"field":"whale_count","op":"gte","value":3}],"enabled":true}'.
- `type` is the category label; evaluation uses the conditions payload
  (`value`, fallback `threshold`). Rules without an evaluable conditions
  list are reported in `rules_skipped` — never silently matched.

Row building reuses user_workspace.portfolio_analytics_views._compute_scan
with empty conditions (match-all rows), so the ops scan reads exactly the
same data layer as /screener (SymbolSnapshot + SessionFacts + DailyPrice +
technical indicators). include_ai=False: ops scan needs matches, not scores.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Ops manual scan is operator-driven with an explicit symbol list: bound the
# work even if the caller sends the whole universe.
MAX_MANUAL_SYMBOLS = 50


def extract_rule_conditions(rule: dict):
    """Return (conditions, None) or (None, skip_reason) for one global rule."""
    from user_workspace.screener_helpers import _validate_screener_rules

    raw = rule.get('value')
    if not isinstance(raw, list):
        raw = rule.get('threshold')
    if not isinstance(raw, list) or not raw:
        return None, 'no-conditions'
    ok, err = _validate_screener_rules(raw)
    if not ok:
        return None, f'invalid-conditions: {err}'
    return raw, None


def _eval_conditions(row: dict, conditions: list) -> bool:
    """Left-assoc AND/OR/NOT evaluation (mirrors _compute_scan)."""
    from user_workspace.screener_helpers import _apply_screener_condition

    first = conditions[0]
    result = _apply_screener_condition(
        row.get(first.get('field')), first.get('op'), first.get('value')
    )
    for cond in conditions[1:]:
        current = _apply_screener_condition(
            row.get(cond.get('field')), cond.get('op'), cond.get('value')
        )
        logic = (cond.get('logic') or 'AND').upper()
        if logic == 'OR':
            result = result or current
        elif logic == 'NOT':
            result = result and (not current)
        else:
            result = result and current
    return bool(result)


def evaluate_global_screener(symbols, rules) -> dict:
    """Evaluate enabled global rules against requested symbols.

    Returns {session_date|None, symbols_requested, symbols_scanned,
    symbols_missing, matched:[{symbol,rule_id,rule_name,close}],
    rules_evaluated, rules_skipped:[{rule_id,rule_name,reason}]}.
    Never raises for empty data (completes with matched=[]).
    """
    from market_serving.models import SymbolSnapshot
    from user_workspace.portfolio_analytics_views import _compute_scan

    requested = sorted({str(s).strip().upper() for s in (symbols or []) if str(s).strip()})
    requested = requested[:MAX_MANUAL_SYMBOLS]

    # Partition rules first so misconfigured rules are reported even when
    # there is no market data at all.
    evaluable = []
    rules_skipped = []
    for rule in rules or []:
        rule_id = rule.get('id')
        rule_name = rule.get('name') or rule.get('type') or 'rule'
        if rule.get('enabled') is False:
            rules_skipped.append({'rule_id': rule_id, 'rule_name': rule_name, 'reason': 'disabled'})
            continue
        conditions, reason = extract_rule_conditions(rule)
        if conditions is None:
            rules_skipped.append({'rule_id': rule_id, 'rule_name': rule_name, 'reason': reason})
            continue
        evaluable.append((rule_id, rule_name, conditions))

    latest = SymbolSnapshot.objects.order_by('-session_date').first()
    if latest is None:
        return {
            'session_date': None,
            'symbols_requested': requested,
            'symbols_scanned': 0,
            'symbols_missing': requested,
            'matched': [],
            'rules_evaluated': 0,
            'rules_skipped': rules_skipped,
            'note': 'no-data',
        }

    session_date = latest.session_date
    rows, _total, _missing, _window = _compute_scan([], session_date, False)
    by_symbol = {r.get('symbol'): r for r in rows if r.get('symbol')}

    matched = []
    for rule_id, rule_name, conditions in evaluable:
        for sym in requested:
            row = by_symbol.get(sym)
            if row is None:
                continue
            try:
                hit = _eval_conditions(row, conditions)
            except Exception:
                logger.exception('screener bridge: eval failed rule=%s symbol=%s', rule_id, sym)
                continue
            if hit:
                matched.append({
                    'symbol': sym,
                    'rule_id': rule_id,
                    'rule_name': rule_name,
                    'close': row.get('close'),
                })

    missing = [s for s in requested if s not in by_symbol]
    return {
        'session_date': session_date.isoformat() if session_date else None,
        'symbols_requested': requested,
        'symbols_scanned': len(requested) - len(missing),
        'symbols_missing': missing,
        'matched': matched,
        'rules_evaluated': len(evaluable),
        'rules_skipped': rules_skipped,
    }
