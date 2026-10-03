# RUN CODE REVIEW — Dashboard SaaS Native Remediation

**Ngày**: 2026-05-20  
**Mục đích**: Danh mục kiểm duyệt code tích hợp phản biện kỹ thuật vòng 2, ngăn chặn regression và rebind churn.

---

## 1. Review checklist — Slice 1 & Slice 5: Cô lập lỗi & i18n Isolation

| # | Hạng mục kiểm tra | Phương pháp | Kết quả mong đợi |
|---|---|---|---|
| 1 | API technicals bulk cô lập bằng try-catch cục bộ | Soát code `useCoreDashboardData.js` | Có khối try-catch riêng quanh dòng gọi API. |
| 2 | Trạng thái lỗi tuân thủ bảng mã lỗi DataOps | Soát code hook | Lỗi Phase 1 trả `[ERR_CORE_PORTFOLIO_SUMMARY_01]` / `[ERR_CORE_PORTFOLIO_HOLDINGS_02]`. Lỗi Phase 2 trả `[ERR_CORE_BULK_TECHNICAL_03]`. |
| 3 | i18n sử dụng Dependency Inversion (Host Injection) | Soát code `DashboardPage.js` | Nhận prop `t` từ Host, không import trực tiếp Context frontend. |

---

## 2. Review checklist — Slice 2 & Slice 4: Stable Ready Token & Tương tác chéo

| # | Hạng mục kiểm tra | Phương pháp | Kết quả mong đợi |
|---|---|---|---|
| 1 | `collectUniqueSortedSymbols` có deduplicate + sort và bao phủ cả **watchlists** | Soát code helper | Sắp xếp alphabet ổn định, gom đủ 4 nguồn holdings + trackedSymbols + watchlists + watchlistGroups. |
| 2 | Loại bỏ so sánh tham chiếu mảng nghiêm ngặt `holdings !== prevHoldingsRef.current` | Soát code | Sử dụng `readyToken` chuẩn hóa làm biến delta so sánh. |
| 3 | Tương tác chéo Selected Session tuân thủ Delivery Gates | Soát kế hoạch/code | Pha A định hình contract ở Page/Host; Pha B cập nhật target component props. |

---

## 3. Review checklist — Slice 3 & Slice 6: Hydration Lifecycle & Kiểm thử UI

| # | Hạng mục kiểm tra | Phương pháp | Kết quả mong đợi |
|---|---|---|---|
| 1 | Trạng thái `hasHydrated` được tích hợp vào lifecycle nạp | Soát code | Mặc định `false`, chuyển thành `true` ngay khi Phase 1 hoàn tất lần đầu. |
| 2 | Skeleton chỉ hiển thị khi `loading && !hasHydrated` | Soát code | Ngăn chặn hoàn toàn việc vẽ skeleton khi refresh/polling ngầm. |
| 3 | File test UI-lifecycle được tạo mới và chạy thành công bằng Jest | Soát code test | Tải file mới `packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js` và chạy Jest. |

---

## 4. Chữ ký xác nhận của Reviewer

- **Họ và tên Reviewer**: Antigravity AI Coding Assistant
- **Ngày duyệt**: 2026-05-20
- **Kết quả đánh giá**: `PASS`
- **Ý kiến ghi chú**: Toàn bộ code đã vượt qua 100% checklist, cô lập lỗi tốt, deduplicate readyToken Set hoạt động trơn tru và pass 5/5 Jest test case.

