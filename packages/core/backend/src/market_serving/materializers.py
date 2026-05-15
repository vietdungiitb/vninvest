"""
Celery materializer tasks for market_serving - SAAS NATIVE ONLY.

ARCHITECTURE: vnbroker realtime API + Redis + DailyPrice
- No legacy DB dependency
- No shadow runs needed
- Pure SaaS native model

Data sources:
- SymbolSnapshot: vnbroker Quote API (price, volume, change) + DailyPrice (reference_price for ceiling/floor)
- SessionFacts: signal_intelligence domain (will compute from whale flows later)
- UnifiedAlert: signal_intelligence domain (will compute from whale alerts later)
"""
import logging
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from celery import shared_task
from django.db import OperationalError
from django.utils.timezone import now

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def materialize_symbol_snapshot(self):
    """
    Materializes SymbolSnapshot from vnbroker realtime API.
    Runs every 60 seconds via celery beat.
    
    SAAS-NATIVE: No legacy DB dependency. Pure vnbroker + Redis caching.
    Data flow:
      vnbroker Quote API → Redis cache → SymbolSnapshot
      (+ DailyPrice prev-close for reference_price, ceiling, floor)
    """
    from market_serving.vnbroker_materializer import (
        materialize_symbol_snapshot_from_vnbroker
    )
    
    try:
        return materialize_symbol_snapshot_from_vnbroker()
    except Exception as exc:
        logger.error("materialize_symbol_snapshot failed: %s", exc)
        from market_serving.models import SymbolSnapshot
        SymbolSnapshot.objects.update(stale=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def materialize_pre_open_snapshots(
    self,
    symbols: list[str] | None = None,
    as_of_date: date | None = None,
):
    """
    Materialize pre-open SymbolSnapshot rows from canonical core market data (DailyPrice).

    Uses active StockProfile symbols when no explicit symbol list is provided.
    The resulting snapshot rows are marked PRE_OPEN so the serving layer can
    render a stable pre-market view before the live session starts.
    """
    from market_data.models import DailyPrice, StockProfile
    from market_serving.models import SymbolSnapshot
    
    try:
        snapshot_date = as_of_date or now().date()
        if symbols is not None:
            target_symbols = sorted({str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()})
        else:
            target_symbols = list(
                StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE)
                .values_list('symbol', flat=True)
                .distinct()
            )

        if not target_symbols:
            logger.info('materialize_pre_open_snapshots: no active symbols available.')
            return {'status': 'skipped', 'reason': 'no_target_symbols'}

        price_rows = (
            DailyPrice.objects
            .filter(symbol__in=target_symbols, date__lte=snapshot_date)
            .order_by('symbol', '-date')
            .values('symbol', 'date', 'close', 'volume')
        )

        latest_rows: dict[str, dict] = {}
        previous_rows: dict[str, dict] = {}
        for row in price_rows:
            symbol = str(row.get('symbol') or '').strip().upper()
            if not symbol:
                continue
            if symbol not in latest_rows:
                latest_rows[symbol] = row
                continue
            if symbol not in previous_rows:
                previous_rows[symbol] = row

        upserted = 0
        missing_symbols: list[str] = []
        for symbol in target_symbols:
            latest_row = latest_rows.get(symbol)
            if latest_row is None:
                missing_symbols.append(symbol)
                continue

            latest_close = Decimal(str(latest_row.get('close') or 0))
            previous_row = previous_rows.get(symbol)
            previous_close = None
            reference_price = None
            ceiling = None
            floor = None
            
            if previous_row is not None and previous_row.get('close') is not None:
                previous_close = Decimal(str(previous_row.get('close') or 0))
                reference_price = previous_close
                ceiling = reference_price * Decimal('1.07')
                floor = reference_price * Decimal('0.93')

            price_change = Decimal('0.00')
            price_change_pct = Decimal('0.0000')
            if previous_close not in (None, Decimal('0')):
                price_change = (latest_close - previous_close).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                price_change_pct = ((price_change / previous_close) * Decimal('100')).quantize(
                    Decimal('0.0001'),
                    rounding=ROUND_HALF_UP,
                )

            SymbolSnapshot.objects.update_or_create(
                symbol=symbol,
                session_date=snapshot_date,
                defaults={
                    'price': latest_close.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    'price_change': price_change,
                    'price_change_pct': price_change_pct,
                    'volume': int(latest_row.get('volume') or 0),
                    'reference_price': reference_price,
                    'ceiling': ceiling,
                    'floor': floor,
                    'fetched_at': now(),
                    'stale': False,
                    'source': SymbolSnapshot.SourceChoices.CORE,
                    'market_status': SymbolSnapshot.MarketStatusChoices.PRE_OPEN,
                },
            )
            upserted += 1

        completeness_pct = round((upserted / len(target_symbols)) * 100.0, 2)
        meets_target = completeness_pct >= 99.5
        status = 'ok' if meets_target else 'partial'
        logger.info(
            'materialize_pre_open_snapshots: upserted=%d total=%d completeness=%.2f%% date=%s',
            upserted,
            len(target_symbols),
            completeness_pct,
            snapshot_date,
        )
        return {
            'status': status,
            'upserted': upserted,
            'symbols_total': len(target_symbols),
            'completeness_pct': completeness_pct,
            'meets_target': meets_target,
            'missing_symbols': sorted(set(missing_symbols))[:30],
            'session_date': snapshot_date.isoformat(),
            'market_status': SymbolSnapshot.MarketStatusChoices.PRE_OPEN,
            'source_table': 'market_data_daily_price',
        }
    except OperationalError as exc:
        logger.error(
            'materialize_pre_open_snapshots: core DB unreachable — retrying. %s',
            exc,
        )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def materialize_session_facts(self, symbol: str | None = None):
    """
    Tính SessionFacts từ WhaleAlertCanonical dùng công thức chuẩn quốc tế:
      - CVD (Cumulative Volume Delta) normalized 0-100
      - Buy Strength & Institutional Strength (0-99.5, sigmoid)
      - Delta Strength % (|net_cvd| / total × 100)
      - Dark Flow Score (absorption proxy)

    Chạy mỗi 5 phút qua celery beat (market_serving.materializers.materialize_session_facts).
    Data source: signal_intelligence.WhaleAlertCanonical
    """
    from market_serving.session_facts_engine import compute_session_facts_for_all_active

    try:
        result = compute_session_facts_for_all_active(symbol=symbol)
        logger.info(
            'materialize_session_facts: %s',
            result,
        )
        return result
    except Exception as exc:
        logger.error('materialize_session_facts failed: %s', exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def materialize_unified_alerts(self):
    """
    PLACEHOLDER: UnifiedAlert will be computed by signal_intelligence domain.
    
    Current: NOOP - legacy DB removed
    Next phase: Integrate vnbroker whale data feeds
    """
    logger.info("materialize_unified_alerts: skipped (legacy DB removed, awaiting signal_intelligence)")
    return {'status': 'skipped', 'reason': 'legacy_db_removed', 'next_phase': 'signal_intelligence_domain'}
