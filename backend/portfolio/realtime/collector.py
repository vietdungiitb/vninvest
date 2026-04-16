from __future__ import annotations

from datetime import datetime

import pandas as pd
from django.utils import timezone

from portfolio.models import TrackedSymbol
from portfolio.services import get_price_changes


def collect_symbols_for_user(user_id: int | None = None) -> list[str]:
    query = TrackedSymbol.objects
    if user_id is not None:
        query = query.filter(user_id=user_id)
    symbols = list(query.values_list("symbol", flat=True).distinct())
    return sorted({s.upper() for s in symbols if s})


def collect_intraday_frame(symbol: str) -> pd.DataFrame:
    """Lấy dữ liệu khớp lệnh thực từ vnstock intraday, fallback về synthetic nếu lỗi.
    
    PRICE UNIT GUARANTEE:
    - Adapter (fetch_intraday_dataframe) now returns prices in canonical THOUSAND_VND
    - No additional scaling needed here
    - All prices are already normalized to THOUSAND_VND by adapter
    """
    try:
        from portfolio.adapters.vnstock_adapter import fetch_intraday_dataframe
        df = fetch_intraday_dataframe(symbol=symbol, page_size=100)
        if df is not None and not df.empty:
            rows = []
            for _, row in df.iterrows():
                raw_time = row.get('time') or row.get('tradingDate') or row.get('date') or ''
                raw_price = row.get('price') or row.get('close') or 0
                raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
                match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
                mt_lower = match_type_raw.lower()
                if mt_lower in ('buy', 'bu', 'b'):
                    side = 'BUY'
                elif mt_lower in ('sell', 'sd', 's'):
                    side = 'SELL'
                else:
                    side = 'UNKNOWN'
                try:
                    price_val = float(raw_price) if raw_price else 0.0
                    vol_val = float(raw_vol) if raw_vol else 0.0
                    
                    # CANONICAL UNIT: Adapter already converted to THOUSAND_VND
                    # Previous code had: price_val = round(price_val * 0.001, 3)
                    # But adapter now handles this - prices are already canonical
                    # So we just round and trust the canonical unit
                    price_val = round(price_val, 3)  # No scale factor - already canonical THOUSAND_VND
                except (ValueError, TypeError):
                    price_val = 0.0
                    vol_val = 0.0
                # Standardize timestamp to UTC ISO-8601 string
                final_ts = str(raw_time)
                try:
                    raw_time_str = final_ts.strip()
                    if raw_time_str:
                        import zoneinfo
                        from django.utils import timezone as dj_tz
                        vn_tz = zoneinfo.ZoneInfo("Asia/Ho_Chi_Minh")
                        
                        if len(raw_time_str) <= 8 and ":" in raw_time_str:
                            today_str = dj_tz.now().astimezone(vn_tz).date().isoformat()
                            dt = datetime.fromisoformat(f"{today_str} {raw_time_str}").replace(tzinfo=vn_tz)
                        else:
                            dt = datetime.fromisoformat(raw_time_str.replace("Z", "+00:00"))
                            if dt.tzinfo is None:
                                dt = dt.replace(tzinfo=vn_tz)
                        
                        # Generate proper UTC ISO string ending in Z, e.g., 2026-04-13T07:45:00Z
                        from datetime import timezone as py_tz
                        final_ts = dt.astimezone(py_tz.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
                except Exception:
                    pass

                rows.append({'ts': final_ts, 'price': price_val, 'volume': vol_val, 'side': side, 'price_unit': 'THOUSAND_VND'})
            if rows:
                return pd.DataFrame(rows)
    except (Exception, SystemExit) as exc:
        import logging as _log
        _log.getLogger(__name__).warning(
            "collect_intraday_frame(%s) vnstock failed, using synthetic fallback: %s",
            symbol, exc,
        )

    # No more synthetic fallback. Return empty if both fetch and synthetic fail.
    return pd.DataFrame()


def collect_and_push(symbol: str, producer) -> int:
    """
    Thu thập intraday ticks và push vào Redis Stream qua TickProducer.
    Trả về số tick đã push. Không ném exception ra ngoài.
    """
    try:
        df = collect_intraday_frame(symbol)
        pushed = producer.push_intraday_ticks(symbol, df)
        return pushed
    except Exception as exc:
        import logging as _log
        _log.getLogger(__name__).warning("collect_and_push(%s) error: %s", symbol, exc)
        return 0
