# Thiết kế SSOT giá điều chỉnh — Rev.2 (2026-11-27)

> **DOC-ONLY.** Tài liệu này **thay thế** `SSOT_ADJUSTMENT_DESIGN_20261127.md` (Rev.1, PR #583).
> Lý do: audit độc lập cho verdict **NEED_REVISION** với 2 lỗi P0 nền tảng (mô hình toán và chẩn đoán `vnbroker`) + 2 lỗi P1. Mọi phản biện trọng yếu đã được tôi **tự kiểm chứng lại bằng source** trước khi viết vào Rev.2.
> 5 nguyên tắc ở §0 của Rev.1 (raw chỉ tham khảo, `adj_close` SSOT, CafeF chỉ đối chiếu, tự tính toàn chuỗi khi có event, bulk nhiều provider song song) **vẫn giữ nguyên**.

---

## 1. Phản biện Rev.1 — đối chiếu với source thật

| Rev.1 nói | Kiểm chứng của tôi | Kết luận |
|---|---|---|
| `BulkRouter.max_workers=len(selected)=2` ⇒ chỉ 2 request đồng thời | `bulk_router.py:150` đúng là `len(selected)`, nhưng `:153` nộp **1 future cho mỗi provider** (`_fetch_batch`); bên trong `:329-365` gọi `history(symbols=..., parallel=True)`. VCI `fetch_multiple(max_concurrency=24)` (`vci/quote.py:407`), KBS `ThreadPoolExecutor(max_workers=worker_count)` adaptive (`kbs/quote.py:194-266`) | **SAI** — tăng dòng 150 vô dụng. Bỏ. |
| `TokenBucketRateLimiter` bị tắt ⇒ vô hiệu | Có **2** bucket: sync `core/utils/client.py:35` (tắt) và **async `core/utils/async_client.py:35-106` BẬT**, `RATE_LIMITER = TokenBucketRateLimiter(Config.RATE_LIMIT_RPM)` ở `:106`, dùng bởi VCI `fetch_multiple` | **SAI MỘT PHẦN** — phải hợp nhất cả hai, không chỉ `client.py`. |
| 429 không retry (`base.py:237-238`) | Đúng cho sync, **sai cho async**: `async_client.py:313-314` `_is_retryable_status` trả `status_code == 429` ⇒ retry 3 lần. Grep literal **418 = 0** trong toàn `vnbroker` ⇒ HTTP 418 (rate-limit thực tế của VCI) không được nhận diện | **SAI** — phải bắt `418 + 429`, bỏ 429 khỏi retry list async. |
| Sửa `bulk_router.py:158` để requeue | `vci/quote.py:439` và `kbs/quote.py:261` nuốt exception per-symbol; `fetch_multiple` trả ít frame nhưng không ném lỗi ⇒ `BulkRouter` gọi `record_success` (`:268`). Tag symbol bị bỏ khi `len(frames)!=len(symbols)` (`bulk_router.py:467-471`) | **SAI** — phải làm work-queue per-symbol, không vá dòng 158. |
| Cần thêm connection pooling / Redis trong `vnbroker` | Đã có `core/utils/connection_pool.py:16-61`, `async_client.py:223-288` (`http2=True`, `max_connections=200`). `pyproject.toml:40-55` **không có redis** — thêm hard dependency phá ranh giới package | **SAI** — Redis chỉ inject từ `vninvest`; giữ pool có sẵn. |
| `base_close` lưu từ `adjusted=True`, rồi nhân `Π f(e)` | Không có `adjusted_as_of` trong `vnbroker` (grep = 0). Mỗi dòng có vintage khác nhau ⇒ double-adjust 100% | **SAI P0** — thay bằng `base_as_of` per-row (D-01). |
| Ingest T+0 không ghi `adj_close` | Mâu thuẫn I1/I2/§3.1 (`adj_close NOT NULL`) ⇒ `IntegrityError` hoặc mất nến hôm nay | **SAI P0** — ingest phải ghi đồng thời (D-01). |
| Công thức chỉ DIV + ISS | Thiếu Rights Issue (phổ biến SSI/VND/VIX/HCM) | **SAI** — công thức Sở đầy đủ (D-02). |
| Sample 24 mã cho 1 mã recompute | Sai mã, tốn request, so giá tuyệt đối ⇒ fail oan (VCI vs KBS lệch sẵn; provider cập nhật adjusted chậm 12–24h) | **SAI** — sample 1 mã + return-ratio (D-04). |
| 3 bảng mới | Trùng `CorporateAction`/`PriceRebaseRun`; đổi khóa `AdjFactor` thành `events_hash` gây nhân hệ số | **SAI** — schema tối giản (D-03). |
| Số liệu benchmark 8 mã local | IP VPS dính 418/503 khác máy dev | **CHƯA HỢP LỆ** — đo lại VPS (D-07). |
| — | `vnbroker_materializer.py:89,103` query `date=yesterday` ⇒ Thứ Hai/sau lễ lấy `None` | **Bug P2** — sửa trong D-06. |
| — | `CLAIMS.md` ghi `Entry 674`, ledger ghi `Entry 675` cho cùng slice | **Lệch sổ** — sửa trong Rev.2. |

---

## 2. Các quyết định đã khóa (`D-01`..`D-07`)

### `D-01` — Mô hình Anchor + Forward Self-Compute (thay §4.1 Rev.1)

Bất biến toán học duy nhất, triệt tiêu double-adjust:

```
cum_factor(t) = Π f(e)  với mọi e trong E_latest có ex_date > base_as_of(t)
adj_close(t)  = base_close(t) × cum_factor(t)
adj_O/H/L(t)  = base_O/H/L(t) × cum_factor(t)
```

`base_as_of` = *"OHLC cơ sở của dòng này đã phản ánh mọi sự kiện có `ex_date <= base_as_of`"*.

- **Ingest T+0 (sau 15:00/17:00)**: giá đóng cửa đúng ngày `t` là raw thật (sự kiện `ex_date > t` chưa xảy ra). Ghi **đồng thời**: `open/high/low/close = giá T+0`, `base_as_of = t`, `adj_close = close`, `adj_factor = 1.0`, `adj_basis = 'self_computed'`. **Không bao giờ để `adj_close = NULL`**.
- **Anchor lịch sử một lần tại `T0`** (các ngày `<= T0`): lưu chuỗi OHLC đồng nhất từ **một** nguồn sạch với `base_as_of = T0`. Sau `T0`, chỉ event có `ex_date > T0` được nhân vào dòng có `base_as_of < ex_date`. Pure function, idempotent.
- Nếu sau này có nguồn raw 15 năm ⇒ chỉ đổi `base_as_of = t` từng dòng, **không đổi một dòng code công thức**.
- **Bất biến nến**: O/H/L/C cùng row phải cùng `base_as_of`; `low_adj <= open_adj, adj_close <= high_adj` luôn đúng.

### `D-02` — Công thức Sở GDCK VN đầy đủ + fail-closed

Với nhóm event `is_latest=True` cùng `(symbol, ex_date)` và `ex_date > base_as_of`:

```
D  = cash_amount_per_share (có thể cộng nhiều event)
I2 = stock_ratio_pct / 100
I1 = rights_ratio_pct / 100 ; P_issue = rights_issue_price
P_prev = base_close của phiên giao dịch gần nhất < ex_date có base_as_of == date

f(e) = (P_prev + I1 * P_issue - D) / (P_prev * (1 + I1 + I2))
```

Không có quyền mua ⇒ `I1=0`, về `(P_prev - D) / (P_prev * (1+I2))`.

**Fail-closed**: event `parse_status != structured` hoặc `ambiguous_* = True` hoặc thiếu `P_issue` ⇒ `AdjFactor.status = PARTIAL`, **giữ nguyên `adj_close` version cũ + alert owner**. KHÔNG reset `adj_close = NULL` như `adjustment.py:102-109` hiện làm.

### `D-03` — Schema tối giản (bác 3 bảng mới)

- **KHÔNG tạo** `AdjustmentEvent`, `AdjustmentRun`, `ProviderSampleCheck`.
- `DailyPrice`: thêm `base_as_of DateField(null=True, db_index=True)` + `adj_basis CharField(32)` (`self_computed` | `anchor_provider` | `provider_fallback`); giữ `close` làm `base_close` với docstring rõ.
- `CorporateAction`: thêm `rights_ratio_pct`, `rights_issue_price` (nullable).
- `AdjFactor`: giữ unique `(symbol, ex_date)`, update-in-place khi correction; thêm `events_hash` để phát hiện đổi input. **Không** đổi khóa sang `events_hash`.
- `PriceRebaseRun`: thêm `events_hash`, `sample_verdict`, `sample_report` (JSONField).

### `D-04` — Sample check 2 tầng, so **return-ratio**

**Tầng 1 (gate khi recompute 1 mã)**: **1 request** cho chính mã đó, cửa sổ `[ex_date-10 phiên, ex_date+2 phiên]`. So tỷ số nhảy thay vì giá tuyệt đối:

```
| (adj_new(d_prev)/adj_new(d_ex)) / (prov(d_prev)/prov(d_ex)) - 1 | <= 0.005
```

Miễn nhiễm sai lệch lũy kế nhiều năm giữa VCI/KBS.
Nếu `prov(d_prev) == raw_prev` (provider chưa cập nhật sự kiện) ⇒ `PENDING_PROVIDER_SYNC`: cho phép commit nếu event `structured` hợp lệ + hẹn verify lại 6h/24h; **không báo công thức sai oan**.

**Tầng 2 (canary 1 lần/ngày)**: 24 mã thanh khoản + mã có event trong 7 ngày, ghi `PriceRebaseRun`/alert.

### `D-05` — Bulk & rate-limit đúng ranh giới 2 repo

**Trong `vnbroker` (package PyPI, KHÔNG thêm redis):**
1. Protocol `RateLimiterBackend` (`acquire(provider,tokens)`, `wait(provider,tokens,timeout)`) + `HealthStore` có sẵn (`core/health_store.py:68-135`); mặc định in-memory/SQLite, caller inject được.
2. Dùng **cùng một** per-provider limiter cho sync (`core/utils/client.py`) lẫn async (`core/utils/async_client.py:106`) — hết double-throttle.
3. Nhận diện **HTTP 418 + 429 → `RateLimitError`** ở cả `client.py` và `async_client.py:188,314`; **bỏ 429 khỏi `_is_retryable_status`** (`async_client.py:314`); cập nhật `vci_perf_benchmark.py` đếm cả 418.
4. `BulkRouter` đổi sang **work-queue per-symbol + per-provider worker pool** (concurrency theo `AdaptiveController` + `performance_profiles.py:104-132` nhận diện 2 phiên ICT; **không mutate `os.environ`**). Mỗi frame luôn gắn `attrs['symbol']`, `source`, `fetched_at` (sửa bẫy `bulk_router.py:467-471`).
5. Khi provider dính `RateLimitError`: `HealthRouter.record_failure(retry_after)` → mở cooldown ngay → **requeue symbol chưa xong về work-queue**, provider khỏe tiếp nhận **trong cùng lời gọi `BulkAPI.history()`**.
6. **Giữ nguyên** `connection_pool.py` và `async_client.py` pooling/http2.

**Trong `vninvest` (app):**
- Cài `RedisTokenBucket` (Lua atomic) + `RedisHealthStore` rồi **inject vào `vnbroker`** — chia cooldown giữa `core-api` và mọi celery worker.
- Xóa `_PROVIDER_INTER_SYMBOL_DELAY` (`tasks.py:83-87`) và round-robin (`tasks.py:1809-1816`); gọi **một** `BulkAPI.history`, giữ tracking `BackfillExecutionRun`/`BackfillExecutionBatch`.

### `D-06` — Consumer BE/FE + fix bug ngày nghỉ

- `pricing.py:41-74`: `effective_close`/`effective_ohlc` ưu tiên `adj_close` + `adj_factor` cho mọi nguồn có `adj_basis`; **bỏ nhánh `source == 'cafef'`**.
- `/chart/` (`stock_mgmt_native_views.py:2053-2069`) trả giá đã điều chỉnh kèm `price_basis` tường minh; FE `chartAdapter.js:47-93` **xóa điều kiện `price_source === 'cafef'`**.
- `vnbroker_materializer.py:89,103`: đổi `date=yesterday` thành `date__lt=today` + `.order_by('-date').first()` và đọc qua `effective_close()`.

### `D-07` — Benchmark VPS trước khi khóa thông số

Không dùng số 8 mã local. Bắt buộc chạy **≥100 mã × 1 năm** từ VPS `14.225.255.47`, cả trong giờ 09:00–15:00 ICT và sau 17:00 ICT; đo `symbols/s`, p50/p95, 429, 418, `requeue_count`, `symbols_missing`.

---

## 3. Lộ trình & cổng nghiệm thu

> Mọi phase chạy đủ `workflow-dev-loop`: claim → TDD fail-before → gate thật trên VPS DB riêng → re-audit → PR riêng. Không báo PASS cho gate chưa chạy.

| Phase | Repo | Việc | Exit gate / Stop |
|---|---|---|---|
| **0** Pre-flight | docs + VPS | Rev.2 này; probe độ phủ VCI/KBS 1834 mã + độ phủ rights trong `CorporateAction`; benchmark 100 mã VPS | Có số liệu phủ + ngưỡng 418/429 thật. **STOP** nếu VCI+KBS phủ <95% mã active |
| **1** Bulk v3.11.0 | vnbroker | D-05: limiter hợp nhất, bắt 418/429, work-queue + per-provider cap + requeue + attrs symbol | Test mock 418/429 giữa batch → provider khác gánh 100%, 0 `"unknown"`; pytest/ruff/mypy xanh; publish |
| **2** Schema + anchor | vninvest | D-01/D-03: migration `base_as_of`/`adj_basis`/rights/`PriceRebaseRun`; backup; anchor `<=T0`; ingest T+0 ghi đồng thời | `adj_close IS NULL = 0`; integrity 0 violation; rollback SQL đã test DB riêng |
| **3** AdjustmentService | vninvest | D-02/D-04: recompute thuần, DIV/ISS/Rights, PARTIAL fail-closed, sample return-ratio | recompute 2 lần cùng output; không double-adjust; FPT 2026-11-27 = 43500; PARTIAL giữ cũ |
| **4** Consumer + unify | vninvest | Phần vninvest của D-05 + D-06 | benchmark 1834 mã VPS, 0 418/429 lọt; chart 2026 không cắt đuôi; tsc/build/gate xanh |
| **5** Cutover | vninvest | CafeF chỉ đối chiếu; freshness SLO; dọn legacy sau 7 ngày | 7 ngày integrity ok + freshness ≥99,5% |

---

## 4. Hai quyết định Owner còn mở

1. **Anchor lịch sử 2011–2025** (Phase 2): **(A — khuyến nghị)** anchor 1 nguồn VCI/KBS cho toàn chuỗi `<=T0`, giữ dữ liệu CafeF trong `CafefDailyPrice` để đối soát (0 vết nối lệch basis đầu 2026), hay **(B)** giữ `cafef` 2011–2025 và chấp nhận chi phí nối biên từng mã?
2. **Pool bulk**: chỉ chạy 2 nguồn mở `VCI+KBS`, hay cấp credential **DNSE/SSI** để nâng pool 3–4 nguồn ngay trong đợt này?

---

## 5. Sửa lệch sổ sách & trạng thái

- `docs/CLAIMS.md` dòng claim `ssot-adjustment-design` ghi **`Entry 674`** nhưng ledger Entry của slice đó là **675** (674 thuộc whale). Rev.2 sẽ ghi **Entry 676**; sửa note claim cũ thành `Entry 675`.
- Tài liệu này **không code, không migrate, không đổi flag**.
- `vnbroker` là package PyPI riêng (`pyproject.toml:40-55`) ⇒ mọi đề xuất trong D-05 phải giữ ranh giới đó.

## 6. Reservation

- Hành vi fill nến trong `vninvestcharts-widget` (dist minified) **CHƯA XÁC MINH**.
- Số liệu 8 mã local chỉ làm tín hiệu ban đầu, **không phải SLA** (D-07).
- Audit độc lập do người dùng cung cấp là nguồn phản biện; tôi đã tự kiểm chứng các điểm P0/P1 trọng yếu bằng source (mục 1).
