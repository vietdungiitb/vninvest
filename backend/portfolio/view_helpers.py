"""
view_helpers.py
Miscellaneous helper functions for general-purpose views.
S23-04 views decomposition — extracted from views.py.
"""
from __future__ import annotations

from .models import PriceAlertRule, SecuritiesGroup


# ---------------------------------------------------------------------------
# Securities group
# ---------------------------------------------------------------------------

def _build_group_response(group: SecuritiesGroup, price_map: dict) -> dict:
    """Xây dựng dict response cho một SecuritiesGroup kèm dữ liệu giá."""
    items_data = []
    for item in group.items.all():
        pc = price_map.get(item.symbol, {
            'current_price': None, 'prev_price': None,
            'change_value': None, 'change_pct': None, 'last_date': None,
        })
        items_data.append({'id': item.id, 'symbol': item.symbol, **pc})
    return {
        'id': group.id,
        'name': group.name,
        'group_type': group.group_type,
        'description': group.description,
        'color': group.color,
        'order': group.order,
        'items': items_data,
    }


# ---------------------------------------------------------------------------
# Price alert
# ---------------------------------------------------------------------------

def _price_alert_is_triggered(rule: PriceAlertRule, current_price: float | None) -> bool:
    if current_price is None or not rule.is_active:
        return False
    target_price = float(rule.target_price)
    if rule.condition == PriceAlertRule.Condition.ABOVE:
        return float(current_price) >= target_price
    return float(current_price) <= target_price


def _build_price_alert_rule_row(rule: PriceAlertRule, price_map: dict) -> dict:
    current_price = price_map.get(rule.symbol, {}).get('current_price')
    return {
        'id': rule.id,
        'symbol': rule.symbol,
        'condition': rule.condition,
        'target_price': rule.target_price,
        'cooldown_seconds': rule.cooldown_seconds,
        'is_active': rule.is_active,
        'last_triggered_at': rule.last_triggered_at,
        'created_at': rule.created_at,
        'updated_at': rule.updated_at,
        'current_price': current_price,
        'is_triggered': _price_alert_is_triggered(rule, current_price),
    }
