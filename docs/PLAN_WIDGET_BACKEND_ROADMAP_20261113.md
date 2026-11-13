# PLAN — Roadmap backend vninvest cho widget Enterprise (B1–B6 xong, còn lại E1–E5/G0) — rev 2

> **Ngày:** 2026-11-13 · **Trạng thái:** KẾ HOẠCH rev 2 — B4 PASS, chờ khai claim + đóng phiên
> **Claim:** `wbacklog-20261113` (`docs/CLAIMS.md`, `in-progress`, doc-only slice)
> **Branch:** `feat/wbacklog-20261113` → `dev` (PR) · **Base:** `origin/dev` @ `80ceaf6ff` (PR #376 dot3 đã merge)
> **Nguồn yêu cầu (widget team):** `vninvestcharts-widget/docs/ROADMAP_ENTERPRISE_VNINVEST_BACKEND_CONSOLIDATED_2026-11-12.md` (§3, §6) + `VNInvestClient.ts` (adapter expectations, do subagent explore 2026-11-13)
> **Bàn giao vninvest đã xong:** `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` (B-1..B-6) + `docs/BACKEND_QA_ANSWERS_QB1_QB4_2026-11-12.md` + ledger Entry 466/477–479
> **Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-008, L-M02, L-V01, L-V02]
> **Audit độc lập (B3, subagent read-only):** NEED_REVISION (O1–O4, `docs/evidence/widget-backend-roadmap/audit.md`) → đã sửa ở rev 2 (§7).

**Tôi dùng writing-plans skill để tạo implementation plan này.**

## 0. Kết luận 1 trang

1. **B-1..B-6 (spec demo 2026-11-12) ĐÃ XONG ở vninvest** (Entry 466/478/479): routes, depth trung thực, `adjusted:false`, financials typed, hygiene, PAT scope + schema đóng.
2. **Widget đã sẵn sàng gọi 6 nhóm mới, vninvest chưa có** (verify 2 subagent read-only 2026-11-13): WS ticket (G0.2), constituents endpoint (EP-6), refresh-token prefix compat, year/cash_flow probe, và 4 EP lớn cần Owner quyết nguồn dữ liệu (adj_close thật, depth thật, tick sub-second, server Pine).
3. **Phiên này (theo Owner chọn "Full multi-slice roadmap"):** chỉ làm plan tổng + khai claim `proposed` cho từng slice — **0 dòng runtime**, code ở slice sau. Vi phạm L-002 nếu code trước claim nên mọi slice sau phải khai claim `in-progress` riêng trước dòng code đầu tiên.

## 1. Inventory đã verify — widget cần gì vs vninvest có gì

| # | Yêu cầu widget (file:line bên widget) | vninvest hiện tại (file:line đã mở đọc) | Trạng thái | Slice |
|---|---|---|---|---|
| R1 | `POST /core/v1/auth/ws-ticket/` `VNInvestClient.ts:254` (widget đã xong `fetchWsTicket`, đang fallback `?token=`) | `?token=<raw_pat>` live ở `signal_intelligence/consumers.py:52-83,130-155`; ticket endpoint **0 hit** trong `identity_access/` | **MỞ** | S1 |
| R2 | depth thật cho `orderbook_dom` (B-2) | rỗng trung thực `market_serving/native_views.py:452-472` (payload rỗng `:464-472`, `note: orderbook_not_available` `:471`); Q-B1: không nguồn order book | **MỞ — chờ Owner D2** | S5 |
| R3 | `GET .../corporate-actions/` + `adj_close` (`corporateEvents.ts:30-42`) | branch B: `adjusted:false` + note (`stock_mgmt_native_views.py:4332-4335`); Q-B2 events rỗng | **MỞ — chờ Owner D1** | S4 |
| R4 | `cash_flow` + `period=year` thật | `cash_flow:null` + year 400-fallback (dot3); `Finance(period='year')` **CHƯA XÁC MINH** | **MỞ — probe trước** | S3 |
| R5 | index constituents chính thức (`capability.messages.en.ts:140`) | helper `fetch_symbol_group_members()` có (`vnbroker_adapter.py:840-925`), **chưa endpoint public** | **MỞ — làm được ngay** | S2 |
| R6 | tick sub-second push (EP-7) | WS `ticker_update` có (`broadcasting.py:133-147`); tick staging short-lived (Q-B4) | **MỞ — chờ Owner D3** | S6 |
| R7 | server Pine cross-symbol (EP-9) | chỉ backtest 1 symbol (`advisory/views.py:932-935`) | **DEFER — chờ D4** | S7 |
| R8 | `POST /core/v1/alerts` cloud + workspace sync (EP-2/EP-8) | price-alerts CRUD + user_workspace có; contract vs widget **chưa đối chiếu** | **MỞ — slice verify** | S8 |
| R9 | `POST {base}/api/auth/token/refresh/` (`VNInvestClient.ts:741`) | **ĐÃ CÓ — verify bằng đọc code ở audit B3**: `identity_access/api_urls.py:18` định nghĩa `auth/token/refresh/` + `vninvest_core/urls.py:79` mount prefix `api/` ⇒ route serve | **ĐÓNG — chỉ smoke curl ở S3** | S3 |
| R10 | `public_jwk`, `/api/v1/activations`, dual-leg subscription | thuộc **vnsaas** + widget-side, KHÔNG phải vninvest | **Redirect, không làm ở đây** | — |
| R11 | conformance kit reference (E5) | vninvest = reference impl (tôn chỉ §5.6) — chưa có bộ test | **Sau S1–S3** | S9 |

## 2. Slices (mỗi slice 1 claim + 1 PR riêng, theo thứ tự)

### S1 — WS ticket G0.2/C02 (P0 enterprise-production) · effort M · unblocked
- **Files:** NEW `identity_access/views_ws_ticket.py` + `identity_access/urls.py` (mount `auth/ws-ticket/`, pattern như `auth/login` ở `:10-13`) + `signal_intelligence/consumers.py` (chấp nhận `?ticket=`, xóa 1 lần dùng, giữ `?token=` tương thích) + test mới `packages/core/backend/tests/test_ws_ticket.py`.
- **Thiết kế (không migration):** ticket = random 256-bit lưu Django cache 60s `{ticket: pat_id}`, single-use (xóa khi dùng), scope bind theo PAT gốc; log **không** in token/ticket (Rule scrub).
- **AC:** Given PAT hợp lệ, When POST ticket, Then 200 `{ticket, expires_in≤60}`; Given `?ticket=` đúng 1 lần, When connect WS, Then accept; dùng lần 2 → 4401; Given log WS, Then 0 hit PAT/ticket (scan). Fail-before → pass-after trên VPS DB tạm.

### S2 — Index constituents endpoint (EP-6) · effort S · unblocked
- **Files:** `market_data/stock_mgmt_native_views.py` (view mới, reuse `fetch_symbol_group_members`) + `market_data/urls.py` (mount `market-data/index/<code>/constituents/`, cùng chỗ các route market-data khác; `core_urls.py:44` import `shared_urlpatterns` từ file này nên mọi đổi mount đều hiện ở cả hai) + test.
- **AC:** `GET .../index/VN30/constituents/` → 200 `[{symbol,...}]`; code lạ → 400 `code`; số là số (Rule 3); `$ref` schema.

### S3 — Compat check + probes (read-only, 0 runtime nếu đủ) · effort S · unblocked
- **Việc:** (a) refresh route **đã verify CÓ serve bằng đọc code** (audit B3) — chỉ smoke curl staging nếu muốn; (b) probe VPS read-only `Finance(period='year')` cho 1 mã (đóng V1 dot3 còn nợ); (c) ghi evidence.
- **AC:** có/không có đều ghi evidence + lệnh tái hiện; nếu thiếu alias thì tách claim code riêng.

### S4 — EP-1 corporate actions thật · effort M · BLOCKED Owner D1
- Mở **chỉ khi** Owner chốt nguồn (vendor/SSI/manual nhập). Thiết kế sẵn: model `CorporateAction` + `makemigrations` sinh số + endpoint + bars `adj_close` (AC spec §B-3). Chưa chốt → giữ branch B (đã xong).

### S5 — EP-3 depth thật · effort M–XL · BLOCKED Owner D2
- Mở khi có nguồn depth (broker API). Chưa có → giữ rỗng trung thực (dot2) hoặc **bỏ route** (cần widget team tắt capability demo) — Owner chọn.

### S6 — EP-7 sub-second push · effort S (design) · chờ Owner D3
- Đo độ phủ tick 1 ngày (lệnh QB4 có sẵn) + đề xuất: giữ WS+poll hiện tại cho demo, hay build bar-push. Không code khi chưa chốt.

### S7 — EP-9 server Pine · DEFER (chờ D4 + EP-1/EP-4 sạch dữ liệu)
### S8 — Cloud alert + workspace contract verify · effort S
- Đối chiếu price-alerts CRUD + user_workspace với widget contract (`useDrawingAlerts`, `WorkspaceStore`); ra ticket fix nếu lệch, không tự mở rộng.
### S9 — Conformance kit reference · sau S1–S3 · effort M (slice riêng)

## 3. Quyết định cần Owner (chặn slice tương ứng)

| # | Quyết định | Đề xuất | Chặn |
|---|---|---|---|
| D1 | Nguồn corporate actions (mua/manual/giữ `adjusted:false`) | Giữ B + ticket nguồn riêng | S4 |
| D2 | Depth (giữ rỗng / bỏ route / nối broker API) | Giữ rỗng + widget degrade (đã chạy) | S5 |
| D3 | EP-7 scope (WS+poll đủ demo hay build sub-second) | Đủ demo, đo phủ trước | S6 |
| D4 | EP-9 defer tới sau EP-1/EP-4 | Đồng ý defer | S7 |
| D5 | `public_jwk`/activations → team vnsaas | Chuyển, không phải vninvest | — |
| D6 | Widget prefix `/api/*` có phải cam kết hỗ trợ lâu dài? | S3 trả lời bằng verify | S3 |

## 4. Global constraints (spec §5 — mọi slice tuân thủ)

Số là số · timestamp Unix ms · timeframe canonical · nullable `null` · envelope lỗi `{detail,code,...}` với `code` bắt buộc (tái dùng mã sẵn) · typed `$ref` + `spectacular` 0 warning ở endpoint chạm · cursor pagination · không nới quota · Rule 15 (thiếu → null/[]+note, không bịa) · TDD fail-before → pass-after · không sửa test cũ để xanh.

## 5. Non-goals / Rollback / Limit

- Không làm: purge history · namespace mới toàn repo · paper OMS (EP-10, widget đã có client-side) · code widget/vnsaas (repo khác) · deploy staging.
- Rollback: mỗi slice 1 PR → revert theo PR.
- Limit: 3 vòng sửa/bước; slice blocked → ghi `blocked`, không code mò.

## 6. DoD + baseline

- Claim `proposed` (phiên này) → executor đổi `in-progress` trước dòng code đầu tiên + worktree + DB riêng + fail-before VPS + gates xanh + ledger Entry + PR merge-commit.
- Baseline (2026-11-13 @ `80ceaf6ff`): `check-multi-agent` 0 lỗi · `check-lessons` 59/60 · next Entry 480.

## 7. Đối chiếu objection audit B3 (đã sửa ở rev 2)

| # | Nội dung | Xử lý ở rev 2 |
|---|---|---|
| O1 | S2 né `urls.py` vì w0-2 stale (w0-2 đã done, giữ code) | Mount ở `urls.py`; ghi rõ coupling `core_urls.py:44` import `shared_urlpatterns` |
| O2 | R9/S3(a) verify curl thừa (đọc code đã trả lời) | R9 → ĐÃ CÓ; S3(a) chỉ smoke curl |
| O3 | Viện dẫn w0-10 giữ file stale (đã done) | Xóa; S1–S3/S8 không conflict claim nào |
| O4 | Line R2 chưa chính xác | Ghi `:452-472 (payload rỗng :464-472)` |
