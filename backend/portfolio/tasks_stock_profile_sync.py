"""
portfolio/tasks_stock_profile_sync.py

Task Celery định kỳ đồng bộ StockProfile.industry + company_name
từ MarketSnapshot (private vnbroker, nguồn KBS).

Chạy mỗi ngày lúc 07:15 sáng (giờ VN) để chuẩn bị dữ liệu trước phiên giao dịch.
Sau khi sync DB, ghi thêm vào Redis để heatmap view đọc nhanh (cache-first).
Có thể trigger thủ công qua admin API.
"""

import logging

from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger(__name__)

_HEATMAP_CHUNK_SIZE = 100  # KBS hỗ trợ tốt nhất với batch ≤ 100 mã mỗi lần
_HEATMAP_STATIC_TTL = 86400  # 24h — được refresh bởi task hàng ngày


def heatmap_static_cache_key(symbol: str) -> str:
    return f"heatmap:static:{symbol.strip().upper()}"


def _chunked(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


@shared_task(
    name="portfolio.tasks_stock_profile_sync.sync_stock_profiles_from_snapshot",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
    acks_late=True,
)
def sync_stock_profiles_from_snapshot(self, symbols: list[str] | None = None):
    """
    Đồng bộ StockProfile.industry + company_name từ MarketSnapshot.

    Nếu `symbols` được truyền vào → chỉ sync các mã đó.
    Nếu None → lấy tất cả mã đang được theo dõi trong hệ thống
    (TrackedSymbol + WatchlistItem + Transaction).

    Sau khi ghi DB, batch-write toàn bộ vào Redis (cache-first cho heatmap view).

    Returns:
        dict: {"updated": N, "skipped": N, "errors": N}
    """
    from portfolio.adapters.vnbroker_adapter import fetch_heatmap_snapshot
    from portfolio.models import StockProfile, TrackedSymbol, WatchlistItem, Transaction

    # Thu thập danh sách mã cần sync
    if symbols:
        target_symbols = sorted({s.strip().upper() for s in symbols if s})
    else:
        tracked = set(
            TrackedSymbol.objects.values_list("symbol", flat=True)
        )
        watchlist = set(
            WatchlistItem.objects.values_list("symbol", flat=True)
        )
        transacted = set(
            Transaction.objects.values_list("symbol", flat=True)
        )
        target_symbols = sorted(tracked | watchlist | transacted)

    if not target_symbols:
        logger.info("sync_stock_profiles: Không có mã nào cần sync.")
        return {"updated": 0, "skipped": 0, "errors": 0}

    logger.info(
        "sync_stock_profiles: Bắt đầu sync %d mã từ MarketSnapshot.", len(target_symbols)
    )

    updated = 0
    errors = 0
    redis_batch: dict[str, dict] = {}  # key → {industry, company_name}

    for chunk in _chunked(target_symbols, _HEATMAP_CHUNK_SIZE):
        try:
            snapshot_rows = fetch_heatmap_snapshot(chunk)
        except Exception as exc:
            logger.warning("sync_stock_profiles: fetch_heatmap_snapshot chunk lỗi: %s", exc)
            errors += len(chunk)
            continue

        for row in snapshot_rows:
            symbol = str(row.get("symbol") or "").strip().upper()
            if not symbol:
                continue
            industry = str(row.get("industry") or "").strip() or "Khác"
            company_name = str(row.get("company_name") or "").strip() or symbol
            # market_cap_bn (hoặc market_cap legacy) trả về đơn vị tỷ VND
            raw_cap = row.get("market_cap_bn") or row.get("market_cap")
            try:
                market_cap_bn = float(raw_cap) if raw_cap is not None else None
            except (TypeError, ValueError):
                market_cap_bn = None

            try:
                update_fields = {
                    "industry": industry,
                    "company_name": company_name,
                }
                if market_cap_bn is not None:
                    update_fields["market_cap_bn"] = market_cap_bn

                changed = StockProfile.objects.filter(symbol=symbol).update(**update_fields)
                if not changed:
                    # Mã chưa có trong DB → tạo mới (upsert)
                    StockProfile.objects.update_or_create(
                        symbol=symbol,
                        defaults={
                            "industry": industry,
                            "company_name": company_name,
                            "market_cap_bn": market_cap_bn,
                            "exchange": "",
                        },
                    )
                updated += 1
                # Tích lũy vào batch Redis
                redis_entry = {
                    "industry": industry,
                    "company_name": company_name,
                }
                if market_cap_bn is not None:
                    redis_entry["market_cap_bn"] = market_cap_bn
                redis_batch[heatmap_static_cache_key(symbol)] = redis_entry
            except Exception as exc:
                logger.warning(
                    "sync_stock_profiles: Lỗi khi update %s: %s", symbol, exc
                )
                errors += 1
                continue

    # Batch-write tất cả vào Redis một lần duy nhất
    if redis_batch:
        try:
            # Django cache không có set_many với per-key TTL → dùng pipeline qua từng key
            # Nhưng cache.set_many() không hỗ trợ per-key TTL → gọi set_many với TTL chung
            cache.set_many(redis_batch, timeout=_HEATMAP_STATIC_TTL)
            logger.info(
                "sync_stock_profiles: Ghi %d mã vào Redis cache.", len(redis_batch)
            )
        except Exception as exc:
            logger.warning("sync_stock_profiles: Lỗi ghi Redis: %s", exc)

    skipped = max(0, len(target_symbols) - updated - errors)
    logger.info(
        "sync_stock_profiles: Hoàn tất. updated=%d skipped=%d errors=%d redis_keys=%d",
        updated,
        skipped,
        errors,
        len(redis_batch),
    )
    return {"updated": updated, "skipped": skipped, "errors": errors}
