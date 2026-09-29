# Audit Report: Technical Chart (Dark Money Master)

**Date**: 2026-04-20  
**Target**: `DarkMoneyMasterChart.jsx`  
**Status**: ⚠️ **Needs Refinement** (Aesthetic mismatch & Lack of cross-component sync)

## 1. Overview of Current Implementation
Hệ thống sử dụng thư viện `lightweight-charts` (Canvas-based), mang lại hiệu suất vẽ nến rất tốt (hỗ trợ tới 5000+ nến). Cấu trúc biểu đồ gồm 3 Pane xếp chồng (Price, CVD, Dark Flow Strength) với cơ chế đồng bộ trục thời gian tinh vi.

---

## 2. Identified Issues & Bottlenecks

### A. Rendering Performance & Logic (Medium Impact)
1.  **Sync Mechanism**: Hiện đang sử dụng `setVisibleRange` đồng bộ theo thời gian thực — đây là lựa chọn đúng đắn hơn dùng index, giúp tránh lệch nến khi dữ liệu không liên tục.
2.  **Pane Initialization**: Cả 3 pane được khởi tạo cùng lúc ngay cả khi pane 2 và 3 chưa có dữ liệu, gây lãng phí tài nguyên GPU nhẹ.
3.  **Zoom Clipping**: Khi zoom quá sâu, các Marker của Whale có thể bị lấn át hoặc che khuất (Overlap) do chưa có logic giãn cách marker thông minh.

### B. Color & Aesthetic Mismatch (High Impact)
1.  **Màu sắc nến**: Đang dùng mã `#22c55e` (Emerald) và `#f43f5e` (Rose). Điều này **xung đột** với hệ thống Neon mới (`#00FFBB` và `#FF3344`) đã chốt ở Heatmap.
2.  **Độ sắc nét (Sharpness)**: Chưa thấy logic xử lý `devicePixelRatio` tường minh cho các màn hình 4K/Retina, có thể dẫn đến hiện tượng mờ (blur) trên các thiết bị cao cấp.
3.  **Indicator Colors**: Các đường MA20/MA50 dùng màu Cyan/Amber tiêu chuẩn, chưa tận dụng được hiệu ứng "Glow" để tạo chiều sâu như Heatmap.

### C. Interaction & Connectivity (High Impact)
1.  **Tính cô lập (Isolation)**: Tooltip và Crosshair hiện chỉ hoạt động nội bộ. Cần cơ chế đồng bộ liên thành phần nhưng phải kiểm soát chặt chẽ tần suất truy vấn.
2.  **Performance Risk (Hover)**: Việc đồng bộ hóa dựa trên sự kiện `hover` (mousemove) có rủi ro gây quá tải CPU của client và tạo ra hàng loạt request API không cần thiết khi người dùng rà chuột qua biểu đồ.
3.  **Click-to-Inspect Model (New)**: Hướng tiếp cận "Demand-on-Interaction" (chỉ xử lý khi có yêu cầu) là bắt buộc. Hệ thống chỉ thực hiện đồng bộ và truy vấn dữ liệu sâu (tin tức, whale signals chi tiết) khi người dùng thực hiện hành động **Click** vào nến. Điều này giúp hệ thống chịu tải được hàng nghìn người dùng đồng thời với hàng trăm mã chứng khoán mà vẫn giữ mức tiêu thụ tài nguyên ở mức tối thiểu.

---

## 3. Risk Assessment & Optimization
- **Reliability**: Rất cao nhờ thư viện Canvas.
- **Scalability**: Cần tối ưu hóa tầng Network: Không thực hiện pre-fetch tin tức cho mọi điểm trên biểu đồ; chỉ fetch dữ liệu bổ trợ theo mốc thời gian sau khi Click.
- **UX Maturity**: Sẽ đạt mức chuyên nghiệp khi chuyển sang mô hình tương tác chủ động (Click-based).

---
**Auditor**: Antigravity AI  
**Recommendation**: Thực hiện đồng bộ hóa thẩm mỹ Neon và triển khai cơ chế Signal Dispatcher cho cross-component interaction.
