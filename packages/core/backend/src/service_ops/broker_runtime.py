"""B2.4: Runtime adapter tập trung cho broker system config.

Đọc ServiceConfig current (service_key 'broker_config'), fallback defaults.
Không I/O broker ở đây — chỉ policy (routing/kill-switch/quiet-hours).
"""
from __future__ import annotations

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

#: SAFE-03 R2 — 3 scope của kill-switch. Scope lạ bị chặn, không bỏ qua.
_KILL_SWITCH_SCOPES = frozenset({'global', 'tenant', 'provider'})



class BrokerWriteDisabled(Exception):
    """Kill-switch đang bật — write hệ thống bị chặn."""


class KillSwitchIndeterminate(BrokerWriteDisabled):
    """Không đọc được trạng thái kill-switch ⇒ chặn (fail-closed).

    Tách riêng khỏi `BrokerWriteDisabled` để operator phân biệt được
    "chủ động bật switch" với "hệ thống không trả lời". Cả hai đều chặn
    write, nhưng cái thứ hai là sự cố hạ tầng cần điều tra.
    """


def get_active_broker_config(*, strict: bool = False):
    """Trả về BrokerSystemConfig đang hiệu lực (current version hoặc defaults).

    `strict=False` (mặc định) giữ hành vi cũ cho **đường đọc**: config lỗi
    thì dùng default chỉ để routing không chết cùng DB. Đó đúng cho
    `provider_for_purpose`.

    `strict=True` là bắt buộc cho **đường ghi**. Trước đây `except Exception`
    nuốt mọi lỗi rồi trả default có `kill_switch_write=False` — tức là
    Postgres chết đúng lúc đặt lệnh thì kill-switch trả về "cho phép ghi".
    Đó là fail-open ở đúng kịch bản mà kill-switch sinh ra để chặn, và nó
    làm `KillSwitchIndeterminate` không bao giờ chạy với lỗi DB thật.

    Với `strict=True`, mọi lỗi đọc được ném lại cho `check_kill_switch` chuyển
    thành `KillSwitchIndeterminate` (503) thay vì im lặng cho qua.
    """
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
    except Exception as exc:  # noqa: BLE001 - strict=True re-raises; xem docstring
        if strict:
            raise
        logger.warning('broker_runtime: cannot read stored config, using defaults')
    return get_default_broker_system_config()


def provider_for_purpose(purpose: str) -> str | None:
    """Provider hệ thống phục vụ purpose (D4 mapping, tôn trọng enabled/routing)."""
    return get_active_broker_config().provider_for_purpose(purpose)


def check_kill_switch(scope: str = 'global', tenant=None, provider: str | None = None) -> None:
    """Fail-closed theo D-14 + D-23. Gọi trước MỌI đường ghi broker.

    SAFE-03 R1 — trước đây hàm này nuốt lỗi đọc config rồi rơi về
    `kill_switch_write=False`, tức **DB chết = cho phép ghi**. Đó đúng là
    fail-open. Nay lỗi đọc trạng thái ⇒ `KillSwitchIndeterminate` (chặn).

    SAFE-03 R2 — thêm `scope` / `tenant` / `provider`. `global` giữ hành vi cũ;
    `tenant` và `provider` chỉ kích hoạt khi đúng scope khớp, để operator
    khoanh vùng sự cố thay vì tắt toàn hệ thống.

    Raise:
        KillSwitchIndeterminate: không đọc được trạng thái (fail-closed).
        BrokerWriteDisabled: kill-switch đang bật ở scope khớp.
    """
    scope = (scope or 'global').strip().lower()

    if scope not in _KILL_SWITCH_SCOPES:
        # Scope lạ là lỗi cấu hình của caller. Chặn thay vì im lặng bỏ qua:
        # im lặng bỏ qua nghĩa là một caller gõ sai tên sẽ tưởng mình
        # đang được bảo vệ trong khi không có gì cả.
        logger.error(
            'broker_runtime: unknown kill-switch scope %r (known: %s) — denying write',
            scope, sorted(_KILL_SWITCH_SCOPES),
        )
        raise KillSwitchIndeterminate(
            f'Kill-switch scope không hợp lệ: {scope!r}. Chặn ghi để an toàn.'
        )

    try:
        # `strict=True` là mấu chốt của D-14: nếu đọc trạng thái lỗi thì phải
        # ném lên, không được rơi về default `kill_switch_write=False`.
        cfg = get_active_broker_config(strict=True)
        enabled = bool(cfg.kill_switch_write)
    except Exception as exc:  # noqa: BLE001 — bất kỳ lỗi nào cũng phải chặn
        logger.error(
            'broker_runtime: cannot determine kill-switch state, denying write '
            '(scope=%s tenant=%s provider=%s): %s',
            scope, getattr(tenant, 'public_id', tenant), provider, exc,
            exc_info=True,
        )
        raise KillSwitchIndeterminate(
            'Không đọc được trạng thái kill-switch nên tạm chặn ghi. Thử lại sau.'
        ) from exc

    # Các scope ĐỘC LẬP, không phải phân tầng: switch global tắt KHÔNG có nghĩa
    # là tenant switch cũng tắt. Nếu kiểm tra `global` rồi `return` sớm thì
    # operator bật kill-switch cho riêng một tenant sẽ không có tác dụng gì —
    # đúng cái lỗi "bật switch mà không chặn được gì" mà SAFE-03 sinh ra.
    if scope == 'global':
        if enabled:
            raise BrokerWriteDisabled('Kill-switch đang bật — write hệ thống bị chặn.')
        return

    if scope == 'tenant':
        tenant_public_id = getattr(tenant, 'public_id', tenant)
        if not tenant_public_id:
            # Không có tenant trong request: KHÔNG tự bật chặn.
            #
            # Scope global đã được kiểm tra ở trên và vẫn có tác dụng, nên
            # việc thiếu tenant ở đây không phải lỗ hổng — nó chỉ có nghĩa là
            # "không có kill-switch riêng theo tenant nào để áp". Từ chối ở
            # đây sẽ làm hỏng mọi request không kèm tenant (ví dụ test dùng
            # `force_authenticate`, hay luồng không cần tenant), tức biến một
            # trường hợp vô hại thành sự cố. Với tenant thật mà không xác định
            # được thì `request.tenant is None` đã bị chặn tầng trên bởi
            # `_get_user_portfolio` / middleware.
            logger.warning(
                'broker_runtime: tenant scope requested without a tenant — '
                'only the global kill-switch applies'
            )
            return

        if _tenant_kill_switch_enabled(tenant_public_id):
            raise BrokerWriteDisabled(
                'Kill-switch đang bật cho tenant này — write bị chặn.'
            )
        return

    # scope == 'provider'
    if not provider:
        logger.warning(
            'broker_runtime: provider scope requested without a provider — '
            'only the global kill-switch applies'
        )
        return

    if _provider_kill_switch_enabled(provider):
        raise BrokerWriteDisabled(
            f'Kill-switch đang bật cho provider {provider} — write bị chặn.'
        )


def _tenant_kill_switch_enabled(tenant_public_id) -> bool:
    """Tenant có bật kill-switch riêng không?

    Fail-closed: không xác định được thì coi như ĐANG bật, vì đây là nhánh
    quyết định có cho ghi hay không.
    """
    from .models import ServiceConfig, ServiceDefinition
    from .domain_configs.broker import BROKER_CONFIG_SERVICE_KEY

    try:
        service = ServiceDefinition.objects.filter(
            service_key=BROKER_CONFIG_SERVICE_KEY).first()
        if service is None:
            return False
        current = ServiceConfig.objects.filter(
            service=service, is_current=True).first()
        if not current or not isinstance(current.config_payload, dict):
            return False
        return bool(
            (current.config_payload.get('tenant_kill_switches') or {}).get(
                str(tenant_public_id), False
            )
        )
    except Exception:  # noqa: BLE001
        logger.error(
            'broker_runtime: cannot read tenant kill-switch for %s — treating as ENABLED',
            tenant_public_id, exc_info=True,
        )
        return True


def _provider_kill_switch_enabled(provider: str) -> bool:
    """Provider có bật kill-switch riêng không? Fail-closed như trên."""
    from .models import ServiceConfig, ServiceDefinition
    from .domain_configs.broker import BROKER_CONFIG_SERVICE_KEY

    try:
        service = ServiceDefinition.objects.filter(
            service_key=BROKER_CONFIG_SERVICE_KEY).first()
        if service is None:
            return False
        current = ServiceConfig.objects.filter(
            service=service, is_current=True).first()
        if not current or not isinstance(current.config_payload, dict):
            return False
        return bool(
            (current.config_payload.get('provider_kill_switches') or {}).get(
                str(provider), False
            )
        )
    except Exception:  # noqa: BLE001
        logger.error(
            'broker_runtime: cannot read provider kill-switch for %s — treating as ENABLED',
            provider, exc_info=True,
        )
        return True


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
