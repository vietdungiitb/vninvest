# Cold latency DataOps inventory — baseline & plan (2026-11-20)

## Baseline (VPS, xoá cache key rồi profile)

```
ELAPSED 24.8s · NQUERY 38
by_year DATE_TRUNC GROUP BY            3.0s
mỗi group aggregate (7 lần)           ~10.4s (2.6+1.9+1.4+1.2+1.2+1.1+1.0)
DailyPrice COUNT(*)                   2.0s
SymbolSnapshot aggregate              1.2s
```

Warm cache (Redis 5p) đã 3.61s, nhưng request đầu sau flush vẫn ~22-25s.

## Plan

Gom toàn bộ aggregation DailyPrice thành **1 raw SQL query**:

```sql
SELECT symbol,
       EXTRACT(YEAR FROM date)::int AS yr,
       COUNT(*) AS n,
       COUNT(*) FILTER (WHERE date >= %s) AS recent_n,
       MIN(date) AS earliest,
       MAX(date) AS latest
FROM market_data_dailyprice
GROUP BY symbol, EXTRACT(YEAR FROM date)::int
```

- `cutoff = latest - 30 ngày` (latest lấy bằng index `order_by('-date').first()`).
- Build `per_symbol[yr][n/recent/earliest/latest]`; từ đó tính:
  - `summary.total_rows = sum(n)`, `earliest/latest = min/max`
  - `by_year[yr].rows = sum(n)`
  - mỗi group: `rows`, `covered` (#symbol có n>0), `recent` (#symbol có recent_n>0), `earliest/latest`
- `symbols` key trong `by_year` giữ `0` (FE chỉ dùng `rows`) — không đổi shape.
- Cache Redis giữ nguyên cơ chế, TTL tăng 5 phút → **1 giờ** (PR #448) vì dữ liệu DailyPrice cập nhật theo phiên/ngày.

## AC

1. BE test hiện tại vẫn PASS (DB nhỏ).
2. Response shape không đổi (`data.summary`, `data.by_year`, `data.by_group`, `data.data_types`).
3. Cold time đo thật trên VPS giảm rõ rệt; ghi số trước/sau.
4. Không migration, không `package.json`.

## Gate

- BE test trên VPS (DB tạm, drop sau) — PASS.
- `pre-push-gate` 36 PASS.
- Deploy staging + xoá cache + đo cold time + Playwright `HAS_4_6M=true`.

## Kết quả thật (2026-11-20)

| Giai đoạn | Cold (xoá cache) | Warm |
|---|---|---|
| Baseline | 24.8s · 38 query | 3.61s |
| Sau 1 raw SQL query (PR #447) | **6.72s** | **0.02s** |
| Sau TTL 1h (PR #448) | 7.13s (chỉ 1 lần/giờ) | **0.02s** |

- BE test trên VPS: DB tạm `dataops_cold` đã tạo → test **OK** (TEST_EXIT=0) → DROP; worktree tạm `/tmp/wt-cold` đã remove.
- Response shape không đổi; sau deploy `summary.total_rows = 4582503`, `total_symbols = 1400`.
- Query chậm nhất còn lại chính là raw aggregation ~4.5s. Muốn cold <3s cần materialized summary + Celery refresh — ticket riêng.
- ⚠ Sự cố branch: working tree dùng chung bị agent khác chuyển nhánh, 2 commit docs lọt sang `feat/ws-ticket-machine-scope`; đã revert ở nhánh đó, nội dung được ghi lại đúng tại đây. Agent kia đã chuyển sang worktree riêng `wt/ws-ticket-machine`.
