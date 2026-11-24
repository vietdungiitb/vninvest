# PLAN — Whale/CVD API contract cho widget (backend vninvest)

- **Ngày:** 2026-11-24 · **Branch sẽ mở:** `feat/whale-cvd-contract-be` · **Nguồn quyết định:** `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` (REV.2.1).
- **Lessons áp dụng:** [L-V01, L-V02, L-V04, L-T01, L-T02, L-F04, L-F07]; MANDATORY CHECKLIST trong decision doc đã tick.
- **Mục tiêu:** cung cấp contract Whale/CVD trung thực cho widget (Rule 15), không fake data, không migration, không xây pipeline tick mới.

## 1. Bằng chứng đã tự verify (không suy diễn)

- G0 staging `docs/evidence/whale-cvd-contract/G0_PROBE.md`: price VND thật, UNKNOWN 0,75%; **6.290 row `tick_session` lẫn vào `WhaleAlertCanonical`**, 623 clamp 5B.
- `signal_intelligence/views.py:1036-1058` đã có `whale_orders` (dùng làm builder chung, không tạo shape thứ 4).
- `market_serving/views.py:416-424` CVD đã có 6 field; `:358-359` thiếu scope gate; `:91-105` empty payload thiếu field mới; `:386` cache key chưa kẹp revision.
- `session_facts_engine.py:122-127` cộng VND vào cột `*_volume` + `else:sell` gán sai UNKNOWN.
- `consumers.py:174-200` subscribe chỉ có `symbols`; `VNInvestClient.ts:238-244,1029` map raw summary.

## 2. Tiêu chí nghiệm thu (Given/When/Then)

| ID | AC |
|---|---|
| AC1 | Given DB có cả `whale_tick:` lẫn `tick_session:`; When `GET /core/v1/realtime/whale-feed/VIC/`; Then `whale_orders[]` chỉ chứa per-tick, không có row aggregate/clamp 5B |
| AC2 | Given seed tick `UNKNOWN` ≥ 500M; When detect; Then không có `WhaleAlertCanonical.side='sell'` giả từ row đó |
| AC3 | Given 2 tick 2,94 tỷ + 200 triệu; When feed; Then `size_class` = `shark` / `small`, `summary` đủ 8 field, `buy_value == whale_buy+shark_buy+small_buy` |
| AC4 | Given widget gọi bare URL; When feed; Then dùng **phiên gần nhất có data**, không cộng 365 ngày; có `from/to` thì kẹp `session_date` ăn index |
| AC5 | Given `min_value=100M` / symbol 0 row; When feed; Then `400 MIN_VALUE_BELOW_FLOOR` / `revision:0` + `updated_at:null` + summary 8 số 0 |
| AC6 | Given mọi timestamp; When trả; Then `+07:00` (`dj_timezone.localtime`), kể cả `updated_at` CVD |
| AC7 | Given CVD; When get; Then có `delta/unit:"vnd"/source/trade_count:null/revision`; PAT sai scope → 403; `window=1m` → 400; empty payload mang đủ field mới; cache key kẹp revision |
| AC8 | Given aggregate `tick_session:` lẫn trong bảng; When CVD materialize đọc canonical; Then không cộng trùng vào `buy_volume/sell_volume` |
| AC9 | Given `/core/v1/orderflow/{symbol}/cvd/` + `/trades/`; When get; Then `501 {reason:"not_provisioned", source:"live_aggressor"}` |
| AC10 | Given WS subscribe `events:["whale_order"]`; When source chưa provision; Then chỉ event đó nhận `not_provisioned`, `ticker_update` bình thường; human ticket vẫn connect |
| AC11 | Given CORS test với `override_settings(CORS_API_DYNAMIC_ALLOW=False)`; When OPTIONS từ `charts.edusuccess.vn`; Then 200 (không PASS giả) |

## 3. Baseline gate (đo trước khi sửa)

| Gate | Lệnh | Kết quả @ dev `3437183bc` |
|---|---|---|
| multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | 0 lỗi, PASS |
| lessons | `node scripts/check-lessons.mjs` | 14 file / 60/60 lesson, sạch |
| experiment-env | `node scripts/check-experiment-env.mjs` | PASS, exit 0 |
| EOL | `node scripts/normalize-eol.mjs` | OK, exit 0 (không churn) |
| tsc | `npx tsc --noEmit` (packages/web) | exit 0 |
| BE test | cần Postgres riêng trên VPS | **CHƯA CHẠY** |

## 4. SCOPE / LIMIT / non-goals / rollback

- **SCOPE (12 file)** theo decision doc §5: `order_flow_engine.py` (:244-256), `tasks.py` (:280-285), `signal_intelligence/views.py` (:354-360, :1010-1058), `market_serving/native_views.py` (builder mới + :340-362), `market_serving/views.py` (:91-105, :340-435), `session_facts_engine.py` (:93-101, :124-127, :231-252), `market_serving/urls.py`, `consumers.py`, `ws_ticket.py`, `compose.staging.env` (VPS), `core-route-manifest.json`, 3 file test BE.
- **LIMIT:** tối đa 3 vòng sửa/bước; quá → blocker + dừng. Không migration; không đổi model; không `npm/pip install`.
- **Non-goals:** không xây live tick feed; không đổi retention 30 ngày; không tắt dynamic CORS; không sửa repo widget; không đụng file của claim `in-progress` thật (đã verify stale).
- **Rollback:** `git revert` từng commit; env VPS restore bản sao `compose.staging.env`.

## 5. Thứ tự code (TDD, đỏ trước)

1. S1 — test fail-before cho filter `whale_tick:` + UNKNOWN + enum/summary (AC1–AC5).
2. S2 — builder whale + adapter alias + 501 routes (AC1, AC3–AC5, AC9).
3. S3 — CVD fields/scope/window/cache + fix engine (AC6–AC8).
4. S4 — WS `events[]` + `not_provisioned` + `auth_method` (AC10).
5. S5 — CORS env + manifest + OpenAPI (AC11).
6. S6 — gates + re-audit + handoff.

Mỗi S chạy test đỏ trên code cũ trước khi sửa; ghi log vào `docs/evidence/whale-cvd-contract/gates.md`.
