# Báo cáo Tổng thể: Tái cấu trúc Dashboard VNInvest (v4.0)

**Ngày lập**: 2026-04-20
**Trạng thái**: Đang thảo luận (Concept Approved)
**Mục tiêu**: Nâng cấp trang Dashboard hiện tại thành một "Trạm làm việc thông minh" (Modular Intelligence Workstation) đạt tiêu chuẩn quốc tế, tối ưu mật độ thông tin và giảm thiểu cuộn trang.

---

## 1. Audit & Phân tích hiện trạng
- **Vấn đề**: Giao diện cũ dạng luồng (feed) kéo dài, lãng phí diện tích, người dùng phải cuộn chuột nhiều để thấy bảng danh mục (Holdings).
- **Giải pháp**: Chuyển sang mô hình **Command Center 65/35**.
  - **Cột chính (65%)**: Tập trung vào Bản đồ nhiệt (Heatmap) và Danh mục đầu tư Module.
  - **Cột Sidebar (35%)**: Tập trung vào Cảnh báo (Alerts) và Giám sát hệ thống.

---

## 2. Các giai đoạn phát triển ý tưởng (Mockups)

Dưới đây là hành trình tiến hóa của giao diện Dashboard qua các phiên bản thảo luận:

````carousel
### v2.0: Giao diện Command Center cơ bản
![v2.0](file:///c:/Mujoco%20Projects/vninvest/docs/dashboard_rebranding_assets/dashboard_v2_mockup_pro_1776657050100.png)
- Đưa Header về dạng gọn nhẹ.
- Chia tỷ lệ 70/30.
<!-- slide -->
### v2.5: Tập trung vào Heatmap & Alert Center
![v2.5](file:///c:/Mujoco%20Projects/vninvest/docs/dashboard_rebranding_assets/modular_intelligence_dashboard_v2_5_1776657498991.png)
- Đưa Heatmap lên vị trí trung tâm.
- Module hóa danh sách mã chứng khoán thành các Tab: Tổng quan, Kỹ thuật, Cá mập.
<!-- slide -->
### v3.1: Hệ thống Unified Workstation đầy đủ
![v3.1](file:///c:/Mujoco%20Projects/vninvest/docs/dashboard_rebranding_assets/dashboard_v3_1_final_vision_1776657970396.png)
- Bổ sung Menu điều hướng dọc (Vertical Sidebar) để kết nối toàn bộ tính năng.
- Tinh chỉnh Header siêu nén theo yêu cầu thực tế.
<!-- slide -->
### v4.0: Bản hoàn thiện Tiếng Việt
![v4.0](file:///c:/Mujoco%20Projects/vninvest/docs/dashboard_rebranding_assets/dashboard_v4_0_final_vietnamese_1776658191205.png)
- Sử dụng 100% Tiếng Việt.
- Ánh xạ chính xác mọi tính năng hiện có của Dashboard cũ.
<!-- slide -->
### v5.5: Professional Horizon
![v5.5](file:///c:/Mujoco%20Projects/vninvest/docs/dashboard_rebranding_assets/dashboard_v5_5_final_concept_1776659430141.png)
- Logo tích hợp Top-Nav.
- Header 2 tầng (Menu & Stats).
<!-- slide -->
### v6.0: Analytics Workstation (Final Vision)
![v6.0](file:///c:/Mujoco%20Projects/vninvest/docs/dashboard_rebranding_assets/dashboard_v6_0_analytics_workstation_1776660122194.png)
- **Đường cong tăng trưởng**: Tích hợp biểu đồ Equity Line ngay cạnh Heatmap.
- **Chỉ số rủi ro**: Thêm module phân tích Alpha, Beta, Sharpe, Drawdown ở Sidebar.
- **Bản tin danh mục**: Nâng cấp AI Digest thành bản tin chuyên sâu với các đầu mục News.
````

---

## 3. Các thành phần chức năng chính (v6.0)

### A. Smart Header & Navigation
- **Dòng 1**: Logo | Trang chủ | Cá mập | Danh mục | Bộ lọc | Cài đặt.
- **Dòng 2**: Các chỉ số tài sản tổng quát ($$$).

### B. Core Analytics Hub (65% width)
1. **Bản đồ nhiệt & Hiệu suất**: Bố trí song song hoặc xếp chồng giữa Heatmap (Dòng tiền) và Equity Curve (Hiệu suất tăng trưởng tài sản).
2. **Modular Position Deck**: Danh sách cổ phiếu với đầy đủ các Tab chuyên sâu.

### C. Sidebar Intelligence Suite (35% width)
1. **Luồng cảnh báo**: Dữ liệu realtime.
2. **Phân tích rủi ro & Hiệu suất**: Bảng thông số chuyên sâu (Sharpe, Volatility, Max Drawdown).
3. **Bản tin danh mục (AI News)**: Tóm tắt tin tức và nhận định tự động từ AI.

### C. Intelligence Sidebar (Cột giám sát phải)
- **Live Stream Alerts**: Luồng cảnh báo thời gian thực tích hợp từ `UnifiedAlertCenter`.
- **Portfolio Health**: Theo dõi độ trễ dữ liệu và trạng thái kết nối.
- **AI Digest**: Bản tin tóm tắt nhanh tình trạng danh mục.

---

## 4. Kế hoạch thảo luận tiếp theo
- [ ] Chốt danh sách các Module kỹ thuật cho bảng danh mục.
- [ ] Thảo luận về cách tương tác giữa Heatmap và danh sách mã (Click-to-sync).
- [ ] Duyệt lộ trình Refactor mã nguồn (Tech Spec v3.1).

---

> [!TIP]
> Toàn bộ tài liệu kỹ thuật dự kiến và các ảnh mockup đã được sao lưu vào thư mục `docs/dashboard_rebranding_assets` để phục vụ phiên thảo luận tiếp theo.
