# Bản hiệu chỉnh v2: Kế hoạch Kiểm toán & Nâng cấp Watchlist Page sang SaaS-Native Core
## Architectural Blueprint & Migration Safeguards

Tài liệu này là bản hiệu chỉnh kỹ thuật chính thức (v2), thay thế hoàn chỉnh cho các báo cáo trước đó. Tài liệu sửa chữa các sai lệch về mặt kiến trúc, chỉ định đúng nguồn sự thật kỹ thuật (sources of truth), làm rõ ranh giới áp dụng các quy tắc cứng, và thiết lập các gate PASS/FAIL định lượng cùng kế hoạch Rollout/Rollback chi tiết.

---

## 1. Findings theo Severity (Danh sách Sai lệch & Khoảng trống Kỹ thuật)

### 1.1 [CRITICAL] Áp sai bối cảnh quy tắc Whale Icon (Rule 5 Mismatch)
* **Sai lệch (Line 38 của bản v1):** Báo cáo v1 quy định áp dụng Quy tắc số 5 trong `AGENTS.md` ("Icon cá mập phải áp dụng cho top 10% nến đang hiển thị trong viewport, không phải toàn dataset") vào bảng danh sách watchlist.
* **Phản biện kỹ thuật:** Quy tắc cứng số 5 áp dụng duy nhất cho bối cảnh hiển thị nến (candlestick chart) của KLineChart để tối ưu hóa hiệu năng render đồ họa và tránh tính toán thừa. Việc ép buộc quy tắc này vào bảng quote/watchlist là sai bối cảnh, gây khó khăn cho việc triển khai và tạo ra các logic phức tạp không cần thiết cho bảng biểu dữ liệu tĩnh.
* **Hiệu chỉnh:** Giao diện bảng biểu Watchlist chỉ hiển thị cờ hiệu hoặc icon chỉ báo Whale Alert tĩnh dựa trên dữ liệu snapshot/feed từ backend, không liên quan đến cơ chế tính toán nến theo viewport của chart.

### 1.2 [HIGH] Sai lệch chỉ định module Backend phục vụ Legacy Bridge
* **Sai lệch (Line 14 của bản v1):** Báo cáo cũ chỉ định shim layer tương thích ngược cho `/stock-management/groups/` và `/stock-management/tracked-symbols/` nằm ở `user_workspace/legacy_views.py`.
* **Phản biện kỹ thuật:** Các endpoint tương thích ngược này thực chất đang được định nghĩa và phục vụ bởi [market_data/legacy_views.py](file:///packages/core/backend/src/market_data/legacy_views.py) (Specifically lines 135 & 230). Việc ghi nhận sai đường dẫn sẽ dẫn tới việc sửa đổi nhầm file, gây khó khăn cho việc refactor và dọn dẹp shim layer sau này.
* **Hiệu chỉnh:** Xác định chính xác [market_data/legacy_views.py](file:///packages/core/backend/src/market_data/legacy_views.py) là vị trí duy nhất chứa legacy shims cho nhóm ngành/tracked-symbols.

### 1.3 [HIGH] Hiểu sai lớp hạ tầng Realtime (WebSocket vs HTTP layer)
* **Sai lệch (Line 66 của bản v1):** Báo cáo v1 ghi nhận việc tận dụng hạ tầng WebSocket sẵn có trong `packages/web/src/adapters/core/transport.js`.
* **Phản biện kỹ thuật:** File `transport.js` được thiết kế thuần túy làm nhiệm vụ HTTP transport và quản lý auth token (refresh token). Việc chỉ định cắm realtime adapter hoặc khởi tạo WebSocket trực tiếp tại `transport.js` sẽ phá vỡ quy chuẩn phân tách trách nhiệm (Separation of Concerns).
* **Hiệu chỉnh:** Kết nối Realtime WebSocket sẽ được xử lý riêng thông qua một hook chuyên biệt hoặc manager lớp mạng (`useRealtimeFeed` / `useRealtimeWS`), tách biệt hoàn toàn với HTTP request layer của `transport.js`. Hook này sẽ chỉ lấy access token từ `authTokenStorage` làm tham số bắt tay (handshake auth).

### 1.4 [HIGH] Thiếu kế hoạch tương thích Route Gating trong pageRegistry
* **Sai lệch (Line 94 của bản v1):** Đề xuất thay đổi trực tiếp route `"watchlist"` từ shell sang trang mới mà không có kế hoạch chuyển đổi, gate kiểm soát và rollback.
* **Phản biện kỹ thuật:** Trong [pageRegistry.js](file:///packages/web/src/pages/pageRegistry.js), có sự phân chia rõ ràng giữa các trang shell `"baseline"` (như `"watchlist"`) và các trang nghiệp vụ thực tế `"core"` (như `"core-dashboard"`). Việc chuyển hướng thô bạo mà không có cơ chế gating sẽ gây vỡ luồng phân quyền (abilities) và điều hướng của hệ thống đối với các phân khúc người dùng khác nhau.
* **Hiệu chỉnh:** Thiết kế lộ trình rollout 2 giai đoạn (Baseline Shell co-existence -> Core swap) được điều khiển thông qua cấu hình Tenant-level Capability.

### 1.5 [MEDIUM] Thiếu dữ liệu đo lường hiệu năng định lượng
* **Sai lệch (Line 17 của bản v1):** Đưa ra kết luận "nghẽn >100 mã" trên client-side chỉ mang tính định tính, chưa có số liệu benchmark thực tế.
* **Hiệu chỉnh:** Thiết lập bộ chỉ số đo lường hiệu năng (latency, CPU, payload size) làm tiêu chí PASS/FAIL bắt buộc trước và sau khi nâng cấp.

---

## 2. Corrective Actions (Hành động Khắc phục)

### 2.1 Refactor Backend API & Clean Shim Layer
1. Phát triển Endpoint phân tích kỹ thuật gộp (`/core/v1/market-data/technicals/bulk/`) chịu trách nhiệm tính toán RSI(14) và khoảng cách MA20 hoàn toàn ở backend.
2. Thiết lập cơ chế tự động chạy tác vụ ngầm (background CPS workers) để đồng bộ và tính toán định kỳ cho toàn bộ các mã chứng khoán nằm trong watchlist của người dùng đang active, loại bỏ hoàn toàn việc đồng bộ thủ công.

### 2.2 Tách biệt Kiến trúc Realtime tại Frontend
1. WebSocket client được triển khai riêng biệt, kết nối tới kênh `/ws/realtime/` thông qua `authTokenStorage.getAccessToken()`.
2. Giao diện `WatchlistPage.js` mới sẽ gọi adapter kết nối WebSocket này và tự động fallback về short-polling HTTP (30s) nếu kết nối WebSocket bị ngắt đột ngột (Circuit Breaker mở).

### 2.3 Quản lý Route Gating và Đăng ký Page
1. Đăng ký trang mới dưới dạng core page trong [pageRegistry.js](file:///packages/web/src/pages/pageRegistry.js):
   ```js
   makePageEntry("core-watchlist", "core", () => import("./WatchlistPage.js").then((m) => m.WatchlistPage))
   ```
2. Giữ nguyên route baseline `"watchlist"` để làm điểm kiểm tra quyền. Nếu cấu hình tenant bật cờ `"watchlist_saas_native"`, hệ thống tự động định tuyến sang `"core-watchlist"`.

---

## 3. Validation Gates (Gate Kiểm chứng PASS/FAIL Định lượng)

Để đáp ứng tiêu chuẩn nghiệm thu chặt chẽ của dự án, quá trình xác minh phải thỏa mãn các tiêu chí định lượng sau:

| Chỉ số / Tiêu chuẩn | Phương pháp đo | Trạng thái PASS | Trạng thái FAIL |
| :--- | :--- | :--- | :--- |
| **Tốc độ phản hồi UI** | Chrome DevTools Performance Profiling | Khung hình duy trì ổn định $\ge 58$ FPS khi nhận WebSocket ticks liên tục cho 120 mã | Khung hình tụt dưới $45$ FPS, xảy ra hiện tượng nghẽn luồng render (Jank) |
| **Độ trễ xử lý dữ liệu** | Log thời gian nhận và xử lý payload của WebSocket | Thời gian phân tách (parse) và cập nhật state của bảng radar $< 10$ ms | Thời gian xử lý state của bảng radar $> 50$ ms |
| **Bảo mật Multi-Tenant** | Test suite `test_user_workspace_tenant_isolation.py` | 100% test case kiểm tra truy cập chéo tenant bị từ chối bằng mã lỗi 403/404 | Có bất kỳ rò rỉ dữ liệu watchlist nào giữa các tenants |
| **Parity Dữ liệu** | So sánh API response của `/core/v1/workspace/watchlists/` và legacy view | Dữ liệu mã chứng khoán trùng khớp 100% về danh sách và ghi chú | Có sự sai lệch hoặc mất mát dữ liệu giữa hai lớp lưu trữ |
| **Kích thước Payload** | Network Tab trong trình duyệt | Dung lượng JSON payload khi lấy danh sách kỹ thuật gộp $< 50$ KB | Dung lượng JSON payload $> 250$ KB do thừa thãi dữ liệu thô |

---

## 4. Rollout & Rollback Plan (Kế hoạch Triển khai & Dự phòng)

### 4.1 Kế hoạch Rollout theo Từng giai đoạn
```
[Giai đoạn 1: Shadow Run]  ──>  [Giai đoạn 2: Canary Gated]  ──>  [Giai đoạn 3: 100% Cutover]
- Chạy song song API native      - Bật cờ "watchlist_saas_native" - Xóa hoàn toàn shim layer
- Ghi nhận logs đối soát          - Áp dụng cho 10% tenants        - Decommission legacy views
```

1. **Giai đoạn 1 (Shadow Run):** Triển khai mã backend và frontend mới lên môi trường staging. Dữ liệu watchlist được đồng bộ song song. Trình duyệt client chạy ngầm đối soát dữ liệu (parity checking) nhưng chưa đổi giao diện người dùng.
2. **Giai đoạn 2 (Canary Gated):** Bật cờ kiểm tra surface capability `"watchlist_saas_native"` cho nhóm 10% tenants (Canary). Theo dõi sát chỉ số FPS và độ trễ WebSocket.
3. **Giai đoạn 3 (100% Cutover):** Chuyển đổi toàn bộ tenants sang sử dụng trang native mới. Sau 72 giờ vận hành ổn định, thực hiện gỡ bỏ hoàn toàn legacy shim views trong [market_data/legacy_views.py](file:///packages/core/backend/src/market_data/legacy_views.py).

### 4.2 Tiêu chí Rollback (Rollback Criteria)
Kích hoạt rollback ngay lập tức về trạng thái sử dụng trang shell baseline và giao diện legacy nếu xảy ra một trong các trường hợp sau:
1. **Lỗi Giao dịch & Mạng:** Kết nối WebSocket lỗi liên tục dẫn đến HTTP short-polling quá tải làm tăng CPU server $> 85\%$.
2. **Mất Parity Dữ liệu:** Phát hiện sai lệch dữ liệu danh sách theo dõi giữa cơ sở dữ liệu core và legacy ảnh hưởng đến trải nghiệm người dùng.
3. **Downtime Migration:** Quá trình chạy di trú cơ sở dữ liệu khóa bảng $> 5$ giây trên môi trường sản xuất.

---

## 5. Quyết định Kiến trúc & Phản hồi Open Questions

### 5.1 Watchlist target contract chính thức sẽ đi theo con đường nào?
* **Quyết định:** Chuẩn hóa hoàn toàn trên hệ sinh thái native `/core/v1/workspace/watchlists/` và `/core/v1/workspace/watchlists/<watchlist_id>/items/`. Chúng ta thực hiện **Dual-Read** trong giai đoạn di trú (Shadow Run), sau đó cắt đứt hoàn toàn và dọn dẹp các đường dẫn cũ.

### 5.2 Kênh Realtime WebSocket và Fallback Strategy?
* **Quyết định:** Sử dụng kênh WebSocket chuẩn của dự án thông qua `/ws/realtime/?token=<access_token>`. 
* **Fallback:** Nếu kết nối WebSocket gặp lỗi (mất mạng, server khởi động lại) và Circuit Breaker mở sau 3 lần thử lại thất bại, giao diện tự động hạ cấp xuống cơ chế **HTTP Short-Polling** (gửi request lấy dữ liệu gộp mỗi 30 giây) để đảm bảo tính sẵn sàng cao của bảng giá.

### 5.3 Có cần sử dụng Feature Flag / Tenant-level capability không?
* **Quyết định:** **Bắt buộc**. Việc chuyển hướng route sẽ được kiểm soát thông qua thuộc tính `surfaces` trong bootstrap payload của từng tenant. Điều này cho phép bật/tắt tính năng theo từng phân khúc người dùng và môi trường (dev/staging/production) mà không cần deploy lại mã nguồn.
