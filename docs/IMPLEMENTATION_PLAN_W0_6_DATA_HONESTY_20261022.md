# IMPLEMENTATION PLAN — W0.6 DATA HONESTY (fail-closed 5 endpoint)

**Agent:** `w0-6-data-honesty` · **Branch:** `feat/w0-6-data-honesty` -> `dev`
**Base:** `origin/dev` @ `bda7698ba` · **Worktree:** `C:\Mujoco Projects\agent-w0-6`
**Nguồn:** `docs/ROADMAP_MASTER_2026Q4_2027.md` §4.2 **W0.6** (ưu tiên cao nhất vì D1: retail mua "dữ liệu mà chỗ khác không có") + §4.3 W1.3/W1.4/W1.10 (phần code của 3 slice đó gộp vào đây)
**Lessons áp dụng:** L-001 L-002 L-003 L-007 L-008 L-M02 L-M05 L-M08 L-V01 L-V02 L-V04 L-G01 L-G02 L-G04 L-G05 L-G07 L-G08 L-T01 L-T02 L-A01
**Skill:** `multi-agent-workflow` (8 stage) · `tdd-workflow` (RED → GREEN, 2 checkpoint commit) · `verification-loop` (6 phase) · `project-lessons` (Planning Gate)

---

## 0. Vấn đề — "nói dối" là rủi ro niềm tin lớn nhất với retail

D1 (Owner): khách trả tiền là **retail**, mua **charts · whale · dark flow · AI**. ⇒ **mọi giá trị không phải dữ liệu thật phải được nói rõ**. 5 endpoint hiện **trả về thứ giả mà không nói**:

| # | Endpoint / chỗ | Hiện trạng (đọc code thật) | Bằng chứng |
|---|---|---|---|
| A | `send_fcm_push` / `send_webpush` | Key thiếu ⇒ **trả `True`** ("Push marked as delivered") | `signal_intelligence/outbound_notification_service.py:57-59`, `:103-105` |
| B | `POST /api/soc/signals/whale/test/` | **hardcode** `test_result:'success'`, `detection_possible: True` | `service_ops/views/signals.py:770-775` |
| C | `GET /core/v1/partner/usage/meters/` | **placeholder** trả `[]` | `identity_access/views_tenant.py:523-528` |
| D | `send_quota_warning` task | Chỉ ghi log, **không gửi email** | `commercial/tasks.py:290-302` |
| E | `GET /core/v1/realtime/depth-chart/<symbol>/` | Dữ liệu **tổng hợp giả** (`pseudo_random`), chỉ có `is_mock` | `market_serving/native_views.py:430,481-509,520-522` |

## 1. ĐÍNH CHÍNH 1 CONTRADICTION (L-V02 — phải có phản chứng)

Roadmap §4.3 **W1.3** nói badge "Ước tính" cho order book **chưa có**. **Đọc code thật ⇒ SAI**: `packages/web/src/components/workstation/StockOrderBookWidget.jsx:153-161` **đã** render badge khi `orderBook?.is_mock` (`t("workstation.orderBook.estimatedBadge", { defaultValue: "Dữ liệu ước tính" })`).

⇒ **Sửa roadmap**: W1.3 phần **FE đã xong**. Còn thiếu: (a) BE expose `data_quality` chuẩn để FE dùng chung; (b) **order book nhúng trong widget biểu đồ** (`chartAdapter.js:160` đưa mock vào `vninvestcharts-widget`) — **không sửa được** (repo ngoài) ⇒ **[X]**.

## 2. Scope chính xác (5 thay đổi, TDD)

### A — Push không được báo "đã gửi" khi chưa cấu hình
- **File:** `packages/core/backend/src/signal_intelligence/outbound_notification_service.py:33-89` (FCM), `:91-120` (WebPush)
- **Sửa:** thêm `OutboundNotificationService.push_configured() -> dict` (`{'fcm': bool, 'webpush': bool}`) đọc `settings.FCM_SERVER_KEY` / `settings.VAPID_PRIVATE_KEY` (không phải sentinel `MOCK_*`). `send_fcm_push` / `send_webpush`: nếu **chưa cấu hình** ⇒ **trả `False`** + `logger.warning` nêu rõ "chưa cấu hình — KHÔNG gửi". **Bỏ** điều kiện `settings.DEBUG` trong nhánh "coi là thành công" (DEBUG **không** được làm push thành công giả).
- **AC:** (1) test: chưa cấu hình ⇒ `send_fcm_push(...) is False` **và** `push_configured()['fcm'] is False` (2) test: `push_configured()` **True** khi set key thật trong `override_settings` (3) test: `DEBUG=True` + chưa cấu hình ⇒ **vẫn `False`**.
- **Non-goal:** không thêm provider push mới; không đổi chữ ký hàm (`bool`) để không phá caller.

### B — Whale test phải chạy engine THẬT
- **File:** `packages/core/backend/src/service_ops/views/signals.py:764-776`
- **Sửa:** dùng `signal_intelligence.order_flow_engine.load_session_ticks_df(symbol, session_date)` + `detect_whale_ticks(df)` + `detect_dark_flow_windows(df)` ⇒ trả **số liệu thật**: `ticks_scanned`, `whale_ticks_detected`, `dark_flow_windows`, `session_date`. Không có tick ⇒ `test_result:'no_data'`, `detection_possible: False`, `note` nêu rõ. Có tick ⇒ `test_result:'completed'`, `detection_possible: True` (**KHÔNG** nói "success" khi chưa chạy gì).
- **AC:** (1) test: symbol không có tick ⇒ `test_result != 'success'` **và** `detection_possible is False` (2) test: có tick ≥ ngưỡng whale ⇒ `whale_ticks_detected >= 1` **và** `test_result == 'completed'`.
- **Non-goal:** không ghi alert (chỉ **đọc** & báo cáo — endpoint là "test", không phải job).

### C — Usage meters: số thật hoặc 501, không phải `[]` âm thầm
- **File:** `packages/core/backend/src/identity_access/views_tenant.py:523-528`
- **Sửa:** dựng meter từ **nguồn sự thật**: `commercial/tasks.py` có `METER_NAMES`, `METER_ENTITLEMENT_BY_PLAN` (`:56-62`) và bộ đếm Redis `_iter_month_counter_keys` (`:73-86`) — cùng nguồn mà `middleware` enforce. Nếu Redis **không** có `scan_iter` (không cấu hình) ⇒ **HTTP 501** + `detail` nêu lý do (không trả `[]` làm người dùng tưởng "chưa dùng gì").
- **AC:** (1) test: Redis không có `scan_iter` ⇒ **status 501** + `detail` có chữ "meter" (2) test: có counter ⇒ response **200** với `meters` là list có phần tử (3) **không** còn đường trả `200` + `[]`.
- **Non-goal:** không thêm meter mới; không đổi schema `QuotaRecord`.

### D — Quota warning phải gửi email thật
- **File:** `packages/core/backend/src/commercial/tasks.py:290-302`
- **Sửa:** sau khi qua dedup, lấy email chủ tenant ⇒ gọi `OutboundNotificationService.send_email(...)`. Không có email ⇒ `{'status':'skipped','reason':'tenant_email_missing'}`. Gửi thành công ⇒ `{'status':'sent'}`; thất bại ⇒ `{'status':'failed','reason':...}`. Giữ dedup (cache key `quota:warning_sent:...` `:294-296`).
- **AC:** (1) test: tenant không có email ⇒ `status == 'skipped'` + `reason == 'tenant_email_missing'` (2) test: có email + SMTP mock thành công ⇒ `status == 'sent'` (3) test: SMTP lỗi ⇒ `status == 'failed'` (4) dedup: gọi 2 lần ⇒ lần 2 `status == 'skipped'` + `reason == 'duplicate_warning'`.
- **Non-goal:** không đổi lịch Celery; không thêm template HTML mới (dùng text thuần).

### E — Depth chart: nói rõ "ước tính" ở contract
- **File:** `packages/core/backend/src/market_serving/native_views.py:443-452` (nhánh không có snapshot) + `:511-523` (nhánh có)
- **Sửa:** thêm `data_quality: 'estimated'` + `note` **tiếng Việt** rõ ràng ở **cả hai** nhánh; giữ `is_mock: True` (contract cũ, FE đang dùng `StockOrderBookWidget.jsx:153`).
- **AC:** (1) test: response luôn có `data_quality == 'estimated'` **và** `is_mock is True` (2) FE **không** cần sửa (badge đã có — §1).
- **Non-goal:** **không** thay thuật toán `pseudo_random` bằng order book thật (chưa có nguồn L2) — đó là W5/[X].

## 3. File dự kiến sửa (claim)

| File | Loại |
|---|---|
| `packages/core/backend/src/signal_intelligence/outbound_notification_service.py` | SỬA |
| `packages/core/backend/src/service_ops/views/signals.py` | SỬA |
| `packages/core/backend/src/identity_access/views_tenant.py` | SỬA |
| `packages/core/backend/src/commercial/tasks.py` | SỬA |
| `packages/core/backend/src/market_serving/native_views.py` | SỬA |
| `packages/core/backend/tests/test_w0_6_data_honesty.py` | **TẠO MỚI** (test) |
| `docs/IMPLEMENTATION_PLAN_W0_6_DATA_HONESTY_20261022.md` | **TẠO MỚI** (plan) |

**KHÔNG chạm file deny-list** (§2 protocol). **KHÔNG có migration** ⇒ không rủi ro trùng số migration.

## 4. Cổng chất lượng (Stage 6) — theo quy định mới

| Gate | Nơi chạy |
|---|---|
| **BE `manage.py test`** (scope: file test mới + app bị ảnh hưởng) | **VPS staging** (runbook §12.3) — **KHÔNG local Docker** |
| BE `manage.py check` | VPS staging |
| FE `npm run test:components` + `npm run test` + `npm run build` + `npm run lint` | **VPS staging** (runbook §12.4) |
| `node scripts/pre-push-gate.mjs` | local (nhẹ, §12.2 cho phép) |
| `node scripts/check-experiment-env.mjs --self-test` | local |
| `node scripts/check-lessons.mjs` · `node packages/web/scripts/check-multi-agent.mjs` | local |

**Dọn sau thử nghiệm (bắt buộc):** DB tạm VPS **DROP** · worktree VPS **remove** + prune · `node_modules` VPS **xoá** (trừ khi lock không đổi) · `docker ps` xác nhận **không còn container thử nghiệm**.

## 5. Quy trình TDD (theo `tdd-workflow`)

1. **RED** — viết `tests/test_w0_6_data_honesty.py` (5 nhóm test, 10+ case) ⇒ chạy trên VPS ⇒ **phải đỏ** vì lý do nghiệp vụ đúng (không phải lỗi cú pháp / setup). **Checkpoint commit 1** (`test: add reproducer for W0.6 data honesty`).
2. **GREEN** — sửa code tối thiểu ⇒ chạy lại **cùng target** ⇒ xanh. **Checkpoint commit 2** (`fix(w0-6): ...`).
3. **Verify** — `verification-loop` 6 phase + `pre-push-gate` + toàn bộ gate VPS.

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Test BE không chạy được local (Docker chết) | Chạy trên **VPS staging** theo §12.3 — đã kiểm chứng hoạt động (Entry 397) |
| `send_fcm_push` đổi hành vi ⇒ caller khác | Grep caller trước khi sửa; giữ chữ ký `bool`; `DEBUG` không còn là "thành công" |
| Whale test gọi pandas nặng | Chỉ 1 symbol + 1 session; `load_session_ticks_df` đã cache |
| Sửa `usage/meters` ⇒ route contract đổi | Giữ **đường dẫn**; chỉ đổi mã 200-empty ⇒ 501 ⇒ FE phải xử lý 501 (kiểm tra caller) |
| `commercial/tasks.py` có thể bị agent khác claim | Kiểm tra `docs/CLAIMS.md` **trước** khi sửa (L-002) |
