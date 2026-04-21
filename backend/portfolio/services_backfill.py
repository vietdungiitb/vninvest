"""
services_backfill.py — Backfill service layer cho IntradayTick.side.

Cung cấp hai hàm:
  intraday_side_backfill_preview(...)  → thống kê không ghi DB
  intraday_side_backfill_apply(...)    → thực sự cập nhật DB (bulk_update theo chunk)

Logic: seed prev_price từ DailyPrice.close_price của phiên trước, sau đó áp dụng
tick-rule: price > prev → BUY, price < prev → SELL, price == prev → kế thừa
last_side.  Chỉ cập nhật những hàng mà inferred != stored_side.
"""

from __future__ import annotations

import time
from collections import Counter
from decimal import Decimal
from functools import lru_cache
from typing import List, Optional

from django.db import transaction

from portfolio.models import DailyPrice, IntradayTick


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_side(value) -> str:
    raw = str(value or "").strip().upper()
    if raw in {"BUY", "BU", "B"}:
        return "BUY"
    if raw in {"SELL", "SD", "S"}:
        return "SELL"
    return "UNKNOWN"


def _get_previous_close(symbol: str, trade_date, _cache: dict) -> Optional[float]:
    from django.conf import settings
    from portfolio.market_data_service import MarketDataService

    key = (symbol, trade_date)
    if key in _cache:
        return _cache[key]

    value = None
    if settings.FEATURE_FLAGS.get("MDSU_BACKFILL_ENABLED"):
        # MDSU Canonical path: use the unified service
        # Note: Backfill usually happens for today's data, so the latest price in DB is the prev_close.
        snapshot = MarketDataService.get_latest_snapshot([symbol])
        if symbol in snapshot:
            value = snapshot[symbol].get("close_price")
    else:
        # Legacy path (to be retired in Phase 3)
        row = (
            DailyPrice.objects
            .filter(symbol=symbol, date__lt=trade_date)
            .order_by("-date")
            .values("close_price")
            .first()
        )
        if row:
            try:
                v = float(row.get("close_price") or 0)
                value = v if v > 0 else None
            except (TypeError, ValueError):
                pass

    _cache[key] = value
    return value


def _build_queryset(symbols, start_date, end_date, threshold):
    qs = IntradayTick.objects.all()
    if symbols:
        qs = qs.filter(symbol__in=symbols)
    if start_date:
        qs = qs.filter(trade_date__gte=start_date)
    if end_date:
        qs = qs.filter(trade_date__lte=end_date)
    if threshold and threshold > 0:
        # matched_value heuristic: nếu price >= 1000 thì đơn vị là VND thô,
        # nếu < 1000 thì đơn vị là nghìn VND (canonical).
        # Lọc đơn giản theo volume để tránh phép tính phức tạp trong ORM.
        # Ta filter sau khi iterate — không add DB filter cho threshold ở đây
        # vì cần tính matched_value = price * 1000 * volume (canonical unit).
        pass
    return qs


def _infer_side_for_rows(rows_iter, threshold, batch_size, prev_close_cache):
    """
    Iterate qua rows, tính inferred side, trả về:
      (changed_ids_to_side, transitions, inferred_counter, changed_preview_items)
    """
    transition_counter: Counter = Counter()
    inferred_counter: Counter = Counter()
    changed_ids_to_side: dict[int, str] = {}
    changed_preview: list[dict] = []

    current_group = None
    prev_price = None
    last_side = "UNKNOWN"

    for row in rows_iter:
        symbol = row["symbol"]
        trade_date = row["trade_date"]
        group_key = (symbol, trade_date)

        if group_key != current_group:
            current_group = group_key
            prev_price = _get_previous_close(symbol, trade_date, prev_close_cache)
            last_side = "UNKNOWN"

        stored_side = _normalize_side(row.get("side") or "")
        price_raw = row.get("price")
        price = float(price_raw or 0) if isinstance(price_raw, (int, float, Decimal)) else 0.0
        volume = int(row.get("volume") or 0)

        # Threshold filter (matched_value in VND)
        if threshold and threshold > 0:
            matched_value = price * 1000 * volume  # canonical: price in thousand VND
            if matched_value < threshold:
                if price > 0:
                    prev_price = price
                continue

        if prev_price is None:
            inferred = stored_side
        elif price > prev_price:
            inferred = "BUY"
        elif price < prev_price:
            inferred = "SELL"
        else:
            inferred = last_side if last_side in {"BUY", "SELL"} else stored_side

        if inferred not in {"BUY", "SELL"}:
            inferred = "UNKNOWN"

        if inferred in {"BUY", "SELL"}:
            last_side = inferred
        if price > 0:
            prev_price = price

        inferred_counter[inferred] += 1

        if inferred != stored_side:
            key = f"{stored_side}->{inferred}"
            transition_counter[key] += 1
            changed_ids_to_side[int(row["id"])] = inferred
            if len(changed_preview) < 30:
                changed_preview.append({
                    "id": int(row["id"]),
                    "symbol": symbol,
                    "trade_date": str(trade_date),
                    "trade_time": str(row.get("trade_time") or ""),
                    "price": price,
                    "old_side": stored_side,
                    "new_side": inferred,
                })

    return changed_ids_to_side, transition_counter, inferred_counter, changed_preview


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def intraday_side_backfill_preview(
    symbols: List[str],
    start_date: Optional[str],
    end_date: Optional[str],
    threshold: int = 0,
    batch_size: int = 2000,
) -> dict:
    """
    Dry-run: tính scope, changed, transitions, distribution, sample — không ghi DB.
    """
    qs = _build_queryset(symbols, start_date, end_date, threshold)
    scope_rows = qs.count()

    rows_iter = (
        qs.order_by("symbol", "trade_date", "trade_time", "id")
        .values("id", "symbol", "trade_date", "trade_time", "price", "volume", "side")
        .iterator(chunk_size=batch_size)
    )

    prev_close_cache: dict = {}
    changed_ids_to_side, transition_counter, inferred_counter, changed_preview = _infer_side_for_rows(
        rows_iter, threshold, batch_size, prev_close_cache
    )

    return {
        "scope_rows": scope_rows,
        "changed_rows": len(changed_ids_to_side),
        "inferred_distribution": dict(inferred_counter),
        "transitions": dict(transition_counter),
        "sample_rows": changed_preview,
    }


def intraday_side_backfill_apply(
    symbols: List[str],
    start_date: Optional[str],
    end_date: Optional[str],
    threshold: int = 0,
    batch_size: int = 2000,
) -> dict:
    """
    Apply: cập nhật DB bằng bulk_update theo chunk để tránh SQL param limit.
    Trả về kết quả.
    """
    t0 = time.monotonic()

    qs = _build_queryset(symbols, start_date, end_date, threshold)
    scope_rows = qs.count()

    rows_iter = (
        qs.order_by("symbol", "trade_date", "trade_time", "id")
        .values("id", "symbol", "trade_date", "trade_time", "price", "volume", "side")
        .iterator(chunk_size=batch_size)
    )

    prev_close_cache: dict = {}
    changed_ids_to_side, transition_counter, inferred_counter, _ = _infer_side_for_rows(
        rows_iter, threshold, batch_size, prev_close_cache
    )

    changed_count = len(changed_ids_to_side)
    updated_total = 0
    symbols_touched = set()

    if changed_count > 0:
        ids_list = list(changed_ids_to_side.keys())
        chunk_size_update = 2000

        with transaction.atomic():
            for chunk_start in range(0, len(ids_list), chunk_size_update):
                chunk_ids = ids_list[chunk_start: chunk_start + chunk_size_update]
                chunk_objs = list(IntradayTick.objects.filter(id__in=chunk_ids).only("id", "side", "symbol"))
                for obj in chunk_objs:
                    obj.side = changed_ids_to_side[obj.id]
                    symbols_touched.add(obj.symbol)
                IntradayTick.objects.bulk_update(chunk_objs, ["side"])
                updated_total += len(chunk_objs)

    duration = round(time.monotonic() - t0, 2)

    return {
        "scope_rows": scope_rows,
        "updated": updated_total,
        "duration_seconds": duration,
        "symbols_touched": sorted(symbols_touched),
        "transitions": dict(transition_counter),
    }
