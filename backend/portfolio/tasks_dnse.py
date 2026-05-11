# DEPRECATED: DNSE tasks moved to packages/core/backend/src/user_workspace/tasks.py
# This file exists only to prevent import errors in legacy backend during Phase 3-4
# All actual implementations are in the core system.
# DO NOT ADD NEW CODE HERE — this module will be deleted in Phase 6

from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(name="portfolio.sync_dnse_accounts_task", bind=True, max_retries=1)
def sync_dnse_accounts_task(self, user_id: int):
    """
    DEPRECATED: This is a legacy stub.
    Actual implementation: packages/core/backend/src/user_workspace/tasks.py::sync_dnse_accounts_task
    
    During Phase 3-4 shadow run, legacy backend remains in readonly mode and this task
    will not be called. Core system handles all DNSE account syncing.
    """
    logger.warning("sync_dnse_accounts_task called on legacy backend (Phase 3-4) — redirecting to core system")
    return {"status": "deprecated", "msg": "use core system instead"}


@shared_task(name="portfolio.sync_all_dnse_balances_task")
def sync_all_dnse_balances_task():
    """
    DEPRECATED: This is a legacy stub.
    Actual implementation: packages/core/backend/src/user_workspace/tasks.py::sync_all_dnse_balances_task
    """
    logger.warning("sync_all_dnse_balances_task called on legacy backend (Phase 3-4) — redirecting to core system")
    return {"status": "deprecated", "msg": "use core system instead"}


@shared_task(name="portfolio.sync_dnse_balances_task")
def sync_dnse_balances_task(user_id: int):
    """
    DEPRECATED: This is a legacy stub.
    Actual implementation: packages/core/backend/src/user_workspace/tasks.py
    """
    logger.warning("sync_dnse_balances_task called on legacy backend (Phase 3-4) — redirecting to core system")
    return {"status": "deprecated", "msg": "use core system instead"}


@shared_task(name="portfolio.reconcile_all_dnse_transactions_task")
def reconcile_all_dnse_transactions_task():
    """
    DEPRECATED: This is a legacy stub.
    Actual implementation: packages/core/backend/src/user_workspace/tasks.py::reconcile_all_dnse_transactions_task
    """
    logger.warning("reconcile_all_dnse_transactions_task called on legacy backend (Phase 3-4) — redirecting to core system")
    return {"status": "deprecated", "msg": "use core system instead"}


@shared_task(name="portfolio.reconcile_dnse_transactions_task")
def reconcile_dnse_transactions_task(user_id: int):
    """
    DEPRECATED: This is a legacy stub.
    Actual implementation: packages/core/backend/src/user_workspace/tasks.py
    """
    logger.warning("reconcile_dnse_transactions_task called on legacy backend (Phase 3-4) — redirecting to core system")
    return {"status": "deprecated", "msg": "use core system instead"}
