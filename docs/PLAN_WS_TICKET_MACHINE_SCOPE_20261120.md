# PLAN ws-ticket-machine-scope — 2026-11-20

> Slice `ws-ticket-machine-scope` · Branch `feat/ws-ticket-machine-scope` · Claim `docs/CLAIMS.md` · Base `origin/dev` @ `ff3b7bdb1`
> Goal: demo chart (widget) lấy WS ticket bằng **machine PAT có scope `ws:realtime`**, không dùng PAT trong URL, không mở escalation staff/tenant.
> **Lessons áp dụng:** [L-V01, L-V02, L-G02, L-S01, L-T01] · SCOPE: 9 file theo claim · LIMIT: 3 vòng audit; KHÔNG migration, KHÔNG đổi response shape, KHÔNG xoá guard endpoint khác.

## 1. Baseline
- Local Postgres 127.0.0.1:5433 **không chạy** ⇒ BE tests chạy trên VPS staging với DB tạm (xem runbook §12).
- `POST /core/v1/auth/ws-ticket/` mounted (401 khi không auth), machine PAT → 403 do `require_human_session` (`views_ws_ticket.py:36`, `permissions.py:29-36`).
- `docs/CLAIMS.md`: `ws-ticket-s1`, `sse-ticket-c01`, `req-vn-c1-c7` đều done; không claim in-progress trùng 9 file SCOPE.

## 2. Thiết kế (WHAT/WHY)
1. Dùng helper **có sẵn** `require_pat_scopes_or_human_session(request, 'ws:realtime')` (`permissions.py:39-52`) thay cho `require_human_session` ở `views_ws_ticket.py:36` — human vẫn vào như cũ; machine chỉ vào khi có scope + tenant match. **Status ACTIVE/ROTATING + service account ACTIVE do `authentication.py:34-41` enforce, không phải helper.** Vì `/core/v1/auth/` nằm trong `EXEMPT_PATH_PREFIXES` (`middleware.py:34-37,55-58`) nên `request.tenant` luôn `None` ở endpoint này ⇒ trong `post()`, với machine PAT, **tự gán `request.tenant = auth.service_account.tenant`** (nguồn từ credential đã xác thực, KHÔNG đọc header client) trước khi gọi helper. Không sửa middleware, không xoá guard chỗ khác.
2. Ticket payload mang `machine: bool` + `service_account_id` (`ws_ticket.py:20-24`). Machine TTL 30s (human giữ 60s). Single-use giữ nguyên.
3. Mọi nơi redeem ticket phải **strip quyền** khi `payload["machine"]`: `user.is_staff=False`, `user.is_superuser=False` **trước khi** permission check. Đây là điều kiện bắt buộc để không tái diễn lỗ O2 (redeem load user mới từ DB → phục hồi quyền đã strip bởi `resolve_tenant.py:216-226`).
   - `ws_ticket.py:49-63` (`resolve_user_from_ws_query`) — WS consumers.
   - 4 SSE view: `signal_intelligence/views.py:817-824`, `service_ops/views/{signals_stream.py:138-145, overview_stream.py:129-136, dataops_stream.py:91-98}`.
   - Dùng 1 helper `strip_machine_privileges(user, payload)` trong `ws_ticket.py` để tránh 5 bản copy.
   - **Ngoại lệ bắt buộc:** `AlertCenterStreamView` chỉ có `[IsAuthenticated]` (`signal_intelligence/views.py:804`), không có `IsAdminUser` như 3 view `SOCBaseView` (`service_ops/views/base.py:104`) ⇒ sau khi strip quyền vẫn vào được. Phải **từ chối ticket machine với 403**: trong khối `try` tại `:814-824` chỉ **gắn cờ** `machine_ticket = bool(payload.get("machine"))`, rồi **`raise PermissionDenied(...)` Ở NGOÀI `try/except`** (sau `:824`, trước `super().initial()` ở `:839`) — nếu raise trong `try` sẽ bị `except Exception: pass` (`:823-824`) nuốt ⇒ 401 hoặc 200 escalation. Test assert `status_code == 403`. Human ticket giữ nguyên.
4. PAT demo: re-issue service account PAT với scopes gồm `ws:realtime` bằng `issue_vnbrokerchart_pat --scopes ... --force` (command đã hỗ trợ `--scopes` tại `:29-34`), inject token qua cơ chế `/demo-token.json` hiện hữu. Không nhét token vào repo/log/chat.

## 3. AC (Given/When/Then)
- **AC1** Given machine PAT **có** `ws:realtime`, When POST ws-ticket, Then 200 + `expiresIn ≤ 60` + payload `machine=True`.
- **AC2** Given machine PAT **không có** scope, When POST, Then 403.
- **AC3** Given human session, When POST, Then 200 như cũ (regression 8 test cũ).
- **AC4** Given ticket machine của tenant có owner là staff, When redeem ở 3 SSE `IsAdminUser`, Then **403** (privileges stripped); When redeem ở `AlertCenterStreamView`, Then **403** (machine ticket bị từ chối rõ ràng); When redeem ở `/ws/realtime/`, Then connect được.
- **AC5** Ticket dùng lại/hết hạn → `None` (single-use giữ nguyên).
- **AC6** E2E staging: widget demo `?standalone=1&dock=1` mở Watchlist ⇒ `priceCells` có ít nhất 1 giá không phải `—` (đóng PARTIAL của D1).

## 4. Tasks (fail-before → pass-after)
**T1** Viết `tests/test_ws_ticket_machine_scope.py` cho AC1–AC5. Auth phải dùng `force_authenticate(user=owner, auth=credential)` (hoặc `Bearer <raw>` như `test_soc_sse_ticket_c01.py:82-85`) — nếu chỉ truyền credential vào `user`, `request.auth=None` ⇒ helper return sớm ⇒ test vô hiệu. Kèm 4 case redeem SSE + AlertCenter riêng. Chạy trên VPS DB tạm ⇒ FAIL.
**T2** Sửa `views_ws_ticket.py` + `ws_ticket.py` (helper scope, machine payload, TTL, strip helper). Chạy lại ⇒ PASS; 8 test cũ `test_ws_ticket.py` vẫn PASS.
**T3** Sửa 4 SSE view gọi strip helper; thêm test AC4. Chạy lại ⇒ PASS.
**T4** Re-issue PAT staging + deploy backend (`bash scripts/deploy-staging.sh`) + verify `health`/endpoint + chạy lại E2E D1 (AC6).
**T5** Ledger Entry + claim done + doc evidence.

## 5. Traceability
| AC | Task | Test |
|---|---|---|
| AC1/AC2 | T2 | `test_machine_pat_with_scope_200`, `test_machine_pat_without_scope_403` |
| AC3 | T2 | `test_ws_ticket.py` 8 tests |
| AC4 | T3 | `test_machine_ticket_strips_staff` |
| AC5 | T2 | `test_ticket_single_use` (cũ) + machine variant |
| AC6 | T4 | Playwright probe staging |

## 6. Gates
`manage.py check` 0 · `makemigrations --check --dry-run` 0 (không migration) · targeted pytest PASS · regression `test_ws_ticket.py` (8) + `service_ops/tests/test_soc_sse_ticket_c01.py` (10) PASS · grep đảm bảo `require_human_session` còn nguyên ở các endpoint khác · `check-multi-agent` 0 · `check-lessons` 0 · deploy staging PASS · `curl` health · E2E DOM. Mọi con số kèm lệnh + nơi chạy (VPS).

## 7. Risks
- **HIGH escalation** ⇒ strip privileges ở 5 redeem site + test AC4; nếu thiếu ⇒ KHÔNG merge.
- **HIGH scope creep** ⇒ chỉ scope `ws:realtime`, không mở cho mọi machine PAT; `require_pat_scopes_or_human_session` đã check tenant match.
- **MEDIUM secret leak** ⇒ PAT chỉ qua POST body; WS URL dùng `?ticket=`; không log token.
- **MEDIUM demo PAT không expiry** ⇒ `issue_vnbrokerchart_pat.py:107-114` hardcode `expires_at=None` và file KHÔNG nằm claim ⇒ KHÔNG đổi code; ghi lịch rotate thủ công trong evidence.
- **MEDIUM `--scopes` ghi đè default** (`issue_vnbrokerchart_pat.py:30-34,50`) ⇒ khi re-issue phải truyền đủ: dùng đúng bộ scope hiện có của PAT demo (đọc từ DB qua `manage.py shell` trước khi `--force`) cộng `ws:realtime`; không dùng default của command vì `--scopes` ghi đè.
- Rollback: revert commit + revoke PAT mới + deploy lại bản cũ; không đụng migration.
