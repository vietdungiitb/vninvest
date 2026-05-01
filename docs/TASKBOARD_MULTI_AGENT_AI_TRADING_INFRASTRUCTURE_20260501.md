# TASKBOARD: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01

## Phase 1: Database & User Configuration (BYOM)
- [ ] Backend: Thiết kế model `UserAIConfiguration` với Fernet Encryption.
- [ ] Backend: Tạo migrate script và thêm vào Admin Panel.
- [ ] Backend: Viết API endpoint `GET/PUT /api/v1/ai/config/` để đọc và lưu API key.
- [ ] Frontend: Xây dựng màn hình "AI Configuration" (Có form nhập API Keys, Select Box chọn model cho từng Agent).
- [ ] Frontend: Test gửi API lưu cấu hình thành công.

## Phase 2: Agent Tools Layer
- [ ] Backend: Tạo file `ai_tools/whale_tools.py` bọc `get_realtime_whale_metrics` thành JSON function schema.
- [ ] Backend: Tạo file `ai_tools/tech_tools.py` bọc hàm lấy MA, RSI.
- [ ] Backend: Tạo file `ai_tools/risk_tools.py` lấy điểm rủi ro thị trường từ Global Screener.

## Phase 3: Orchestrator Logic
- [ ] Backend: Viết logic `AgentDispatcher` dùng `asyncio` để gọi song song tới OpenAI/Anthropic SDKs.
- [ ] Backend: Viết logic `OrchestratorSynthesizer` lấy kết quả 4 agents ghép thành prompt tổng hợp.
- [ ] Backend: Chuyển đổi endpoint `/api/v1/ai/debate/stream/` thành `StreamingHttpResponse` (Server-Sent Events).
- [ ] Backend: Xử lý fallback (VD: Quăng lỗi nếu user chưa nhập API Key, hoặc API key hết hạn).

## Phase 4: Frontend UI
- [ ] Frontend: Cập nhật component `AIAdvisoryPanel.jsx`. Chuyển từ API gọi REST cũ sang kết nối SSE stream.
- [ ] Frontend: Render UI Loading States: "Đang gọi Whale Agent...", "Đang gọi Risk Agent...".
- [ ] Frontend: Render kết quả cuối cùng với biểu đồ radar 4 góc độ (Whale, Tech, Risk, Sentiment) và Điểm số tổng hợp.

## QA & Audit
- [ ] Kiểm tra: Cấu hình user A có rò rỉ key sang user B không?
- [ ] Kiểm tra: Quá trình debate có dính "Echo chamber" khi set 4 agents cùng chung model `gpt-4o` không?
- [ ] Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`.
