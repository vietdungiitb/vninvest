# OPEN CORE DOCUMENTATION AUDIT REPORT (2026-04-18)

Báo cáo này đánh giá mức độ sẵn sàng, tính nhất quán và các rủi ro tồn tại trong bộ tài liệu Open Core của VNInvest sau đợt cập nhật ngày 18/04/2026.

## 1. Tóm tắt kết quả (Executive Summary)

Việc cập nhật bộ tài liệu từ OC-14 đến OC-21 đã tạo ra một "Governance Reset" cần thiết. Tuy nhiên, vẫn tồn tại sự mâu thuẫn giữa các tài liệu cũ (đầu tháng 4) và tài liệu chiến lược mới (18/04).

- **Trạng thái tổng thể:** **CONDITIONAL READY** (Sẵn sàng có điều kiện cho giai đoạn Hardening, chưa sẵn sàng cho Public Launch).
- **Điểm sáng:** Đã xác lập rõ ranh giới giữa Private Docs và Public Docs (OC-17).
- **Điểm yếu:** Quota và Mapping giữa Business Package và Runtime Plan vẫn còn độ lệch (Drift).

---

## 2. Kết quả Audit Chi tiết

### 2.1 Tính nhất quán Kỹ thuật (Technical Alignment)
- **Quota Unit:** Có sự không đồng nhất giữa `OPEN_CORE_05` (theo ngày) và thực tế Runtime backend (theo tháng). OC-15 đã ghi nhận rủi ro này nhưng chưa chốt con số Canonical cuối cùng.
- **Boundary Matrix:** OC-05 là bảng nháp tốt, nhưng cần được cập nhật để khớp chính xác với `PREMIUM_INDICATORS` định nghĩa trong `backend/portfolio/opencore_premium.py`.
- **API Weights:** Các tài liệu chiến lược chưa đề cập đến trọng số API (api_weight), trong khi code thực tế đã bắt đầu tính toán quota dựa trên độ nặng của request.

### 2.2 Quản trị Repository (Repo Governance)
- **Mirroring Strategy:** OC-14 và Master Strategy đã mô tả rõ mô hình Mirroring. Đây là phương án tối ưu để giải quyết bài toán "Code once, push twice".
- **Hệ thống Entitlement:** Tài liệu và Code (DPI) đã có sự đồng bộ cao. Tuy nhiên, logic "Hybrid Intelligence" (chạy AI trên SaaS) cần được mô tả rõ hơn trong kiến trúc để tránh user self-host kỳ vọng có thể chạy AI offline.

### 2.3 Quản trị Tài liệu (Docs Governance - OC-17)
- **Phân tách Private/Public:** Đã đạt được sự đồng thuận cao. Thư mục `docs/` hiện tại là PRIVATE.
- **Missing Link:** Chưa có quy trình tự động hóa việc trích xuất "Public Docs" từ "Private Docs" (Bản sanitize).

---

## 3. Danh sách Rủi ro (Risk Analysis)

| Rủi ro | Mức độ | Hành động khắc phục |
| :--- | :--- | :--- |
| **Leakage (Rò rỉ)** | Cao | Đảm bảo script Mirror không copy thư mục `docs/`. |
| **Outdated Docs** | Trung bình | Đánh dấu "OBSOLETE" cho các file đầu tháng 4 (như OC-02 v1, OC-04). |
| **Quota Drift** | Thấp | Cập nhất lại OC-11 (Numeric Lock Sheet) để khớp với code Backend. |

---

## 4. Khuyến nghị Tiếp theo (Recommendations)

1. **Khóa thông số (Hardening):** Chốt 5 câu hỏi còn treo tại Mục 6 của OC-15.
2. **Làm sạch tài liệu cũ:** Chuyển các tài liệu từ OC-01 đến OC-10 (trừ OC-05) vào thư mục `docs/archived/` hoặc đánh dấu `[DEPRECATED]` ở header để tránh gây nhầm lẫn khi tra cứu.
3. **Phê duyệt OC-19:** Chính thức áp dụng OC-19 (Team Governance Policy) làm tiêu chuẩn cho mọi PR liên quan đến Open Core.
4. **Triển khai Script mẫu:** Viết script `tools/mirror_core.sh` (mô phỏng) để kiểm chứng khả năng tách code tự động như đã đề xuất.

---
**Người thực hiện Audit:** Antigravity (AI Coding Assistant)  
**Ngày hoàn thành:** 18/04/2026
