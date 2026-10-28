"""
tasks.py — Celery tasks cho DNSE LightSpeed API integration trong SaaS Core.

Quy tắc cứng:
- KHÔNG có stub/fallback ghi dữ liệu giả vào DB.
- Khi vnbroker chưa khả dụng hoặc credential sai -> task fail rõ ràng, không ghi gì.
- Auth bằng client_id + client_secret.
- KHÔNG dùng username/password tài khoản cá nhân DNSE.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .dnse_adapter import (
    DNSEAdapterError,
    DNSECredentialMissingError,
    DNSEVnbrokerUnavailableError,
    bootstrap_dnse_session,
)
from .models import AccountSnapshot, DNSECredential, Portfolio, SubAccount, Transaction
from .vnbroker_dnse_compat import (
    fetch_account_balance,
    fetch_order_history,
    fetch_sub_accounts,
)

logger = logging.getLogger(__name__)

# Mã lỗi fail-closed khi không resolve được tenant (P0-DATA-01).
ERR_TENANT_REQUIRED = 'tenant_required'
ERR_TENANT_NOT_ALLOWED = 'tenant_not_allowed'
ERR_TENANT_NOT_FOUND = 'tenant_not_found'


def _beat_check_kill_switch(*, provider=None, tenant=None) -> None:
    """Wrapper de test patch TAI `user_workspace.tasks` (khong cham service_ops)."""
    from service_ops.broker_runtime import check_kill_switch

    check_kill_switch('global')
    if tenant is not None:
        check_kill_switch('tenant', tenant=tenant)
    if provider:
        check_kill_switch('provider', provider=provider)


def _beat_in_quiet_hours(now=None) -> bool:
    """Wrapper de test patch TAI `user_workspace.tasks` (khong cham service_ops)."""
    from service_ops.broker_runtime import in_quiet_hours

    return bool(in_quiet_hours(now=now))


def _resolve_tenant_for_user(user, tenant_id=None):
    """Trả `(tenant, error_code)`. `error_code` là None khi resolve thành công.

    Quy tắc (plan `IMPLEMENTATION_PLAN…:54` — "không có first tenant/first
    portfolio fallback"):
    1. `tenant_id` được truyền vào ⇒ phải thuộc user, nếu không thì từ chối.
    2. Không truyền ⇒ chỉ chấp nhận khi user thuộc **đúng 1** tenant.
    3. User thuộc ≥2 tenant mà không truyền `tenant_id` ⇒ từ chối, KHÔNG đoán.
    """
    from django.apps import apps as global_apps

    CoreTenant = global_apps.get_model('identity_access', 'CoreTenant')
    TenantMember = global_apps.get_model('identity_access', 'TenantMember')
    UserProfile = global_apps.get_model('identity_access', 'UserProfile')

    if tenant_id is not None:
        allowed = _user_tenant_ids(user, CoreTenant, TenantMember, UserProfile)
        if int(tenant_id) not in allowed:
            return None, ERR_TENANT_NOT_ALLOWED
        return CoreTenant.objects.filter(id=tenant_id).first(), None

    allowed = _user_tenant_ids(user, CoreTenant, TenantMember, UserProfile)
    if not allowed:
        return None, ERR_TENANT_NOT_FOUND
    if len(allowed) > 1:
        return None, ERR_TENANT_REQUIRED
    return CoreTenant.objects.filter(id=next(iter(allowed))).first(), None


def _user_tenant_ids(user, CoreTenant, TenantMember, UserProfile):
    """Tập tenant id mà user thực sự thuộc (owner + profile + membership)."""
    ids = set(
        CoreTenant.objects.filter(owner_user=user).values_list('id', flat=True))
    ids.update(
        UserProfile.objects.filter(user=user)
        .exclude(tenant__isnull=True)
        .values_list('tenant_id', flat=True))
    ids.update(
        TenantMember.objects.filter(user=user).values_list('tenant_id', flat=True))
    return ids


@shared_task(name="user_workspace.reconcile_all_dnse_transactions_task")
def reconcile_all_dnse_transactions_task():
    from service_ops.broker_runtime import in_quiet_hours
    if in_quiet_hours():
        return {"ok": True, "triggered_count": 0, "skipped": "quiet_hours"}
    user_ids = list(DNSECredential.objects.filter(is_active=True).values_list("user_id", flat=True))
    for user_id in user_ids:
        # P0-DATA-01: không truyền `tenant_id` ở fan-out ⇒ user đa tenant bị
        # từ chối ở task con (fail-closed). Cần scheduler truyền tenant theo
        # membership; báo coordinator (ngoài phạm vi slice này).
        reconcile_dnse_transactions_task.delay(user_id)
    return {"ok": True, "triggered_count": len(user_ids)}


@shared_task(name="user_workspace.sync_all_dnse_balances_task")
def sync_all_dnse_balances_task():
    from service_ops.broker_runtime import in_quiet_hours
    if in_quiet_hours():
        return {"ok": True, "triggered_count": 0, "skipped": "quiet_hours"}
    user_ids = list(DNSECredential.objects.filter(is_active=True).values_list("user_id", flat=True))
    for user_id in user_ids:
        sync_dnse_balances_task.delay(user_id)
    return {"ok": True, "triggered_count": len(user_ids)}


@shared_task(name="user_workspace.sync_dnse_accounts_task", bind=True, max_retries=3, default_retry_delay=60)
def sync_dnse_accounts_task(self, user_id: int, tenant_id: int | None = None):
    """Đồng bộ tiểu khoản DNSE.

    `tenant_id` là keyword có default None để call site cũ (`views_dnse.py` —
    ngoài phạm vi slice này) không vỡ. Khi None: user thuộc đúng 1 tenant thì
    dùng tenant đó; user đa tenant thì **từ chối** (`tenant_required`) — KHÔNG
    tự chọn "first portfolio" như bản cũ `tasks.py:78`.
    """
    # SAFE-03 lớp worker: task đã vào queue cũng phải bị chặn khi kill-switch
    # bật. Đặt ở ĐẦU thân hàm để task thoát trước khi chạm broker.
    try:
        from service_ops.broker_runtime import BrokerWriteDisabled, check_kill_switch
        check_kill_switch('global')
    except BrokerWriteDisabled as exc:
        logger.warning(
            'kill-switch chặn task %s (user=%s): %s',
            'sync_dnse_accounts_task', user_id, exc,
        )
        return {'ok': False, 'error': 'broker_writes_disabled'}

    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return {"ok": False, "error": "User not found"}

    tenant, tenant_error = _resolve_tenant_for_user(user, tenant_id)
    if tenant_error:
        logger.warning(
            "sync_dnse_accounts_task: từ chối vì không resolve được tenant cho user %s — %s",
            user_id, tenant_error,
        )
        return {"ok": False, "error": tenant_error}

    try:
        credential = DNSECredential.objects.select_related("user").get(user_id=user_id, is_active=True)
    except DNSECredential.DoesNotExist:
        logger.warning("sync_dnse_accounts_task: Không tìm thấy credential active cho user %s", user_id)
        return {"ok": False, "error": "Credential not found"}

    try:
        auth_result = bootstrap_dnse_session(credential)
    except (DNSECredentialMissingError, DNSEVnbrokerUnavailableError, DNSEAdapterError) as exc:
        logger.warning("sync_dnse_accounts_task: auth thất bại cho user %s — %s", user_id, exc)
        return {"ok": False, "error": str(exc)}

    client = auth_result["session"]

    try:
        dnse_accounts = fetch_sub_accounts(client)
    except Exception as exc:
        logger.error("sync_dnse_accounts_task: fetch_sub_accounts thất bại cho user %s — %s", user_id, exc)
        return {"ok": False, "error": f"Lấy danh sách tiểu khoản từ DNSE thất bại: {exc}"}

    # P0-DATA-01: scope theo tenant, KHÔNG dùng `filter(user_id=…).first()`.
    portfolio = Portfolio.objects.filter(user_id=user_id, tenant=tenant).first()
    if not portfolio:
        portfolio = Portfolio.objects.create(
            user_id=user_id,
            tenant=tenant,
            name="Danh mục chính",
            description="Tự động khởi tạo từ DNSE sync",
        )

    sync_results = []
    with transaction.atomic():
        for acc in dnse_accounts:
            ext_id = acc.get("account_number") or acc.get("accountNo") or acc.get("id")
            if not ext_id:
                continue

            acc_type_raw = acc.get("account_type") or acc.get("accountType", "1")
            acc_name = acc.get("account_name") or acc.get("accountName") or f"DNSE {ext_id}"

            type_map = {
                "1": SubAccount.TypeChoices.CASH,
                "6": SubAccount.TypeChoices.MARGIN,
                "3": SubAccount.TypeChoices.SPECIAL,
            }
            core_type = type_map.get(str(acc_type_raw), SubAccount.TypeChoices.CASH)

            sub_acc, created = SubAccount.objects.update_or_create(
                user_id=user_id,
                tenant=tenant,
                external_id=str(ext_id),
                broker_source="DNSE",
                defaults={
                    "portfolio": portfolio,
                    "display_name": acc_name,
                    "name": acc_name,
                    "broker": "DNSE",
                    "account_number": str(ext_id),
                    "type": core_type,
                    "sync_status": {
                        "last_sync_at": timezone.now().isoformat(),
                        "source": "DNSE_LIGHTSPEED_API",
                    },
                },
            )
            sync_results.append({"external_id": str(ext_id), "sub_account_id": sub_acc.id, "created": created})

    credential.last_sync_at = timezone.now()
    credential.save(update_fields=["last_sync_at", "updated_at"])

    return {"ok": True, "synced_count": len(sync_results), "details": sync_results}


@shared_task(name="user_workspace.sync_dnse_balances_task", bind=True, max_retries=3, default_retry_delay=120)
def sync_dnse_balances_task(self, user_id: int):
    # SAFE-03 lớp worker: task đã vào queue cũng phải bị chặn khi kill-switch
    # bật. Đặt ở ĐẦU thân hàm để task thoát trước khi chạm broker.
    try:
        from service_ops.broker_runtime import BrokerWriteDisabled, check_kill_switch
        check_kill_switch('global')
    except BrokerWriteDisabled as exc:
        logger.warning(
            'kill-switch chặn task %s (user=%s): %s',
            'sync_dnse_balances_task', user_id, exc,
        )
        return {'ok': False, 'error': 'broker_writes_disabled'}

    try:
        credential = DNSECredential.objects.get(user_id=user_id, is_active=True)
    except DNSECredential.DoesNotExist:
        return {"ok": False, "error": "Credential not found"}

    sub_accounts = SubAccount.objects.filter(user_id=user_id, broker_source="DNSE").exclude(external_id="")
    if not sub_accounts.exists():
        return {"ok": True, "message": "Không có tiểu khoản DNSE nào được liên kết."}

    try:
        auth_result = bootstrap_dnse_session(credential)
    except (DNSECredentialMissingError, DNSEVnbrokerUnavailableError, DNSEAdapterError) as exc:
        logger.warning("sync_dnse_balances_task: auth thất bại cho user %s — %s", user_id, exc)
        return {"ok": False, "error": str(exc)}

    client = auth_result["session"]
    sync_date = timezone.now().date()
    sync_results = []

    for sub_acc in sub_accounts:
        try:
            data = fetch_account_balance(client, account_number=sub_acc.external_id)

            AccountSnapshot.objects.update_or_create(
                sub_account=sub_acc,
                date=sync_date,
                defaults={
                    "cash_balance": data.get("cash", 0),
                    "stock_value": data.get("stock_value", 0),
                    "debt": data.get("debt", 0),
                    "net_equity": data.get("net_equity", 0),
                },
            )

            sub_acc.sync_status.update(
                {
                    "last_balance_sync_at": timezone.now().isoformat(),
                    "last_nav": float(data.get("net_equity", 0)),
                }
            )
            sub_acc.save(update_fields=["sync_status", "updated_at"])

            sync_results.append(
                {
                    "sub_account_id": sub_acc.id,
                    "external_id": sub_acc.external_id,
                    "nav": float(data.get("net_equity", 0)),
                }
            )
        except Exception as exc:
            logger.error("sync_dnse_balances_task: lỗi acc %s — %s", sub_acc.external_id, exc)
            continue

    return {"ok": True, "date": sync_date.isoformat(), "synced_count": len(sync_results)}


@shared_task(name="user_workspace.reconcile_dnse_transactions_task", bind=True, max_retries=3)
def reconcile_dnse_transactions_task(self, user_id: int, days_back: int = 7):
    # SAFE-03 lớp worker: task đã vào queue cũng phải bị chặn khi kill-switch
    # bật. Đặt ở ĐẦU thân hàm để task thoát trước khi chạm broker.
    try:
        from service_ops.broker_runtime import BrokerWriteDisabled, check_kill_switch
        check_kill_switch('global')
    except BrokerWriteDisabled as exc:
        logger.warning(
            'kill-switch chặn task %s (user=%s): %s',
            'reconcile_dnse_transactions_task', user_id, exc,
        )
        return {'ok': False, 'error': 'broker_writes_disabled'}

    try:
        credential = DNSECredential.objects.get(user_id=user_id, is_active=True)
    except DNSECredential.DoesNotExist:
        return {"ok": False, "error": "Credential not found"}

    sub_accounts = SubAccount.objects.filter(user_id=user_id, broker_source="DNSE").exclude(external_id="")
    if not sub_accounts.exists():
        return {"ok": True, "message": "Không có tiểu khoản DNSE nào được liên kết."}

    try:
        auth_result = bootstrap_dnse_session(credential)
    except (DNSECredentialMissingError, DNSEVnbrokerUnavailableError, DNSEAdapterError) as exc:
        logger.warning("reconcile_dnse_transactions_task: auth thất bại cho user %s — %s", user_id, exc)
        return {"ok": False, "error": str(exc)}

    client = auth_result["session"]
    end_date = timezone.now().date()
    start_date = end_date - timezone.timedelta(days=days_back)
    sync_results = []

    with transaction.atomic():
        for sub_acc in sub_accounts:
            try:
                orders = fetch_order_history(
                    client,
                    account_number=sub_acc.external_id,
                    from_date=start_date.isoformat(),
                    to_date=end_date.isoformat(),
                )

                for order in orders:
                    status = str(order.get("status") or "").upper()
                    if status and status not in ("FILLED", "MATCHED", "EXECUTED"):
                        continue

                    ext_id = str(order.get("order_id") or order.get("orderId") or order.get("deal_id") or "")
                    if not ext_id:
                        continue

                    raw_type = str(order.get("type") or order.get("side") or "BUY").upper()
                    type_map = {
                        "BUY": Transaction.TransactionType.BUY,
                        "SELL": Transaction.TransactionType.SELL,
                    }
                    core_type = type_map.get(raw_type, Transaction.TransactionType.BUY)

                    tx_obj, created = Transaction.objects.update_or_create(
                        portfolio=sub_acc.portfolio,
                        external_id=ext_id,
                        defaults={
                            "symbol": str(order.get("symbol") or order.get("ticker") or "").upper(),
                            "transaction_type": core_type,
                            "date": order.get("date") or order.get("matched_date") or start_date.isoformat(),
                            "price": order.get("price") or order.get("matched_price") or 0,
                            "quantity": order.get("quantity") or order.get("matched_quantity") or 0,
                            "fee": order.get("fee") or 0,
                            "tax": order.get("tax") or 0,
                            "note": f"DNSE LightSpeed sync: {ext_id}",
                        },
                    )
                    sync_results.append({"external_id": ext_id, "transaction_id": tx_obj.id, "created": created})

            except Exception as exc:
                logger.error("reconcile_dnse_transactions_task: lỗi acc %s — %s", sub_acc.external_id, exc)
                continue

    return {"ok": True, "synced_count": len(sync_results)}


# W2 FIX: register screener tasks with the celery app.
# `celery.app.autodiscover_tasks()` only imports `<app>.tasks`, so the
# `@shared_task`s in `screener_tasks.py` were NEVER registered in workers —
# beat sent `screener_scheduled_run` every 5m but workers rejected it with
# "Received unregistered task" (same for `run_screener_scan_task.delay`
# from run-now). Re-export here so autodiscovery picks them up.
from .screener_tasks import (  # noqa: F401
    run_screener_scan_task,
    screener_scheduled_run,
)


@shared_task(name="user_workspace.test_broker_connection_task", bind=True, max_retries=0)
def test_broker_connection_task(self, config_id: int, tenant_id: int | None = None):
    """B1.2: test-connection broker read-only trong worker (không I/O trong request).

    Nhận config_id (không nhận secret - đọc từ DB). Cập nhật status/last_verified_at/last_error.

    P0-ISO-03: `tenant_id` là keyword default None (tương thích ngược). Khi được
    truyền, config phải thuộc tenant đó - sai thì fail-closed TRƯỚC khi gọi
    broker, nên 2 tenant của cùng user không thể sync credential của nhau.
    """
    # SAFE-03 lớp worker: đặt ở ĐẦU thân hàm để task thoát trước khi chạm
    # broker. Biến log là `config_id` (hàm này không có `user_id`).
    try:
        from service_ops.broker_runtime import BrokerWriteDisabled, check_kill_switch
        check_kill_switch('global')
    except BrokerWriteDisabled as exc:
        logger.warning(
            'kill-switch chặn task %s (config=%s): %s',
            'test_broker_connection_task', config_id, exc,
        )
        return {'ok': False, 'error': 'broker_writes_disabled'}

    from .broker import dnse as dnse_schema
    from .models import UserBrokerConfig

    try:
        config = UserBrokerConfig.objects.select_related('user').get(id=config_id)
    except UserBrokerConfig.DoesNotExist:
        return {'ok': False, 'error': 'config_not_found'}

    if tenant_id is not None and config.tenant_id != int(tenant_id):
        logger.warning(
            'test_broker_connection_task: config %s thuộc tenant %s, yêu cầu tenant %s — từ chối',
            config_id, config.tenant_id, tenant_id,
        )
        return {'ok': False, 'error': 'tenant_mismatch'}

    secrets = config.get_secrets()
    if config.provider == 'dnse':
        from .broker import dnse as dnse_schema
        result = dnse_schema.test_connection(secrets)
    elif config.provider == 'ssi':
        from .broker import ssi as ssi_schema
        result = ssi_schema.test_connection(secrets)
    elif config.provider == 'tcbs':
        from .broker import tcbs as tcbs_schema
        result = tcbs_schema.test_connection(secrets)
    else:
        result = {'ok': False, 'error': 'not_supported_yet'}

    if result.get('ok'):
        config.status = UserBrokerConfig.StatusChoices.CONNECTED
        config.last_verified_at = timezone.now()
        config.last_error = ''
    elif result.get('unverified'):
        # B3.2: TCBS thiếu OTP — trạng thái chờ, KHÔNG phải lỗi
        config.status = UserBrokerConfig.StatusChoices.UNVERIFIED
        config.last_error = ''
    else:
        config.status = UserBrokerConfig.StatusChoices.ERROR
        config.last_error = str(result.get('error', 'unknown'))[:500]
    config.save(update_fields=['status', 'last_verified_at', 'last_error', 'updated_at'])
    return result


@shared_task(name='user_workspace.sync_all_broker_positions_task')
def sync_all_broker_positions_task():
    """Wave 1 B1.4: fan-out position-first sync moi credential co secrets.

    Moi config: 1 BrokerSyncRun (running -> succeeded/failed) + sync tung
    SubAccount da lien ket (B1.3). Config thieu tenant => skip (khong doan).
    Guard: kill-switch global + quiet-hours (fail-closed, khong ghi gi).
    """
    from service_ops.broker_runtime import BrokerWriteDisabled

    try:
        _beat_check_kill_switch()
    except BrokerWriteDisabled as exc:
        logger.warning('kill-switch chan fan-out broker positions: %s', exc)
        return {'ok': False, 'error': 'broker_writes_disabled'}
    if _beat_in_quiet_hours():
        return {'ok': True, 'triggered_count': 0, 'skipped': 'quiet_hours'}

    from .broker.position_sync import sync_account_positions
    from .broker.sync_service import BrokerSyncService
    from .models import (
        BrokerSyncRun,
        SubAccount,
        UserBrokerConfig,
    )

    triggered = 0
    failed = 0
    skipped_no_tenant = 0
    for config in UserBrokerConfig.objects.all().order_by('id'):
        if not config.has_secrets():
            continue
        if config.tenant_id is None:
            skipped_no_tenant += 1
            continue
        run = BrokerSyncRun.objects.create(
            user=config.user, tenant_id=config.tenant_id,
            provider=config.provider, status='running')
        try:
            service = BrokerSyncService.for_config(config)
            merged = {'positions_written': 0, 'collisions': []}
            for sub in SubAccount.objects.filter(
                    broker_config=config).order_by('id'):
                stats = sync_account_positions(service, sub)
                merged['positions_written'] += stats['positions_written']
                merged['collisions'].extend(stats['collisions'])
            run.status = BrokerSyncRun.StatusChoices.SUCCEEDED
            run.stats = merged
        except Exception as exc:
            logger.warning(
                'sync_all_broker_positions: config %s loi — %s',
                config.id, type(exc).__name__,
            )
            run.status = BrokerSyncRun.StatusChoices.FAILED
            run.error = str(exc)[:500]
            failed += 1
        finally:
            run.finished_at = timezone.now()
            run.save()
        triggered += 1
    return {
        'ok': True,
        'triggered_count': triggered,
        'failed': failed,
        'skipped_no_tenant': skipped_no_tenant,
    }


@shared_task(name='user_workspace.sync_broker_account_task', bind=True, max_retries=3)
def sync_broker_account_task(self, config_id: int, sub_account_id: int):
    """Wave 1 B1.6: sync 1 tieu khoan (position-first) trong worker.

    Ghi 1 BrokerSyncRun. Fail-closed: config/sub khong ton tai hoac lech
    tenant => loi ro, khong ghi gi. View POST .../sync/ enqueue task nay.
    """
    from service_ops.broker_runtime import BrokerWriteDisabled, check_kill_switch

    try:
        check_kill_switch('global')
    except BrokerWriteDisabled as exc:
        logger.warning(
            'kill-switch chan task %s (config=%s, sub=%s): %s',
            'sync_broker_account_task', config_id, sub_account_id, exc,
        )
        return {'ok': False, 'error': 'broker_writes_disabled'}

    from .broker.position_sync import sync_account_positions
    from .broker.sync_service import BrokerSyncService
    from .models import (
        BrokerSyncRun,
        SubAccount,
        UserBrokerConfig,
    )

    try:
        config = UserBrokerConfig.objects.select_related('user').get(id=config_id)
        sub = SubAccount.objects.get(id=sub_account_id)
    except (UserBrokerConfig.DoesNotExist, SubAccount.DoesNotExist):
        return {'ok': False, 'error': 'not_found'}
    if sub.broker_config_id != config.id:
        return {'ok': False, 'error': 'account_not_linked'}
    if (config.tenant_id is None or sub.tenant_id != config.tenant_id
            or sub.user_id != config.user_id):
        return {'ok': False, 'error': 'tenant_mismatch'}

    run = BrokerSyncRun.objects.create(
        user=config.user, tenant_id=config.tenant_id,
        provider=config.provider, status='running')
    try:
        service = BrokerSyncService.for_config(config)
        stats = sync_account_positions(service, sub)
        run.status = BrokerSyncRun.StatusChoices.SUCCEEDED
        run.stats = stats
    except Exception as exc:
        logger.warning(
            'sync_broker_account_task: config %s sub %s loi — %s',
            config_id, sub_account_id, type(exc).__name__,
        )
        run.status = BrokerSyncRun.StatusChoices.FAILED
        run.error = str(exc)[:500]
        stats = {'ok': False, 'error': 'sync_failed'}
    finally:
        run.finished_at = timezone.now()
        run.save()
    stats['run_id'] = run.id
    return stats
