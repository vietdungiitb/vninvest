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
3. **Nâng cấp Phân tích Kỹ thuật Gộp (Technicals Bulk API):**
   * Đảm bảo endpoint `GET /core/v1/market-data/technicals/bulk/` trả về đầy đủ các chỉ số: `rsi_14`, `ma20_distance_pct`, `rvol`, và `updated_at`.

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

* **Câu lệnh thực hiện:**
  ```powershell
  $env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"; $env:DJANGO_DEBUG="true"; .venv\Scripts\python packages/core/backend/manage.py test vninvest_core.tests.test_user_workspace_tenant_isolation
  ```
* **Kết quả kiểm thử:**
  ```
  Ran 24 tests in 10.897s

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

---

## 4. Critical Fixes - Stock Detail Workstation (2026-06-19)

### Lỗi 1: Stale Closure trong `useRealtimePolling.js`
**Vấn đề:** Hook `useRealtimePolling` khai báo `executePoll` bằng `useCallback` với dependency array rỗng `[]`. Khi `symbol` thay đổi, `dedupeKey` trong closure vẫn giữ giá trị cũ (ví dụ: `'ACB'`), trong khi `dedupeKeyRef.current` đã cập nhật sang mã mới (ví dụ: `'GVR'`). Điều này khiến kiểm tra `dedupeKeyRef.current !== dedupeKey` luôn trả về `true`, dẫn đến việc dữ liệu mới của mã cổ phiếu mới bị hủy bỏ âm thầm.

**Giải pháp:** Chụp giá trị key lúc bắt đầu chu kỳ poll: `const activeDedupeKey = dedupeKeyRef.current` và so sánh trực tiếp với `dedupeKeyRef.current` sau khi nhận dữ liệu.

**File:** `packages/web/src/components/workstation/hooks/useRealtimePolling.js` (lines 85-110)

### Lỗi 2: Trộn lẫn nhật ký giao dịch trên `useTradeLog.js` khi chuyển mã
**Vấn đề:** Hook `useTradeLog` lưu trữ danh sách giao dịch trong state `trades`. Tuy nhiên, khi thay đổi `symbol`, component không thực hiện xóa danh sách cũ. Kết quả là các giao dịch mới của mã cổ phiếu mới được `prepend` đè lên giao dịch của mã cổ phiếu cũ.

**Giải pháp:** Thêm `setTrades([]); seenKeysRef.current.clear()` vào `useEffect` lắng nghe sự thay đổi của `symbol`.

**File:** `packages/web/src/components/workstation/hooks/useTradeLog.js` (lines 93-101)

### Lỗi 3: Lệch cấu trúc CSS Selector trên `StockOrderBookWidget.jsx`
**Vấn đề:** CSS `StockDetailPage.css` thiết kế bố cục Sổ lệnh theo cấu trúc hai cột song song (Grid) với các class `.ob-grid`, `.ob-side`, `.ob-levels`, `.ob-level.bid`, `.ob-level.ask`. Component trước đó lại hiển thị dạng bảng xếp chồng và dùng các class không tồn tại (`.ob-row`, `.ob-column-headers`), khiến giao diện mất định dạng.

**Giải pháp:** Tái cấu trúc hoàn toàn HTML trong `StockOrderBookWidget.jsx` để khớp 100% với đặc tả CSS.

**File:** `packages/web/src/components/workstation/StockOrderBookWidget.jsx`

### Lỗi 4: Lệch cột lưới Grid trên `StockExecutionLogWidget.jsx`
**Vấn đề:** CSS định nghĩa `.tl-row` dạng lưới 4 cột (`grid-template-columns: auto 1fr auto auto`) chứa trực tiếp 4 phần tử `.tl-time`, `.tl-price`, `.tl-qty`, `.tl-side`. Component cũ sinh ra 5 cột bọc trong `.tl-col` không có style, khiến tỷ lệ chia lưới bị méo và pseudo-element `.tl-side.buy::before` bị vô hiệu hóa.

**Giải pháp:** Cập nhật cấu trúc HTML loại bỏ các thẹ bao thừa, ánh xạ đúng 4 class con.

**File:** `packages/web/src/components/workstation/StockExecutionLogWidget.jsx`

### Kết quả kiểm thử
- **Backend Unit Tests:** `python src/manage.py test market_data.tests.test_stock_management_native_api --keepdb` → **OK (50/50 passed)**
- **Frontend Production Build:** `npm run build` → **Thành công trong 9.19s**, CSS gzip 6.44 kB
- **Dev Stack Smoke Test:** Core API health OK, Frontend health OK

### CI Guardrails Added
- **ESLint `react-hooks/exhaustive-deps`**: Set to `error` - catches stale closures in hooks
- **ESLint `react-hooks/rules-of-hooks`**: Set to `error` - enforces hook rules
- **Unit Tests**: Added `useRealtimePolling.test.js` covering stale closure fix, `useTradeLog.test.js` covering symbol-change cleanup logic
- **Visual Regression**: Playwright tests in `tests/visual/stock-detail-workstation.spec.ts` cover desktop/mobile layouts, symbol switching, accessibility

### Verdict: GO for Deployment
