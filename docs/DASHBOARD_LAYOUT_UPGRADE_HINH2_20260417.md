# Implementation Plan: Dashboard Layout Upgrade (Hình 2)

**ID**: DASHBOARD-LAYOUT-20260417  
**Status**: Approved / Ready for Coding  
**Description**: Tái cấu trúc Dashboard theo bố cục "Hình 2" (Heatmap + Sidebar) để tối ưu hóa khả năng quan sát biến động danh mục và trạng thái thời gian thực.

---

## 1. Giao diện Mục tiêu (Target UI)

Dựa trên hình ảnh tham khảo ("Hình 2"):
- **Hàng 1**: 4 StatCards (Tổng giá trị, Lãi lỗ chưa chốt, Lãi lỗ đã chốt, Cổ tức).
- **Hàng 2 (Grid 3/4 + 1/4)**:
    - **Cột trái (Lớn)**: Biểu đồ Treemap (PortfolioHeatmap) hiển thị biến động giá và tỷ trọng.
    - **Cột phải (Nhỏ)**: Bảng trạng thái danh mục và các chỉ số cảnh báo (Market Breadth, Freshness, Delta).

---

## 2. Thay đổi Mã nguồn (Code Changes)

### 2.1 Thành phần mới: `PortfolioHeatmap.jsx`
Cần tái khởi tạo lại component `PortfolioHeatmap.jsx` đã bị xóa trong đợt rollback trước.
- **Vị trí**: `frontend/src/components/PortfolioHeatmap.jsx`
- **Yêu cầu kỹ thuật**:
    - Sử dụng `recharts` Treemap.
    - **CRITICAL**: Phải kiểm tra tính hợp lệ của số trước khi gọi `.toFixed()`.
    - Code tham khảo: 
    ```javascript
    const rawChange = original.live_change_pct ?? original.change_pct ?? 0;
    const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
    // ...
    {changePct.toFixed(2)}%
    ```

### 2.2 Cập nhật trang `Dashboard.jsx`
- **Import**: `PortfolioHeatmap`.
- **Layout Logic**:
    - Sử dụng `grid grid-cols-1 xl:grid-cols-4 gap-4` cho phần giữa.
    - Cột 1 (Heatmap): `xl:col-span-3`.
    - Cột 2 (Sidebar): `xl:col-span-1`. gom các ô thông số từ `DashboardRealtimePanel` và các status boxes hiện tại vào đây.
- **Cleanup**: Gỡ bỏ row 4 ô status rời rạc hiện tại.

---

## 3. Kế hoạch Verification

- **Manual Check**: Kiểm tra layout có khớp với screenshot "Hình 2" không.
- **Realtime Check**: Đảm bảo các cell trong Heatmap nhấp nháy/cập nhật màu sắc khi có quote mới.
- **Bug Regression**: Xác nhận không còn lỗi `toFixed` của `undefined`.

---

## 4. Ghi chú cho đội Code
- Heatmap nên có chiều cao cố định (ví dụ `min-h-[400px]`) để không bị vỡ layout trên màn hình lớn.
- Sidebar nên sử dụng style `border-gray-800` và `bg-gray-900/40` để đồng bộ với theme chung.
- Dữ liệu `holdings` truyền vào Heatmap cần được lọc `market_value > 0`.
