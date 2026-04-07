"""Runtime compatibility patches for upstream vnstock regressions."""

from __future__ import annotations

import logging


logger = logging.getLogger(__name__)


def patch_vnstock_finance_init() -> bool:
    """
    Patch vnstock Finance.__init__ when upstream sets period/get_all
    *after* BaseComponent.__init__, which triggers AttributeError during
    data source loading.
    """
    try:
        from vnstock.common import data as vnstock_data
    except Exception:
        return False

    finance_cls = getattr(vnstock_data, "Finance", None)
    if finance_cls is None:
        return False

    # Idempotent patch.
    if getattr(finance_cls, "_vninvest_period_patch", False):
        return True

    original_init = finance_cls.__init__

    def _patched_init(self, symbol, period="quarter", source="VCI", get_all=True, auth_token=None):
        self.auth_token = auth_token
        self.period = str(period or "quarter").lower()
        self.get_all = bool(get_all)

        supported_periods = getattr(self, "SUPPORTED_PERIODS", ["quarter", "annual"])
        if self.period not in supported_periods:
            periods_str = ", ".join(supported_periods)
            raise ValueError(f"Period must be one of {periods_str}. Got: {period}")

        # Delegate to BaseComponent directly to avoid re-running buggy upstream init flow.
        super(finance_cls, self).__init__(symbol, source)

    try:
        finance_cls.__init__ = _patched_init
        finance_cls._vninvest_period_patch = True
        finance_cls._vninvest_original_init = original_init
        logger.info("Applied vnstock Finance compatibility patch")
        return True
    except Exception:
        return False


def disable_vnstock_upgrade_notice() -> bool:
    """
    Disable vnstock's automatic upgrade notice/warning messages.
    Silences the verbose output about new versions being available.
    """
    try:
        import vnstock.core.utils.upgrade as upgrade_module
    except Exception:
        return False

    # Patch the update_notice function to do nothing
    def noop_update_notice(*args, **kwargs):
        pass

    try:
        upgrade_module.update_notice = noop_update_notice
        logger.info("Disabled vnstock upgrade notice")
        return True
    except Exception:
        return False
