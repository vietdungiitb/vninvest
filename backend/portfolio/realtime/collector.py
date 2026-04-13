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
    """Lấy dữ liệu khớp lệnh thực từ vnstock intraday, fallback về synthetic nếu lỗi."""
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
                except (ValueError, TypeError):
                    price_val = 0.0
                    vol_val = 0.0
                rows.append({'ts': str(raw_time), 'price': price_val, 'volume': vol_val, 'side': side})
            if rows:
                return pd.DataFrame(rows)
    except (Exception, SystemExit) as exc:
        import logging as _log
        _log.getLogger(__name__).warning(
            "collect_intraday_frame(%s) vnstock failed, using synthetic fallback: %s",
            symbol, exc,
        )

    # Fallback: synthetic one-tick frame từ DB price
    import logging as _log
    _log.getLogger(__name__).info("collect_intraday_frame(%s) synthetic fallback active (volume=0)", symbol)
    changes = get_price_changes([symbol]).get(symbol.upper(), {})
    price = changes.get("current_price") or 0.0
    now = timezone.now() if hasattr(timezone, "now") else datetime.utcnow()
    return pd.DataFrame([{"ts": now, "price": float(price), "volume": 0.0, "side": "UNKNOWN"}])


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
