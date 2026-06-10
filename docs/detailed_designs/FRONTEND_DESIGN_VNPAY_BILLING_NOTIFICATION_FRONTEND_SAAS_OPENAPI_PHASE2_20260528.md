# Frontend Design — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Design locked for implementation
**Program Name**: `VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2`

---

## 1. Design principles

1. Giữ visual language hiện có của `packages/web`; không tạo một billing app khác tông.
2. Trạng thái giao dịch phải trung thực hơn là “đẹp”: pending phải nhìn là pending, không làm người dùng tưởng đã thành công.
3. Billing là user-facing commercial surface; notification/account copy phải rõ, pháp lý và không mập mờ.
4. Responsive-first: desktop ưu tiên bảng và panel song song; mobile ưu tiên timeline/card stack.

---

## 2. Surface inventory

### 2.1 Billing Center
**Mục tiêu**: nơi người dùng xem toàn bộ commercial posture hiện tại.

Layout đề xuất:
1. Hero strip: plan hiện tại, trạng thái subscription, invoice state, next invoice.
2. Cột trái: `SubscriptionCard`, `QuotaCard`, `PaymentActionPanel`.
3. Cột phải: `InvoiceTable` với pagination và trạng thái row.
4. Inline banner vùng trên cùng cho account-level notices như `quá hạn`, `sắp đến hạn`, `chưa thể thanh toán`.

### 2.2 Payment Return Page
**Mục tiêu**: giải thích kết quả redirect VNPay bằng server truth.

Layout đề xuất:
1. Hero status card với biểu tượng, heading, trợ giúp trạng thái.
2. Timeline ngắn: `Tạo giao dịch` -> `Chuyển hướng VNPay` -> `Đối soát trạng thái`.
3. Summary panel: `txn_ref`, `số tiền`, `thời điểm cập nhật`, `mã VNPay` nếu có.
4. Action row: `Tải lại trạng thái`, `Quay lại Billing`, `Thử thanh toán lại` theo state.

### 2.3 Notification lane cho commercial
**Mục tiêu**: chỉ thiết kế và khóa states, chưa mở code nếu backend contract thiếu.

Surface dự kiến:
1. Activity feed của billing events.
2. Preferences card theo channel/event taxonomy.
3. Delivery explanation panel, không phải operator provider config.

---

## 3. Component-level spec

### BillingSummaryStrip
1. Hiển thị 4-5 metric chính, ưu tiên `plan`, `subscription`, `next invoice`, `invoice state`, `quota risk`.
2. Dùng pill tone theo trạng thái: `active`, `past_due`, `suspended`, `trialing`.
3. Không dùng metric card cho dữ liệu chưa xác thực.

### SubscriptionCard
1. Trình bày chu kỳ hiện tại, auto-renew posture, ngày gia hạn, commercial note.
2. Nếu thiếu dữ liệu, hiển thị placeholder trung thực `Chưa có dữ liệu subscription.`.

### QuotaCard
1. Cho thấy tiêu thụ/quota risk mà không cần người dùng hiểu cấu trúc raw quota rows.
2. Khi quota API chưa đủ field, chỉ hiển thị các posture có server truth.

### InvoiceTable
1. Bảng desktop, card stack trên mobile.
2. Các cột tối thiểu: `Mã hóa đơn`, `Số tiền`, `Trạng thái`, `Đến hạn`, `Đã thanh toán`, `Tác vụ`.
3. Row-level CTA `Thanh toán` chỉ bật cho invoice open/past_due phù hợp.

### PaymentActionPanel
1. Chọn plan/payment amount theo commercial truth, không hardcode plan pricing ở UI nếu backend đã trả được state tương ứng.
2. Trước khi redirect, disable CTA và hiện tiến trình rõ ràng.

### PaymentStatusHero
1. Màu sắc theo status nhưng không được dùng green cho `pending`.
2. Có summary text ngắn gọn, giải thích hành động tiếp theo.

---

## 4. UX states chi tiết

### Billing Center
1. `loading`: skeleton cho metrics, card, table.
2. `empty`: giải thích tenant chưa có billing data hoặc chưa phát hành hóa đơn.
3. `error`: panel lỗi có request hint ngắn và CTA tải lại.
4. `past_due`: banner nổi bật, CTA quay lại thanh toán.

### Payment Return
1. `missing txn_ref`: message cứng, không retry vô hạn.
2. `pending`: giải thích giao dịch đang chờ xác nhận từ hệ thống thanh toán.
3. `success`: chúc mừng + link quay lại Billing Center.
4. `failed`: giải thích thất bại, không suy diễn nguyên nhân vượt quá dữ liệu backend trả về.
5. `not found`: hướng dẫn kiểm tra lại giao dịch hoặc quay về billing.

---

## 5. Notification UX spec

### Event groups
1. `billing_and_account`
2. `payment_status`
3. `invoice_and_due_date`
4. `quota_and_usage`

### Channel strategy
1. In-app banner/activity là channel cơ sở.
2. Email expectation chỉ là explanatory copy nếu backend chưa expose delivery state.
3. Push/webpush không được render như enabled nếu backend chưa có contract + stored preference + delivery truth.

### Anti-confusion rules
1. Không hiển thị `Đã gửi email` nếu frontend không có confirmation field từ server.
2. Không hiển thị `Bạn đã bật thông báo` nếu state đang lấy từ local toggle chưa sync server.
3. Không dùng `MailConfig` operator labels trong user-facing notification settings.

---

## 6. i18n và copy guidance

1. Tất cả copy phải đặt key riêng cho commercial domain, tránh reuse text admin.
2. Các trạng thái phải có bản dịch riêng cho `active`, `past_due`, `pending`, `failed`, `paid`, `open`, `void`.
3. Helper text mẫu:
   - `Hệ thống đang đối soát kết quả thanh toán với VNPay.`
   - `Chúng tôi chưa nhận được xác nhận cuối cùng cho giao dịch này.`
   - `Bạn có thể tải lại trạng thái hoặc quay lại trung tâm billing.`

---

## 7. Accessibility và responsive

1. Action buttons có label đầy đủ, không chỉ icon.
2. Banner và status hero dùng `role="status"` hoặc `role="alert"` tùy mức độ.
3. Mobile breakpoint phải đưa bảng hóa đơn thành stacked cards dễ scan.
4. Không dùng animation gây hiểu nhầm trạng thái nghiệp vụ; animation chỉ phục vụ chuyển trạng thái UI.

---

## 8. Design anti-patterns cấm

1. Giao diện mô phỏng “success” trước khi status endpoint trả về `success`.
2. Gắn notification toggles vào operator mail provider config.
3. Chèn commercial cards vào `settings` hoặc `operations-center` rồi coi như hoàn tất self-service billing.
4. Hiển thị plan price hardcoded nếu backend truth khác với UI labels.