"""
Native vnbroker adapter for realtime ticker data (post-legacy-decommission).

After SAAS-15, swap materialize_symbol_snapshot to read from vnbroker
instead of legacy portfolio_tickersessionclose table.

This maintains the same SymbolSnapshot write contract.
"""
from decimal import Decimal
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


def fetch_realtime_tickers_from_vnbroker(symbols: list[str]) -> list[dict]:
    """
    Fetch realtime ticker data from vnbroker native API.
    
    Returns list of dicts with keys:
    - symbol, price, price_change, price_change_pct, volume
    - reference_price (prev close), ceiling, floor (calculated)
    - market_status, fetched_at
    
    POST-LEGACY ONLY: This replaces legacy portfolio_tickersessionclose reads.
    """
    try:
        from vnbroker.explorer.vci.quote import Quote as VciQuote
        
        tickers = []
        for symbol in symbols:
            try:
                q = VciQuote(symbol=symbol.upper())
                # Get today's OHLCV + prev close
                df = q.history(
                    start=date.today().isoformat(),
                    end=date.today().isoformat(),
                    interval='1D',
                    show_log=False,
                )
                if df is None or df.empty:
                    logger.warning(f"vnbroker returned empty data for {symbol}")
                    continue
                
                row = df.iloc[0]
                close = float(row.get('close', 0))
                volume = int(row.get('volume', 0))
                
                # Get prev close for reference/ceiling/floor calculation
                yesterday = date.today() - timedelta(days=1)
                df_prev = q.history(
                    start=yesterday.isoformat(),
                    end=yesterday.isoformat(),
                    interval='1D',
                    show_log=False,
                )
                
                prev_close = None
                if df_prev is not None and not df_prev.empty:
                    prev_close = float(df_prev.iloc[0].get('close', 0))
                
                # Calculate price change from prev close
                price_change = 0
                price_change_pct = 0
                if prev_close and prev_close > 0:
                    price_change = close - prev_close
                    price_change_pct = (price_change / prev_close) * 100
                
                # Calculate ceiling/floor
                reference_price = prev_close if prev_close else close
                ceiling = reference_price * Decimal('1.07') if reference_price else None
                floor = reference_price * Decimal('0.93') if reference_price else None
                
                tickers.append({
                    'symbol': symbol.upper(),
                    'price': close,
                    'price_change': price_change,
                    'price_change_pct': price_change_pct,
                    'volume': volume,
                    'reference_price': prev_close,
                    'ceiling': float(ceiling) if ceiling else None,
                    'floor': float(floor) if floor else None,
                    'market_status': 'closed',  # VCI only has daily data
                    'source': 'vnbroker_native',
                })
            except Exception as e:
                logger.warning(f"vnbroker fetch failed for {symbol}: {e}")
                continue
        
        return tickers
    
    except ImportError:
        logger.error("vnbroker library not available for realtime ticker fetch")
        return []


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
        
        today = date.today()
        yesterday = today - timedelta(days=1)
        count = 0
        
        for symbol in symbols:
            try:
                # Get today's close from DailyPrice (canonical)
                today_price = DailyPrice.objects.filter(
                    symbol=symbol, date=today
                ).first()
                
                if not today_price:
                    logger.debug(f"No DailyPrice found for {symbol} today")
                    continue
                
                # Get yesterday's close for reference/ceiling/floor
                yesterday_price = DailyPrice.objects.filter(
                    symbol=symbol, date=yesterday
                ).first()
                
                reference_price = yesterday_price.close if yesterday_price else today_price.close
                price_change = today_price.close - reference_price if reference_price else Decimal('0')
                price_change_pct = (price_change / reference_price * Decimal('100')) if reference_price and reference_price != 0 else Decimal('0')
                
                # Calculate ceiling/floor
                ceiling = reference_price * Decimal('1.07') if reference_price else None
                floor = reference_price * Decimal('0.93') if reference_price else None
                
                SymbolSnapshot.objects.update_or_create(
                    symbol=symbol,
                    session_date=today,
                    defaults={
                        'price': today_price.close,
                        'price_change': price_change,
                        'price_change_pct': price_change_pct,
                        'volume': today_price.volume,
                        'reference_price': reference_price,
                        'ceiling': ceiling,
                        'floor': floor,
                        'market_status': 'open',
                        'source': 'vnbroker_native',
                        'stale': False,
                    },
                )
                count += 1
            except Exception as e:
                logger.warning(f"Failed to materialize {symbol}: {e}")
                continue
        
        logger.info(f"materialize_symbol_snapshot (vnbroker): upserted {count} snapshots from DailyPrice")
        return {'status': 'ok', 'upserted': count, 'source': 'vnbroker_native'}
    
    except Exception as e:
        logger.error(f"vnbroker materialize failed: {e}")
        from market_serving.models import SymbolSnapshot
        SymbolSnapshot.objects.update(stale=True)
        raise
