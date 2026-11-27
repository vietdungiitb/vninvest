# Báo cáo nghiên cứu kiến trúc — `vnbroker` + `vninvest`, luồng dữ liệu giá (2026-11-27)

> **Doc-only**: báo cáo này không đổi source, data, flag hay migration. Mọi khẳng định kèm `file:line` hoặc lệnh tái hiện. Các con số là snapshot staging `dev@0a0f71a7c` ngày 2026-11-27.

## Tóm tắt 5 vấn đề nghiêm trọng nhất

1. **`DailyPrice.close` đang chứa giá đã điều chỉnh nhưng được consumer coi là raw.** Ingest ghi thẳng `history()['close']` với provider mặc định `adjusted=True` (`data_ingest/tasks.py:665-673,704-711`); VCI/KBS chỉ phục vụ adjusted (`vci/quote.py:544,578-585`). Hệ thống **đúng nhờ dữ liệu sai**.
2. **`adj_close` chưa đủ để làm nguồn duy nhất.** Toàn DB có 1.904.709 dòng non-null nhưng riêng 2026 chỉ **222** / ~281.000 dòng. Bật flag lọc theo basis sẽ cắt đuôi chuỗi (TPB dừng 2025-12-31).
3. **CafeF là nguồn raw độc quyền và không ổn định.** `adjusted=False` của VCI/KBS đều gọi lại CafeF; VPS 503/rỗng; `cafef_2026=0`. Không có raw dự phòng nào.
4. **Hai lớp song song không dùng chung health/rate-limit budget.** `vnbroker` có `BulkRouter` + `HealthRouter` + `ProviderPool`; `vninvest` lại tự round-robin VCI/KBS với delay cứng. Dễ gây 418/503 và lãng phí provider khỏe.
5. **Đường cập nhật adjusted theo sự kiện bị tắt.** Có 22.470 `CorporateAction` nhưng `apply_adjustments()` trả 0 UPDATE (`adjustment.py:93-94`) vì `PRICE_ADJUSTMENT_WRITES_ENABLED` unset; `compute_adj_factors._prev_close` lại đọc cột `close` đã adjusted.

---

## A. Bản đồ kiến trúc

### A.1 `vnbroker` (package `3.10.0`, pin tại `packages/core/backend/requirements.txt:40`)

| Thành phần | file:line | Vai trò |
|---|---|---|
| `Vnbroker` façade | `vnbroker/__init__.py:30-34`, `common/client.py:88-122` | `stock(symbol, source)` trả `quote/company/finance`; `source` override VCI/KBS/TCBS/DNSE/SSI |
| `ProviderRegistry` | `core/registry.py:20-60,70+` | self-register theo import side-effect; lazy loader `_auto_loaded` tránh registry rỗng |
| `UnifiedRegistry` | `core/unified_registry.py:23-119` | hợp nhất provider + broker registry |
| `ProviderPool` | `core/provider_pool.py:14-112` | phát hiện provider có credential (`_detect_auth_providers`); lọc theo module |
| `source_router` | `core/source_router.py:31-60` | `AUTO` failover; `OPEN_SOURCE_CANDIDATES` quote=`[vci,kbs]`; `PRIMARY_SOURCE_POOLS` quote=`[vci,kbs]`; cooldown lưu SQLite |
| `HealthRouter` | `core/health_router.py:16-49` | xếp provider khỏe theo latency, loại provider `in_cooldown` |
| `BulkRouter` | `core/bulk_router.py:90-178` | chia symbol round-robin, `ThreadPoolExecutor(max_workers=len(selected))` ở `:150`, gom lỗi per-provider |
| `api/bulk.py` | `api/bulk.py:34-89` | façade `Bulk.history`: pool → registry → BulkRouter |
| `AdaptiveController` | `core/adaptive_controller.py:63-275` | điều chỉnh batch size theo latency/error (`compute`, `adjust`, `GlobalPressure`) |
| CafeF reference | `reference/client.py:182-269` | `_BULK_TTL_SEC=300`, `_BULK_CACHE` process-local, `_MIN_REQUEST_INTERVAL_SEC=1`, `bulk_year` 3 lần thử, timeout 180s |
| VCI quote | `explorer/vci/quote.py:530-585` | `adjusted=True` mặc định; `adjusted=False` → `_cafef_raw_records` |
| KBS quote | `explorer/kbs/quote.py:302-445` | tương tự VCI |

### A.2 `vninvest`

| Thành phần | file:line | Vai trò |
|---|---|---|
| `DailyPrice` | `market_data/models.py:63-107` | `close`, `is_adjusted`, `adj_close`, `adj_factor`, `adj_as_of`, `adj_version`, `price_source` |
| `CafefDailyPrice` | `models.py:113-142` | bảng đối chiếu độc lập `close_raw` + `close_adjusted` |
| `CorporateAction` / `AdjFactor` | `models.py:148` / `:202` | 22.470 sự kiện; hệ số theo ex-date |
| `PriceRebaseRun` | `models.py:610-646` | audit rebase: applied / applied_fallback / halted / failed |
| Ingest | `data_ingest/tasks.py:77-90,653-737,1809-1816` | VCI/KBS, 2 provider, round-robin, delay 0.5s/0.12s, retry 3 lần backoff 0.5→2s |
| CafeF import | `market_data/cafef/importer.py` + `fetcher.py` | `fetch_year_paced` backoff; normalize field; ghi `CafefDailyPrice` |
| Rebase / drift / fallback | `tasks.py:3560-3697`, `cafef/rebase.py:26-67`, `cafef/drift.py`, `cafef/fallback.py` | validate 3 bất biến; fallback KBS adjusted có nhãn |
| Integrity | `cafef/integrity.py:21-150` | 7 violation code, dùng chung write-path + ops command + beat |
| Pricing | `market_data/pricing.py:29-74` | `effective_close` / `effective_ohlc` theo flag `PRICE_ADJUSTED_DISPLAY` |
| FE contract | `packages/web/src/adapters/chartAdapter.js:42-104` | `parseBars`: lọc `unmapped_cafef`, chọn basis `adjusted`/`provider_adjusted_fallback`, scale O/H/L/C |
| Lịch beat | `vninvest_core/settings.py:778-817` | 17:00 backfill, corporate action, 19:00 rebase, 20:00 drift, 21:00 integrity |

---

## B. Luồng dữ liệu đã trace

### B1. Ingest hàng ngày (giá hiển thị hiện tại)
`settings.py:778` → `backfill_daily_prices` (`tasks.py:2101`) → `_backfill_daily_prices_impl` round-robin VCI/KBS (`:1809-1816`) → `_fetch_daily_history_with_retry` (`:653-685`) → `fetch_daily_history(source=provider)` → `_classify_daily_price_rows` (`:688-737`) → `DailyPrice.close = row['close']` (`:708`).

⚠️ `row['close']` là **adjusted** vì provider mặc định `adjusted=True`. Guard `:726-728` chỉ skip dòng `cafef`/`unmapped_cafef`, không sửa định nghĩa cột.

### B2. Rebase lịch sử khi có sự kiện
`rebase_symbol_from_cafef` (`tasks.py:3560+`) → `fetch_year_paced` từ CafeF ALL-export → `build_series` → `validate_rebase` (raw ≤0,5%, parity ≤0,5%, `0.01≤factor≤1.05`, coverage ≥95%, `rebase.py:13-67`) → ghi `adj_close`/`adj_factor`/`adj_as_of`/`adj_version` → `PriceRebaseRun`.

### B3. Corporate action → adjusted
`sync_corporate_actions` (`tasks.py:3779-3794`, flag `CORPORATE_ACTIONS_ENABLED=true` trên staging) → `compute_adj_factors` → `apply_adjustments` → **0 UPDATE** vì guard `PRICE_ADJUSTMENT_WRITES_ENABLED` unset (`adjustment.py:93-94`).

### B4. Fallback khi CafeF chết
`fetch_year_paced` lỗi **hoặc trả rỗng** → `apply_provider_fallback` (`cafef/fallback.py`) → KBS `adjusted=True` → ghi `adj_close=provider_close`, `adj_factor=1`, `price_source='vnbroker_fallback'` → FE nhãn `provider_adjusted_fallback` (`chartAdapter.js:90`). Guard `cafef_rows_present` từ chối mã đã có dòng CafeF.

### B5. Hiển thị
`/chart/` (`stock_mgmt_native_views.py:2053-2069`) trả `points` + `adjusted_display` → `parseBars` (`chartAdapter.js:65-104`) → widget. BE có `effective_close` nhưng `/chart/` **không dùng** nó để đổi giá, chỉ truyền flag.

---

## C. CONTRADICTIONS (tài liệu/code vs thực tế)

| # | Tài liệu/code nói | Thực tế | Tác động |
|---|---|---|---|
| C1 | `pricing.py:3-5`: "pilot HOSE 2022 (~2%) có cafef" | `cafef_2026=0`; 2026 chỉ legacy/unmapped/fallback | Doc stale, dễ tin rằng flag đã parity |
| C2 | `adjustment.py:22-29` gọi `_prev_close` là "raw close" | Cột `close` chứa adjusted (TPB 13934.04 = VCI adjusted) | Factor tính sai nếu bật writes |
| C3 | `RAW_USAGE_SCAN` cũ: trần/sàn dùng raw | FPT ex-date: raw 44500, adjusted 43498.75, snapshot ref 43500 = 44500−1000 | Kết luận cũ SAI, đã đính chính Entry 672 |
| C4 | `chartAdapter.js:74-76`: "drop mixed legacy" để tránh basis | Legacy `close` cũng là adjusted → dropping không còn ý nghĩa như thiết kế | Cắt đuôi 2026 vô lý |
| C5 | `vnbroker` BulkRouter "chịu trách nhiệm bulk" | `vninvest` tự round-robin riêng ở `tasks.py:1809` | Hai bộ health/delay rời nhau |

---

## D. Findings

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **F1** | **P0** | `tasks.py:665-673,704-711`; `vci/quote.py:544,578` | `close` = adjusted provider | Consumer gọi là raw; migrate sang raw sẽ sai trần/sàn | Định nghĩa lại contract: `adj_close` canonical; `close` reference |
| **F2** | **P0** | probe `ADJ_NONNULL_2026=222`; `chartAdapter.js:67-69,80-92` | 2026 thiếu adjusted; flag=1 lọc/cắt | Chart mất 2026 (TPB dừng 2025-12-31) | Fill `adj_close` có backup trước khi bật flag |
| **F3** | **P0** | `vci/quote.py:578-585`; `kbs/quote.py:438-445`; `reference/client.py:229-269` | Raw chỉ có CafeF; bulk 503/rỗng | Không có nguồn thay thế khi CafeF block | Provider có credential làm raw SSOT hoặc chấp nhận adjusted canonical |
| **F4** | P1 | `bulk_router.py:150`; `tasks.py:1809-1816,83-87` | 2 lớp song song, không chia rate budget | 418/503, provider khỏe bị bỏ rơi | Một bulk engine dùng chung health+rate limiter |
| **F5** | P1 | `adjustment.py:22-29,93-94`; `tasks.py:3779-3794` | 22.470 sự kiện nhưng write path tắt | Không tự recompute theo ex-date | Thiết kế lại `_prev_close` từ raw thật rồi bật có kiểm soát |
| **F6** | P1 | `reference/client.py:182-192` | Cache/throttle process-local | Nhiều worker/agent cùng đụng CafeF → burst | Redis rate limiter + distributed lock |
| **F7** | P2 | `cafef/integrity.py:21-150` | Gate kiểm consistency, không check freshness | Dữ liệu stale vẫn "ok" | Thêm SLO `last_date` theo symbol + alert |
| **F8** | P2 | `cafef/fallback.py` guard `cafef_rows_present` | Fallback chỉ phủ 537/1834 mã | 1345 mã không có fallback | Thiết kế "chuyển basis toàn chuỗi" có audit, không trộn |

---

## E. Quality gates (trạng thái thật)

| Gate | Kết quả |
|---|---|
| `pre-push-gate` | 36 PASS / 0 FAIL (chạy trên tree sạch) |
| `check-system-design --check` | SACH |
| Unit price-integrity/fallback | 32 + 9 + 22 passed ở các slice trước |
| Full BE suite local | **CHƯA CHẠY** — Postgres local `connection timeout expired` |
| Browser E2E widget | **CHƯA XÁC MINH** — baseline kẹt "Đang tải biểu đồ…", đã chứng minh không phải regression |
| Fill `adj_close` toàn 2026 | **CHƯA LÀM** (cần owner chốt + backup) |

## F. Câu hỏi cần owner chốt

1. Chọn **A**: provider-adjusted làm canonical (không cần raw, đang đi), hay **B**: raw SSOT độc lập CafeF (cần credentials DNSE/SSI/TCBS)?
2. Có cho phép **fill `adj_close = close` cho ~281k dòng 2026** (với backup + batch) để bật flag không?
3. Có cấp credentials provider trả phí để hết phụ thuộc CafeF không?
4. Chấp nhận **fallback có nhãn** cho 1345 mã có lịch sử CafeF hay bắt buộc giữ nguyên CafeF khi có sẵn?

## G. Kiến trúc mục tiêu & lộ trình đề xuất

### G1. Contract dữ liệu (thống nhất)
- `adj_close` = **giá hệ thống dùng** để hiển thị, NAV, cảnh báo, tham chiếu ngày ex-date.
- `close` = giá tham chiếu/thô, **không dùng cho UI**; có thể NULL nếu không có nguồn raw.
- `adj_factor` = `adj_close / close` khi có raw, else `1` với nhãn basis.
- `price_source` ∈ `{cafef, vnbroker_fallback, provider_raw, ...}` — **không bao giờ trộn trong cùng symbol**.
- `adj_as_of`, `adj_version`, `PriceRebaseRun` = truy vết.

### G2. Vai trò provider
- **VCI/KBS**: adjusted OHLCV canonical (đang có, nhanh); `adjusted=False` không dùng vì vẫn gọi CafeF.
- **DNSE/SSI/TCBS**: nguồn raw độc lập nếu có credentials — chỉ khi chọn phương án B.
- **CafeF**: raw *tham khảo* + đối chiếu sự kiện; **không nằm trên critical path** hiển thị.
- Fallback: provider khác có adjusted → ghi nhãn, không che giấu nguồn.

### G3. Bulk song song (tránh rate-limit)
- Dùng **một** bulk engine: `vnbroker.api.bulk.Bulk` → `BulkRouter` (`bulk_router.py:90-178`) + `HealthRouter` (`health_router.py:35-40`) + `ProviderPool` (`provider_pool.py:98`).
- `vninvest` bỏ round-robin tự định nghĩa (`tasks.py:1809-1816`), gọi một API bulk với `symbols[]`, `providers=AUTO`.
- Rate limiter dùng Redis (shared counter + token bucket) thay cho `_BULK_CACHE`/`_throttle` process-local (`reference/client.py:182-192`).
- Circuit breaker per-provider theo `health_store` hiện có; cooldown tăng dần; worker = số provider khỏe, có hard cap (dùng `AdaptiveController.cap_to` `adaptive_controller.py:218`).
- Idempotent write: khóa `(symbol, date, basis)`; retry chỉ khi lỗi tạm thời; log per-provider errors như `bulk_router.py:158`.

### G4. Cập nhật & truy vết
- Rebase toàn chuỗi khi có `CorporateAction` mới: **một** phương thức được chọn (A hoặc B), không hai đường cạnh tranh.
- Beat hiện tại (17:00 ingest, ca, 19:00 rebase, 20:00 drift, 21:00 integrity) giữ nguyên nhưng thêm **freshness SLO**: mỗi symbol active có `last_date >= today-1 trading day`; nếu vi phạm → alert thay vì báo ok.
- Gate integrity mở rộng: consistency (7 code hiện có) + freshness + coverage adjusted.

### G5. Lộ trình (phụ thuộc quyết định F)
| Phase | Việc | Gate |
|---|---|---|
| 0 | Chốt A/B + contract fields | owner sign-off |
| 1 | Backup + fill `adj_close` cho 2026 (A) hoặc migrate raw (B) | row count + rollback test |
| 2 | Đổi consumer sang `effective_close` (ưu tiên `adj_close`) | TDD + 32/9/22 tests hiện có |
| 3 | Unify bulk engine + Redis rate limiter | so sánh latency/418 trước-sau |
| 4 | CafeF xuống tham khảo; bật flag khi parity | integrity ok + freshness ok |
| 5 | Bỏ chế độ song song cũ, dọn code chết | pre-push + system-design |

## Appendix — lệnh tái hiện chính

```powershell
# env staging
ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 'docker exec vninvest-core-api python -c "import os; print({k:os.getenv(k) for k in [\"PRICE_ADJUSTED_DISPLAY\",\"CORPORATE_ACTIONS_ENABLED\",\"PRICE_ADJUSTMENT_WRITES_ENABLED\"]})"'
# coverage
... DailyPrice.objects.filter(date__gte='2026-01-01', adj_close__isnull=False).count()
# ex-date FPT
... SymbolSnapshot.objects.filter(symbol='FPT', session_date='2026-11-27').values(...)
# provider probe
PYTHONPATH=<vnbroker> python -c "..."  # VCI/KBS history(adjusted=True/False)
```

## Reservation cuối
Hành vi fill nến bên trong package `vninvestcharts-widget` (dist minified) **CHƯA XÁC MINH**. Báo cáo không khuyến nghị bật flag cho tới khi owner chốt Phase 0.
