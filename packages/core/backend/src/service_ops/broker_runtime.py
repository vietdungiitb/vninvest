"""B2.4: Runtime adapter tập trung cho broker system config.

Đọc ServiceConfig current (service_key 'broker_config'), fallback defaults.
Không I/O broker ở đây — chỉ policy (routing/kill-switch/quiet-hours).
"""
from __future__ import annotations

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class BrokerWriteDisabled(Exception):
    """Kill-switch đang bật — write hệ thống bị chặn."""


def get_active_broker_config():
    """Trả về BrokerSystemConfig đang hiệu lực (current version hoặc defaults)."""
    from .domain_configs.broker import BrokerSystemConfig, get_default_broker_system_config
    from .models import ServiceConfig, ServiceDefinition
    from .domain_configs.broker import BROKER_CONFIG_SERVICE_KEY

    try:
        service = ServiceDefinition.objects.filter(
            service_key=BROKER_CONFIG_SERVICE_KEY).first()
        if service is not None:
            current = ServiceConfig.objects.filter(
                service=service, is_current=True).first()
            if current and isinstance(current.config_payload, dict):
                cfg = BrokerSystemConfig.from_dict(current.config_payload)
                if not cfg.validate():
                    return cfg
                logger.warning('broker_runtime: stored config invalid, using defaults: %s',
                               cfg.validate())
    except Exception:  # noqa: BLE001 — DB chưa migrate vẫn chạy defaults
        logger.warning('broker_runtime: cannot read stored config, using defaults')
    return get_default_broker_system_config()


def provider_for_purpose(purpose: str) -> str | None:
    """Provider hệ thống phục vụ purpose (D4 mapping, tôn trọng enabled/routing)."""
    return get_active_broker_config().provider_for_purpose(purpose)


def check_kill_switch() -> None:
    """Raise BrokerWriteDisabled khi kill-switch bật. Gọi trước mọi write hệ thống."""
    if get_active_broker_config().kill_switch_write:
        raise BrokerWriteDisabled('Kill-switch đang bật — write hệ thống bị chặn.')


def _parse_hhmm(value: str) -> tuple[int, int] | None:
    try:
        parts = str(value or '').split(':')
        if len(parts) != 2:
            return None
        hour, minute = int(parts[0]), int(parts[1])
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return hour, minute
    except (TypeError, ValueError):
        pass
    return None


def in_quiet_hours(now: datetime | None = None) -> bool:
    """True khi `now` (ICT, mặc định hiện tại) nằm trong quiet_hours (hỗ trợ qua đêm)."""
    import pytz
    cfg = get_active_broker_config()
    start = _parse_hhmm(cfg.quiet_hours_start)
    end = _parse_hhmm(cfg.quiet_hours_end)
    if not start or not end:
        return False
    tz = pytz.timezone('Asia/Ho_Chi_Minh')
    current = (now or datetime.now(tz)).astimezone(tz)
    cur = (current.hour, current.minute)
    if start <= end:
        return start <= cur < end
    return cur >= start or cur < end
