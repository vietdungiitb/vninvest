# HANDOFF 2026-11-26 — CVD history `window=1D` cho vninvestcharts-widget (BE)

- **Phạm vi:** BE tiếp nhận BE Request của widget team; implement **A1** (multi-session từ `SessionFactsBucket`).
  **Không sửa** code widget / FE adapter trong slice này.
- **Branch:** `feat/cvd-1d-history-be` · **Commits:** `47b3f23c6` (claim) → `c166374d0` (test fail-before)
  → `5bee4ea2f` (A1) → `665767ce0` (fix O-1/M-4) · **Base:** `origin/dev @ ce1e08138`.
- **Trạng thái:** code + test **done**, re-audit **AGREE** (0 blocker/0 major), PR **đang mở** — merge/deploy
  chờ Owner. Claim `in-progress → done`; ledger `Entry 644`.

## 1. Hợp đồng endpoint (đã implement)

`GET /core/v1/market/session-facts/{symbol}/cvd/`

| Tham số / field | Hành vi |
|---|---|
| `window=1D&period=1M\|3M\|6M\|1Y\|10Y` | Trả history nhiều session; `period` lấy SSOT `_DARK_MONEY_PERIOD_DAYS` (`market_data/stock_mgmt_native_views.py:352-358`) |
| Không `period` | **Legacy giữ nguyên 100%** — `bucket_count=1`, cache v2, response không có `period/history/date_from/date_to` |
| Có `trade_date` | **Thắng `period`**, kể cả `period=999M` (không 400), đi path legacy đúng 1 session |
| `window≠1D` + `period` | Bỏ qua `period`, đi path legacy (AC-11) |
| `period` sai + `window=1D` | `400 UNSUPPORTED_PERIOD` |
| Response additive | `period`, `history:true`, `date_from`, `date_to` (ISO ngày); giữ `unit:"vnd"`, `bucket_count`, `cvd_series`, `delta`, `revision`, `updated_at` |
| Bucket | `bucket_ts` ISO **+07:00**, tăng dần; `buy_volume`/`sell_volume` (KHÔNG `buy_value/sell_value`); `delta = buy - sell` |
| Cumulative | `cumulative_cvd[i] = Σ delta[0..i]` — **không** cộng dồn `cumulative_cvd` per-session (`session_facts_engine.py:155-158`) |
| Zero-fill | Ngày có `DailyPrice` nhưng không có whale bucket ⇒ bucket `delta=0`; `bucket_ts` = **07:00+07:00** (UTC midnight chiếu localtime), khớp bucket thật |
| Cache | Legacy `core:cvd_series:v2:...` giữ nguyên; history `core:cvd_series:v3:{symbol}:{window}:{period}:{start}:{end}:{revision}` TTL 30s; `revision = int(max(computed_at).timestamp())` |
| Index | **Không cần migration** — `(session_facts, window, bucket_ts)` đã có (`market_serving/models.py:143`) |

**AC-4 clarification (quan trọng cho widget team):** request ghi "bucket cuối khớp AC-1 ±1e-6" nhưng không nói
field nào. Vì cumulative nguồn **reset mỗi session**, `cumulative_cvd` của bucket cuối history **không thể**
bằng legacy khi các session trước có delta ≠ 0. BE đã chọn AC-3 làm invariant và AC-4 = parity của
`delta` / `buy_volume` / `sell_volume` / `bucket_ts`. Nếu widget cần cumulative parity thì phải đổi contract,
không phải đổi code (đã ghi trong `AUDIT_PLAN.md` §CONTRADICTIONS).

## 2. Quyết định BE cần widget/Owner confirm

| ID | Quyết định BE | Cần confirm |
|---|---|---|
| D-1 | Chọn **A1** (A2 bị loại: `buy_value/sell_value` + UTC midnight sai field/timezone endpoint) | Widget team acknowledge |
| D-2 | Cap **2600 bucket** cho `period=10Y` (≈10 năm × 260 phiên), giữ phần cuối, tính lại cumulative trên phần giữ | Owner/widget confirm |
| D-3 | Không thêm index migration (index đã có) | — |
| D-4 | `date_from`/`date_to` = **khoảng truy vấn** (`localdate()-period_days` … `localdate()`), kể cả sau cap 10Y (`date_from` không phải ngày đầu bucket còn giữ) | **Widget confirm** — reservation R1 của re-audit round 2 |
| D-5 | Deploy staging do Owner chốt | Owner + ngày deploy |

## 3. Bằng chứng

- Fail-before (`c166374d0`, code chưa sửa): `Ran 11 tests … FAILED (failures=4, errors=1)` —
  `docs/evidence/cvd-1d-history/FAIL_BEFORE.md`.
- Pass-after (`665767ce0`): `Ran 45 tests … OK` trên VPS staging `14.225.255.47`, DB tạm `cvd1d_verify`;
  tiến trình exit 1 do teardown `ObjectInUse` (đã ghi rõ), DB/worktree đã dọn —
  `docs/evidence/cvd-1d-history/PASS_AFTER.md`.
- Audit plan: round1 `NEED_REVISION` (O1/O2/O3) → round2 `AGREE` — `docs/evidence/cvd-1d-history/AUDIT_PLAN.md`.
- Re-audit: round1 `NEED_REVISION` (O-1 test flaky UTC/local) → round2 `AGREE` 0 blocker/0 major —
  `docs/evidence/cvd-1d-history/RE_AUDIT.md`.
- Gate: `manage.py check` 0 · `py_compile` 0 · `pre-push-gate` 36 PASS/0 FAIL · `check-multi-agent` exit 0.
- Plan + source: `docs/PLAN_CVD_1D_HISTORY_BE_20261126.md`; `packages/core/backend/src/market_serving/views.py`
  (`_parse_cvd_history_period`, `_cvd_history_candle_dates`, `SessionFactsCvdView._get_cvd_history`).
- ⚠ SHA `32b2e98a` (origin/dev) / `30f7ef4e` (origin/main) do widget team nêu **không tồn tại** sau
  `git fetch` và GitHub raw trả 404 — dùng nội dung request làm contract, ghi `KHÔNG XÁC MINH`.

## 4. Next steps + owner

1. **Widget team:** slice riêng truyền `period:"3M"` (`packages/web/src/features/stock-detail/hooks/useMarketFlowFeed.ts:86-92`
   + adapter `sessionFactsCvd.ts`), E2E đổi assertion từ HTTP-only sang `pts>=2` và `maxX-minX>0`,
   visual proof 1D trên price pane, tier parity enterprise.
2. **Widget team / Owner:** confirm D-1/D-2/D-4 (đặc biệt ngữ nghĩa `date_from` sau cap).
3. **Owner:** merge PR `feat/cvd-1d-history-be` → `dev`, deploy staging theo runbook, curl proof
   `?window=1D&period=3M` ⇒ `bucket_count>=2` + `bucket_ts` tăng dần; sau merge chạy
   `pwsh -File scripts/agent-cleanup.ps1 -Branch feat/cvd-1d-history-be -Execute`.
4. **Không làm trong slice này:** không đụng FE/widget, không migration, không deploy production.
