# KẾ HOẠCH TRIỂN KHAI CHI TIẾT — Toàn vẹn Dữ liệu Thị trường, Market CVD & Whale SSOT (2026-11-27)

- **REV.3** — sửa theo audit vòng 2 `NEED_REVISION` (R-O1, R-O2): fixture M04 dùng **≥2 bucket**, fix cả `:144` lẫn `:146`, chỉ assert `buy_strength`; phân biệt HEAD worktree với `origin/dev` đã trôi. Các vòng trước: `docs/evidence/market-data-integrity/AUDIT_PLAN_1127.md` (v1, O1..O12) và `AUDIT_PLAN_1127_R2.md` (v2, 11/12 resolved). Mọi đối chiếu ở §2b.
- **Ngày lập:** 2026-11-27 · **Vai trò:** vninvest BE team (người nhận RFC) · **Trạng thái:** `PROPOSED — chờ Owner phê duyệt`
- **Nguồn yêu cầu:** `vninvestcharts-widget` → `BE_REQUEST_MARKET_DATA_INTEGRITY_CVD_WHALE_2026-11-27.md` + `AUDIT_REBUTTAL_BUBBLE_AXIS_CVD_DATA_INTEGRITY_2026-11-27.md` (2 file trong worktree widget `D:\Mujoco Projects\wt\be-req-market-data-integrity-1127`, CHỈ ĐỌC).
- **Baseline đã tự mở đọc:** HEAD worktree `9507ca45e` — mọi `file:line` trong plan đúng tại HEAD này. **Lưu ý (R-O2):** `git rev-parse origin/dev` lúc re-audit v2 đã trôi tới `d446515b` ⇒ trước B5 phải `agent-sync.ps1` (rebase → check migration → gate) rồi **re-verify mọi `file:line`** (L-003); KHÔNG báo PASS trên code cũ. RFC ghi `35f4242de` — đã cũ. **Số dòng lấy từ worktree, KHÔNG phải checkout chính** (checkout chính ở branch khác + có file chưa commit ⇒ lệch: `IntradayTick` worktree `:302`, checkout chính `:299`).
- **Worktree:** `D:\Mujoco Projects\wt\mdi-plan-1127` · branch `docs/mdi-plan-1127` · sạch · `core.hooksPath=.githooks` · `check-multi-agent` exit 0.
- **Lessons áp dụng:** [L-001, L-002, L-003, L-005, L-007, L-008, L-M02, L-A01, L-B01, L-B02, L-B03, L-B04, L-V01, **L-V02**, L-V03, **L-V04**, L-V05, L-V06, L-T01].

---

## 0. Quyết định cần Owner chốt

| # | Câu hỏi | Khuyến nghị REV.3 | Mặc định nếu im lặng |
|---|---|---|---|
| **Q1** | Duyệt chuỗi `S1 → S6` hay chỉ Phase 1 (`S1–S3`)? | Duyệt từng slice, S1 trước | Chỉ `S0`, **không code** |
| **Q2** | Cho phép thao tác **phá dữ liệu** staging (S4)? | CÓ, nhưng snapshot → dry-run → canary VIC/FPT/VNM → mới mở rộng | **KHÔNG** — S4 khóa |
| **Q3** | `dedup_key`: thêm `trade_seq` hay hash cột có sẵn? | Hash `(symbol,timestamp,price,volume,side,match_type,source)`, **không thêm cột** (`models.py:313-324` vốn không có `trade_seq`) | Hash cột có sẵn |
| **Q4** | `data_quality`/`coverage_ratio`: tận dụng `detail` JSONField (`:495`) hay thêm cột? | Tận dụng `detail`, 0 ALTER bảng lớn | Tận dụng `detail` |
| **Q5** | Tick `UNKNOWN`: giữ chia 50/50 hay loại khỏi Market CVD? | Giữ hàm cũ `compute_cvd_buckets_df` (caller `OrderFlowEvent` đang dùng) + path mới **loại tick đấu giá** | Thêm path mới, không đổi hàm cũ |
| **Q6** | Thống nhất ngưỡng whale `200M` (`session_facts_engine.py:54`) vs `500M` (`order_flow_engine.py:31`)? | Đổi về **500M**, thực thi ở **S2**, có test ghim (O12) | Đổi về 500M |
| **Q7** | Backfill Ph.3: cửa sổ 30 ngày VN30 → 90 ngày → toàn sàn, throttle DNSE? | 30 ngày canary trước, có `DnseRateLimitError` retry (`vnbroker_adapter.py:1126-1127`) | Chưa backfill |
| **Q8** | Ai deploy staging VPS `14.225.255.47`, khung giờ canary? | Owner/coordinator, probe đọc trước/sau | Chưa deploy |
| **Q9 (mới, O6)** | `?metric=` mặc định: giữ `whale` (legacy, opt-in `market`) hay đổi sang `market` ngay? | **Giữ `whale` làm default** cho tới khi widget bật `metric=market` (cutover đồng bộ) — bảo vệ "tương thích ngược 100%" RFC §4 | Giữ `whale` |

---

## 1. Bằng chứng hiện trạng — tự mở đọc tại worktree `9507ca45e`

| ID | Hiện tượng | Bằng chứng thật | Kết luận |
|---|---|---|---|
| **F-01** | Bar `1H` cụt do batch partial | `data_ingest/tasks.py:425-564`; `:458` chỉ 1 trang tape; `:513` `_build_intraday_bar_payloads` (def `:376-404`, cộng dồn **trong batch**); `:538-543` `bulk_create(update_conflicts=True, update_fields=['open','high','low','close','volume','source'])` ghi đè cả nến. Đường đúng `synthesize_intraday_bars_from_ticks` `:3081-3089` tổng hợp từ toàn bộ tick DB nhưng **không được gọi ở đường nóng**. | XÁC NHẬN |
| **F-02** | Ép `UNKNOWN → sell` ATC | `signal_intelligence/tasks.py:281-282` **đã có guard** `if side_raw not in ('BUY','SELL'): continue` từ commit `6e50418a9`. `session_facts_engine.py:101-116` đọc `WhaleAlertCanonical` (`whale_tick:` tại `:112`). | **Chỉ còn là dữ liệu lịch sử**, không sửa code (xem C-1) |
| **F-03** | Mất `match_type` | `vnbroker_adapter.py:1111-1118` hardcode tại `:1116` (docstring `:1045` khai trả `match_type`); `tasks.py:338-358` default tại `:356`; `vnbroker_adapter.py:149-186` là đường live. Không có `session_phase` ở cả 2 nơi. | XÁC NHẬN |
| **F-04** | Tick nhân đôi | `market_data/models.py:302-334` (class thật `:302`; fields `:313-324`; Meta `:326-334`) **không** unique — so sánh `IntradayBar` `unique_together` tại `:295`. `tasks.py:2604`/`:2717` `ignore_conflicts=True` vô tác dụng; `:479-505` dedup chỉ trong bộ nhớ. | XÁC NHẬN |
| **F-05** | "CVD Real" = Whale Net Flow | `session_facts_engine.py:40-42` docstring; `:101-116` query; `:54` `200M`; `order_flow_engine.py:31` `500M`; engine CVD trên 100% tick tại `order_flow_engine.py:69-112,119-181` nhưng chỉ ghi scalar qua `signal_intelligence/tasks.py:131-156,438-467`, không nối vào `SessionFactsBucket`. | XÁC NHẬN + C-2/C-3 |
| **F-06** | Mẫu số bị ô nhiễm — **đính chính REV.3** | `session_facts_engine.py:139-146`: `:144` cộng mọi side vào `bucket['total']`, `:146` cộng whale ngay cả side lạ. **NHƯNG** `:216` `total_value = total_buy + total_sell` (`:214-215` chỉ lấy `buy`/`sell`) ⇒ `delta_strength_pct` (`:220`) / `dark_flow_score` (`:221`) **KHÔNG bị 50B pha loãng**. Ô nhiễm chảy vào `:181` (`total_v`), `:186` (baseline), `:189` (`raw_strength`), `:197-198` (whale/dark ratio), `:212` (history) ⇒ sai **`buy_strength`** (chắc chắn) và có thể sai `institutional_strength` qua `whale_ratio` (`:197`). | **ĐÍNH CHÍNH (O4/R-O1)**: fix cả `:144` + `:146` theo RFC M04; fail-before **chỉ assert `buy_strength`** (tránh mơ hồ do `whale_ratio`), giữ `delta_strength` làm control; fixture phải **≥2 bucket** |
| **Cấu hình** | Retention | `service_ops/domain_configs/signals.py:34-36` = 7/365/90; validate `:56-59` chỉ ép tick≥7 & canonical≥180. | XÁC NHẬN |
| **Schema** | `SessionFactsBucket` | `market_serving/models.py:115-147`, fields `:130-134`; chưa có 8 field mới. Head migration `market_serving`: `0007_sessionfactsbucket_strength_fields.py`. | XÁC NHẬN |
| **Schema** | `GlobalSymbolCoverage` | `market_data/models.py:455-521`, `detail` JSONField `:495`, `freshness_state` `:485-491`. | XÁC NHẬN |
| **API** | whale-feed | `market_serving/native_views.py:479,607,677-678` đã có `data_quality`; `urls.py:35,37` mount 2 route. | XÁC NHẬN |
| **Cache** | CVD cache key | `views.py:415-418` (`core:cvd_series:v4:...`) và `:603` (`...v2:...`) **không chứa `metric`** ⇒ 2 metric trả cùng payload. | XÁC NHẬN (O5) |
| **Detect** | Whale detection | `order_flow_engine.py:244-259`: `detect_whale_ticks` lọc `known_side` (`BUY`/`SELL`) nhưng `load_session_ticks_df:88-93` **bỏ `match_type`** ⇒ tick ATC có `side='BUY'` vẫn lọt nếu normalization không đặt ở write-path. | XÁC NHẬN (O8) |
| **Migration head** | `market_data` | `Get-ChildItem .../migrations/*.py` → `0012_dailyprice_price_source_adj_factor.py`, **`0013_s2_vintage.py`, `0014_alter_pricerebaserun_status.py`**. Không được đặt `0013_*`. | XÁC NHẬN (O1) |
| **Gates** | Baseline | `check-multi-agent` exit 0; `core.hooksPath=.githooks`; warning claim stale **~130 dòng** (không phải ~30). | XÁC NHẬN |

> **Lệnh tái tạo số liệu:** `(Get-Content 'packages/core/backend/src/data_ingest/tasks.py').Count` = **3846** dòng (REV.1 ghi ~3100 — sai); HEAD worktree `git log -1 --format=%h` = `9507ca45e` (**không phải `origin/dev`** — nhánh gốc đã trôi `d446515b` trước B5, xem header & §5); `git config core.hooksPath` = `.githooks`.

---

## 2. CONTRADICTIONS — RFC / kế thừa vs code thật

| # | RFC khẳng định | Thực tế | Xử lý |
|---|---|---|---|
| **C-1** | Sửa `signal_intelligence/tasks.py:280-283` ép `UNKNOWN→sell` | Guard đã có `tasks.py:281-282` | **RE-SCOPE**: chỉ cleanup dữ liệu cũ (S4) |
| **C-2** | Ngưỡng whale 500M | `session_facts_engine.py:54` dùng 200M | Q6, thực thi ở S2 + test ghim |
| **C-3** | `I-3` cấm ATO/ATC vào CVD | `order_flow_engine.py:145-155` chia `UNKNOWN` 50/50 | Giữ hàm cũ; path mới loại tick đấu giá (Q5) |
| **C-4** | `dedup_key` gồm `trade_seq` | `models.py:313-324` không có field đó | Q3 — hash cột có sẵn |
| **C-5** | Ghi cột `data_quality` vào `GlobalSymbolCoverage` | Đã có `detail` JSONField `:495` | Q4 — tận dụng `detail` |
| **C-6** | Baseline `35f4242de` | `origin/dev = 9507ca45e`; `IntradayTick` worktree `:302` (checkout chính `:299`) | Mọi citation dùng worktree; re-verify sau rebase (L-003) |
| **C-7** | 6 lỗi "đang chạy" | F-02 hết lỗi code; F-06 bị hiểu sai mẫu số (xem §1 F-06) | Giảm code, tăng data recovery; sửa AC M04 |
| **C-8 (mới)** | Cleanup theo `session_phase`/`match_type` đấu giá (`I-3`, REQ-BE-M02/M05) | `signal_intelligence/models.py:76-101` `WhaleAlertCanonical` **không có** 2 field này; chỉ có `side`, `executed_at`, `alert` (`source_ref`) | Predicate dùng `executed_at` trong khung ICT + `alert__source_ref__startswith='whale_tick:'`; báo widget hiệu chỉnh `I-3` |
| **C-9 (mới)** | API trả 2 metric khác nhau | Cache key `views.py:415-418,603` không có `metric` | Đưa `metric` vào key + bump `v5`/`v3` + invalidate lúc deploy |

### 2b. Đối chiếu sửa audit vòng 1 (O1..O12)

| O | Finding | Cách sửa (REV.2 → REV.3) | Vị trí |
|---|---|---|---|
| O1/P0 | Migration head sai (`0012`→đặt `0013`) | Bỏ số cứng; ghi "head hiện `0014`, để `makemigrations` sinh, re-verify sau rebase" | §3 S3, §4 M03, §1 |
| O2/P0 | Fail-before M03 xanh giả do presence-check `tasks.py:2557-2568` | Thiết kế lại: (a) test model-level `bulk_create` trùng `dedup_key` 2 lần với `ignore_conflicts=True` → count không tăng **và** assert conflict ≥1; (b) test `UniqueConstraint` nổ `IntegrityError` khi `ignore_conflicts=False`; (c) test E2E **monkeypatch presence-check** để force đi tới `:2604`; (d) test dương tính: tick mới thật made count tăng 1 | §3 S3 |
| O3/P1 | S4 backfill skip canary | Thêm bước xoá/UPDATE `IntradayTick` theo `(symbol,date)` cho canary **trước** re-backfill, nằm trong snapshot + Q2 | §3 S4 |
| O4/P1 → **R-O1** | M04 nhầm mẫu số **+ fixture 1 bucket xanh giả** | REV.2 đổi nhầm sang `buy/inst strength` nhưng fixture 1 bucket ⇒ sigmoid luôn `50` (`:186`, `:191`, `:202`). REV.3: fixture **2 bucket** (bucket 1 sạch làm baseline) + fix `:144` **và** `:146`; **chỉ assert `buy_strength`** (mô phỏng auditor: old `62.727` → fix `50.0` ⇒ đỏ thật), `delta_strength` giữ nguyên làm control | §1 F-06, §3 S2, §4 M04 |
| O5/P1 | Cache key thiếu `metric` | Đưa `metric` vào `views.py:415-418` (bump `v5`) và `:603` (bump `v3`); invalidate lúc deploy; test gọi 2 metric liên tiếp | §3 S5, §4 M08 |
| O6/P1 | Default `metric` đổi ngữ nghĩa | Q9: giữ default `whale`, `market` là opt-in tới khi widget cutover | §0 Q9, §3 S5 |
| O7/P1 | `session_phase` không tồn tại | C-8 + predicate dùng `executed_at`/`source_ref` | §2 C-8, §3 S4 |
| O8/P1 | Detect bỏ `match_type` | Normalization đặt ở **mọi write-path**: live `vnbroker_adapter.py:149-186`, backfill `:1103-1118`, hydrate `tasks.py:338-358` ⇒ `side='UNKNOWN'` **trước** `detect_whale_ticks` (`order_flow_engine.py:244-259`); test 2 tầng | §3 S2 |
| O9/P2 | Citation/stale count | Use worktree line numbers (`IntradayTick :302`, unique `:295`), 3846 dòng, ~130 warning, kèm lệnh tái tạo | §1, §2 C-6 |
| O10/P2 | Chain mô tả sai | Chain đúng `tasks.py:2619-2623` = detect → `materialize_session_facts` → `synthesize_intraday_bars_from_ticks`; `backfill_session_facts_buckets` là **management command riêng** (`market_serving/management/commands/`) — gọi riêng nếu cần rebuild bucket cũ | §3 S4 |
| O11/P2 | S2–S6 thiếu GWT | Bổ sung Given/When/Then + test dương tính cho mọi slice | §3 |
| O12/P2 | Q6 treo ở S3 | Chuyển Q6 sang **S2** (đã target `session_facts_engine.py`) + AC/test 500M | §0 Q6, §3 S2 |
| **R-O2/P2** | Baseline trôi `origin/dev` | Phân biệt HEAD worktree `9507ca45e` (citation đúng tại HEAD) vs `origin/dev = d446515b`; trước B5 rebase + re-verify + chạy lại gate (L-003) | Header, §5 |
| **RES/P2** | Reservation Owner | Q9 (default `whale` khác RFC §4.1) + Q2 (phá dữ liệu) phải chốt bằng văn bản trước B4; im lặng = KHÔNG code/KHÔNG xoá | §0, §7 |

> **Kết quả audit v2:** 11/12 objection v1 resolved; chỉ R-O1 (fixture M04) chưa. REV.3 sửa R-O1 + R-O2. Xem `docs/evidence/market-data-integrity/AUDIT_PLAN_1127_R2.md`.

---

## 3. Cấu trúc chương trình — 6 slice / 4 phase / 10 REQ

> Mỗi slice = 1 claim + 1 branch + 1 PR + 1 vòng fail-before → pass-after → re-audit. **S4 khóa tới khi Q2 = CÓ.**

### S0 — Plan + Audit + Consensus (slice hiện tại, doc-only)
- **Given** RFC tồn tại tại worktree widget · **When** auditor độc lập đọc plan + code thật · **Then** verdict thành file `docs/evidence/market-data-integrity/AUDIT_PLAN_1127.md`; vòng 1 = `NEED_REVISION` → REV.2 sửa O1..O12 → re-audit vòng 2.
- **Không làm:** code production, migration, claim code, staging.

### S1 — P0 / Ph.1 — Chặn cụt `IntradayBar` (REQ-BE-M01)
- **Given** bucket `10:00–11:00` có 500.000 cp từ batch 1 · **When** batch 2 thêm 1.000 cp lúc `10:45` rồi chạy `_hydrate_intraday_symbols` (`tasks.py:425-564`) · **Then** `IntradayBar(1H,10:00).volume == 501000` (code cũ cho `1000`). **Test dương tính:** bucket không bị ảnh hưởng vẫn giữ nguyên volume.
- **Đích:** tách helper recompute OHLCV từ **toàn bộ `IntradayTick` DB** theo `(timeframe,bucket_ts)`; file `tasks.py` hiện **3846 dòng** ⇒ helper phải tách file riêng.
- **Gate:** `check-multi-agent` · pytest fail-before đỏ→xanh · replay warm 2 lần không giảm volume · `makemigrations --check` = 0.

### S2 — P0 / Ph.1 — Auction isolation + mẫu số + ngưỡng whale (REQ-BE-M02 + M04 + Q6)
- **Đích:** `vnbroker_adapter.py:149-186` (live) & `:1111-1118` (backfill), `tasks.py:338-358` (hydrate), `market_serving/session_facts_engine.py:127-146,178-221`, `order_flow_engine.py:244-259` (CHỈ ĐỌC để ghim assert).
- **Hành vi:** (a) đọc `match_type` thật, map `session_phase ∈ {ATO,CONTINUOUS,ATC,PUT_THROUGH,UNKNOWN}`; (b) normalization đặt ở **mọi write-path** ⇒ tick `ATO/ATC/PUT_THROUGH` có `side='UNKNOWN'` **trước** detect ⇒ `detect_whale_ticks` (`order_flow_engine.py:258-259`) loại; (c) `:144` **và `:146`** đều bỏ qua side lạ (RFC M04 yêu cầu cả `total` lẫn `whale`); (d) Q6 đổi `_WHALE_THRESHOLD_VND` `200M → 500M`.
- **Given** tick `14:45:18 match_type='ATC'` raw side=`BUY` · **When** ingest live/backfill/hydrate + detect · **Then** `IntradayTick.side=='UNKNOWN'`, `WhaleAlertCanonical` có **0** row buy/sell (I-3).
- **Given** **2 bucket** (bucket 1 sạch 1B buy + 1B sell làm baseline; bucket 2 = 1B buy + 1B sell + **50B unknown**) · **When** `_compute_session_facts_from_rows` trước và sau fix `:144`+`:146` · **Then** `buy_strength` **đổi từ `62.727` xuống `50.0`** (số mô phỏng có control của auditor, `AUDIT_PLAN_1127_R2.md:59`) ⇒ test **đỏ trên code cũ**, **và** `delta_strength_pct` **giữ nguyên** (mẫu số `:216` đã loại unknown). **KHÔNG assert `institutional_strength`** — nó đi qua `whale_ratio` `:197` nên kết quả phụ thuộc cả việc sửa `:146`, dễ gây mơ hồ (R-O1). Fixture 1 bucket **bị cấm**: `baseline=total_v` (`:186`) + `midpoint=raw` (`:191/:202`) ⇒ sigmoid luôn `50`, không thể đỏ. **Test dương tính:** cả 2 bucket đều sạch → strength đúng baseline.
- **Given** tick 500M · **When** compute · **Then** `whale` field được tính theo ngưỡng **500M** (Q6, O12).
- **Gate:** pytest 2 file mới · probe đọc `/intraday-tape/VIC/` · I-3 = 0 row ATC buy/sell.
- **Không sửa** `signal_intelligence/tasks.py:281-282` (C-1).

### S3 — P0 / Ph.1 — Idempotency `IntradayTick` (REQ-BE-M03 + Q3 + O1/O2)
- **Đích:** `market_data/models.py:302-334` + migration do **`makemigrations` sinh** (head hiện `0014_alter_pricerebaserun_status.py` — **KHÔNG** tự đặt `0013`); `tasks.py:479-509,2604,2717`.
- **Given** 100 tick VIC đã có trong DB · **When** `bulk_create` cùng `dedup_key` thêm lần nữa với `ignore_conflicts=True` · **Then** số row không tăng **và** số conflict ≥1 (assert thật, không chỉ "không tăng" — O2). **Given** insert trùng với `ignore_conflicts=False` · **When** lưu · **Then** `IntegrityError`. **Given** presence-check bị monkeypatch trả `False` (để force đi tới `tasks.py:2604`) · **When** chạy lại `backfill_intraday_tick_system` · **Then** không nhân đôi. **Test dương tính:** tick mới thật làm count tăng đúng 1.
- **Migration:** dedup dữ liệu cũ **trước khi** tạo unique; log bằng `logger` ASCII (L-B03). Re-verify head sau rebase (L-003).
- **Gate:** `makemigrations --check --dry-run` = 0 · pytest trên DB riêng **có sẵn row trùng** · không tự số migration.

### S4 — P0 / Ph.2 — Cleanup & Recovery (REQ-BE-M05) — **KHÓA chờ Q2**
- **Đích:** management command mới trong `signal_intelligence/management/commands/` (hiện chỉ có `recompute_dark_flow_values.py`, `seed_alertcenter_demo.py`).
- **Predicate đúng (C-8):** `WhaleAlertCanonical` lọc `executed_at` trong `14:30:01–14:59:59 ICT` (Asia/Ho_Chi_Minh) & `session_date < 2026-11-24` & `alert__source_ref__startswith='whale_tick:'`; **không** dùng `session_phase`/`match_type` (field không tồn tại).
- **Chain đúng (O10):** `tasks.py:2619-2623` = `detect_and_store_global_whale_alerts` → `materialize_session_facts` → `synthesize_intraday_bars_from_ticks`. `backfill_session_facts_buckets` là **management command riêng** (`market_serving/management/commands/`) — gọi riêng nếu cần rebuild bucket lịch sử.
- **Bắt buộc trước re-backfill (O3):** xoá/UPDATE `IntradayTick` của canary theo `(symbol,date)` để presence-check `tasks.py:2557-2568` không trả `skipped` và để `match_type`/`side` cũ không tồn tại (nếu không, `ignore_conflicts=True` ở `:2604` cũng không update).
- **Given** 3 mã canary có row ATC cũ bị ép sell · **When** chạy `--dry-run` rồi chạy thật · **Then** lần 2 xoá 0 row (idempotent) · probe: `0%` nến có `whale > bar_turnover`, skew khung `14:00 < 85%`. **Test dương tính:** fixture có row ATC cũ → dry-run báo ≥1 row.
- **Gate Q2:** snapshot 4 bảng → dry-run → canary → probe → mới VN30/toàn sàn. **Không chạy nếu Q2=KHÔNG.**

### S5 — P1 / Ph.3 — Market CVD SSOT (REQ-BE-M06 + M07 + M08 + O5/O6)
- **Đích:** `market_serving/models.py:115-147` + migration do `makemigrations` sinh (head `0007_sessionfactsbucket_strength_fields.py`); `session_facts_engine.py` (path mới); `service_ops/domain_configs/signals.py:36` (90→365 + validate); `views.py:381-547,549-664` (+ cache key `:415-418`→`v5`, `:603`→`v3`); `native_views.py:388-678`.
- **Given** ngày có đủ `IntradayTick` · **When** `compute_session_facts_for_all_active` · **Then** `market_buy+market_sell+auction ≈ DailyPrice.value ±5%`, `trade_count>0`, `cvd_source='full_tick'`. **Given** `?metric=market` rồi `?metric=whale` liên tiếp · **When** gọi 2 lần · **Then** 2 payload **khác nhau** (cache key có `metric` — O5), `market_total>=whale_total`. **Given** caller cũ không truyền `metric` · **When** gọi · **Then** vẫn trả shape cũ với **ngữ nghĩa `whale`** (Q9/default — O6); `market` chỉ opt-in.
- **Gate:** pytest · `makemigrations --check` · probe staging · phía widget tự đổi nhãn (Slice A/B riêng).

### S6 — P1/P2 / Ph.4 — Reconciliation + Evidence (REQ-BE-M09 + M10)
- **Đích:** `market_serving/tasks.py` task mới; `vninvest_core/settings.py` beat `15:15 ICT` `day_of_week='1-5'` (**file cấu hình dùng chung — ghi vào claim, báo coordinator**); `market_data/models.py:455-521` (`detail` theo Q4); `market_serving/serializers.py`; `docs/evidence/market-data-integrity/**`.
- **Given** `IntradayBar.volume < whale_buy+whale_sell` · **When** task đối soát chạy · **Then** `data_quality='degraded'`, trigger tái tổng hợp, phát SOC alert (mock); 6/6 invariant `I-1..I-6` có assert. **Test dương tính:** dữ liệu sạch → `verified`.
- **Gate:** pytest full 4 app · `check-multi-agent` · `check-lessons` · `pre-push-gate` · probe · ledger Entry + handoff.

---

## 4. Ma trận truy vết REQ → Slice → Fail-before → Cổng

| REQ | Slice | File đích (worktree) | Fail-before (đỏ thật) | Cổng |
|---|---|---|---|---|
| M01 | S1 | `tasks.py:425-564` | volume 501000 vs 1000 | replay ×2 không giảm |
| M02 | S2 | `vnbroker_adapter.py:149-186,1111-1118`, `tasks.py:338-358` | ATC BUY → UNKNOWN + 0 whale row | I-3 = 0 |
| M03 | S3 | `models.py:302-334` + **migration do makemigrations sinh** | conflict ≥1 + IntegrityError + monkeypatch presence-check | backfill ×2 không tăng |
| M04 | S2 | `session_facts_engine.py:127-146,178-221` | fixture **2 bucket** → `buy_strength` 62.727→50.0 (đỏ thật); delta giữ nguyên; KHÔNG assert inst strength | không pha 50B |
| M05 | S4 (khóa) | command mới + xoá tick canary | dry-run ≥1 row, lần 2 = 0 | 0% I-1, skew<85% |
| M06 | S5 | `market_serving/models.py:115-147`, `session_facts_engine.py` | ±5% DailyPrice, `full_tick` | `makemigrations --check` |
| M07 | S5 | `signals.py:36` | validate `>=365` | config pass |
| M08 | S5 | `views.py:381-664` (+cache v5/v3), `native_views.py:388-678` | 2 metric cho 2 payload khác nhau | legacy 200 + shape cũ |
| M09 | S6 | `market_serving/tasks.py`, `settings.py`, `models.py:495` | `degraded` + alert + 6/6 | probe VN30 |
| M10 | Mọi slice | `docs/evidence/market-data-integrity/**` | log đỏ→xanh | gates + ledger + handoff |

---

## 5. Baseline cổng — đã chạy / `CHƯA CHẠY`

| Cổng | Kết quả thật | Ghi chú |
|---|---|---|
| `git worktree add ... origin/dev` | sạch, HEAD worktree `9507ca45e` | checkout chính **không bị đụng**; citation đúng tại HEAD này |
| `git rev-parse origin/dev` (lúc re-audit v2) | **`d446515b`** | nhánh gốc đã trôi (R-O2) — trước B5 phải rebase + re-verify + chạy lại gate |
| `git config core.hooksPath` | `.githooks` | hook active |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS`, kèm **~130** dòng warning claim stale | auditor tự chạy lại, khớp |
| `git status --short` | 4 file doc chưa track (plan + audit v1 + audit v2 + audit v3) | không code/migration |
| `makemigrations --check --dry-run` | **CHƯA CHẠY** | chưa đổi model; chạy S3/S5 |
| BE `pytest` Postgres riêng | **CHƯA CHẠY** | cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; theo workflow chỉ VPS staging, cấm local Docker (L-B01) |
| `npm run build` / `tsc --noEmit` | **CHƯA CHẠY** | slice này không sửa FE |
| Probe staging đọc / cleanup ghi | **CHƯA CHẠY / bị khóa Q2** | — |
| Audit vòng 1 | **NEED_REVISION** (2 P0 / 6 P1 / 4 P2) | `AUDIT_PLAN_1127.md`; REV.2 sửa O1..O12 |
| Audit vòng 2 (re-audit) | **NEED_REVISION** (11/12 resolved; R-O1 M04 fixture) | `AUDIT_PLAN_1127_R2.md`; REV.3 sửa R-O1/R-O2 |
| Audit vòng 3 (final) | **CHƯA CHẠY** | phải chạy trước B4; tối đa 3 vòng sửa |

---

## 6. SCOPE / LIMIT / Non-goals / Rollback

- **SCOPE (dự kiến):** ~6 file BE runtime + 2 migration (do `makemigrations`) + 2 command + 1 Celery task + ~9 file test + docs/evidence/ledger/claim. Không sửa engine/widget.
- **LIMIT:** tối đa 3 vòng sửa/slice; 1 slice = 1 PR; không gộp migration 2 slice.
- **Non-goals:** không tự aggregate ở widget (Rule 15); không vỡ caller cũ (Q9); không rotate secret; không đổi giá/adj_close; không đụng deny-list (`package.json`, `docker-compose*.yml`, `.env*`).
- **Rollback:** migration additive + default an toàn; S4 = phục hồi snapshot 4 bảng; `?metric=market` lỗi → fallback `whale` + `data_quality='degraded'`, không làm sập `/bars/`.

---

## 7. Checklist bắt buộc

- [x] `git status --short` checkout chính đã đọc; file agent khác không bị đụng.
- [x] `docs/CLAIMS.md` đã đọc; không có claim `in-progress` còn sống giữ 6 file đích (sẽ re-verify trước B5).
- [x] Nạp `project-lessons` trước khi lập kế hoạch; lessons ghi ở header.
- [x] Mọi `file:line` tự mở **trong worktree** (không phải checkout chính — O9).
- [x] Phản chứng C-1..C-9 + O1..O12 ghi thành văn bản.
- [x] Mỗi REQ có fail-before **đỏ thật** + test dương tính (L-V04; O2/O4 đã sửa).
- [x] Worktree cô lập + hooks + `check-multi-agent` PASS.
- [x] Cổng không chạy ghi `CHƯA CHẠY` (L-007).
- [x] Audit vòng 1 xong; REV.2 trả lời đủ 12 objection.
- [x] Audit vòng 2 xong; REV.3 sửa R-O1 (fixture 2 bucket + `:144`/`:146`) & R-O2 (baseline trôi).
- [ ] **Re-audit độc lập vòng 3** (B3, final) → file verdict; nếu vẫn `NEED_REVISION` → ghi blocker, dừng (tối đa 3 vòng).
- [ ] B4 đồng thuận → file verdict; `PASS`/`AGREE` mới được chuyển B5.
- [ ] **Owner chốt bằng văn bản Q2 + Q9** (reservation auditor) trước B4; im lặng = KHÔNG code/KHÔNG xoá.
- [ ] Owner phê duyệt Q1..Q9 → B5 `agent-sync.ps1` (rebase → check migration → gate) + khai claim riêng + branch `feat/<agent>` đúng tên (L-M02) → S1.
