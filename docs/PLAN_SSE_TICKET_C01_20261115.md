# PLAN — C-01: Bỏ PAT khỏi URL SSE, dùng ticket ngắn hạn (2026-11-15)

> **Slice:** C-01 (P0 bảo mật) · **Claim:** `sse-ticket-c01` · **Branch:** `feat/sse-ticket-c01`
> **Base:** `dev@ad857b6c3` · **Loại:** code (FE + BE + test)
> **Plan mẹ:** `docs/PLAN_CONTINUATION_20261115.md` §C-01 + audit `docs/evidence/continuation-20261115/audit.md` (M-02)
> **Lessons áp dụng:** [L-001 L-002 L-M02 L-S01 L-V02 L-V04 L-G02 L-B01 L-B03 L-T01 L-F10]

## 1. Mục tiêu

SSE hiện gửi PAT dài hạn trong query string (`?token=`), lọt access log nginx/proxy.
Đổi sang ticket single-use 60s (hạ tầng `ws_ticket` đã có), FE không bao giờ gắn PAT vào URL;
BE chấp nhận `?ticket=` trước, giữ `?token=` chuyển tiếp có log cảnh báo.

## 2. Bằng chứng đã tự mở đọc (B1)

| File | Dòng | Thực tế |
|---|---|---|
| `packages/web/src/hooks/useSignalStream.ts` | 50-53 | `getBrowserStorageToken("access_token")` → `qs.set("token", token)` — injector chính |
| `packages/web/src/hooks/useAlertCenterStream.ts` | 36-47, 49-52 | `buildAlertCenterQuery` + `getAlertCenterStreamUrl` đọc PAT vào `?token=`; runtime thật đi qua `useSignalStream.buildStreamQuery` (`useSignalStream.ts:40-56,158`) — helper này chỉ còn test dùng |
| `packages/web/src/hooks/useDataOpsStream.ts` | 32-39, 41-43, 103-106 | hook độc lập, tự inject `?token=` + tự tạo `EventSource` — KHÔNG qua `useSignalStream` (phát hiện từ audit B3) |
| `packages/web/src/hooks/useOverviewStream.ts` | 34-42, 44-46, 131-134 | tương tự DataOps — hook độc lập (phát hiện từ audit B3) |
| `packages/web/src/hooks/useSignalStream.component.test.tsx` | 136-141 | ghim `expect(url).toContain("token=test-pat-token")` — phải viết lại |
| `packages/core/backend/src/signal_intelligence/views.py` | 803-817 | `AlertCenterStreamView.initial()` nhận `?token=` |
| `packages/core/backend/src/service_ops/views/signals_stream.py` | 126-142 | `SignalsStreamView.initial()` nhận `?token=` |
| `packages/core/backend/src/service_ops/views/dataops_stream.py` | 79-92 | `DataOpsStreamView.initial()` nhận `?token=` |
| `packages/core/backend/src/service_ops/views/overview_stream.py` | 117-130 | `OverviewStreamView.initial()` nhận `?token=` (phát hiện thêm ngoài plan mẹ) |
| `packages/core/backend/src/identity_access/ws_ticket.py` | 19-34, 48-62 | `issue/redeem_ws_ticket` + `resolve_user_from_ws_query` (ticket trước, token sau) tái dùng được |
| `packages/core/backend/src/identity_access/views_ws_ticket.py` | 32-36 | `POST /core/v1/auth/ws-ticket/` trả flat `{ticket, expiresIn}` |
| `packages/web/src/hooks/useRealtimeFeedCore.js` | 9-10, 1010-1011 | fallback `localStorage.getItem('access_token')` chưa có call site nào chạm (guard `:1011`) nhưng là bẫy (M-02) |

## 3. Thiết kế (không đoán — tái dùng contract đã có)

- **Ticket scope:** tái dùng `POST /core/v1/auth/ws-ticket/` nguyên (không thêm scope `sse`).
  Lý do: ticket chỉ mang `{user_id, tenant_id}`, không mang scope; phân quyền vẫn do
  view (`IsAuthenticated + IsAdminUser` / `require_pat_scopes_or_human_session`) quyết định.
- **Chốt O2 (audit B3 vòng 1): KHÓA mint ticket cho machine PAT.** `WsTicketView.post`
  thêm `require_human_session(request)` → machine PAT nhận 403 khi xin ticket, giữ
  `?token=` tương thích (có warning) cho client máy. Ticket luôn = human semantics
  (`request.auth` giữ `None`, user giữ staff flags thật — đúng như flow JWT hiện tại),
  nên không có escalation scope/staff/tenant. Không client browser nào mint bằng
  machine PAT (FE WS/SSE đều dùng JWT `access_token` từ localStorage:
  `useRealtimeFeedCore.js:977` đọc token + `:1010` mint bằng nó); không test nào mint bằng machine PAT.
- **FE (4 hooks, O1):** `useSignalStream` (+ `useAlertCenterStream` qua hook chung) +
  `useDataOpsStream` + `useOverviewStream` — cùng pattern async-ticket ×4: `connect()`
  thành async, fetch ticket trước, có ticket mới tạo `EventSource`
  với `?ticket=`; fetch fail → **fail-closed** (không tạo EventSource, `scheduleReconnect`
  thử lại → lần thử lại fetch ticket mới). Không fallback PAT dưới mọi hình thức.
  Chi tiết async (O4): re-check `cancelled` sau MỖI `await`; mỗi `connect()` fetch
  ticket mới (single-use); mọi `fetch` bọc try/catch → fail-closed + scheduleReconnect.
  URL builder đồng bộ đổi chữ ký sang nhận `ticket?`, không đọc localStorage;
  test đồng bộ cũ phải viết lại dạng async (`await act(async () => {})` + mock `fetch`).
- **Helper chết (O3):** `getAlertCenterStreamUrl`, `getDataOpsStreamUrl`,
  `getOverviewStreamUrl` — chỉ test dùng — đổi sang nhận `ticket?`, KHÔNG đọc localStorage.
- **BE (4 views):** mỗi `initial()` thử `?ticket=` trước (redeem + set `request.user`,
  giữ `request.auth = None` = human; redeem fail → set nothing, raise nothing —
  rơi về permission 401/403 như cũ (O5); chỉ khi không có ticket mới thử `?token=` + `logger.warning` (ASCII, không in secret).
- **`getRealtimeWebSocketUrl`:** bỏ fallback localStorage — `if (!token) return null`.
  An toàn vì call site duy nhất đã guard `wsTicket ? … : null` (`useRealtimeFeedCore.js:1011`).

## 4. AC (Given/When/Then)

- **AC1:** Given user mở `/alert-center` **hoặc SOC Monitor/Overview**, when SSE kết nối,
  then URL chỉ có `ticket=` cho cả 4 hooks
  (test component assert `not.toContain("token=")` + `toContain("ticket=")`).
- **AC2:** Given ticket hết hạn/sai, when BE `initial()` redeem fail, then request rớt
  về 401/403 qua permission như cũ (không exception 500), không set user.
- **AC2b (O2):** Given machine PAT (không `signals:read`), when xin ticket,
  then `POST /auth/ws-ticket/` trả 403; Given ticket của human staff, when mở SOC stream,
  then vẫn qua `IsAdminUser` như JWT; machine PAT vẫn dùng `?token=` tương thích.
- **AC5 (O2):** ticket đã dùng lại lần 2 → redeem fail → 401/403 (single-use giữ nguyên).
- **AC3:** Given ticket fetch fail (401 POST / null), when hook connect, then không tạo
  `EventSource` (fail-closed, `instances.length === 0`) và schedule reconnect.
- **AC4:** Given caller gọi `getRealtimeWebSocketUrl()` không tham số, when hàm chạy,
  then trả `null` (không đọc localStorage).

## 5. SCOPE + LIMIT + non-goals

- **SCOPE (14 item):** 4 hook FE + 1 WS helper + 1 `WsTicketView` + 4 `initial()` BE
  + 4 test FE (signal, alert-center, dataops, overview)
  (+ 1 test BE mới nếu hạ tầng cho phép; BE test cần Postgres — thiếu thì ghi CHƯA CHẠY).
- **LIMIT:** tối đa 3 vòng sửa/bước (quy tắc loop). Vượt → ghi `blocker`, dừng.
- **Non-goals:** không revoke PAT (C-02, Owner); không đổi TTL 60s; không thêm scope sse;
  không sửa `MASTER_TRACKING`; không drop DB; không deploy.

## 6. Fail-before (chạy trước dòng code đầu — đã ghi, sẽ chạy ở B6)

1. FE mới: `useSignalStream.ticket.test.tsx` (tạm) hoặc case mới trong file hiện tại —
   mock `fetch` trả `{ticket:"t-abc"}` → URL chứa `ticket=t-abc`, không chứa `token=`.
   Kỳ vọng trên code cũ: **ĐỎ** (URL chứa `token=`).
2. FE fail-closed: mock `fetch` reject → `instances.length === 0`. Trên code cũ: **ĐỎ**.
3. BE: `POST /auth/ws-ticket/` → dùng ticket cho `GET .../stream/?ticket=` → 200/chấp nhận;
   ticket dùng lại lần 2 → không còn auth. Trên code cũ: **ĐỎ** (view chưa biết `ticket=`).
   Chạy được chỉ khi có Postgres + `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; thiếu → CHƯA CHẠY.

## 7. Rollback

`git revert <commit>` từng commit; FE và BE độc lập — revert BE trước nếu client mới lỗi,
vì BE giữ nhánh `token` tương thích ngược.

## 8. Gates cho slice

- `node packages/web/scripts/check-multi-agent.mjs` — PASS trước/sau.
- `npx tsc --noEmit` (packages/web) — PASS.
- `node packages/web/scripts/scan-secrets.mjs` — PASS.
- `node scripts/pre-push-gate.mjs` — không tệ hơn baseline 5 FAIL/31 PASS (3 FAIL môi trường
  + 2 drift đã biết ở plan mẹ).
- vitest targeted 2 file hook — PASS; full FE/BE suite → CHƯA CHẠY (C-07/C-08, VPS).

## 9. MANDATORY CHECKLIST (tick khi đóng slice)

- [ ] Claim commit riêng trước dòng code đầu; branch khớp tên
- [ ] Fail-before đỏ đã chụp (log) trước pass-after
- [ ] Không file deny-list; numstat khớp số dòng sửa
- [ ] Không ghi giá trị secret; log cảnh báo ASCII, không in token
- [ ] Audit độc lập B3 + re-audit B8 có verdict văn bản
- [ ] Claim → done + Entry ledger + PR merge-commit
