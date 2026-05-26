<USER_REQUEST>
không phải bản này bản ngày hôm qua do bạn tạo ra trong memory space không phải trong thư mục docs. Nội dung như này mà: KIẾN TRÚC SAAS NATIVE OPENAPI & HỆ THỐNG CHỈ BÁO DÒNG TIỀN THÔNG MINH (SMART MONEY FLOW)
1. Giới thiệu tổng quan & Lý do đề xuất
Dự án VNInvest đang chuyển mình mạnh mẽ sang kiến trúc SaaS Native OpenAPI, đòi hỏi các thành phần UI phải đạt được độ tin cậy cao, khả năng tùy biến sâu và tốc độ phản hồi tối ưu ở cấp độ quốc tế.
Trong trang chi tiết cổ phiếu (Stock Detail) cũ, thành phần biểu đồ trung tâm sử dụng thư viện Klinecharts. Mặc dù đây là một thư viện canvas gọn nhẹ, nó gặp phải những giới hạn nghiêm trọng về khả năng tích hợp sâu các chỉ báo độc quyền của VNInvest:
Đóng gói pipeline vẽ (Black-box rendering): Rất khó khăn để inject trực tiếp các overlay phức tạp như Whale Alert Markers (Shark Icons 🟢🦈/🔴🦈), Whale Buy/Sell Bubbles, hay Heatmap Bands theo thời gian thực vào đúng các tọa độ nến cụ thể mà không làm giảm hiệu năng hệ thống.
Double-Compute & Sync Scale: Việc đồng bộ hóa dữ liệu dòng tiền tích lũy (CVD) và Sức mạnh dòng tiền (Buy/Institutional Strength) trên cùng một trục X nhưng khác scale Y thường bị méo mó hoặc phải tính toán lặp lại (double-compute), gây tốn CPU của client.
Hạn chế Theming & Customize: Không hỗ trợ chuẩn CSS Variables khiến việc chuyển đổi Dark/Light mode không mượt mà và khó đồng bộ với hệ thống Design System chung của VNInvest.
Giải pháp: VNStockCharts (vietdungiitb/vnstockchars)
VNStockCharts là thư viện biểu đồ kỹ thuật chuyên nghiệp được xây dựng trên nền tảng React 19 + TypeScript strict + D3 v7 (Canvas/SVG hybrid). Thư viện này được thiết kế riêng biệt để giải quyết các bài toán charting phức tạp nhất của thị trường Việt Nam:
Kiến trúc Indicator Platform 5 tầng: Sẵn sàng hỗ trợ từ các chỉ báo Well-known đến các chỉ báo độc quyền (VN-exclusive) và tiến tới bộ dựng chỉ báo trực quan bằng sơ đồ khối (Visual DAG Builder).
SSOT Canonical Store: Mọi chỉ báo được tính toán đúng một lần qua enrichData và truy xuất qua seriesValueResolver giúp loại bỏ hoàn toàn việc tính trùng lặp.
Hybrid Rendering: Trục tọa độ, lưới và legends được vẽ bằng SVG chính xác; chuỗi nến, khối lượng và các vùng mật độ dòng tiền được vẽ bằng Canvas hiệu năng cao (đáp ứng 60fps khi stream WebSocket thực tế).
Độc lập và Type-safe: Viết bằng TypeScript nghiêm ngặt, cấu hình linh hoạt qua CSS Variables (--gc-*), hỗ trợ i18n đầy đủ.
Tài liệu này đề xuất giải pháp kiến trúc và lộ trình chi tiết sử dụng VNStockCharts làm thành phần cốt lõi của trang Stock Details mới, nâng tầm trải nghiệm phân tích kỹ thuật dòng tiền cá mập lên chuẩn mực quốc tế.
2. So sánh tính năng vượt trội: Cũ (Klinecharts) vs. Mới (VNStockCharts)
Dưới đây là bảng đối chiếu kỹ thuật chi tiết chỉ ra sự vượt trội của giải pháp đề xuất so với hệ thống cũ và các tiêu chuẩn quốc tế:
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-05-22T10:27:37+07:00.
</ADDITIONAL_METADATA>