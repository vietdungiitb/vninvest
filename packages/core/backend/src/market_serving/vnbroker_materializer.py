"""
Native vnbroker adapter for realtime ticker data (post-legacy-decommission).

After SAAS-15, swap materialize_symbol_snapshot to read from vnbroker
instead of legacy portfolio_tickersessionclose table.

This maintains the same SymbolSnapshot write contract.
"""
from decimal import Decimal, ROUND_FLOOR, ROUND_CEILING
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


_SNAPSHOT_COMPARE_FIELDS = (
    'price',
    'price_change',
    'price_change_pct',
    'volume',
    'reference_price',
    'ceiling',
    'floor',
    'open',
    'high',
    'low',
    'market_status',
    'source',
    'stale',
)


def _normalize_target_symbols(symbols: list[str] | None) -> list[str]:
    if symbols is not None:
        return sorted({str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()})

    from market_data.models import StockProfile

    return list(
        StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE)
        .values_list('symbol', flat=True)
        .distinct()
    )


def _hose_tick_size(price: Decimal) -> Decimal:
    """
    HoSE bước giá (tick size) theo quy định sàn HOSE:
      < 10,000 VND  → 10 VND
      10,000–49,999 → 50 VND
      ≥ 50,000      → 100 VND
    Dùng để làm tròn Trần/Sàn theo chuẩn thị trường.
    """
    if price < Decimal('10000'):
        return Decimal('10')
    elif price < Decimal('50000'):
        return Decimal('50')
    else:
        return Decimal('100')


def _round_ceiling_price(raw: Decimal) -> Decimal:
    """Làm tròn Trần: ROUND_FLOOR về bước giá gần nhất (không được vượt giới hạn +7%)."""
    tick = _hose_tick_size(raw)
    return (raw / tick).to_integral_value(rounding=ROUND_FLOOR) * tick


def _round_floor_price(raw: Decimal) -> Decimal:
    """Làm tròn Sàn: ROUND_CEILING về bước giá gần nhất (không được dưới giới hạn -7%)."""
    tick = _hose_tick_size(raw)
    return (raw / tick).to_integral_value(rounding=ROUND_CEILING) * tick


def fetch_realtime_tickers_from_vnbroker(symbols: list[str]) -> list[dict]:
    """
    Fetch realtime ticker data for a list of symbols.
    Delegates to market_data.vnbroker_adapter.fetch_realtime_price (SSOT).

    Returns list of dicts with keys:
    - symbol, price, price_change, price_change_pct, volume
    - reference_price (prev close), ceiling, floor (calculated)
    - market_status, fetched_at
    """
    from market_data.vnbroker_adapter import fetch_realtime_price
    from datetime import date
    tickers = []
    today = date.today()
    yesterday = today - timedelta(days=1)

    for symbol in symbols:
        try:
            live = fetch_realtime_price(symbol)
            if live is None:
                logger.warning('fetch_realtime_tickers: no data for %s', symbol)
                continue

            close = Decimal(str(live['close']))
            volume = int(live['volume'])

            # Reference price: yesterday's canonical close from DB
            from market_data.models import DailyPrice
            yesterday_price = DailyPrice.objects.filter(symbol=symbol.upper(), date=yesterday).first()
            ref_dec = yesterday_price.close if yesterday_price else close

            price_change = close - ref_dec
            price_change_pct = (price_change / ref_dec * Decimal('100')) if ref_dec != 0 else Decimal('0')
            ceiling = _round_ceiling_price(ref_dec * Decimal('1.07'))
            floor = _round_floor_price(ref_dec * Decimal('0.93'))

            tickers.append({
                'symbol': symbol.upper(),
                'price': float(close),
                'price_change': float(price_change),
                'price_change_pct': float(price_change_pct),
                'volume': volume,
                'reference_price': float(ref_dec),
                'ceiling': float(ceiling),
                'floor': float(floor),
                'market_status': 'open',
                'source': 'vnbroker_native',
                'fetched_at': live['fetched_at'],
            })
        except Exception as e:
            logger.warning('fetch_realtime_tickers failed for %s: %s', symbol, e)
            continue

    return tickers


def materialize_symbol_snapshot_from_vnbroker(symbols: list[str] | None = None):
    """
    Drop-in replacement for materialize_symbol_snapshot() after legacy decommission.
    
    Reads price from DailyPrice (canonical), prev-close for ceiling/floor.
    Writes same SymbolSnapshot contract (no downstream changes needed).
    """
    from market_serving.models import SymbolSnapshot
    from market_data.models import DailyPrice
    
    try:
        target_symbols = _normalize_target_symbols(symbols)
        
        if not target_symbols:
            logger.warning("No active symbols found for vnbroker fetch")
            return {'status': 'ok', 'upserted': 0, 'source': 'vnbroker_native'}
        

        inserted = 0
        updated = 0
        skipped_existing = 0
        failed: list[str] = []
        today = date.today()
        # Use last actual trading day, not calendar yesterday (may be weekend/holiday)
        yesterday = (
            DailyPrice.objects.filter(date__lt=today)
            .order_by('-date')
            .values_list('date', flat=True)
            .first()
        ) or (today - timedelta(days=1))
        count = 0
        existing_snapshots_by_symbol = {
            row['symbol']: row
            for row in SymbolSnapshot.objects.filter(symbol__in=target_symbols, session_date=today).values(
                'symbol',
                'price',
                'price_change',
                'price_change_pct',
                'volume',
                'reference_price',
                'ceiling',
                'floor',
                'open',
                'high',
                'low',
                'market_status',
                'source',
                'stale',
            )
        }

        # Pre-fetch live prices via SSOT adapter (không gọi VciQuote trực tiếp)
        # Sử dụng batch fetch để tối ưu hóa hiệu năng và tránh 429 Too Many Requests.
        from market_data.vnbroker_adapter import fetch_price_board_snapshots_batch
        live_snapshots = fetch_price_board_snapshots_batch(target_symbols)
        # Corrective live-measured: batch DailyPrice yesterday+today (2 queries) thay vì
        # 2 queries/symbol (~3100 queries → 7+ phút/task, tự flood beat 60s).
        _dp_yesterday = {
            row['symbol']: row
            for row in DailyPrice.objects.filter(
                symbol__in=target_symbols, date=yesterday
            ).values('symbol', 'close')
        }
        _dp_today = {
            row['symbol']: row
            for row in DailyPrice.objects.filter(
                symbol__in=target_symbols, date=today
            ).values('symbol', 'open', 'high', 'low', 'close', 'volume')
        }
        live_prices: dict[str, dict] = {}
        for sym in target_symbols:
            live = live_snapshots.get(sym)
            if live is not None:
                live_prices[sym] = {
                    'close': Decimal(str(live['close'])),
                    'volume': int(live['volume']),
                    'open': Decimal(str(live.get('open') or live['close'])),
                    'high': Decimal(str(live.get('high') or live['close'])),
                    'low': Decimal(str(live.get('low') or live['close'])),
                }
        logger.info('live_prices fetched via adapter: %d/%d', len(live_prices), len(target_symbols))


        # Corrective live-measured: collect rồi bulk upsert 1 lần (thay update_or_create
        # từng dòng ~1551 round-trip). Dùng prefetched maps ở trên — 0 query trong loop.
        _to_upsert: list = []
        for symbol in target_symbols:
            try:
                # Reference price: yesterday's canonical close (for ceiling/floor)
                yesterday_price = _dp_yesterday.get(symbol)
                # Today's DailyPrice used only as fallback if vnbroker fetch failed
                today_db_price = _dp_today.get(symbol)

                # Live price: prefer vnbroker realtime, fall back to DB snapshot
                live = live_prices.get(symbol)
                if live:
                    live_close = live['close']
                    live_volume = live['volume']
                    live_open = live['open']
                    live_high = live['high']
                    live_low = live['low']
                elif today_db_price:
                    live_close = today_db_price['close']
                    live_volume = today_db_price['volume']
                    live_open = today_db_price['open'] or today_db_price['close']
                    live_high = today_db_price['high'] or today_db_price['close']
                    live_low = today_db_price['low'] or today_db_price['close']
                else:
                    logger.debug(f"No price data for {symbol} today — skipping")
                    continue

                # Reference price for change/ceiling/floor calculations
                if yesterday_price:
                    reference_price = yesterday_price['close']
                elif today_db_price:
                    reference_price = today_db_price['close']
                else:
                    reference_price = live_close

                price_change = live_close - reference_price
                price_change_pct = (price_change / reference_price * Decimal('100')) if reference_price != 0 else Decimal('0')

                # Calculate ceiling/floor (HoSE bước giá rounding)
                ceiling = _round_ceiling_price(reference_price * Decimal('1.07'))
                floor = _round_floor_price(reference_price * Decimal('0.93'))

                snapshot_defaults = {
                    'price': live_close,
                    'price_change': price_change,
                    'price_change_pct': price_change_pct,
                    'volume': live_volume,
                    'reference_price': reference_price,
                    'ceiling': ceiling,
                    'floor': floor,
                    'open': live_open,
                    'high': live_high,
                    'low': live_low,
                    'market_status': 'open',
                    'source': 'vnbroker_native',
                    'stale': False,
                }
                existing = existing_snapshots_by_symbol.get(symbol)
                if existing is not None and all(existing[field_name] == snapshot_defaults[field_name] for field_name in _SNAPSHOT_COMPARE_FIELDS):
                    skipped_existing += 1
                    continue

                _to_upsert.append(SymbolSnapshot(
                    symbol=symbol, session_date=today, **snapshot_defaults))
                if existing is None:
                    inserted += 1
                else:
                    updated += 1
                count += 1
            except Exception as e:
                logger.warning(f"Failed to materialize {symbol}: {e}")
                failed.append(symbol)
                continue

        # Corrective live-measured: 1 bulk upsert thay ~1551 update_or_create round-trip.
        if _to_upsert:
            SymbolSnapshot.objects.bulk_create(
                _to_upsert,
                batch_size=500,
                update_conflicts=True,
                update_fields=[
                    'price', 'price_change', 'price_change_pct', 'volume',
                    'reference_price', 'ceiling', 'floor', 'open', 'high', 'low',
                    'market_status', 'source', 'stale',
                ],
                unique_fields=['symbol', 'session_date'],
            )

        logger.info(
            'materialize_symbol_snapshot (vnbroker): upserted %d snapshots (inserted=%d updated=%d skipped_existing=%d live=%d)',
            count,
            inserted,
            updated,
            skipped_existing,
            len(live_prices),
        )
        return {
            'status': 'ok',
            'symbols_count': len(target_symbols),
            'upserted': count,
            'inserted': inserted,
            'updated': updated,
            'skipped_existing': skipped_existing,
            'failed': failed,
            'failed_count': len(failed),
            'source': 'vnbroker_native',
        }
    
    except Exception as e:
        # Slice F (QueueRecovery, audit C-1): CẤM mass-stale toàn bảng — 1 lỗi provider
        # không được đánh stale 1551 symbols khỏe mạnh. Chi tiết per-symbol đã có trong
        # `failed` list của result path (xem :274-277). Giữ nguyên raise để retry.
        logger.error(f"vnbroker materialize failed: {e}")
        raise
