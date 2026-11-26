# PLAN — CVD lịch sử `window=1D` cho vninvestcharts-widget (BE, A1)

- **Ngày:** 2026-11-26
- **Base:** `origin/dev @ ce1e08138` (fetch lúc 2026-11-26; `git rev-parse origin/dev`)
- **Nguồn yêu cầu:** nội dung BE Request do widget team gửi (`BE_REQUEST_CVD_1D_HISTORY_2026-11-26.md`, 183 dòng).
  ⚠ **KHÔNG XÁC MINH được SHA** `32b2e98a` / `30f7ef4e` mà widget team nêu: sau `git fetch origin dev main`,
  `git cat-file -t 32b2e98a` → `fatal: Not a valid object name`; GitHub raw tại SHA đó → HTTP 404.
  ⇒ Dùng nội dung request trong chat làm nguồn contract; ghi rõ ngoại lệ này trong evidence.
- **Vai trò:** BE tiếp nhận yêu cầu; **không sửa** code widget / FE adapter trong slice này.
- **Worktree/branch:** `D:/Mujoco Projects/wt/cvd-1d-history-be` · `feat/cvd-1d-history-be` (claim agent = `cvd-1d-history-be`).

## 1. Mục tiêu + bằng chứng code đã tự mở đọc

Widget vẽ external CVD trên price pane nhưng `window=1D` hiện trả **1 bucket** ⇒ nét đứng vô hình
(`x=1386.6/1440`, canvas hook). Cần endpoint trả chuỗi ngày tăng dần, có cumulative đúng invariant.

| Bằng chứng | Vị trí @ `ce1e08138` | Ý nghĩa |
|---|---|---|
| `SessionFactsCvdView.get` lấy 1 facts | `packages/core/backend/src/market_serving/views.py:389` (hàm `:53-65`) | Gốc rễ bucket_count=1 |
| Lọc bucket của đúng 1 session | `views.py:418` (hàm `:75-88`) | Chỉ 1 session được đọc |
| Cache key v2 gắn 1 session | `views.py:406-407,464` | Cần key v3 cho history |
| Cumulative per-session reset về 0 | `session_facts_engine.py:155-165` | **Không được cộng dồn `cumulative_cvd` của từng session** (sẽ nhân đôi) |
| 1D bucket_ts = **UTC midnight**, endpoint chiếu sang **07:00+07:00** | `session_facts_engine.py:91-92` floor trên `executed_at` UTC (`:132-134`), `views.py:449` `localtime(...)`, `settings.py:354,356` | Zero-fill phải tạo `datetime.combine(date, time.min, UTC)` rồi `localtime()` ⇒ **07:00+07:00**, khớp bucket thật. KHÔNG copy `native_views.py:553-554` (subsystem khác fill lúc 00:00+07:00) |
| `_DARK_MONEY_PERIOD_DAYS` SSOT | `market_data/stock_mgmt_native_views.py:352-358` | Dùng chung 1M/3M/6M/1Y/10Y |
| Hotfix UnboundLocalError DailyPrice | `stock_mgmt_native_views.py:2105-2107` | Import `DailyPrice` **tại method scope** |
| Composite index đã có sẵn | `market_serving/models.py:141-144` (`session_facts, window, bucket_ts`) | **KHÔNG cần migration index** |
| Helper A2 (bỏ qua) | `stock_mgmt_native_views.py:1070-1160` | Dùng `buy_value/sell_value`, UTC midnight ⇒ sai field/timezone của endpoint này |

## 2. Hợp đồng triển khai (quyết định BE)

Chọn **A1** (đọc đa session từ `SessionFactsBucket`, giữ nguyên field + timezone của endpoint hiện tại).
A2 bị loại vì phải đổi field và timezone, rủi ro parity sai.

### 2.1 Params
| Param | Hành vi |
|---|---|
| `window` | Giữ nguyên; `period` **chỉ có nghĩa khi `window=1D`**. Với window khác → bỏ qua `period` (backward compatible). |
| `period` | `1M\|3M\|6M\|1Y\|10Y` (chấp nhận thường/hoa). Thiếu → path legacy **giữ nguyên 100%** (kể cả cache key v2, bucket_count=1). Giá trị khác → 400 `UNSUPPORTED_PERIOD` (chỉ khi `window=1D`). |
| `trade_date` | **Thắng `period`**: có trade_date → đi path legacy đúng 1 session, bỏ qua period hoàn toàn. |

### 2.2 Response history (additive; path legacy KHÔNG đổi)
Thêm: `period`, `history: true`, `date_from`, `date_to` (ISO `YYYY-MM-DD`).
Giữ nguyên: `unit: "vnd"`, `bucket_count`, `cvd_series[]`, `symbol`, `window`, `bucket_minutes`,
`delta`, `session_date`, `cvd_normalized`, `delta_strength_pct`, `whale_net_flow`, `revision`,
`updated_at`, `trade_count`, `source`, `data_quality`, `_source`.
- Bucket: `bucket_ts` local ISO +07:00, tăng dần; `buy_volume`/`sell_volume` (KHÔNG dùng `buy_value/sell_value`).
- `delta = buy_volume - sell_volume`; `cumulative_cvd[i] = Σ delta[0..i]` (float, **không làm tròn** để
  sai số ≤ 1e-6). `delta` top-level = `Σ delta` các bucket giữ lại (cùng công thức `views.py:429-431`,
  **không** đọc field `delta` — `SessionFacts` không có field này, `models.py:80-101`).
- Scalar top-level (`cvd_normalized`, `delta_strength_pct`, `whale_net_flow`) lấy từ SessionFacts có
  `session_date = max(session_date)` trong khoảng; `revision = max(computed_at)` trên cùng tập facts đó;
  `updated_at = localtime(revision)`.
- Ngày có `DailyPrice` nhưng không có whale bucket ⇒ bucket `delta=0`, cumulative giữ nguyên,
  `bucket_ts = localtime(datetime.combine(date, time.min, UTC))` = **07:00+07:00** (khớp bucket thật).
  Không fabricate alert.
- Rỗng: history path trả 200 với payload rỗng **do history path tự build** (kèm 4 field history +
  `data_status`). **KHÔNG sửa** `_build_empty_cvd_payload` (`views.py:91-112`) vì helper này dùng chung
  cho legacy empty (`views.py:396-402,421-427`) — legacy empty phải giữ nguyên 100%.

### 2.3 Cache & giới hạn
- Legacy: `core:cvd_series:v2:{symbol}:{session_date}:{bucket_minutes}:{revision}` (giữ nguyên).
- History: `core:cvd_series:v3:{symbol}:{window}:{period}:{start}:{end}:{revision}`; TTL 30s.
- **R1/R2 đã chốt lúc implement:** `revision = int(max(computed_at).timestamp())` (int Unix, cùng kiểu legacy `views.py:406`), `updated_at = localtime(max(computed_at))`; `end_date = localdate()`, `start_date = end_date - timedelta(days=period_days)` (inclusive 2 đầu, cùng `stock_mgmt_native_views.py:2119-2120`). `date_from`/`date_to` là **khoảng truy vấn**, không phải ngày đầu bucket sau cap 2600.
- **D-1 (chọn A1)** · **D-2 max bucket 10Y = 2600** (≈10 năm × 260 phiên): nếu vượt, giữ **cuối** 2600
  bucket, tính lại cumulative từ delta của phần giữ lại, `date_from` = ngày đầu còn lại. Bảo toàn AC-3/AC-4.
  Con số này là quyết định BE, cần Owner confirm (ghi trong handoff).
- **D-3 index:** KHÔNG thêm migration — composite index đã tồn tại (`models.py:143`).
- **D-4 deploy staging:** BE chỉ commit riêng + chạy test VPS; deploy/staging do Owner chốt.

## 3. CONTRADICTIONS (doc/request vs code)

| Request | Thực tế @ `ce1e08138` | Tác động / xử lý |
|---|---|---|
| AC-4 "bucket cuối khớp response AC-1 cùng session ±1e-6" — yêu cầu ghi **không nói rõ field nào** | `session_facts_engine.py:155-158` reset cumulative về 0 mỗi session; history cumulative là tổng dồn ⇒ **không thể bằng** cumulative legacy khi các session trước có delta ≠ 0 | AC-4 được hiểu là parity của `delta`/`buy_volume`/`sell_volume`/`bucket_ts` (các field **không reset**). **Không** dùng fixture net=0 để "ép" cumulative bằng nhau — điều đó làm AC-3 mất khả năng phát hiện bug reset. Nếu widget thực sự muốn cumulative parity thì AC-3 và AC-4 mâu thuẫn, phải hỏi lại; mặc định chọn AC-3 là invariant cốt lõi. |
| Zero-fill bucket_ts | `session_facts_engine.py:91-92` floor UTC ⇒ endpoint trả 07:00+07:00; nhưng `market_serving/native_views.py:553-554` fill lúc 00:00+07:00 | Hai subsystem lệch 7h. A1 phải theo **endpoint hiện tại** (07:00+07:00), không copy helper whale-buckets. Có test assert cùng định dạng cho bucket thật và bucket fill. |
| "Cache key nâng v3" | Endpoint còn path legacy dùng v2 | Chỉ nâng v3 cho path history; legacy giữ v2 để AC-1 "response unchanged" |
| "Composite index (session_facts, window, bucket_ts)" | Đã có sẵn | Bỏ migration; tránh trùng số migration |
| SHA `32b2e98a` / `30f7ef4e` | Không tồn tại trên origin sau fetch, GitHub 404 | Ghi `KHÔNG XÁC MINH`, dùng nội dung request |

## 4. Acceptance criteria (Given/When/Then)

| ID | Given / When / Then |
|---|---|
| AC-1 | Given 1D bucket tồn tại, when GET không `period`, then 200, `bucket_count=1`, response **không** có `history`/`period`/`date_from`/`date_to`, cumulative = giá trị materialized. |
| AC-2 | Given ≥2 session có 1D bucket, when `?window=1D&period=3M`, then 200, `bucket_count>=2`, `bucket_ts` tăng dần, `history=true`. |
| AC-3 | Với mọi i: `abs(cumulative_cvd[i] - Σ delta[0..i]) <= 1e-6`, không reset giữa session. **Fixture bắt buộc có ≥1 session trước net ≠ 0** (vd `-300M`) để bug reset bị phát hiện; KHÔNG dùng fixture net=0. |
| AC-4 | Bucket cuối cùng: `delta`, `buy_volume`, `sell_volume`, `bucket_ts` khớp response AC-1 của cùng session ±1e-6. **Không so `cumulative_cvd`** (đã reset per-session ở nguồn). |
| AC-5 | `period=999M` + `window=1D` → 400 `UNSUPPORTED_PERIOD`. |
| AC-6 | `computed_at` **lớn hơn max cũ** (`SessionFacts.objects.update(...)`, vì `models.py:101` `auto_now=True`) → `revision` đổi, cache v3 trả số liệu mới. |
| AC-7 | PAT sai/thiếu `market:read` → 401/403. |
| AC-8 | `trade_date` + `period` (kể cả `period=999M`) → trade_date thắng, **không 400**, path legacy `bucket_count=1`. |
| AC-9 | Ngày có DailyPrice nhưng không có bucket → bucket `delta=0`, cumulative không đổi, `bucket_ts` **07:00+07:00** như bucket thật. |
| AC-10 | `period=10Y` → số bucket bị chặn ≤ 2600, vẫn tăng dần + invariant đúng. |
| AC-11 | `window=15m&period=999M` → bỏ qua `period`, 200, path legacy (không 400, không có `history`). |

## 5. Baseline gate (đo trước khi sửa)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | exit **0** (0 lỗi, 0 trùng migration; có warning stale claim cũ) |
| Claim hold | parse `docs/CLAIMS.md` cột status=in-progress, so targets | `NO IN-PROGRESS HOLD ON TARGET FILES` |
| Worktree | `git worktree add ... -b feat/cvd-1d-history-be origin/dev` | `HEAD is now at ce1e08138` |
| BE test | `manage.py test` | **CHƯA CHẠY** — bắt buộc VPS staging (`AGENT_PROTOCOL.md` §12.3), DB tạm `cvd1d_verify`, xoá sau |

## 6. Lessons áp dụng

`Lessons áp dụng: [L-001, L-002, L-003, L-M02, L-007/L-B01, L-V02, L-V04, L-V03, L-T01, L-T02]`

- [x] L-001/L-002: claim ở cuối `docs/CLAIMS.md`, commit riêng **trước** dòng code đầu tiên; không đụng file deny-list.
- [x] L-M02: branch = `feat/cvd-1d-history-be`, agent = `cvd-1d-history-be` (khớp y ký tự).
- [x] L-003: gate chạy lại sau rebase/agent-sync trước khi bàn giao.
- [x] L-007/L-B01: BE test chỉ trên VPS staging + DB tạm riêng; thiếu env → ghi `CHƯA CHẠY`.
- [x] L-V02: fail-before thật trên code chưa sửa (commit test trước → chạy VPS → đỏ), không tin root cause kế thừa. Đã tự mở source kiểm chứng timezone (`session_facts_engine.py:132-134` + `views.py:449` + `settings.py:354,356`) sau objection O2 của auditor — **không** tin reviewer khi chưa đọc code. Import `_DARK_MONEY_PERIOD_DAYS` tại method scope: auditor xác nhận không có import ngược `market_serving.views` từ `market_data`; ràng buộc code: import 1 lần, dùng sau import để tránh UnboundLocalError.
- [x] L-V04: assert giá trị thật (`period`, `history`, `bucket_count>=2`, cumulative), không assert rỗng; có test dương tính.
- [x] L-V03: sau mỗi lệnh chạy test/capture, `git status --short` kiểm product phụ.
- [x] L-T01: sau mỗi edit file có tiếng Việt, `git diff --numstat` khớp số dòng dự kiến; không round-trip qua PowerShell.
- [x] L-T02: mọi con số kèm lệnh tái tạo; không báo PASS cho thứ chưa chạy.

## 7. SCOPE / LIMIT / non-goals / rollback

- **SCOPE:** `packages/core/backend/src/market_serving/views.py` (sửa); `packages/core/backend/tests/test_cvd_1d_history_api.py` (mới);
  `docs/evidence/cvd-1d-history/*` (mới: plan audit, fail-before, gates, re-audit, handoff); `docs/CODE_CHANGE_AUDIT_LEDGER.md` (append Entry);
  `docs/CLAIMS.md` (append only); `docs/handoffs/HANDOFF_2026-11-26_CVD_1D_HISTORY_BE.md` (mới).
- **LIMIT:** tối đa 3 vòng sửa/bước; quá → blocker + partial state.
- **Non-goals:** không đổi FE/widget, không đổi model/schema, không migration, không dependency, không deploy production.
- **Rollback:** revert commit duy nhất trong `views.py`; cache v3 tự hết hạn 30s; legacy v2 không đổi.

## 8. TDD + gate plan

1. Commit test file trước (chưa sửa `views.py`) → push → chạy VPS: `manage.py test tests.test_cvd_1d_history_api` ⇒ **đỏ** (evidence fail-before).
2. Implement A1 trong `views.py` → `python -m py_compile` + `node scripts/check-experiment-env.mjs` local.
3. Chạy lại VPS cùng lệnh ⇒ **xanh**; chạy thêm regression `tests.test_session_facts_api` + `tests.test_market_serving_api_routes`.
4. `agent-sync.ps1` (rebase → gate) → re-audit doc độc lập → claim `done` → ledger → push → PR.
