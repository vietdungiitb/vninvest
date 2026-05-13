"""Celery task discovery shim for signal_intelligence materializers."""
from celery import shared_task
from .materializers import materialize_unified_alerts, materialize_whale_feed_aggregate

__all__ = [
    'materialize_unified_alerts',
    'materialize_whale_feed_aggregate',
    'run_signal_detection_job',
]

@shared_task(bind=True)
def run_signal_detection_job(self, domain: str = 'all', symbol: str = None):
    """
    Native: Kích hoạt signal detection job.
    Hiện tại chủ yếu trigger materializers.
    """
    if domain in {'all', 'whale'}:
        materialize_whale_feed_aggregate.delay(symbol=symbol)
    if domain in {'all', 'dark_flow'}:
        materialize_unified_alerts.delay()
        
    return {'status': 'accepted', 'domain': domain, 'symbol': symbol}