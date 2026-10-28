"""Wave 1 B1.4: cong gac truoc moi lan sync — kill-switch + quiet-hours.

Wrapper `_check_kill_switch` / `_in_quiet_hours` ton tai de test patch TAI
`user_workspace.broker.sync_guard`, khong cham `service_ops` that.
"""
from __future__ import annotations

from .adapters import BrokerAdapterError


def _check_kill_switch(*, provider=None, tenant=None) -> None:
    from service_ops.broker_runtime import check_kill_switch

    check_kill_switch('global')
    if tenant is not None:
        check_kill_switch('tenant', tenant=tenant)
    if provider:
        check_kill_switch('provider', provider=provider)


def _in_quiet_hours(now=None) -> bool:
    from service_ops.broker_runtime import in_quiet_hours

    return bool(in_quiet_hours(now=now))


class BrokerSyncBlockedError(BrokerAdapterError):
    """Sync bi chan (kill-switch hoac quiet-hours) — fail-closed, co code."""

    def __init__(self, message: str = '', code: str = 'broker_sync_blocked'):
        super().__init__(message or code, code=code)


def assert_sync_allowed(*, provider=None, tenant=None, now=None) -> None:
    """Raise BrokerSyncBlockedError khi khong duoc sync luc nay."""
    from service_ops.broker_runtime import BrokerWriteDisabled

    try:
        _check_kill_switch(provider=provider, tenant=tenant)
    except BrokerWriteDisabled as exc:
        raise BrokerSyncBlockedError(str(exc), code='broker_writes_disabled') from exc
    if _in_quiet_hours(now=now):
        raise BrokerSyncBlockedError(
            'ngoai gio dong bo (quiet-hours)', code='broker_quiet_hours')
