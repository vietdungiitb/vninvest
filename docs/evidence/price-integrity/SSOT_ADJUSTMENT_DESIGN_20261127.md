# Thiết kế SSOT giá điều chỉnh — `vnbroker` + `vninvest` (Rev.1, 2026-11-27)

> **DOC-ONLY** — tài liệu thiết kế, không đổi source/data/flag. Dựa trên
> `ARCHITECTURE_RESEARCH_20261127.md`, `PRICE_MODEL_REVIEW_20261127.md`,
> `EXDATE_REFERENCE_20261127.md` và các probe thực tế ngày 2026-11-27.

---

## 0. Quyết định nguyên tắc (Owner chốt trong phiên này)

1. **Raw price chỉ là dữ liệu tham khảo**, dùng để đối chiếu/so sánh biến động lịch sử — **không phải giá hệ thống dùng**.
2. **`adj_close` là SSOT duy nhất** cho mọi hoạt động hiển thị, tính toán, cảnh báo, NAV, tham chiếu ngày ex-date.
3. **CafeF chỉ là nguồn đối chiếu**. Không được nằm trên đường dẫn critical path của giá hiển thị.
4. Khi có sự kiện điều chỉnh, **tự tính lại toàn bộ chuỗi `adj_close` lịch sử trên chính nguồn chuẩn này**. Việc đồng bộ toàn bộ từ provider là phương án dự phòng/chậm (rate-limit, gián đoạn), nên **chỉ lấy mẫu một lượng nhất định từ provider để khẳng định công thức đúng**.
5. Bulk phải **song song nhiều nguồn, tốc độ cao nhất có thể**, nhưng vẫn tuân thủ rate-limit và idempotent.

---

## 1. Định nghĩa & bất biến

| Khái niệm | Định nghĩa đề xuất |
|---|---|
| `base_close` | Giá nhận từ provider ở thời điểm ingest (hiện đang bị ghi vào `close`, `tasks.py:704-711`). Là **nền để tính**, không phải giá hiển thị. |
| `adj_close` | Giá đã điều chỉnh lũy kế tới ex-date mới nhất — **SSOT**. Mọi consumer đọc giá trị này. |
| `adj_factor` | `adj_close / base_close` khi có base tin cậy; nếu không có base thì `1` và gắn nhãn basis. |
| `adj_source` | `self_computed` (mặc định) · `provider_sample_verified` · `cafef_crosscheck` (chỉ đối chiếu) · `fallback_labeled`. |
| `adj_version` | Tăng mỗi lần recompute toàn chuỗi (`models.py:90-92` đã có). |
| `adj_as_of` | Thời điểm recompute gần nhất (`models.py:91`). |
| `basis` | Nhãn hiển thị: `adjusted` / `provider_adjusted_fallback` — **do BE trả về**, không do FE suy từ `price_source`. |

**Bất biến (I1..I7):**
- I1: Mọi consumer UI/API lấy giá từ `adj_close`; không consumer nào đọc `close` để hiển thị.
- I2: `adj_close > 0`; chuỗi theo ngày tăng dần; không có khoảng trống do lọc basis.
- I3: Một symbol chỉ có **một** basis tại một thời điểm; tuyệt đối không trộn dòng `cafef`/legacy/fallback trong cùng chuỗi hiển thị.
- I4: Recompute là **pure function** của `(base_close, danh sự kiện có is_latest, cutoff)` — chạy lại nhiều lần cho cùng input ra cùng output.
- I5: Mỗi lần recompute ghi `adj_version += 1`, `adj_as_of`, và một bản ghi audit.
- I6: Công thức chỉ được tin khi **mẫu đối chiếu provider** đạt ngưỡng (§5); không đạt → fail-closed, giữ chuỗi cũ.
- I7: CafeF không được ghi vào `DailyPrice.adj_close`. Bảng `CafefDailyPrice` (`models.py:113-142`) chỉ để đối chiếu.

---

## 2. Phân vai trò hai repo (RACI)

| Nhiệm vụ | `vnbroker` | `vninvest` |
|---|---|---|
| Định nghĩa provider & auth | Chủ (`ProviderPool`, `ProviderRegistry`: `core/provider_pool.py:14-112`, `core/registry.py:70+`) | Chỉ dùng |
| Chọn provider khỏe / sharding | Chủ (`HealthRouter`, `source_router`, `BulkRouter`: `core/health_router.py:16-49`, `core/source_router.py:31-60`, `core/bulk_router.py:90-178`) | Gọi 1 API bulk, không tự sharding |
| Rate-limit phân tán | Chủ (Redis token bucket — **đề xuất mới**, thay `_throttle` process-local `reference/client.py:188-192`) | Không tự delay cứng (`tasks.py:83-87` sẽ bỏ) |
| Trả giá adjusted + metadata | Chủ (`history(adjusted=True)`, `df.attrs`: `vci/quote.py:336-337,599-600`, `api/bulk.py:128-130`) | Đọc metadata, lưu `base_close` + `adjusted_as_of` |
| CafeF | **Read-only reference** (`CafefReference` cố tình không vào AUTO pool, `reference/cafef.py:23-28`) | Chỉ bảng đối chiếu `CafefDailyPrice` |
| Công thức điều chỉnh | Không (chỉ cung cấp mẫu kiểm chứng) | **Chủ** (`AdjustmentService` — đề xuất thay `apply_adjustments`/`rebase`/`fallback` rời rạc) |
| Lưu trữ & audit canonical | Không | Chủ (`DailyPrice`, `AdjFactor`, `AdjustmentRun`) |
| Integrity + freshness | Provider health | Chủ (`cafef/integrity.py` mở rộng) |
| FE contract | Không | Chủ (`price_basis` do BE trả, bỏ phụ thuộc `price_source==='cafef'` ở `chartAdapter.js:47-50`) |

---

## 3. Contract dữ liệu đề xuất

### 3.1 `DailyPrice` (`models.py:63-107`) — bổ sung

| Trường | Hiện tại | Đề xuất |
|---|---|---|
| `close` | đang chứa adjusted | đổi nghĩa thành `base_close` (reference). Giữ tên để tương thích, nhưng **cấm dùng làm giá hiển thị** |
| `adj_close` | nullable, rời rạc | **NOT NULL sau migration backfill**; canonical price |
| `adj_factor` | nullable | `adj_close / close` khi `close` là base tin cậy; else `1` |
| `adj_basis` | chưa có | `self_computed` / `provider_sample_verified` / `fallback_labeled` |
| `adj_source_version` | chưa có | mã hóa provider + ngày lấy mẫu |
| `adj_as_of`, `adj_version` | đã có (`models.py:90-92`) | giữ nguyên, bắt buộc ghi |
| `price_source` | `cafef`/`unmapped_cafef`/legacy | chỉ còn ý nghĩa **nguồn base**, không quyết định basis hiển thị |

### 3.2 Bảng mới (đề xuất)

- **`AdjustmentEvent`**: thay thế việc dùng trực tiếp `CorporateAction` cho tính toán — lưu `event_id`, `symbol`, `ex_date`, `cash_per_share`, `stock_ratio_pct`, `factor`, `status`, `applied_version`. Dùng `is_latest` (`models.py:184`) để xử lý correction.
- **`AdjustmentRun`**: `symbol`, `version_before`, `version_after`, `events_hash`, `rows_scanned`, `rows_updated`, `sample_verdict`, `started_at`, `finished_at` — audit mỗi lần recompute (thay/extend `PriceRebaseRun` hiện tại `models.py:610-646`).
- **`ProviderSampleCheck`**: `run_id`, `provider`, `symbols_checked`, `dates_checked`, `max_abs_diff`, `verdict` — bằng chứng công thức đúng.

### 3.3 Contract từ `vnbroker` trả về (đề xuất)

Mỗi `DataFrame` phải có `df.attrs` (đang có `source`/`data_origin` ở `vci/quote.py:336-337,599-600`; cần bổ sung):
```
symbol, source, adjusted=True, adjusted_as_of, fetched_at,
provider_request_id, rate_limit_remaining, quality_flags
```
`Bulk.history` đã trả `sources_used`/`failed`/`requested`/`returned` (`api/bulk.py:119-130`) — mở rộng thêm `attrs['basis']`.

---

## 4. Công thức tự tính (SSOT) — chi tiết

### 4.1 Nguyên tắc

Không nhân thêm factor lên `adj_close` đã điều chỉnh (tránh double-adjust — lý do `adjustment.py:3-5` tắt ghi). Thay vào đó:

1. Lưu `base_close` từ provider tại lần ingest đầu (theo `adjusted_as_of` của provider).
2. Mỗi sự kiện `e` có hệ số `f(e)` tính từ **cùng basis với base_close**:
   - Tiền mặt: `cash_factor = (P_prev - cash_sum) / P_prev`, với `P_prev = base_close` của phiên liền trước ex-date (thay vì `close` ô nhiễm hiện tại — `adjustment.py:22-29,67`).
   - Cổ phiếu thưởng/chia tách: `stock_factor = 1 / (1 + ratio_sum/100)` (`adjustment.py:57,68`).
   - `f = cash_factor * stock_factor` (`adjustment.py:69`).
3. `adj_close(t) = base_close(t) * Π f(e)` với mọi `e.ex_date > t`.
4. Khi có event mới: **recompute toàn chuỗi từ base + danh sách event**, không cộng dồn vào kết quả cũ. Đây là I4 — idempotent, sửa correction chỉ cần đổi event rồi chạy lại.

### 4.2 Ví dụ thực (FPT, ex-date 2026-11-27)

- `base_close(2026-11-26) = 44500` (VCI raw probe), event `DIV 1000 ₭` (`CorporateAction` id 22469).
- `f = (44500 - 1000)/44500 = 0.97752809`.
- `adj_close(2026-11-26) = 44500 × 0.97752809 = 43500` — khớp `SymbolSnapshot.reference_price=43500` và VCI adjusted `43498.75` (sai số làm tròn).
- Mọi ngày `< 2026-11-27` nhân với `f`; ngày `>= ex-date` giữ nguyên.

### 4.3 Xử lý correction / event trùng

- `AdjFactor` hiện khóa `(symbol, ex_date)` (`models.py:210-216`); đề xuất khóa theo `(symbol, ex_date, events_hash)` để correction tạo phiên bản mới thay vì ghi đè.
- `is_latest=False` (`models.py:184`) → loại khỏi tính toán nhưng vẫn lưu vết.
- Nếu `parse_status != structured` hoặc `ambiguous_*` (`models.py:177-183`) → `status=PARTIAL`, **không tự động áp dụng**; chờ owner xác nhận.

### 4.4 Chạy khi nào

| Trigger | Hành động |
|---|---|
| Event mới/`is_latest` đổi | recompute symbol đó, version+1 |
| Ingest base mới | ghi `base_close` nếu chưa có; **không đụng `adj_close`** |
| Sample check định kỳ | so công thức với provider (§5) |
| Beat 19:00/20:00 (`settings.py:797-810`) | giữ làm watchdog, không phải đường ghi chính |

---

## 5. Kiểm chứng công thức bằng mẫu provider (thay full sync)

**Nguyên tắc:** provider làm "thước đo", không làm nguồn ghi. Lấy ít hơn 1% dữ liệu để khẳng định đúng.

### 5.1 Giao thức đề xuất

| Tham số | Giá trị đề xuất |
|---|---|
| `SAMPLE_SYMBOLS` | 24 mã/ngày (top thanh khoản + 6 mã có event gần nhất) |
| `SAMPLE_DATES` | 5 ngày/mã: ex-date, ex-date−1, ex-date+1, 1 ngày trước đó 30d, 1 ngày sau 30d |
| Tổng request | ~24, so với ~1800 mã × 15 năm nếu sync toàn bộ |
| Sai số cho phép | `abs(computed - provider) / provider <= 0.005` (cùng tolerance với `rebase.py:13`) |
| Ngưỡng đạt | ≥95% mẫu khớp; nếu thấp hơn → `verdict=FAILED`, **fail-closed**, giữ chuỗi cũ + alert |
| Tần suất | Mỗi lần recompute + 1 lần/ngày cho symbol có event trong 7 ngày |

### 5.2 Luồng

```
recompute(base, events) -> adj_close_new
    -> sample = vnbroker.history(adjusted=True, symbols=SAMPLE_SYMBOLS, windows=SAMPLE_DATES)
    -> compare(adj_close_new, sample) -> verdict
    -> PASS: commit version mới + ghi ProviderSampleCheck
    -> FAIL: rollback in-memory, giữ version cũ, ghi audit failed, báo owner
```

### 5.3 Vì sao không sync toàn bộ từ provider

- VCI/KBS `adjusted=True` trả adjusted theo **chu kỳ riêng của provider** (VCI 13934.04 vs KBS 13949 cùng ngày — probe thực); sync toàn bộ dễ đẩy basis khác vào DB.
- Rate-limit: CafeF bulk 3 lần vẫn 503 (`reference/client.py:229-269`); VCI/KBS từng 418 khi dồn request (`docs/evidence/corporate-actions/ALL_SYMBOLS_SYNC_20261121.md`).
- Mẫu đủ để chứng minh công thức, không cần copy dữ liệu provider.

---

## 6. Bulk tốc độ cao từ nhiều nguồn song song

### 6.1 Đo lường thực (2026-11-27, local, 8 mã, 27 ngày)

| Provider | workers | ok | thời gian |
|---|---|---|---|
| VCI | 4 | 8/8 | 3,64s |
| VCI | 8 | 8/8 | **1,39s** |
| KBS | 1 | 8/8 | 1,79s |
| KBS | 4 | 8/8 | **0,94s** |
| KBS | 8 | 8/8 | 0,93s (đã bão hòa) |

⇒ Song song có lợi; KBS bão hòa ~4 worker, VCI vẫn tăng ở 8. **Đây là mẫu nhỏ, không phải SLA** — cấu hình phải auto-adjust.

### 6.2 Vấn đề hiện tại

- `vnbroker.BulkRouter` dùng `max_workers = len(selected)` (`core/bulk_router.py:150`) = **2** → không bao giờ vượt 2 request đồng thời dù có 1800 mã.
- `vninvest` tự round-robin 2 provider với delay cứng VCI 0.5s / KBS 0.12s (`tasks.py:1809-1816,83-87`) → nhân đôi lớp điều phối, không chia sẻ health.

### 6.3 Kiến trúc bulk đề xuất

```
vninvest (1 caller)
   └─ vnbroker.api.bulk.Bulk.history(symbols[], providers="AUTO")
        ├─ ProviderPool.get_available_providers("quote")     [core/provider_pool.py:98]
        ├─ HealthRouter.get_healthy_providers + latency      [core/health_router.py:35-40]
        ├─ RedisTokenBucket(per provider)  ← MỚI, thay _throttle process-local
        ├─ AdaptiveController.compute/adjust/cap_to          [core/adaptive_controller.py:157,190,218]
        ├─ BulkRouter sharding: symbol_hash % capacity_weight
        │    VCI: 8 slots · KBS: 4 slots · (DNSE/SSI/TCBS nếu có credential)
        └─ ThreadPoolExecutor(max_workers = Σ slots, hard cap)
             → df.attrs sources_used/failed/requested/returned  [api/bulk.py:119-130]
```

**Tối ưu cụ thể:**
1. **Bỏ delay cứng** trong `vninvest`; nhường rate-limit cho token bucket tập trung.
2. **Worker = tổng slot provider khỏe**, không phải số provider. Bắt đầu VCI=8/KBS=4; `AdaptiveController` tự hạ nếu error rate tăng (`adaptive_controller.py:247-266`).
3. **Sharding có trọng số** theo capacity, không round-robin đều — tránh provider yếu thành nút thắt.
4. **Circuit breaker**: provider vào cooldown (`source_router.py:37-60`) → chia lại symbol cho provider khỏe trong cùng batch, không chờ batch sau.
5. **Connection pooling**: dùng `requests.Session` dùng lại cho provider (giảm TLS handshake).
6. **Bulk endpoint theo nhóm ngày**: nếu provider có API `bulk` (như CafeF ALL-export) thì 1 request cho cả nhóm; nếu không, 1 request/symbol nhưng chạy song song ở trên.
7. **Idempotent merge**: khóa `(symbol, date, basis)`; retry chỉ lỗi tạm; ghi `sources_used` per symbol để trace.
8. **Chỉ số đo bắt buộc**: symbols/s, p50/p95 latency, error rate per provider, cooldown events — so sánh trước/sau khi đổi.

### 6.4 Tái dùng cơ chế rate-limit ĐÃ CÓ của `vnbroker` (không phát minh lại)

Owner nhắc đúng: `vnbroker` đã có cả đo lẫn giới hạn rate.

| Thành phần hiện có | file:line | Trạng thái / cách dùng |
|---|---|---|
| `TokenBucketRateLimiter` | `core/utils/rate_limiter.py:21-84` | Thread-safe; `acquire()` `:38`, `wait(timeout)` `:51`; `MIN_CAPACITY=1` `:10`, `DEFAULT_MAX_WAIT=30s` `:15` |
| `configure_rate_limiter(rate, capacity)` | `core/utils/client.py:38-48` | Module-level, **mặc định TẮT** (`:34-35`); `wait()` chỉ gọi ở `:249-251` |
| Hàm **đo** rate-limit | `tests/examples/vci_perf_benchmark.py:45,92-159,166-177` | Đếm `throttled_responses` (429) + `success_rate` theo từng mức concurrency |
| Profile tự điều chỉnh | `core/performance_profiles.py:9-74` | `benchmark_max_speed` VCI start 10 / KBS 8; `production_stable` 6/4; `market_hours` 4/3 (tránh 429 giờ mở cửa) |
| Adaptive controller | `core/adaptive_controller.py:157,190,218,247-266` | `compute`/`adjust`/`cap_to`; `GlobalPressure.record_batch` theo error rate |
| Cooldown | `core/source_router.py:37-60`, `core/health_router.py:35-40` | Provider 429/fail vào cooldown, bị loại khỏi pool tạm thời |
| 429 không retry | `base.py:237-238`, `common/data.py:30` | Đúng: retry ngay chỉ đốt quota ⇒ phải **failover sang provider khác** |

**Vấn đề:** `configure_rate_limiter` chưa bao giờ được gọi bởi explorer VCI/KBS (grep chỉ thấy định nghĩa ở `core/utils/client.py`) ⇒ token bucket hiện **vô hiệu** với đường bulk; profile adaptive cũng nằm riêng với `BulkRouter` (`max_workers=len(selected)` ở `bulk_router.py:150`).

**Đề xuất (tái dùng code cũ, bổ sung phần còn thiếu):**
1. Biến `TokenBucketRateLimiter` thành **per-provider**, khởi tạo từ rate đo được bởi `vci_perf_benchmark.py`; default theo `performance_profiles.py` (`market_hours` trong 09:00–15:30 ICT).
2. Đặt bucket ở **Redis** (hoặc ít nhất shared-process) để mọi worker/api instance cùng tuân một ngân sách — thay cho `_throttle` process-local của CafeF (`reference/client.py:188-192`).
3. Nối `AdaptiveController` vào `BulkRouter`: `max_workers = Σ min(profile_start, bucket_rate)` thay vì `len(selected)`.
4. **Requeue trong cùng batch**: `bulk_router.py:158` hiện chỉ ghi lỗi per-provider; khi provider dính 429/cooldown, chuyển ngay symbol còn lại sang provider khỏe khác trong cùng đợt ⇒ "vẫn tải đủ dữ liệu" như owner yêu cầu.
5. `vninvest` bỏ delay cứng (`tasks.py:83-87`) và sharding tự làm (`:1809-1816`), gọi một `Bulk.history` duy nhất.
6. Định kỳ chạy lại benchmark 429 để cập nhật rate profile; lưu kết quả vào `ProviderSampleCheck`-like record để có bằng chứng.

---

## 7. Luồng dữ liệu mục tiêu (end-to-end)

### 7.1 Ingest ngày (T+1)
`beat 17:00` → `vnbroker.Bulk.history(adjusted=True)` → metadata `adjusted_as_of` → `DailyPrice.base_close` (+ `price_source` provider). **Không ghi `adj_close`**.

### 7.2 Recompute định kỳ/khi có event
`sync_corporate_actions` (`tasks.py:3779`) → `AdjustmentEvent` → `AdjustmentService.recompute(symbol)` → sample check (§5) → commit `adj_close`, `adj_version`, audit.

### 7.3 Fallback provider
Khi provider chính lỗi: lấy adjusted từ provider khác → vẫn đi qua cùng `AdjustmentService` với `adj_basis='fallback_labeled'`; **không tạo đường ghi riêng** như `cafef/fallback.py` hiện nay.

### 7.4 CafeF (chỉ đối chiếu)
`CafefDailyPrice` (`models.py:113`) được import độc lập; `cafef/integrity.py` so sánh `close_raw`/`close_adjusted` với `base_close`/`adj_close` để báo **chênh lệch**, không để ghi đè.

### 7.5 Serving
`/chart/` (`stock_mgmt_native_views.py:2053-2069`) trả `points` với `adj_close` + `basis` do BE tính; FE `parseBars` (`chartAdapter.js:65-104`) **bỏ logic `price_source==='cafef'`**, chỉ dùng `basis` từ payload → hết phụ thuộc CafeF ở FE.

---

## 8. Integrity & Freshness

- Giữ 7 code hiện có trong `cafef/integrity.py:21` nhưng đổi tên cho basis-based (`unmapped_with_adjustment` → `stale_basis`, v.v.).
- Thêm violation: `adj_close_null`, `adj_version_stale`, `sample_verdict_failed`, `last_date_lag`.
- **SLO**: mỗi symbol active có `adj_as_of` trong 24h và `last_date >= today - 1 trading day`; vi phạm → alert, không báo ok.
- Gate `check_price_integrity` (command hiện có) chạy sau mỗi recompute, không chỉ 21:00.

---

## 9. Lộ trình triển khai (phụ thuộc owner)

| Phase | Việc | Gate / rollback |
|---|---|---|
| 0 | Chốt contract §1/§3, chọn provider credential | owner sign-off |
| 1 | Thêm field + migration; backfill `adj_close = base_close` có backup | row count, rollback SQL |
| 2 | `AdjustmentService` recompute từ event + sample check | 32/9/22 tests hiện có + test fail-before mới |
| 3 | Đổi consumer BE/FE sang `adj_close` + `basis` | tsc + contract tests; so sánh chart trước/sau |
| 4 | Unify bulk vào `vnbroker.Bulk` + Redis rate limiter | benchmark symbols/s, error rate |
| 5 | CafeF xuống đối chiếu; bật flag; bỏ đường ghi cũ | integrity ok + freshness ok |
| 6 | Dọn code chết (`rebase`/`fallback`/`apply_adjustments` cũ) | pre-push + system-design |

---

## 10. Rủi ro & chưa xác minh

- **R1**: Provider adjusted có thể đã áp dụng event trước khi ta tự tính → double-adjust. Giảm thiểu bằng `adjusted_as_of` + sample check; nếu không có metadata, bắt buộc dùng `base_close` lấy từ nguồn raw có credential.
- **R2**: Hành vi fill nến trong package widget (dist minified) **CHƯA XÁC MINH**.
- **R3**: Benchmark §6 là mẫu 8 mã — không đại diện 1800 mã; phải đo lại khi triển khai.
- **R4**: Migration `close → base_close` là thay đổi ngữ nghĩa lớn; phải có backup + rollback SQL + chạy trên staging riêng trước.
- **R5**: `PRICE_ADJUSTMENT_WRITES_ENABLED` hiện unset (`adjustment.py:93`); design này thay thế hoàn toàn cờ đó bằng `AdjustmentService`.

---

## 11. Evidence tham chiếu

- `ARCHITECTURE_RESEARCH_20261127.md` — bản đồ + 5 finding.
- `PRICE_MODEL_REVIEW_20261127.md` — A/B provider-adjusted vs raw SSOT.
- `EXDATE_REFERENCE_20261127.md` — FPT ex-date prove adjusted reference.
- `RAW_USAGE_SCAN_20261127.md` — scan consumer (đoạn cũ đã đính chính).
- `CAFEF_FALLBACK_IMPL_20261127.md`, `FALLBACK_E2E_CLOSE_20261127.md` — fallback thực chạy.
- Ledger Entry 666–673.

## 12. Reservation cuối
Tài liệu này là đề xuất; **không code, không migrate, không đổi flag**. Mọi thay đổi phải đi qua plan riêng, TDD fail-before, gate và PR.
