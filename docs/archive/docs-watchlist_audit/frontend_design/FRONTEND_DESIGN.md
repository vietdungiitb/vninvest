# Thiết kế Frontend: Watchlist SaaS-Native Core
## Architectural Blueprint - React Components & Realtime Adapters

Tài liệu này cung cấp thiết kế chi tiết lớp Web Frontend cho tính năng Watchlist thuộc package `packages/web`.

---

## 1. Cấu trúc Layout Hai cột (Bloomberg-Style Sidebar + Grid)

Giao diện trang Watchlist mới được cấu trúc gọn gàng, tăng tối đa không gian hiển thị bảng giá mật độ cao.

```
+-----------------------------------------------------------------------------------+
| Top Navigation (Tổng quan, Tín hiệu, Danh mục, Hệ thống...)                       |
+-----------------------------------------------------------------------------------+
| RADAR THỊ TRƯỜNG                                   [Tự động cập nhật ngầm | 17:15]|
+--------------------------+--------------------------------------------------------+
| Nhóm thị trường (Sectors)| Danh sách theo dõi cá nhân                             |
| * Ngân hàng (17)         | [Bảng giá]  [Quản lý]  [Cảnh báo]                       |
| * Bất động sản (14)      | +---------+---------+---------+---------+-----------+   |
| * Thép (7)               | | Mã      | Giá     | % Thay  | RSI(14) | MA20 Dist |   |
| * VN30 (30)              | +---------+---------+---------+---------+-----------+   |
|                          | | ACB     | 25.40   | +1.20%  | 58.42   | +2.15%    |   |
|                          | | VNM     | 68.10   | -0.45%  | 42.15   | -1.45%    |   |
|                          | | SSI     | 35.80   | +2.50%  | 64.88   | +4.12%    |   |
|                          | +---------+---------+---------+---------+-----------+   |
+--------------------------+--------------------------------------------------------+
```

### 1.1 Quản lý Mật độ Hiển thị (Density Controls)
Bảng quote cung cấp nút chuyển đổi nhanh giữa hai chế độ thông qua việc gán CSS class động vào bảng:
* **Chế độ Compact (Gọn):** Giảm tối đa padding của ô (`padding: 4px 6px`), cỡ chữ nhỏ gọn (`font-size: 11px`), chiều cao dòng tối ưu để có thể hiển thị cùng lúc $> 50$ mã chứng khoán trên màn hình mà không cần cuộn.
* **Chế độ Comfortable (Thoáng):** Padding tiêu chuẩn (`padding: 10px 12px`), cỡ chữ vừa phải (`font-size: 13px`).

### 1.2 Hiệu ứng Nhấp nháy Giá (Price Flash Effects)
Khi nhận được tick giá mới qua luồng realtime, ô hiển thị giá sẽ tự động kích hoạt hiệu ứng flash nhẹ:
* **Giá tăng:** Kích hoạt animation `price-glow-up` nhấp nháy nhẹ viền xanh (#00FFBB) và biến mất sau 300ms.
* **Giá giảm:** Kích hoạt animation `price-glow-down` nhấp nháy nhẹ viền đỏ (#FF3344) và biến mất sau 300ms.

---

## 2. Adapter Kết nối Realtime WebSocket (`useRealtimeWS`)

Tách biệt hoàn toàn với HTTP transport layer của `transport.js`, chúng ta sử dụng hook riêng để giao tiếp thời gian thực:

```
[WebSocket Server] <====== ws://host/ws/realtime ======> [useRealtimeWS hook]
                                                                |
                                                      (On Connection Fail)
                                                                v
[API Server]       <=== GET Technicals/Quotes (30s) <=== [HTTP Fallback short-poll]
```

### 2.1 Luồng Khởi tạo và Bắt tay (Handshake Flow)
1. Hook `useRealtimeWS` gọi `authTokenStorage.getAccessToken()` để lấy Access Token hợp lệ.
2. Thiết lập kết nối WebSocket tới đường dẫn (URL phải được xây dựng động theo hốt nhiệm vụ — không hardcode localhost):
   ```
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const host = window.location.host;  // e.g. localhost:3000 (dev) or prod domain
   const wsUrl = `${protocol}//${host}/ws/realtime/?token=${accessToken}`;
   ```
3. Khi nhận được tin nhắn dạng text chứa payload JSON giá khớp liên tục, hook thực hiện parse dữ liệu và kích hoạt callback cập nhật state cho bảng dưới 10ms.

### 2.2 Chiến lược Dự phòng (Fallback Strategy)
* Nếu kết nối WebSocket bị mất (mất mạng, server khởi động lại) và thử lại 3 lần thất bại (Circuit Breaker mở), hook tự động chuyển đổi sang cơ chế **HTTP Short-Polling** (gửi request lấy dữ liệu gộp mỗi 30 giây).
* Khi kết nối mạng phục hồi, WebSocket tự động tái lập và ngắt cơ chế Short-polling để tối ưu tài nguyên.

---

## 3. Cấu hình pageRegistry và Route Gating

Để đảm bảo tính tương thích và bảo mật phân quyền theo từng Tenant, trang mới được đăng ký như sau:

1. Đăng ký trang nghiệp vụ native mới trong `packages/web/src/pages/pageRegistry.js`:
   ```js
   makePageEntry("core-watchlist", "core", () =>
     import("./WatchlistPage.js").then((module) => module.WatchlistPage)
   )
   ```
2. Cấu hình kiểm tra cờ năng lực (Tenant Capability Gating) tại lớp Host Context:
   * Route `"watchlist"` đóng vai trò điểm chặn kiểm tra quyền.
   * Nếu bootstrap payload trả về cờ `"watchlist_saas_native": true` trong thuộc tính surfaces của Tenant, hệ thống định tuyến mượt mà người dùng sang trang mới `"core-watchlist"`.
   * Ngược lại, điều hướng người dùng về trang chẩn đoán shell hoặc thông báo nâng cấp gói dịch vụ để đảm bảo an toàn nghiệp vụ.
