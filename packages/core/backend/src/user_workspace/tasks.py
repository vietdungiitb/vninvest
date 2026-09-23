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


@shared_task(name="user_workspace.reconcile_all_dnse_transactions_task")
def reconcile_all_dnse_transactions_task():
    from service_ops.broker_runtime import in_quiet_hours
    if in_quiet_hours():
        return {"ok": True, "triggered_count": 0, "skipped": "quiet_hours"}
    user_ids = list(DNSECredential.objects.filter(is_active=True).values_list("user_id", flat=True))
    for user_id in user_ids:
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
def sync_dnse_accounts_task(self, user_id: int):
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

    portfolio = Portfolio.objects.filter(user_id=user_id).first()
    if not portfolio:
        portfolio = Portfolio.objects.create(
            user_id=user_id,
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
from .screener_tasks import (  # noqa: E402,F401
    run_screener_scan_task,
    screener_scheduled_run,
)


@shared_task(name="user_workspace.test_broker_connection_task", bind=True, max_retries=0)
def test_broker_connection_task(self, config_id: int):
    """B1.2: test-connection broker read-only trong worker (không I/O trong request).

    Nhận config_id (không nhận secret — đọc từ DB). Cập nhật status/last_verified_at/last_error.
    """
    from .broker import dnse as dnse_schema
    from .models import UserBrokerConfig

    try:
        config = UserBrokerConfig.objects.select_related('user').get(id=config_id)
    except UserBrokerConfig.DoesNotExist:
        return {'ok': False, 'error': 'config_not_found'}

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
