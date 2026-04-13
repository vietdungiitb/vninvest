from __future__ import annotations

from celery import shared_task

from portfolio.models import WhaleConfigRollout
from portfolio.services import (
    activate_due_scheduled_whale_config_rollouts,
    ensure_rollout_worker_ack_records,
    get_live_celery_worker_names,
    monitor_whale_config_rollout_anomalies,
    record_whale_config_worker_ack,
    refresh_rollout_propagation_status,
)


@shared_task(bind=True, name='portfolio.tasks.activate_due_whale_config_rollouts', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def activate_due_whale_config_rollouts(self) -> dict:
    activated = activate_due_scheduled_whale_config_rollouts()
    return {
        'status': 'ok',
        'activated_count': len(activated),
        'activated': activated,
    }


@shared_task(bind=True, name='portfolio.tasks.monitor_whale_config_anomalies', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def monitor_whale_config_anomalies(self, auto_revert: bool = True) -> dict:
    results = monitor_whale_config_rollout_anomalies(auto_revert=auto_revert)
    auto_reverted = [result for result in results if result.get('auto_reverted')]
    anomalies = [result for result in results if not result.get('anomaly', {}).get('healthy', True)]
    return {
        'status': 'ok',
        'checked_count': len(results),
        'anomaly_count': len(anomalies),
        'auto_reverted_count': len(auto_reverted),
        'results': results,
    }


@shared_task(bind=True, name='portfolio.tasks.refresh_whale_config_rollout_status', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def refresh_whale_config_rollout_status(self, rollout_id: int) -> dict:
    rollout = WhaleConfigRollout.objects.select_related('version').get(pk=rollout_id)
    worker_result = get_live_celery_worker_names()
    ensure_rollout_worker_ack_records(rollout, worker_names=worker_result['workers'])
    snapshot = refresh_rollout_propagation_status(rollout)
    return {
        'status': rollout.status,
        'rollout_id': rollout.id,
        'version_code': rollout.version.version_code,
        'signal': snapshot['signal'],
        'acked_count': snapshot['acked_count'],
        'expected_count': snapshot['expected_count'],
        'missing_workers': snapshot['missing_workers'],
        'stale_workers': snapshot['stale_workers'],
    }


@shared_task(bind=True, name='portfolio.tasks.ack_whale_config_rollout', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def ack_whale_config_rollout(
    self,
    rollout_id: int,
    worker_name: str | None = None,
    worker_version: str | None = None,
    details: str = '',
) -> dict:
    rollout = WhaleConfigRollout.objects.select_related('version').get(pk=rollout_id)
    resolved_worker_name = worker_name or getattr(self.request, 'hostname', '') or 'unknown-worker'
    resolved_version = worker_version or rollout.version.version_code

    ack = record_whale_config_worker_ack(
        rollout,
        worker_name=resolved_worker_name,
        worker_version=resolved_version,
        acked=True,
        details=details or 'ack_from_task',
    )
    snapshot = refresh_rollout_propagation_status(rollout)
    return {
        'status': rollout.status,
        'rollout_id': rollout.id,
        'worker_name': ack.worker_name,
        'worker_version': ack.worker_version,
        'signal': snapshot['signal'],
        'acked_count': snapshot['acked_count'],
        'expected_count': snapshot['expected_count'],
    }
