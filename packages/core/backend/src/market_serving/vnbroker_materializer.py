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


def materialize_symbol_snapshot_from_vnbroker():
    """
    Drop-in replacement for materialize_symbol_snapshot() after legacy decommission.
    
    Reads price from DailyPrice (canonical), prev-close for ceiling/floor.
    Writes same SymbolSnapshot contract (no downstream changes needed).
    """
    from market_serving.models import SymbolSnapshot
    from market_data.models import StockProfile, DailyPrice
    
    try:
        symbols = list(
            StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE)
            .values_list('symbol', flat=True)
            .distinct()
        )
        
        if not symbols:
            logger.warning("No active symbols found for vnbroker fetch")
            return {'status': 'ok', 'upserted': 0, 'source': 'vnbroker_native'}
        
        import time as _time

        today = date.today()
        yesterday = today - timedelta(days=1)
        count = 0

        # Pre-fetch live prices via SSOT adapter (không gọi VciQuote trực tiếp)
        # Delay 0.35s giữa các symbol để tránh 429 Too Many Requests từ VCI.
        from market_data.vnbroker_adapter import fetch_realtime_price
        live_prices: dict[str, dict] = {}
        for sym in symbols:
            live = fetch_realtime_price(sym)
            if live is not None:
                live_prices[sym] = {
                    'close': Decimal(str(live['close'])),
                    'volume': int(live['volume']),
                }
            _time.sleep(0.35)
        logger.info('live_prices fetched via adapter: %d/%d', len(live_prices), len(symbols))

        for symbol in symbols:
            try:
                # Reference price: yesterday's canonical close (for ceiling/floor)
                yesterday_price = DailyPrice.objects.filter(
                    symbol=symbol, date=yesterday
                ).first()
                # Today's DailyPrice used only as fallback if vnbroker fetch failed
                today_db_price = DailyPrice.objects.filter(
                    symbol=symbol, date=today
                ).first()

                # Live price: prefer vnbroker realtime, fall back to DB snapshot
                live = live_prices.get(symbol)
                if live:
                    live_close = live['close']
                    live_volume = live['volume']
                    live_open = Decimal(str(live.get('open') or live['close']))
                    live_high = Decimal(str(live.get('high') or live['close']))
                    live_low = Decimal(str(live.get('low') or live['close']))
                elif today_db_price:
                    live_close = today_db_price.close
                    live_volume = today_db_price.volume
                    live_open = today_db_price.open if today_db_price.open else today_db_price.close
                    live_high = today_db_price.high if today_db_price.high else today_db_price.close
                    live_low = today_db_price.low if today_db_price.low else today_db_price.close
                else:
                    logger.debug(f"No price data for {symbol} today — skipping")
                    continue

                # Reference price for change/ceiling/floor calculations
                if yesterday_price:
                    reference_price = yesterday_price.close
                elif today_db_price:
                    reference_price = today_db_price.close
                else:
                    reference_price = live_close

                price_change = live_close - reference_price
                price_change_pct = (price_change / reference_price * Decimal('100')) if reference_price != 0 else Decimal('0')

                # Calculate ceiling/floor (HoSE bước giá rounding)
                ceiling = _round_ceiling_price(reference_price * Decimal('1.07'))
                floor = _round_floor_price(reference_price * Decimal('0.93'))

                SymbolSnapshot.objects.update_or_create(
                    symbol=symbol,
                    session_date=today,
                    defaults={
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
                    },
                )
                count += 1
            except Exception as e:
                logger.warning(f"Failed to materialize {symbol}: {e}")
                continue

        logger.info(f"materialize_symbol_snapshot (vnbroker): upserted {count} snapshots (live={len(live_prices)})")
        return {'status': 'ok', 'upserted': count, 'source': 'vnbroker_native'}
    
    except Exception as e:
        logger.error(f"vnbroker materialize failed: {e}")
        from market_serving.models import SymbolSnapshot
        SymbolSnapshot.objects.update(stale=True)
        raise
