# BẢN QUẢN LÝ TÍNH NĂNG (HANDOFF MASTER)
## GLOBAL SCREENER & AI ALERTS SCALABILITY REFACTOR

**Ngày tạo:** 2026-04-27
**Người lập:** Ban Kiến Trúc (AI)
**Trạng thái:** Sẵn sàng chuyển giao cho Đội Lập Trình (Dev Team)

---

## 1. Mục Tiêu Dự Án (Project Objective)
Nâng cấp toàn diện tính năng Screener & AI Alerts từ mô hình "User-Driven" (do người dùng tự kích hoạt) sang mô hình "Admin-Curated & Global Broadcast" (Quản trị viên cấu hình quét toàn cục và đẩy thông báo cho người dùng). 

Mục tiêu cốt lõi:
1. **Giải quyết triệt để nút thắt (Bottleneck)**: Hiện tại API `ScreenerRuleRunView` chạy đồng bộ O(N*M) và gọi DB/Cache liên tục. Nếu 1000 users truy cập, server sẽ quá tải.
2. **Khắc phục lỗi Duplicate LLM Calls**: Hiện tại AI Advisory đang trigger một request LLM (OpenAI/Anthropic) cho mỗi cặp `User + Symbol`. Nếu 5000 users cùng track mã FPT, hệ thống gọi API 5000 lần, gây tốn kém chi phí khổng lồ và bị rate-limit.
3. **Tuân thủ quy chuẩn SSOT (Single Source of Truth)**: Screener Engine mới không được tự lấy giá hay tự tính toán mà phải lấy từ `MarketDataService`, `OrderFlow`, và `WhaleAdvisory` để đảm bảo dữ liệu trên toàn hệ thống khớp nhau tuyệt đối.
4. **Phân phối thời gian thực (Event-Driven)**: Tự động đẩy WebSocket xuống cho người dùng khi có mã "trúng giải" hoặc khi phát hiện Whale Flow, Dark Money.

## 2. Các Thành Phần Thay Đổi Cốt Lõi (Core Components Affected)
1. **Database Models**: Tạo mới `GlobalScreenerRule`, `ScreenerScheduleConfig`, và `UserAlertHistory`.
2. **Global Screener Engine**: Dịch vụ `GlobalScreenerService` chạy ngầm bằng Celery Beat, tạo `MasterTechnicalSnapshot` lưu trên Redis.
3. **AI Generation Lock**: Thay cache key từ `whale_advisory_lock:{user_id}:{symbol}` thành `whale_advisory_lock:{symbol}` để đảm bảo gọi LLM 1 lần duy nhất cho 1 mã.
4. **User Screener Tối Ưu**: API cho người dùng hiện tại không bị xóa bỏ, nhưng được Refactor sang đọc `MasterTechnicalSnapshot` từ Redis (O(1)) thay vì truy vấn Database, kèm tính năng bật/tắt (Feature Flag).

## 3. Danh Mục Hồ Sơ Chuyển Giao (Documentation Index)
Để quá trình thực thi tuân thủ đúng quy định AI Coding và Quality Standards của dự án, bộ tài liệu này bao gồm 5 file quan trọng sau:

1. **[EXECUTION PLAN](GLOBAL_SCREENER_AI_ALERTS_REFACTOR_EXECUTION_PLAN_20260427.md)**: Bản kế hoạch các bước sửa đổi code chi tiết. Đội lập trình (AI Sessions) phải đọc kỹ trước khi code.
2. **[TASKBOARD](GLOBAL_SCREENER_AI_ALERTS_REFACTOR_EXECUTION_TASKBOARD_20260427.md)**: Danh sách công việc (Slices) theo từng cụm.
3. **[TRACEABILITY MATRIX](GLOBAL_SCREENER_AI_ALERTS_REFACTOR_TRACEABILITY_MATRIX_20260427.md)**: Bảng truy xuất nguồn gốc yêu cầu (Yêu cầu nào -> File code nào -> Test nào).
4. **[SELF AUDIT & TEST PROTOCOL](GLOBAL_SCREENER_AI_ALERTS_REFACTOR_SELF_AUDIT_AND_TEST_PROTOCOL_20260427.md)**: Giao thức kiểm thử sau mỗi slice.
5. **[EVIDENCE TEMPLATE](GLOBAL_SCREENER_AI_ALERTS_REFACTOR_EXECUTION_EVIDENCE_TEMPLATE_20260427.md)**: Mẫu báo cáo nghiệm thu (Evidence) sau mỗi lần commit mã nguồn.

## 4. Ranh Giới Phát Triển (Development Boundaries)
> [!WARNING]
> - **KHÔNG ĐƯỢC** thay đổi cấu trúc bảng `DailyPrice` hoặc `IntradayTick`.
> - **KHÔNG ĐƯỢC** sửa đổi các API trả về biểu đồ (Kline) hiện tại.
> - Bắt buộc phải duy trì tính tương thích ngược cho người dùng nếu API cũ chưa bị xóa hoàn toàn.

Đội ngũ thực thi vui lòng chuyển sang file **EXECUTION PLAN** để bắt đầu công việc.
