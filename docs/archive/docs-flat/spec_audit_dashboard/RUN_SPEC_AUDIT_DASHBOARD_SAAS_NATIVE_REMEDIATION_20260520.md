# RUN SPEC AUDIT — Dashboard SaaS Native Remediation

**Ngày**: 2026-05-20  
**Mục đích**: Spec audit checklist kiểm định sự tuân thủ nghiêm ngặt hiến chương chất lượng VNInvest (Quality Constitution), ngăn chặn regression, và bảo toàn tính cô lập module.

---

## 1. Spec audit — Ràng buộc kiến trúc (Architectural Constraints)

| # | Ràng buộc kỹ thuật | Cách kiểm định | Kết quả mong đợi |
|---|---|---|---|
| 1 | **JSX-Free in Core Packages** | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "<|/>"` | 0 active usages (Không dùng thẻ XML JSX). |
| 2 | **Package Isolation Compliance** | Soát code imports đầu file `DashboardPage.js` | Không import trực tiếp từ `frontend/src/*`. Không sử dụng Context frontend trực tiếp. |
| 3 | **i18n Host Prop Injection** | Soát code `DashboardPage.js` | Sử dụng prop `t` được Host Shell inject truyền vào để dịch text, không import `useI18n`. |

---

## 2. Spec audit — Ràng buộc chất lượng (Quality & Functional Constraints)

| # | Ràng buộc chất lượng | Cách kiểm định | Kết quả mong đợi |
|---|---|---|---|
| 1 | **Stable Set Semantics Token** | Đổi ngẫu nhiên thứ tự các mã cổ phiếu trong holdings hoặc watchlist/watchlists | `readyToken` sinh ra giữ nguyên chuỗi ổn định, không gây rebind WebSocket. |
| 2 | **Degraded-State Visibility** | API technicals bulk trả về lỗi hoặc timeout | Expose `technicalsStatus` ra ngoài với status `failed` và errorCode `[ERR_CORE_BULK_TECHNICAL_03]`. |
| 3 | **Anti-Flicker Hydration Lifecycle** | Tải trang với danh mục rỗng và bấm làm mới | Skeleton chỉ hiển thị ở lần đầu tiên (Initial Load). Không xuất hiện ở các lần refresh sau nhờ cờ `hasHydrated`. |
| 4 | **Selected Session Sync Phasing** | Kiểm duyệt code mapping của Slice 4 | Tách biệt rõ ràng Pha A (Page/Host Contract) và Pha B (Component Target Props) kèm theo rollback strategy. |

---

## 3. Spec audit — Chữ ký hoàn thành kiểm định

- **Người thực hiện Audit**: Antigravity AI Assistant
- **Ngày thực hiện**: 2026-05-20
- **Trạng thái tuân thủ**: `COMPLIANT`
- **Ý kiến bổ sung**: Không tìm thấy bất kỳ dấu hiệu JSX nào trong packages/web. Quá trình inject translation prop `t` hoạt động hoàn hảo. Đảm bảo cô lập module và không phát sinh rebind WebSocket.

