"""
view_helpers.py
Miscellaneous helper functions for general-purpose views.
S23-04 views decomposition — extracted from views.py.
"""
from __future__ import annotations

import os
import sys

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import PriceAlert
    _USE_CORE_MODELS = True
except (ImportError, RuntimeError):
    class PriceAlert:
        pass
    _USE_CORE_MODELS = False

from .models import SecuritiesGroup


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

def _price_alert_is_triggered(rule: PriceAlert, current_price: float | None) -> bool:
    if current_price is None:
        return False
    
    # Handle both core and legacy models
    is_enabled = getattr(rule, 'is_enabled', None)
    if is_enabled is None:
        is_enabled = getattr(rule, 'is_active', True)
    if not is_enabled:
        return False
    
    # Core model uses price_threshold, legacy uses target_price
    target_price = getattr(rule, 'price_threshold', None) or getattr(rule, 'target_price', None)
    if target_price is None:
        return False
    target_price = float(target_price)
    
    # Core model uses alert_type, legacy uses condition
    if _USE_CORE_MODELS:
        alert_type = getattr(rule, 'alert_type', 'BELOW')
        return (float(current_price) >= target_price) if alert_type == 'ABOVE' else (float(current_price) <= target_price)
    else:
        condition = getattr(rule, 'condition', 'BELOW')
        return (float(current_price) >= target_price) if str(condition) == 'ABOVE' else (float(current_price) <= target_price)


def _build_price_alert_rule_row(rule: PriceAlert, price_map: dict) -> dict:
    current_price = price_map.get(rule.symbol, {}).get('current_price')
    
    # Handle both core and legacy models
    is_enabled = getattr(rule, 'is_enabled', None)
    if is_enabled is None:
        is_enabled = getattr(rule, 'is_active', True)
    
    target_price = getattr(rule, 'price_threshold', None) or getattr(rule, 'target_price', None)
    condition_field = getattr(rule, 'alert_type', None) or getattr(rule, 'condition', 'BELOW')
    cooldown_secs = getattr(rule, 'cooldown_seconds', None) or 3600
    
    return {
        'id': rule.id,
        'symbol': rule.symbol,
        'condition': condition_field,
        'target_price': target_price,
        'cooldown_seconds': cooldown_secs,
        'is_active': is_enabled,
        'last_triggered_at': getattr(rule, 'last_triggered_at', None),
        'created_at': getattr(rule, 'created_at', None),
        'updated_at': getattr(rule, 'updated_at', None),
        'current_price': current_price,
        'is_triggered': _price_alert_is_triggered(rule, current_price),
    }
