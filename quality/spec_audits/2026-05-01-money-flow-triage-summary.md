# SPEC AUDIT TRIAGE SUMMARY - Money Flow Control Center and Data Lifecycle
**Date:** 2026-05-01
**Auditors:** Council of Three (Simulated AI Session)
**Target:** Money Flow Control Center & Data Lifecycle Specification Pack

## 1. Mục tiêu Audit
Thực hiện rà soát chéo (Spec Audit) trên 13 tài liệu kiến trúc thuộc gói `Money Flow Control Center Data Lifecycle` dựa theo chuẩn chất lượng `QUALITY.md` và protocol `RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`.

## 2. Kết quả Triage (Đã tổng hợp từ 3 góc độ)

### 🔴 P1 - Rủi ro nghiêm trọng (Cần update Spec ngay)

#### 1. Lỗi bỏ lọt Stale Cache sau Recompute (Auditor B)
- **Vị trí:** `TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`, mục 4.6 (Backfill and recompute).
- **Phát hiện:** Spec quy định L4 Hot Snapshots có TTL lên tới 24h, nhưng luồng recompute/backfill không hề đề cập đến bước **Cache Invalidation**. 
- **Tác động:** Khi chạy job recompute dữ liệu sai, facts ở L2/L3 được cập nhật nhưng cold path `whale-alerts/:symbol` vẫn sẽ hit L4 cache và trả về stale data đến 24h. Hệ thống có vẻ đã sửa nhưng user vẫn thấy số liệu cũ.
- **Khuyến nghị:** Bổ sung bước "Force invalidate L4 caches for affected symbol/session" vào pipeline BE-4.3 (Purge & Recompute orchestration).

#### 2. Vi phạm Governance do Write-Through Bypass (Auditor A)
- **Vị trí:** `TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`, mục 5.2 (Zone semantics - Whale Governance).
- **Phát hiện:** Spec yêu cầu hành vi "write-through sang whale mission-control". Tuy nhiên, không ghi rõ là write-through tạo *Pending Version* hay *Overwrite Active Version*. 
- **Tác động:** Nếu write-through từ Control Center trực tiếp override active version, chúng ta sẽ vô tình bypass luồng approval của whale mission-control.
- **Khuyến nghị:** Bổ sung ràng buộc: "Write-through API (BE-5.3) chỉ được phép tạo Draft/Pending config, không được tự động Apply/Publish nếu thiếu explicit approval từ mission-control".

#### 3. UX gãy do phân quyền Link-out (Auditor C)
- **Vị trí:** `TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`, mục 5.3 (Read-only link-out rules).
- **Phát hiện:** Việc link-out tới `Data Ops` để sửa raw retention là đúng về SSOT, nhưng thiếu xét đến quyền của Operator.
- **Tác động:** Nếu Operator của Control Center không có role `Data Ops`, việc bấm link-out sẽ dẫn tới trang 403. Việc này gây đứt gãy luồng vận hành.
- **Khuyến nghị:** UI phải kiểm tra quyền trước khi render link. Nếu không có quyền, render text dạng disabled + badge `Requires Data Ops permission` thay vì link chết.

### 🟡 P2 - Rủi ro logic (Cần rào chắn kỹ thuật)

#### 4. Phantom Writes do API cũ vẫn mở (Auditor A)
- **Vị trí:** `TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`, Task BE-1.2.
- **Phát hiện:** Yêu cầu "chuẩn hóa deprecation semantics" nhưng chưa nhấn mạnh việc chặn API. Việc chỉ demote/hide trên Frontend (FE-6.5) là không đủ.
- **Tác động:** Các script automation cũ hoặc tab trình duyệt cũ vẫn có thể gọi thẳng vào API của `Signal Control Center` để sửa knob đã bị deprecate, tạo ra "phantom writes".
- **Khuyến nghị:** Backend phải return `400 Bad Request` hoặc `403 Forbidden` với message chỉ định chuyển hướng đối với các POST/PUT request vào config cũ.

#### 5. Purge Deadlock do Data Gaps (Auditor B)
- **Vị trí:** `TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`, mục 4.5 (Retention and cleanup).
- **Phát hiện:** Điều kiện để purge là "completeness đạt chuẩn". Nhưng nếu Provider bị sập làm khuyết data vĩnh viễn, completeness sẽ vĩnh viễn < 100%.
- **Tác động:** Purge job (L0) bị block vô thời hạn, ổ cứng đầy vì raw data không được xóa.
- **Khuyến nghị:** Thêm cơ chế `Force Purge Override` trên Control Center, hoặc TTL fallback (ví dụ: quá 14 ngày tự động purge bất chấp completeness).

### 🔵 QUESTION / Cần làm rõ

#### 6. Vật lý hóa Forensic Carve-out (Auditor B & A)
- **Vị trí:** `TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`, mục 3.1 & 4.5.
- **Nghi vấn:** Việc "carve-out" dữ liệu vào `MoneyFlowForensicWindow` (L5) là copy dữ liệu vật lý sang một table độc lập, hay chỉ là gắn cờ (tag) `is_forensic=True` trên bảng raw (L0)?
- **Rủi ro:** Nếu chỉ gắn cờ trên bảng raw (L0), khi DB chạy lệnh `DROP PARTITION` để xóa raw sau 7 ngày, dữ liệu L5 cũng sẽ bị xóa sạch dù policy là 90 ngày. Bắt buộc phải là physical copy/move sang L5 table.

## 3. Khuyến nghị Rollout & Next Steps

1. **Tech Lead / PO:** Duyệt 3 vấn đề P1 và đưa thẳng vào Spec / Taskboard.
2. **Backend Lead:** Cập nhật lại Task BE-4.3 để xử lý invalidate cache, và BE-1.2 để hard-block API cũ.
3. **Frontend Lead:** Cập nhật thiết kế UI/UX tại FE-6.5 cho case Permission Denied.

**Kết luận Audit:** BỘ TÀI LIỆU CẦN UPDATE FIX CÁC LỖI P1 TRƯỚC KHI CHO PHÉP BẮT ĐẦU CODING (NO-GO for implementation until spec is patched).

## 4. Trạng thái sau phản biện

- Stale cache sau recompute được khóa lại ở TECH_SPEC mục 4.5-4.6, TASKBOARD `BE-4.3`, TRACEABILITY `MFC-12`.
- Whale write-through được siết thành pending/draft bridge có approval/rollout proof ở TECH_SPEC mục 5.2-5.3, TASKBOARD `BE-5.3`, TRACEABILITY `MFC-13`.
- Link-out tới `Data Ops` / `Vnbroker Config` được permission-gate ở TECH_SPEC mục 5.3, TASKBOARD `FE-6.5`, TRACEABILITY `MFC-15`.
- Phantom writes, purge deadlock và forensic carve-out đã được map vào deprecation hard-block, bounded override và physical carve-out trong các tài liệu core/quality liên quan.
- Trạng thái implementation vẫn là NO-GO cho đến khi các docs đã vá này được review/approve lại và evidence/test slices tương ứng được chạy.
