# Kế hoạch triển khai: Cấu hình Nguồn Prompt AI Advisory (Runtime)

## 1. Mục tiêu
Nâng cấp module **AI Advisory** để cho phép người dùng tùy chỉnh các nguồn dữ liệu đầu vào (Prompt Sources) và khoảng thời gian lấy dữ liệu (Lookback period) ngay tại giao diện `StockDetails`. Việc này giúp cá nhân hóa phân tích AI và tối ưu hóa độ chính xác của kết quả.

> [!IMPORTANT]
> Canonical contract duy nhất cho schema/rules/migration của runtime config được chốt tại `docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md`.
> Toàn bộ thiết kế và coding phải bám contract này.

## 2. Các nguồn dữ liệu đề xuất (8 Nguồn)

| ID Nguồn | Tên hiển thị | Mặc định | Khoảng Lookback | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `whale` | Whale Activity | BẬT | 1 - 365 Ngày | Lệnh lớn và dòng tiền cá mập. |
| `dark_flow` | Dark money flow | BẬT | 1 - 365 Ngày | Tín hiệu dòng tiền ngầm (Iceberg, Absorption). |
| `technical` | Phân tích kỹ thuật | BẬT | 1 - 180 Phiên | RSI, MA20/50, Bollinger, Vols, Prices, CDMS... |
| `news` | Tin tức & Tâm lý | BẬT | 1 - 30 Ngày | Tóm tắt tin tức AI và điểm tâm lý. |
| `market` | Bối cảnh thị trường | BẬT | 1 - 30 Ngày | Trạng thái phiên và lịch sử khuyến nghị AI. |
| `fundamental` | Sức khỏe tài chính | TẮT | Gần nhất / Quý | Chỉ số P/E, P/B, Tài sản, Nợ, Doanh thu. |
| `ownership` | Cơ cấu cổ đông | TẮT | 1 - 365 Ngày | Giao dịch nội bộ, tỷ lệ sở hữu tổ chức. |
| `sector` | So sánh ngành | TẮT | 1 - 180 Phiên | Hiệu suất tương quan với ngành/VNIndex. |

---

## 3. Kiến trúc Backend (Django)

### A. Mở rộng Helper
- **Tệp**: `backend/portfolio/ai_advisory_helpers.py`
- **Hành động**:
    - Refactor hàm `_sprint17_generate_executive_synthesis_with_ai` để nhận thêm object `config`.
    - Cập nhật các hàm `_build_..._context_for_prompt` để nhận tham số `lookback_days` hoặc `lookback_sessions`.
    - Xây dựng 3 hàm context mới: `_build_fundamental_context`, `_build_ownership_context`, `_build_sector_context`.

### B. Cập nhật API Endpoint
- **Tệp**: `backend/portfolio/views_ai_advisory_session.py`
- **Endpoint**: `POST /api/portfolio/regenerate-executive-summary/`
- **Logic**: Tiếp nhận `prompt_config` từ body request và chuyển xuống lớp helper.

---

## 4. Kiến trúc Frontend (React)

### A. Giao diện Cấu hình
- Thêm nút **"Cấu hình AI"** (Icon Gear) tại khu vực nâng cao của StockDetails Advisory.
- Hiển thị **Settings Drawer** (Thanh bên) bao gồm:
    - Danh sách 8 Switch (Bật/Tắt) cho từng nguồn.
    - Thanh trượt (Slider) cho khoảng thời gian (chỉ hiện khi nguồn đó đang Bật).
    - Nút "Khôi phục mặc định".

### B. Quản lý Trạng thái
- Lưu cấu hình vào `localStorage` của trình duyệt để duy trì trạng thái khi người dùng chuyển mã cổ phiếu.

---

## 5. Kế hoạch xác thực (Verification)
- **Kiểm thử Unit**: Đảm bảo các Context Block không xuất hiện trong Prompt nếu bị tắt.
- **Kiểm thử Tích hợp**: Gửi payload config giả lập từ Postman và kiểm tra kết quả AI trả về trong `AIAdvisoryTrace`.
- **Kiểm tra UI**: Đảm bảo thanh trượt giới hạn đúng khoảng 1-365 ngày.

---

## 6. Nguyên tắc triển khai bắt buộc: Single Source of Truth (SSOT)

Do AI Advisory được tái sử dụng ở nhiều module, kế hoạch triển khai bắt buộc tuân thủ kiến trúc một nguồn sự thật duy nhất.

### A. Mục tiêu SSOT
- Tránh phân mảnh logic AI Advisory giữa các module.
- Triển khai một lần, tái sử dụng toàn hệ thống.
- Khi đổi quy tắc nguồn/chỉ báo, toàn bộ module nhận hiệu lực đồng thời.

### B. Workstream kỹ thuật bắt buộc
1. **Tạo service lõi dùng chung**
    - Xây `AdvisoryPromptRuntimeService` (hoặc tên tương đương) làm đầu mối duy nhất cho validate/normalize/build context.
2. **Chuẩn hóa schema dùng chung**
    - Một serializer contract chung cho mọi nơi gọi regenerate AI advisory.
    - Module cũ đi qua compatibility adapter thay vì viết nhánh xử lý riêng.
3. **Tạo source registry trung tâm**
    - Khai báo tập trung default, lookback range/unit, technical indicators metadata.
    - Frontend và backend cùng bám registry này.
4. **Migration và de-dup liên module**
    - Rà toàn bộ module đang gọi AI advisory, chuyển về service lõi.
    - Loại bỏ helper trùng lặp sau khi migrate xong.

### C. Tiêu chí hoàn thành SSOT
- Không còn duplicate prompt builder ngoài service trung tâm.
- Các module sử dụng AI advisory đều gọi cùng interface chuẩn.
- Có regression tests liên module xác nhận cùng config cho hành vi giống nhau.
- CI có kiểm tra phát hiện helper AI advisory bị duplicate ngoài vùng chuẩn.

---

## 7. Gate trước coding (bắt buộc xác nhận)
- [x] Đã chốt Spec + Plan + Canonical contract.
- [x] Đã chốt migration map endpoint legacy/canonical.
- [x] Đã chốt source registry và validation rules.
- [ ] Chờ xác nhận chính thức từ chủ dự án để bắt đầu coding.

> [!NOTE]
> Báo cáo chi tiết kỹ thuật (Technical Spec) được lưu tại `docs/SPEC_AI_ADVISORY_RUNTIME_PROMPT_CONFIG_20260418.md`.
