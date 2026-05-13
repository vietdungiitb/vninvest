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
    
    Reads from vnbroker native API instead of legacy DB.
    Writes same SymbolSnapshot contract (no downstream changes needed).
    """
    from market_serving.models import SymbolSnapshot
    from market_data.models import StockProfile
    
    try:
        symbols = list(
            StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE)
            .values_list('symbol', flat=True)
            .distinct()
        )
        
        if not symbols:
            logger.warning("No active symbols found for vnbroker fetch")
            return {'status': 'ok', 'upserted': 0, 'source': 'vnbroker_native'}
        
        tickers = fetch_realtime_tickers_from_vnbroker(symbols)
        
        count = 0
        for ticker in tickers:
            SymbolSnapshot.objects.update_or_create(
                symbol=ticker['symbol'],
                session_date=date.today(),
                defaults={
                    'price': Decimal(str(ticker['price'])),
                    'price_change': Decimal(str(ticker['price_change'])),
                    'price_change_pct': Decimal(str(ticker['price_change_pct'])),
                    'volume': ticker['volume'],
                    'reference_price': Decimal(str(ticker['reference_price'])) if ticker['reference_price'] else None,
                    'ceiling': Decimal(str(ticker['ceiling'])) if ticker['ceiling'] else None,
                    'floor': Decimal(str(ticker['floor'])) if ticker['floor'] else None,
                    'market_status': ticker['market_status'],
                    'source': 'vnbroker_native',
                    'stale': False,
                },
            )
            count += 1
        
        logger.info(f"materialize_symbol_snapshot (vnbroker): upserted {count} snapshots")
        return {'status': 'ok', 'upserted': count, 'source': 'vnbroker_native'}
    
    except Exception as e:
        logger.error(f"vnbroker materialize failed: {e}")
        from market_serving.models import SymbolSnapshot
        SymbolSnapshot.objects.update(stale=True)
        raise
