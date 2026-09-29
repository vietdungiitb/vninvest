# Plan Chi Tiết: Nâng Cấp AI Advisory Thành Command Center Đẳng Cấp Thế Giới (2026)

Tài liệu này trình bày kế hoạch chi tiết để chuyển đổi trang `WhaleAdvisory` hiện tại từ một hệ thống báo cáo tĩnh thành một **Trung tâm Điều hành Agentic (Agentic Command Center)**, đáp ứng các tiêu chuẩn thẩm mỹ và tính năng quốc tế mới nhất.

## 1. Tầm Nhìn & Mục Tiêu
Thay thế mô hình "Snapshot Report" (Người dùng yêu cầu -> AI trả kết quả) bằng mô hình **"Active Agentic Monitoring"** (AI chủ động theo dõi -> Phản hồi real-time -> Người dùng ủy quyền).

## 2. Các Thay Đổi Chính

### A. Hạ Tầng & Cấu Trúc (Modularity)
*   **Chia nhỏ component**: Hiện tại file `WhaleAdvisory.jsx` đang quá lớn (>1000 dòng). Sẽ được tách thành ~10 component chuyên biệt (BentoGrid, AgenticStream, RiskPulse, v.v.)
*   **Pipeline Dữ liệu**: Nâng cấp để hỗ trợ streaming dữ liệu, giúp chuyển đổi trạng thái AI từ "Idle" sang "Thinking" và "Analyzing" một cách mượt mà.

### B. Ngôn Ngữ Thiết Kế (Neon-Glass Aesthetics)
*   **Bento Grid Layout**: Sử dụng bố cục dạng lưới Bento (giống Apple/modern fintech) để phân bổ thông tin theo mức độ ưu tiên.
*   **Giao diện Glassmorphism**: Sử dụng các lớp phủ kính mờ (Backdrop blur), viền neon xanh cyan cho các zone quan trọng.
*   **Micro-animations**: Hiệu ứng "Pulse" khi có tín hiệu Whale mới và hiệu ứng "Wave" khi AI đang xử lý.

### C. Tính Năng Agentic (Trí Tuệ Chủ Động)
*   **Streaming Analysis**: Hiển thị "Dòng suy nghĩ" (Stream of Thought) của AI thay vì chỉ 1 đoạn text tĩnh.
*   **Whale Guardrails**: Cho phép thiết lập các quy tắc ủy quyền (Ví dụ: "AI tự động phân tích lại khi volume Whale của mã $VNM vượt 500 tỷ trong 10 phút").
*   **Visual Explainability**: Tích hợp chart mini ngay trong thẻ tư vấn, đánh dấu chính xác điểm giá/khối lượng mà AI dựa vào để đưa ra khuyến nghị.

### D. Cá Nhân Hóa (Portfolio Context)
*   **Impact Analysis**: Trả lời câu hỏi: "Tín hiệu này ảnh hưởng thế nào đến danh mục của BẠN?". AI sẽ tự tính toán mức độ rủi ro dựa trên tỷ trọng mã trong danh mục thực tế của người dùng.

## 3. Lộ Trình Thực Hiện (Roadmap)

### Giai Đoạn 1: Tái cấu trúc & Thiết kế hệ thống (Tuần 1)
*   Tách component và định nghĩa design tokens (Neon UI).
*   Mock-up giao diện Bento Grid cho màn hình Advisory.

### Giai Đoạn 2: Tính năng Real-time & Visual (Tuần 2)
*   Tích hợp chart mini và visual telemetry.
*   Triển khai hiệu ứng Streaming cho AI summary.

### Giai Đoạn 3: Agentic Logic (Tuần 3)
*   Triển khai hệ thống Guardrails and Autonomous re-analysis.
*   Tích hợp Portfolio Contextual Analysis.

---

## Các Câu Hỏi Cần Xem Xét
1. **Streaming vs Snapshot**: Bạn muốn AI "gõ chữ" phân tích theo thời gian thực để tăng cảm giác "Agentic", hay hiển thị toàn bộ bản tin ngay lập tức?
2. **Quyền hạn của AI**: Có nên cho phép AI tự động gửi thông báo (Push notification) ra Telegram/App khi các Guardrails bị vi phạm không?
