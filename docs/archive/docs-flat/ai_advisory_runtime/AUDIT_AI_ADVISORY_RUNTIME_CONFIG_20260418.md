# Báo cáo Audit & Đề xuất Nâng cấp: Tùy biến Nguồn dữ liệu AI Advisory

## 1. Audit Tính năng AI Advisory Hiện tại

Tính năng **AI Advisory** (Tổng hợp AI) trong trang `StockDetails` hiện đang hoạt động theo kiến trúc "Grounding-based Generation" (Sinh văn bản dựa trên cơ sở dữ liệu thực tế). Dưới đây là phân tích chi tiết:

### A. Luồng xử lý Dữ liệu (Pipeline)
1.  **Thu thập Context**: Khi người dùng yêu cầu tạo hoặc refresh AI Advisory, hệ thống sẽ thu thập dữ liệu từ 5 nguồn chính:
    *   **Whale Alert Context**: Phân tích lệnh lớn (Whale) trong 180 ngày gần nhất (tỷ lệ mua/bán, xu hướng dòng tiền).
    *   **Dark Flow Context**: Phân tích các tín hiệu dòng tiền ngầm (Iceberg, Absorption) trong 180 ngày.
    *   **Technical Context**: Phân tích kỹ thuật (RSI, MACD, Bollinger Bands, Volume) trong 30 phiên giao dịch.
    *   **Market Context**: Thông tin về phiên giao dịch hiện tại (Pre-market, In-market, Weekend) và lịch sử khuyến nghị gần nhất.
    *   **News Context**: Các tin tức mới nhất về mã cổ phiếu đã được AI tóm tắt từ hệ thống News Crawler.

2.  **Cấu trúc Prompt (Hardcoded)**: Các đoạn context này được "nối" vào một System Prompt cố định trong file `backend/portfolio/ai_advisory_helpers.py` (hàm `_sprint17_generate_executive_synthesis_with_ai`).

3.  **Xác thực ranh giới (Guardrails)**:
    *   Kiểm tra Role/Gói cước (Pro/Premium).
    *   Giới hạn số dòng trả về (18-20 dòng).
    *   Chính sách Narrative (bắt buộc có evidence bullets và invalidating conditions).

### B. Điểm mạnh và Hạn chế hiện tại
*   **Điểm mạnh**: Dữ liệu đầu vào rất phong phú, mang tính thực chiến cao cho TTCK Việt Nam. Có cơ chế Governance (quản trị) và Observability (theo dõi) lỗi/retry rất chi tiết.
*   **Hạn chế**: Cấu hình nguồn dữ liệu hiện tại là **cứng (static)**. Người dùng không thể chọn tắt/bật một nguồn dữ liệu cụ thể (ví dụ: tắt Tin tức nếu thấy nhiễu, hoặc chỉ tập trung vào Dòng tiền lớn).

---

## 2. Đánh giá tính khả thi: Bổ sung cấu hình Nguồn dữ liệu Runtime

Việc bổ sung tính năng cấu hình nguồn dữ liệu Prompt cho AI là **HOÀN TOÀN KHẢ THI** và rất có giá trị về mặt trải nghiệm người dùng chuyên sâu (Pro Power Users).

### Ý kiến đánh giá:
1.  **Tính cá nhân hóa**: Mỗi nhà đầu tư có một "khẩu vị" dữ liệu khác nhau (Một số tin tưởng Technical, một số chỉ tin Whale). Việc cho phép thay đổi nguồn dữ liệu lúc runtime giúp AI Advisory trở thành một công cụ phân tích đa chiều (Multi-scenario analysis).
2.  **Tối ưu Token & Chi phí**: Việc tắt các nguồn dữ liệu không cần thiết giúp giảm độ dài Prompt, từ đó giảm chi phí API (Claude/GPT-4) và tăng tốc độ phản hồi.
3.  **Tránh xung đột thông tin**: Đôi khi Tin tức (News) và Kỹ thuật (Technical) bù trừ hoặc xung đột nhau, việc cho phép người dùng cô lập nguồn dữ liệu giúp họ hiểu rõ hơn logic đằng sau mỗi khuyến nghị của AI.

---

## 3. Đề xuất Kiến trúc triển khai (Technical Blueprint)

Dưới đây là phương án triển khai mà không làm xáo trộn kiến trúc hiện có:

### A. Backend (Django)
*   **Mở rộng API**: Cập nhật endpoint `regenerate-executive-summary` để nhận thêm object `data_source_config`.
    ```json
    {
      "sources": {
        "whale": true,
        "dark_flow": true,
        "technical": true,
        "news": false,
        "market_context": true
      },
      "lookback_days": 90
    }
    ```
*   **Hàm Helpers**: Sửa đổi `_sprint17_generate_executive_synthesis_with_ai` để kiểm tra các flags này trước khi gọi các hàm `_build_..._context_for_prompt`.

### B. Frontend (React)
*   **UI Component**: Thêm một button "Cấu hình AI" (biểu tượng Gear) ngay cạnh nút Refresh AI Advisory.
*   **Settings Drawer/Modal**: Hiển thị danh sách các Checkbox tương ứng với các nguồn dữ liệu.
*   **State Management**: Lưu cấu hình này vào `localStorage` hoặc `UserConfig` để duy trì giữa các phiên làm việc.

### C. Prompt Engineering
*   AI sẽ được chỉ dẫn bổ sung: *"Dựa trên các nguồn dữ liệu được người dùng lựa chọn sau đây..."*. Nếu một nguồn bị tắt, AI sẽ không suy luận từ nguồn đó, dẫn đến kết quả phân tích hoàn toàn khác biệt.

---

## 4. Kết luận

Việc bổ sung "Runtime Prompt Source Configuration" là một bước tiến quan trọng để VNInvest trở thành một nền tảng **AI-Native Investment Terminal**. Nó chuyển đổi AI từ một "hộp đen" đưa ra kết quả cố định thành một "trợ lý phân tích" có thể tùy chỉnh theo chiến thuật của từng nhà đầu tư.

> [!IMPORTANT]
> **Khuyến nghị**: Nên triển khai tính năng này như một đặc quyền cho gói **Pro/Ultimate** để tăng giá trị chuyển đổi người dùng.
