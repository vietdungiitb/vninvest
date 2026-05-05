"""
Celery materializer tasks for signal_intelligence.

Reads whale alerts + unified signal events from legacy DB (read-only during cutover),
writes into UnifiedAlert and WhaleAlertCanonical in the core DB.

After SAAS-15 decommission, swap source to core realtime feed.
"""
import logging
import uuid

from celery import shared_task
from django.db import OperationalError, connections
from django.utils.timezone import now

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def materialize_unified_alerts(self):
    """
    Materializes UnifiedAlert from legacy whale alert tables.
    Runs every 5 minutes via celery beat.
    """
    from signal_intelligence.models import UnifiedAlert

    try:
        legacy_url = _get_legacy_db_url()
        if not legacy_url:
            logger.warning(
                "materialize_unified_alerts: LEGACY_DATABASE_URL not configured — skipping."
            )
            return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

        rows = _fetch_from_legacy(
            """
            SELECT
                id,
                symbol,
                alert_type,
                severity,
                direction,
                triggered_at,
                message,
                extra_data
            FROM portfolio_unifiedalert
            ORDER BY triggered_at DESC
            LIMIT 1000
            """
        )

        count = 0
        for row in rows:
            (
                legacy_id,
                symbol,
                alert_type,
                severity,
                direction,
                triggered_at,
                message,
                extra_data,
            ) = row
            UnifiedAlert.objects.get_or_create(
                alert_id=_deterministic_uuid('unified_alert', legacy_id),
                defaults={
                    'symbol': symbol,
                    'alert_type': _map_alert_type(alert_type),
                    'severity': _map_severity(severity),
                    'direction': _map_direction(direction),
                    'triggered_at': triggered_at or now(),
                    'message': message or '',
                    'extra_data': extra_data or {},
                },
            )
            count += 1

        logger.info("materialize_unified_alerts: upserted %d rows.", count)
        return {'status': 'ok', 'upserted': count}

    except OperationalError as exc:
        logger.error("materialize_unified_alerts: legacy DB unreachable. %s", exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def materialize_whale_feed_aggregate(self, symbol: str | None = None):
    """
    Materializes WhaleAlertCanonical from legacy whale order tables.
    Runs every 5 minutes per symbol (or all symbols if symbol=None).
    """
    from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical

    try:
        legacy_url = _get_legacy_db_url()
        if not legacy_url:
            return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

        sql = """
            SELECT
                id,
                symbol,
                side,
                matched_value,
                price,
                is_dark_flow,
                triggered_at
            FROM portfolio_whalealertcanonical
        """
        params: list = []
        if symbol:
            sql += " WHERE symbol = %s"
            params.append(symbol)
        sql += " ORDER BY triggered_at DESC LIMIT 2000"

        rows = _fetch_from_legacy(sql, params)

        count = 0
        for row in rows:
            (
                legacy_id,
                sym,
                side,
                matched_value,
                price,
                is_dark_flow,
                triggered_at,
            ) = row

            alert_id = _deterministic_uuid('whale_canonical', legacy_id)

            alert, _ = UnifiedAlert.objects.get_or_create(
                alert_id=alert_id,
                defaults={
                    'symbol': sym,
                    'alert_type': 'whale',
                    'severity': 'high',
                    'direction': 'buy' if side == 'buy' else 'sell',
                    'triggered_at': triggered_at or now(),
                    'message': '',
                    'extra_data': {},
                },
            )

            WhaleAlertCanonical.objects.get_or_create(
                alert=alert,
                defaults={
                    'side': 'buy' if side == 'buy' else 'sell',
                    'matched_value': matched_value or 0,
                    'price': price or 0,
                    'is_dark_flow': bool(is_dark_flow),
                },
            )
            count += 1

        logger.info(
            "materialize_whale_feed_aggregate: upserted %d rows (symbol=%s).",
            count,
            symbol or 'all',
        )
        return {'status': 'ok', 'upserted': count}

    except OperationalError as exc:
        logger.error("materialize_whale_feed_aggregate: legacy DB unreachable. %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_legacy_db_url():
    from django.conf import settings

    db_cfg = settings.DATABASES.get('legacy_readonly', {})
    return db_cfg.get('NAME') or db_cfg.get('HOST') or None


def _fetch_from_legacy(sql, params=None):
    from django.conf import settings

    if 'legacy_readonly' not in settings.DATABASES:
        return []

    with connections['legacy_readonly'].cursor() as cursor:
        cursor.execute(sql, params or [])
        return cursor.fetchall()


def _deterministic_uuid(namespace_name: str, legacy_id) -> uuid.UUID:
    """
    Generate a deterministic UUID5 from legacy table name + id.
    Ensures idempotent upserts across multiple materializer runs.
    """
    ns = uuid.uuid5(uuid.NAMESPACE_DNS, f'vninvest.core.{namespace_name}')
    return uuid.uuid5(ns, str(legacy_id))


def _map_alert_type(raw) -> str:
    mapping = {
        'whale': 'whale',
        'dark_flow': 'dark_flow',
        'signal': 'signal',
        'system': 'system',
    }
    return mapping.get(str(raw).lower(), 'signal')


def _map_severity(raw) -> str:
    mapping = {
        'critical': 'critical',
        'high': 'high',
        'medium': 'medium',
        'low': 'low',
    }
    return mapping.get(str(raw).lower(), 'medium')


def _map_direction(raw) -> str:
    mapping = {
        'buy': 'buy',
        'sell': 'sell',
        'neutral': 'neutral',
    }
    return mapping.get(str(raw).lower(), 'neutral')
