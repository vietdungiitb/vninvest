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
| AC3 | Given 2 tick 2,94 tỷ + **600 triệu** (nằm `[500M,1B)`); When feed; Then `size_class` = `shark` / `small`, `summary` đủ 8 field, `buy_value == whale_buy+shark_buy+small_buy` |
| AC4 | Given widget gọi bare URL; When feed; Then dùng **phiên gần nhất có data**, không cộng 365 ngày; có `from/to` thì kẹp `session_date` ăn index |
| AC5 | Given `min_value=100M` / symbol 0 row; When feed; Then `400 MIN_VALUE_BELOW_FLOOR` / `revision:0` + `updated_at:null` + summary 8 số 0 |
| AC6 | Given mọi timestamp của **2 route mới** (`/realtime/whale-feed/{symbol}/`, `/session-facts/{symbol}/cvd/`); When trả; Then `+07:00` (`dj_timezone.localtime`), kể cả `updated_at` CVD. **Alias `/core/v1/whale-feed` bị loại khỏi AC6** — giữ nguyên `.isoformat()` `+00:00` (`signal_intelligence/views.py:1038`), envelope, serializer 2 field (`:107-109`), `?session_date=` để không phá consumer cũ; ghi lý do vào `gates.md` |
| AC7 | Given CVD; When get; Then có `delta/unit:"vnd"/source/trade_count:null/revision`; PAT sai scope → 403; `window=1m` → 400; empty payload mang đủ field mới; cache key kẹp revision |
| AC8 | Given aggregate `tick_session:` lẫn trong bảng; When CVD materialize đọc canonical; Then không cộng trùng vào `buy_volume/sell_volume` |
| AC9 | Given `/core/v1/orderflow/{symbol}/cvd/` + `/trades/`; When get; Then `501 {reason:"not_provisioned", source:"live_aggressor"}` |
| AC10 | Given WS subscribe `events:["whale_order"]`; When source chưa provision; Then chỉ event đó nhận `not_provisioned`, `ticker_update` bình thường; human ticket vẫn connect. **Thiết kế additive:** thêm `resolve_ws_identity()` trả `{user, auth_method}`, giữ nguyên `resolve_user_from_ws_query()` → `User|None` (`ws_ticket.py:78-93`) để không hỏng `tests/test_ws_ticket.py:60-63,74-76` + `test_ws_ticket_machine_scope.py:87,96`. Test trong `packages/core/backend/tests/test_whale_ws_events.py` (mới) |
| AC11 | Given CORS test trong `packages/core/backend/tests/test_whale_cors.py` (mới) với `override_settings(CORS_API_DYNAMIC_ALLOW=False)`; When OPTIONS từ `charts.edusuccess.vn`; Then 200 (không PASS giả). Env VPS do **coordinator** cập nhật ở S5; agent chỉ viết test + evidence |

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

- **SCOPE (14 path)** theo decision doc §5 (sửa từ nhãn "12/13 file" — auditor vòng 1 objection 5):
  1. `packages/core/backend/src/signal_intelligence/order_flow_engine.py` (:244-256)
  2. `packages/core/backend/src/signal_intelligence/tasks.py` (:280-285)
  3. `packages/core/backend/src/signal_intelligence/views.py` (:354-360, :1010-1058)
  4. `packages/core/backend/src/market_serving/native_views.py` (builder mới + :340-362)
  5. `packages/core/backend/src/market_serving/views.py` (:91-105, :340-435)
  6. `packages/core/backend/src/market_serving/session_facts_engine.py` (:93-101, :124-127, :231-252)
  7. `packages/core/backend/src/market_serving/urls.py`
  8. `packages/core/backend/src/signal_intelligence/consumers.py`
  9. `packages/core/backend/src/identity_access/ws_ticket.py`
  10. `/opt/vninvest/compose.staging.env` (VPS-only, **owner = coordinator**, S5)
  11. `packages/web/src/adapters/core/__tests__/core-route-manifest.json`
  12. `packages/core/backend/src/market_serving/tests/test_native_views.py` (sửa)
  13. `packages/core/backend/tests/test_session_facts_api.py` (sửa) + `tests/test_signal_intelligence_api_routes.py` (sửa) + `tests/test_whale_ws_events.py` (mới) + `tests/test_whale_cors.py` (mới)
  14. `docs/evidence/whale-cvd-contract/{gates.md,AUDIT_PLAN.md}` + `docs/CLAIMS.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md`
  - **Claim bổ sung (bắt buộc trước S1):** append 1 dòng vào `docs/CLAIMS.md` liệt kê 4 file test (objection 2).
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
