"""
Celery materializer tasks for market_serving.

Reads from legacy DB (read-only via LEGACY_DATABASE_URL) during cutover period,
writes into SymbolSnapshot and SessionFacts in the core DB (default).

SM-P0.1: Fixed SQL to use correct legacy tables:
  - portfolio_tickersessionclose  → SymbolSnapshot
  - portfolio_whalealertevent     → SessionFacts (whale aggregates) + UnifiedAlert
  - portfolio_orderflowsignal     → SessionFacts (strength/cvd fields)

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

    SM-P0.1 FIX: Reads from portfolio_tickersessionclose (was: non-existent portfolio_symbolsnapshot).
    Source table: portfolio_tickersessionclose.
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
            SELECT
                tsc.symbol,
                tsc.close_price AS last_price,
                COALESCE(tsc.volume, 0) AS total_volume,
                COALESCE(tsc.change_pct, 0) AS price_change_pct,
                COALESCE(tsc.change_value, 0) AS price_change_value,
                tsc.session_date,
                tsc.captured_at AS fetched_at
            FROM portfolio_tickersessionclose tsc
            WHERE tsc.session_date = (
                SELECT MAX(inner_tsc.session_date)
                FROM portfolio_tickersessionclose inner_tsc
            )
            ORDER BY tsc.symbol
            LIMIT 1000
            """,
        )

        count = 0
        for row in rows:
            symbol, last_price, total_volume, price_change_pct, price_change_value, session_date, fetched_at = row
            SymbolSnapshot.objects.update_or_create(
                symbol=symbol,
                session_date=session_date,
                defaults={
                    'price': last_price,
                    'price_change': price_change_value,
                    'price_change_pct': price_change_pct,
                    'volume': total_volume,
                    'fetched_at': fetched_at or now(),
                    'stale': False,
                    'source': 'legacy_sync',
                    'market_status': 'closed',
                },
            )
            count += 1

        logger.info(
            "materialize_symbol_snapshot: upserted %d rows from portfolio_tickersessionclose.",
            count,
        )
        return {'status': 'ok', 'upserted': count, 'source_table': 'portfolio_tickersessionclose'}

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
    Materializes SessionFacts from legacy DB.
    Runs every 5 minutes via celery beat.

    SM-P0.1 FIX: Aggregates from portfolio_whalealertevent (was: non-existent portfolio_sessionfacts).
    cvd_normalized / buy_strength / institutional_strength default to 0.0 in Phase 0.
    Phase 3 will backfill these from the signal intelligence domain.

    Supplementary: Fetches latest strength values from portfolio_orderflowsignal per symbol.
    """
    from market_serving.models import SessionFacts

    try:
        legacy_url = _get_legacy_db_url()
        if not legacy_url:
            logger.warning(
                "materialize_session_facts: LEGACY_DATABASE_URL not configured — skipping."
            )
            return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

        # --- Whale net flow aggregation (portfolio_whalealertevent) ---
        whale_rows = _fetch_from_legacy(
            """
            SELECT
                wae.symbol,
                wae.trade_date AS session_date,
                SUM(CASE WHEN wae.side = 'BUY'  THEN wae.matched_value_vnd ELSE 0 END) AS total_buy_vnd,
                SUM(CASE WHEN wae.side = 'SELL' THEN wae.matched_value_vnd ELSE 0 END) AS total_sell_vnd
            FROM portfolio_whalealertevent wae
            WHERE wae.trade_date = (
                SELECT MAX(inner_wae.trade_date)
                FROM portfolio_whalealertevent inner_wae
            )
            GROUP BY wae.symbol, wae.trade_date
            ORDER BY wae.symbol
            LIMIT 1000
            """,
        )

        # --- OrderFlow strength per symbol (portfolio_orderflowsignal) ---
        # Build a map: {symbol: (buy_strength, whale_intensity, cvd_at_signal)}
        ofs_rows = _fetch_from_legacy(
            """
            SELECT DISTINCT ON (ofs.symbol)
                ofs.symbol,
                ofs.strength,
                ofs.whale_intensity,
                ofs.cvd_at_signal
            FROM portfolio_orderflowsignal ofs
            WHERE ofs.trade_date = (
                SELECT MAX(inner_ofs.trade_date)
                FROM portfolio_orderflowsignal inner_ofs
            )
              AND ofs.signal_type != 'none'
            ORDER BY ofs.symbol, ofs.created_at DESC
            LIMIT 1000
            """,
        )
        ofs_map = {
            row[0]: (row[1] or 0.0, row[2] or 0.0, row[3] or 0.0)
            for row in ofs_rows
        }

        count = 0
        for whale_row in whale_rows:
            symbol, session_date, total_buy_vnd, total_sell_vnd = whale_row
            buy = int(total_buy_vnd or 0)
            sell = int(total_sell_vnd or 0)
            whale_net_flow = buy - sell

            strength, whale_intensity, cvd_at_signal = ofs_map.get(symbol, (0.0, 0.0, 0.0))

            SessionFacts.objects.update_or_create(
                symbol=symbol,
                session_date=session_date,
                defaults={
                    'cvd_normalized': cvd_at_signal,
                    'buy_strength': strength,
                    'institutional_strength': whale_intensity * 100.0,
                    'whale_net_flow': whale_net_flow,
                    'dark_flow_score': 0.0,   # Phase 3: will be computed by signal_intelligence
                    'total_buy_volume': buy,
                    'total_sell_volume': sell,
                    'source': 'legacy_sync',
                    'stale': False,
                    'computed_at': now(),
                },
            )
            count += 1

        logger.info(
            "materialize_session_facts: upserted %d rows from portfolio_whalealertevent.",
            count,
        )
        return {
            'status': 'ok',
            'upserted': count,
            'source_table': 'portfolio_whalealertevent',
        }

    except OperationalError as exc:
        logger.error(
            "materialize_session_facts: legacy DB unreachable. %s", exc
        )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def materialize_unified_alerts(self):
    """
    Materializes UnifiedAlert (+ WhaleAlertCanonical) from portfolio_whalealertevent.
    Runs every 2 minutes via celery beat.

    SM-P0.1 NEW TASK: Pulls last 24 h of whale events from legacy DB and upserts
    into signal_intelligence.UnifiedAlert keyed on source_ref=event_id.
    """
    from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical

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
                wae.event_id,
                wae.symbol,
                wae.side,
                wae.matched_value_vnd,
                wae.severity,
                wae.source_layer,
                wae.trade_date,
                wae.occurred_at,
                wae.payload_json
            FROM portfolio_whalealertevent wae
            WHERE wae.occurred_at >= NOW() - INTERVAL '24 hours'
            ORDER BY wae.occurred_at DESC
            LIMIT 2000
            """,
        )

        _SEVERITY_MAP = {
            'critical': UnifiedAlert.SeverityChoices.CRITICAL,
            'urgent':   UnifiedAlert.SeverityChoices.CRITICAL,
            'high':     UnifiedAlert.SeverityChoices.HIGH,
            'warning':  UnifiedAlert.SeverityChoices.MEDIUM,
            'medium':   UnifiedAlert.SeverityChoices.MEDIUM,
            'info':     UnifiedAlert.SeverityChoices.LOW,
            'low':      UnifiedAlert.SeverityChoices.LOW,
        }

        count = 0
        for row in rows:
            event_id, symbol, side, matched_value_vnd, severity, source_layer, trade_date, occurred_at, payload_json = row
            if not event_id or not symbol or not trade_date or not occurred_at:
                continue

            direction = UnifiedAlert.DirectionChoices.NEUTRAL
            if side == 'BUY':
                direction = UnifiedAlert.DirectionChoices.BUY
            elif side == 'SELL':
                direction = UnifiedAlert.DirectionChoices.SELL

            sev = _SEVERITY_MAP.get((severity or 'medium').lower(), UnifiedAlert.SeverityChoices.MEDIUM)
            is_dark = (source_layer or '') in ('dark_flow', 'dark_pool')
            alert_type = UnifiedAlert.AlertTypeChoices.DARK_FLOW if is_dark else UnifiedAlert.AlertTypeChoices.WHALE

            value_vnd = int(matched_value_vnd or 0)
            title = f"{'🌊 Cá mập' if not is_dark else '🔵 Dark flow'} {symbol}: {value_vnd / 1_000_000_000:.2f}B VND"

            payload = payload_json if isinstance(payload_json, dict) else {}
            price = payload.get('price') or payload.get('avg_price') or 0
            volume = payload.get('volume') or payload.get('qty') or 0

            alert, _ = UnifiedAlert.objects.update_or_create(
                source_ref=str(event_id),
                defaults={
                    'alert_type': alert_type,
                    'symbol': symbol,
                    'severity': sev,
                    'title': title,
                    'value': value_vnd,
                    'direction': direction,
                    'session_date': trade_date,
                    'triggered_at': occurred_at,
                    'metadata': payload,
                },
            )

            WhaleAlertCanonical.objects.update_or_create(
                alert=alert,
                defaults={
                    'symbol': symbol,
                    'session_date': trade_date,
                    'side': side.lower() if side in ('BUY', 'SELL') else 'buy',
                    'price': price,
                    'volume': volume,
                    'matched_value': value_vnd,
                    'is_dark_flow': is_dark,
                    'order_id': str(event_id),
                    'executed_at': occurred_at,
                },
            )
            count += 1

        logger.info("materialize_unified_alerts: upserted %d alerts.", count)
        return {'status': 'ok', 'upserted': count, 'source_table': 'portfolio_whalealertevent'}

    except OperationalError as exc:
        logger.error("materialize_unified_alerts: legacy DB unreachable. %s", exc)
        raise self.retry(exc=exc)


@shared_task
def backfill_symbol_snapshots(days_back: int = 30):
    """
    One-time backfill task for SymbolSnapshot.
    Reads historical snapshots from legacy portfolio_tickersessionclose.

    SM-P0.1 FIX: Uses portfolio_tickersessionclose (was: portfolio_symbolsnapshot).
    """
    from market_serving.models import SymbolSnapshot

    legacy_url = _get_legacy_db_url()
    if not legacy_url:
        return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

    rows = _fetch_from_legacy(
        """
        SELECT
            tsc.symbol,
            tsc.close_price AS last_price,
            COALESCE(tsc.volume, 0) AS total_volume,
            COALESCE(tsc.change_pct, 0) AS price_change_pct,
            COALESCE(tsc.change_value, 0) AS price_change_value,
            tsc.session_date,
            tsc.captured_at AS fetched_at
        FROM portfolio_tickersessionclose tsc
        WHERE tsc.session_date >= CURRENT_DATE - INTERVAL %(days)s
        ORDER BY tsc.symbol, tsc.session_date ASC
        LIMIT 50000
        """,
        params={'days': f'{days_back} days'},
    )

    count = 0
    for row in rows:
        symbol, last_price, total_volume, price_change_pct, price_change_value, session_date, fetched_at = row
        SymbolSnapshot.objects.update_or_create(
            symbol=symbol,
            session_date=session_date,
            defaults={
                'price': last_price,
                'price_change': price_change_value,
                'price_change_pct': price_change_pct,
                'volume': total_volume,
                'fetched_at': fetched_at or now(),
                'stale': False,
                'source': 'backfill',
                'market_status': 'closed',
            },
        )
        count += 1

    logger.info(
        "backfill_symbol_snapshots: upserted %d rows from portfolio_tickersessionclose (%d days).",
        count,
        days_back,
    )
    return {'status': 'ok', 'upserted': count}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_legacy_db_url():
    """Return truthy value if legacy_readonly DB is configured in settings."""
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
