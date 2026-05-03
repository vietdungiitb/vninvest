"""
Celery materializer tasks for market_serving.

Reads from legacy DB (read-only via LEGACY_DATABASE_URL) during cutover period,
writes into SymbolSnapshot and SessionFacts in the core DB (default).

After SAAS-15 decommission, swap data source to vnstock feed without changing contract.
"""
import logging

from celery import shared_task
from django.db import OperationalError, connections
from django.utils.timezone import now

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def materialize_symbol_snapshot(self):
    """
    Materializes SymbolSnapshot from legacy DB.
    Runs every 60 seconds via celery beat.
    Marks all existing snapshots stale if legacy DB unreachable (degraded mode).
    """
    from market_serving.models import SymbolSnapshot

    try:
        legacy_url = _get_legacy_db_url()
        if not legacy_url:
            logger.warning(
                "materialize_symbol_snapshot: LEGACY_DATABASE_URL not configured — skipping."
            )
            return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

        rows = _fetch_from_legacy(
            """
            SELECT symbol, last_price, total_volume, price_change_pct, session_date, fetched_at
            FROM portfolio_symbolsnapshot
            ORDER BY fetched_at DESC
            LIMIT 500
            """,
        )

        count = 0
        for row in rows:
            symbol, price, volume, price_change, session_date, fetched_at = row
            SymbolSnapshot.objects.update_or_create(
                symbol=symbol,
                session_date=session_date,
                defaults={
                    'price': price,
                    'volume': volume,
                    'price_change': price_change,
                    'fetched_at': fetched_at or now(),
                    'stale': False,
                    'source': 'legacy_sync',
                    'market_status': 'open',
                },
            )
            count += 1

        logger.info("materialize_symbol_snapshot: upserted %d rows.", count)
        return {'status': 'ok', 'upserted': count}

    except OperationalError as exc:
        logger.error(
            "materialize_symbol_snapshot: legacy DB unreachable — marking snapshots stale. %s",
            exc,
        )
        from market_serving.models import SymbolSnapshot  # noqa: F811

        SymbolSnapshot.objects.update(stale=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def materialize_session_facts(self):
    """
    Materializes SessionFacts (CVD, buy/institutional strength) from legacy DB.
    Runs every 5 minutes via celery beat.
    """
    from market_serving.models import SessionFacts

    try:
        legacy_url = _get_legacy_db_url()
        if not legacy_url:
            logger.warning(
                "materialize_session_facts: LEGACY_DATABASE_URL not configured — skipping."
            )
            return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

        rows = _fetch_from_legacy(
            """
            SELECT
                symbol,
                session_date,
                cvd_normalized,
                buy_strength,
                institutional_strength,
                whale_net_flow,
                dark_flow_score
            FROM portfolio_sessionfacts
            ORDER BY session_date DESC
            LIMIT 500
            """,
        )

        count = 0
        for row in rows:
            (
                symbol,
                session_date,
                cvd_normalized,
                buy_strength,
                institutional_strength,
                whale_net_flow,
                dark_flow_score,
            ) = row
            SessionFacts.objects.update_or_create(
                symbol=symbol,
                session_date=session_date,
                defaults={
                    'cvd_normalized': cvd_normalized or 0.0,
                    'buy_strength': buy_strength or 0.0,
                    'institutional_strength': institutional_strength or 0.0,
                    'whale_net_flow': whale_net_flow or 0,
                    'dark_flow_score': dark_flow_score or 0.0,
                },
            )
            count += 1

        logger.info("materialize_session_facts: upserted %d rows.", count)
        return {'status': 'ok', 'upserted': count}

    except OperationalError as exc:
        logger.error(
            "materialize_session_facts: legacy DB unreachable. %s", exc
        )
        raise self.retry(exc=exc)


@shared_task
def backfill_symbol_snapshots(days_back: int = 30):
    """
    One-time backfill task for SymbolSnapshot.
    Reads historical snapshots from legacy DB up to `days_back` days.
    """
    from market_serving.models import SymbolSnapshot

    legacy_url = _get_legacy_db_url()
    if not legacy_url:
        return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

    rows = _fetch_from_legacy(
        """
        SELECT symbol, last_price, total_volume, price_change_pct, session_date, fetched_at
        FROM portfolio_symbolsnapshot
        WHERE fetched_at > NOW() - INTERVAL %(days)s DAY
        ORDER BY fetched_at ASC
        """,
        params={'days': days_back},
    )

    count = 0
    for row in rows:
        symbol, price, volume, price_change, session_date, fetched_at = row
        SymbolSnapshot.objects.update_or_create(
            symbol=symbol,
            session_date=session_date,
            defaults={
                'price': price,
                'volume': volume,
                'price_change': price_change,
                'fetched_at': fetched_at or now(),
                'stale': False,
                'source': 'backfill',
                'market_status': 'closed',
            },
        )
        count += 1

    logger.info("backfill_symbol_snapshots: upserted %d rows (%d days).", count, days_back)
    return {'status': 'ok', 'upserted': count}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_legacy_db_url():
    """Return legacy DB URL from settings if configured, else None."""
    from django.conf import settings

    db_cfg = settings.DATABASES.get('legacy_readonly', {})
    return db_cfg.get('NAME') or db_cfg.get('HOST') or None


def _fetch_from_legacy(sql, params=None):
    """Execute raw SELECT on legacy_readonly connection and return all rows."""
    from django.conf import settings

    if 'legacy_readonly' not in settings.DATABASES:
        return []

    with connections['legacy_readonly'].cursor() as cursor:
        cursor.execute(sql, params or [])
        return cursor.fetchall()
