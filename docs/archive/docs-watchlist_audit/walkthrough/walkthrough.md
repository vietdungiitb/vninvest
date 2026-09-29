# Walkthrough: Hoàn thành Nâng cấp Watchlist Page sang SaaS-Native Core

Tôi đã hoàn thành 100% việc lập trình, tối ưu hóa, vá lỗ hổng bảo mật và kiểm thử cô lập Multi-Tenant cho phân hệ Watchlist SaaS-Native Core theo đúng thiết kế và yêu cầu kỹ thuật.

---

## 1. Các Thay đổi & Cải tiến Mã nguồn (Implemented Changes)

### Lớp Backend (`packages/core`)
1. **Vá lỗ hổng bảo mật Multi-Tenant trong Legacy Shim (HIGH):**
   * Bảo vệ thành công legacy shims `SecuritiesGroupListCreateView` và `SecuritiesGroupDetailView` bằng cách tích hợp `TenantScopePermission` vào `permission_classes`.
   * Thay thế các truy vấn user-only bằng double-filtering (`user=request.user, tenant=request.tenant`) trong [legacy_views.py](file:///packages/core/backend/src/user_workspace/legacy_views.py) để chặn đứng nguy cơ rò rỉ dữ liệu chéo giữa các tenants.
2. **Nâng cấp Logic Giải quyết Tenant với Trạng thái Hoạt động (MEDIUM):**
   * Cập nhật hàm `_resolve_tenant` trong [permissions.py](file:///packages/core/backend/src/user_workspace/permissions.py) để lọc và chỉ chấp nhận các tenants có trạng thái hoạt động (`active` hoặc `trial`). Các tenant bị tạm ngưng (`suspended`) hoặc hủy kích hoạt sẽ không thể giải quyết thành công, cô lập triệt để quyền truy cập dữ liệu của họ.
3. **Chặn Đứng Truy cập Trực tiếp Ở Cấp Độ Endpoint (HIGH):**
   * Sửa đổi `TenantScopePermission` để trả về `False` khi `request.tenant` không được giải quyết (như trường hợp tenant bị suspended). Điều này lập tức chặn các cuộc gọi API từ phía người dùng thuộc tenant bị đình chỉ bằng mã phản hồi `403 Forbidden` thay vì cho phép fallback về chế độ lọc user-only.

### Lớp Giao diện (`packages/web`)
1. **Bloomberg-Style Table & Styles (S2.1 & S2.2):**
   * Xây dựng giao diện radar có mật độ hiển thị cao (Density Toggle: Compact / Comfortable), bảng giá neon dark sang trọng, và hiệu ứng nháy sáng (glow) xanh/đỏ khi nhận giá thay đổi thời gian thực.
2. **Logic Gating & Route Swap (S2.3):**
   * Đăng ký route `"core-watchlist"` vào [pageRegistry.js](file:///packages/web/src/pages/pageRegistry.js).
   * Triển khai logic gating tại [ShellWatchlistPage.js](file:///packages/web/src/pages/workspace/ShellWatchlistPage.js): Nếu tenant có capability `watchlist_saas_native`, hệ thống tự động điều hướng và kết xuất component `WatchlistPage` mới một cách mượt mà.
3. **Realtime WebSocket & Poll Fallback (S3.1 & S3.2):**
   * Tích hợp hook WebSocket tự động bắt tay qua JWT.
   * Xây dựng cơ chế Circuit Breaker: Tự động hạ cấp xuống short-polling HTTP (30 giây) khi kết nối mạng đứt liên tục quá 3 lần, đảm bảo ứng dụng vận hành không gián đoạn.

---

## 2. Bằng chứng Kiểm thử & Xác minh (Verification Evidence)

### A. Kiểm thử Bảo mật Multi-Tenant & Legacy Shim Isolation (24/24 Tests PASS)
Tôi đã tăng cường mạnh mẽ bộ test suite `test_user_workspace_tenant_isolation.py` bằng cách:
* Thêm xác minh thực tế dữ liệu tenant-bound cho các test case `test_T02`, `test_T03`, và `test_T07` thay vì chỉ check mã HTTP 200.
* Viết thêm 6 test cases mới (`test_T19` tới `test_T24`) để bao phủ toàn bộ các legacy watchlist endpoints và kiểm chứng logic chặn truy cập đối với các thành viên thuộc tenant đang bị đình chỉ (`suspended`).
* **Đặc biệt trong test_T24:** Xác minh trực tiếp ở cấp độ API rằng người dùng của tenant bị suspended bị chặn bằng mã phản hồi `403 Forbidden` khi truy cập API workspace.

* **Câu lệnh thực hiện:**
  ```powershell
  $env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"; $env:DJANGO_DEBUG="true"; .venv\Scripts\python packages/core/backend/manage.py test vninvest_core.tests.test_user_workspace_tenant_isolation
  ```
* **Kết quả kiểm thử:**
  ```
  Ran 24 tests in 6.867s

  OK
  Destroying test database for alias 'default'...
  Found 24 test(s).
  Portfolio tenant backfill complete: 0 updated, 0 orphaned
  Watchlist tenant backfill complete: 0 updated, 0 orphaned
  backfill_transaction_tenant: No transactions to update
  backfill_subaccount_tenant: No subaccounts to update
  System check identified no issues (0 silenced).
  ```

### B. Kiểm thử Giao diện Frontend
Tôi đã chạy bộ test suites của gói `@vninvest/web` để xác định không có hồi quy mã nguồn:

* **Câu lệnh thực hiện:**
  ```bash
  npm run test --prefix packages/web
  ```
* **Kết quả:**
  ```
  Test Suites: 7 passed, 7 total
  Tests:       74 passed, 74 total
  Time:        1.606 s
  ```

---

## 3. Đồng bộ Tiến độ & Kế hoạch Tiếp theo (Road ahead)

* **Taskboard:** Đã cập nhật trạng thái Slice 1 và Slice 2 thành `[x]` (Hoàn thành) trong [TASKBOARD.md](file:///docs/watchlist_audit/TASKBOARD.md).
* **Shadow Run:** Hệ thống đã sẵn sàng cho giai đoạn Shadow Run trên môi trường staging. Sau khi xác nhận sự ổn định của luồng dữ liệu, chúng ta có thể tiến hành Canary Rollout cho 10% tenants trước khi chuyển đổi hoàn toàn và dọn dẹp các shim layers legacy.
