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
    changes = get_price_changes([symbol]).get(symbol.upper(), {})
    price = changes.get("current_price") or 0.0

    # Sprint 11: start with synthetic one-tick frame from latest known price.
    now = timezone.now() if hasattr(timezone, "now") else datetime.utcnow()
    return pd.DataFrame(
        [
            {
                "ts": now,
                "price": float(price),
                "volume": 0.0,
                "side": "UNKNOWN",
            }
        ]
    )
