from celery import shared_task

from portfolio.global_signal_policy_helpers import get_global_signal_retention_policy
from .models import SignalServiceRun, WhaleAlertEvent
from .services_global_signal_distribution import deliver_whale_alert_event
from .services_money_flow_retention import (
    materialize_money_flow_forensic_window_from_whale_event,
    should_materialize_money_flow_forensic_window,
)
from .services_signal_run_registry import (
    create_signal_service_run,
    finish_signal_service_run,
    resolve_signal_run_status,
    resolve_signal_run_type,
    start_signal_service_run,
)
from .services_global_whale_alerts import run_global_whale_alert_detection


@shared_task(bind=True, name='portfolio.tasks.detect_and_store_global_whale_alerts', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_and_store_global_whale_alerts(self, symbol: str | None = None, run_id: int | None = None) -> dict:
    task_id = getattr(getattr(self, 'request', None), 'id', None)
    if run_id:
        run = start_signal_service_run(SignalServiceRun.objects.get(id=run_id), task_id=task_id)
    else:
        run = create_signal_service_run(
            service_domain=SignalServiceRun.ServiceDomain.WHALE,
            run_type=resolve_signal_run_type(symbol),
            params_json={'symbol': str(symbol).strip().upper()} if str(symbol or '').strip() else {},
            task_id=task_id,
        )

    try:
        result = run_global_whale_alert_detection(symbol=symbol)
        created_event_ids = [int(event_id) for event_id in result.get('created_event_ids') or [] if event_id]
        retention_policy = get_global_signal_retention_policy()
        forensic_window_ids = []
        if created_event_ids:
            created_events = list(WhaleAlertEvent.objects.filter(id__in=created_event_ids))
            for event in created_events:
                if not should_materialize_money_flow_forensic_window(event.severity, retention_policy):
                    continue
                forensic_result = materialize_money_flow_forensic_window_from_whale_event(event, policy=retention_policy)
                if forensic_result.get('created'):
                    forensic_window_ids.append(int(forensic_result.get('window_id') or 0))
        for event_id in created_event_ids:
            distribute_whale_alert_event.delay(event_id)

        stored_items = int(result.get('created', 0) or 0) + int(result.get('updated', 0) or 0)
        status_value = resolve_signal_run_status(
            errors=int(result.get('errors', 0) or 0),
            processed_items=int(result.get('processed', 0) or 0),
            stored_items=stored_items,
        )
        finish_signal_service_run(
            run,
            status=status_value,
            processed_items=int(result.get('processed', 0) or 0),
            stored_items=stored_items,
            failed_items=int(result.get('errors', 0) or 0),
            progress_pct=100.0,
            log=(
                'whale symbols={symbols} processed={processed} created={created} '
                'updated={updated} cached={cached} skipped_locked={skipped_locked} errors={errors}'
            ).format(**result),
        )
        return {
            **result,
            'distribution_enqueued': len(created_event_ids),
            'forensic_window_count': len([window_id for window_id in forensic_window_ids if window_id]),
            'forensic_window_ids': [window_id for window_id in forensic_window_ids if window_id],
            'run_id': run.id,
        }
    except Exception as exc:
        finish_signal_service_run(
            run,
            status=SignalServiceRun.StatusChoices.FAILED,
            processed_items=0,
            stored_items=0,
            failed_items=1,
            progress_pct=100.0,
            log=f'whale detection exception: {exc}',
        )
        raise


@shared_task(bind=True, name='portfolio.tasks.distribute_whale_alert_event', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def distribute_whale_alert_event(self, event_id: int) -> dict:
    del self
    event = WhaleAlertEvent.objects.get(id=event_id)
    result = deliver_whale_alert_event(event=event)
    return {
        **result,
        'event_id': event.event_id,
    }
