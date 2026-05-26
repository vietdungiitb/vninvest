# CODE QUALITY CONSTITUTION — Dashboard Information Architecture Redesign

## 1. Purpose

Chất lượng của workstream này không được định nghĩa bằng việc “layout nhìn đẹp hơn”.  
Chất lượng ở đây nghĩa là dashboard giúp user đọc nhanh hơn, ít bị nhiễu hơn, và đi từ overview sang action với ít ma sát hơn.

Redesign chỉ đạt chuẩn khi:

1. `Workstation` non-mobile thật sự là 1 hàng 3 cột đều với `Heatmap` ở cột giữa, còn `Classic` non-mobile vẫn giữ `Heatmap` full-width ở hàng đầu.
2. Alert duplication bị loại bỏ, không còn 2–3 block cùng nói về một lớp tín hiệu.
3. FactsFirst deck được cấp đủ bề ngang để trở thành workspace chính.
4. Package-host route và live route không drift bố cục.
5. Frontend thay đổi không ép backend phát sinh contract mới vô cớ.

---

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Desktop IA hierarchy | 95% | Đây là giá trị cốt lõi của redesign |
| Alert deduplication | 95% | Trùng lặp tín hiệu là pain point chính |
| Full-width deck usability | 90% | Deck là nơi user thao tác sau khi scan |
| Package-host parity | 90% | Tránh future regression khi route swap |
| Responsive behavior | 85% | Tablet/mobile không phải design driver chính nhưng vẫn phải usable |

---

## 3. Coverage theater prevention

Những thứ sau **không** được tính là bằng chứng chất lượng:

1. Chỉ có screenshot đẹp nhưng vẫn để `StickyAlertBar` mount.
2. Chỉ ép `Workstation` thành 3 cột bằng CSS nhưng làm `Classic` mất bố cục `Heatmap` hàng trên, hoặc vẫn để `ModernSidebar` tồn tại như cũ.
3. Chỉ tăng chiều ngang deck nhưng không kiểm tra empty state, toolbar, table clipping.
4. Chỉ sửa `ModernDashboard` mà bỏ `PackageDashboardHost` / `DashboardPage` drift.
5. Chỉ pass build mà không có smoke screenshots ở các viewport chính.

---

## 4. Fitness-to-purpose scenarios

### Scenario Q1 — Mode split nominally done nhưng layout truth vẫn sai

What can go wrong:
- `Workstation` nominally là 3 cột nhưng độ rộng không đều, hoặc `Classic` lại bị kéo thành 1 hàng 3 cột ngoài ý muốn.

How to verify:
- 1440px/1024px smoke cho cả `Workstation` lẫn `Classic`, kèm compare panel widths/heights.

### Scenario Q2 — Alert duplication còn sót

What can go wrong:
- `StickyAlertBar` biến mất nhưng `ModernSidebar` live stream vẫn lặp event domain từ `UnifiedAlertCenter`.

How to verify:
- Search component tree và browser smoke với feed có nhiều alerts.

### Scenario Q3 — Deck full-width nhưng UX không tốt hơn

What can go wrong:
- Wrapper full-width nhưng bảng/tabs vẫn constrained hoặc double-scroll khó dùng.

How to verify:
- Mở tab overview / technical, check table width + pagination + empty state.

### Scenario Q4 — Future route parity drift

What can go wrong:
- `ModernDashboard` đã đẹp nhưng `PackageDashboardHost` vẫn theo contract cũ; sau route swap user lại thấy dashboard cũ.

How to verify:
- Compare both surfaces against same IA checklist trước khi close.

---

## 5. Hard rules for implementers

1. Không thêm fetch mới chỉ để làm layout mới “giàu dữ liệu hơn”.
2. Không giữ lại `StickyAlertBar` hoặc `ModernSidebar` vì lý do “phòng trường hợp”.
3. Không dùng `renderBubble` như cái cớ để tránh thiết kế AI lane đúng nghĩa.
4. Không merge nếu chưa có bằng chứng parity route.
5. Không merge nếu thiếu update `CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.

## 6. SaaS native / OpenAPI non-negotiables

1. Không có nghiệm thu nào hợp lệ nếu dashboard cuối cùng vẫn neo vào kiến trúc `ModernDashboard + apiClient + legacy /api path`.
2. Không có nghiệm thu nào hợp lệ nếu package-host route vẫn stale hoặc không phản ánh layout/logic mới.
3. Nếu backend contract bị thay đổi, phải qua OpenAPI constitution và PR gate checklist; không có “quick patch” vào monolith legacy.
4. Không được giữ lại legacy monolith như fallback vĩnh viễn rồi gọi đó là migration hoàn thành.

### Failure scenarios mới cần block

#### Scenario Q5 — Redesign đẹp nhưng sai đích kiến trúc

What can go wrong:
- Team làm đẹp `ModernDashboard` rất tốt nhưng không cập nhật `PackageDashboardHost` / `DashboardPage`. Khi route swap quay lại, UI regress hoặc mất toàn bộ IA mới.

How to verify:
- Route parity screenshot + slot contract audit.

#### Scenario Q6 — Lén tạo đường backend/legacy để “chạy nhanh”

What can go wrong:
- Đội code thêm endpoint mới ở `backend/` legacy hoặc giữ `/api` compat route như dependency chính cho dashboard mới. Nhìn bề ngoài feature xong nhưng kiến trúc SaaS native bị phá.

How to verify:
- Diff review backend paths + OpenAPI checklist review.
