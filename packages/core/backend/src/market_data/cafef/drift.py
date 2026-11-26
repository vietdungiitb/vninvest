"""S5 — map `vnbroker.reconcile_prices` verdicts to explicit actions.

Fail-closed: any verdict we do not recognise becomes an alert, never a write.
"""
from __future__ import annotations

OBSERVE = 'observe'
REBASE = 'rebase'
ALERT = 'alert'

_SAFE = {'adjusted_confirmed': OBSERVE}
_REBASE = {'rebase_suspected': REBASE}


def classify_drift(verdict: str | None) -> str:
    """Return one of `observe` / `rebase` / `alert`."""
    if verdict in _SAFE:
        return _SAFE[verdict]
    if verdict in _REBASE:
        return _REBASE[verdict]
    return ALERT
