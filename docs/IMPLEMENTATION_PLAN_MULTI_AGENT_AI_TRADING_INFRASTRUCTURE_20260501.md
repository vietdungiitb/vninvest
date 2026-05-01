# IMPLEMENTATION PLAN: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01

## Mục đích
Định hướng từng bước triển khai kỹ thuật để đảm bảo tính an toàn, không phá vỡ logic cũ và dễ dàng rollback nếu có lỗi.

## Step 1: Xây dựng nền tảng BYOK (Bring Your Own Key) an toàn
*Thực hiện trong 1-2 ngày*
- **Action:** Thêm module mã hóa (Cryptography). Cập nhật Models.
- **Verification:** Chạy Unit Test đảm bảo dữ liệu ghi vào Database bị mã hóa. Hacker dump Database cũng không lấy được plaintext key của User.

## Step 2: Xây dựng "Công cụ" (Tools) cho Agents
*Thực hiện trong 2 ngày*
- **Action:** Dựa trên kiến trúc Django hiện tại, tạo các thư mục mới `backend/portfolio/ai_services/tools/`.
- Các file python ở đây đóng vai trò trung gian: Nó nhận input JSON từ LLM -> Parse params -> Gọi hàm Django nội bộ -> Trả về JSON cho LLM.
- **Verification:** Viết script test độc lập gọi hàm tool và kiểm tra xem JSON output có khớp định dạng không.

## Step 3: Xây dựng Multi-Agent Orchestrator (Luồng Async)
*Thực hiện trong 3-4 ngày*
- **Action:** Viết class `AITradingOrchestrator`. 
- Bắt buộc dùng `asyncio.gather` trong Python để gọi 4 API requests (tới OpenAI/Anthropic/Google) cùng một lúc. Tuyệt đối không gọi tuần tự (Tuần tự sẽ khiến request mất 30-40 giây).
- **Verification:** Test thời gian phản hồi: Orchestrator phải trả về stream bước đầu tiên trong < 1s, và trả về kết quả tổng hợp cuối cùng trong < 12s.

## Step 4: Cập nhật Frontend UI & SSE
*Thực hiện trong 2 ngày*
- **Action:** Viết EventSource hook trên React để bắt stream. Xây dựng giao diện Settings cho user nhập API Key.
- **Verification:** Đảm bảo khi mất kết nối mạng giữa chừng, giao diện báo lỗi chứ không bị treo vĩnh viễn.

## Step 5: Final Audit
- Đối chiếu toàn bộ commit với `TECH_SPEC`.
- Chạy Regression test trên toàn bộ endpoint của `Money Flow Control Center` để đảm bảo hệ thống mới không làm chậm hệ thống cũ.
