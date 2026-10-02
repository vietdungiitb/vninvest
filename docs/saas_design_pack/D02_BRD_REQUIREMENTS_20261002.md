# D02 — BRD: Yêu cầu nghiệp vụ chi tiết

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** ISO/IEC/IEEE 29148:2018 · **Tài liệu trước:** D01
**Tài liệu sau:** D03

---

## 1. Quy ước viết user story

```
US-<mã>   Tôi là <vai trò>  để   <mục đích>  thì   <hành vi>
AC-<số>   Điều kiện  ⇒  Kết quả mong đợi
```

Ưu tiên: **P0** bắt buộc v1.0 · **P1** quan trọng · **P2** sau v1.0

---

## 2. Phân tích vai trò và quyền

### 2.1 Ma trận vai trò

| Chức năng | Khách Owner | Khách Admin | Khách Dev | Nhà cung cấp Ops | Product Admin | Compliance |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Xem tổng chi & hóa đơn | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| Đổi gói / gia hạn | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| Tạo / thu hồi PAT | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ |
| Thêm / xóa thành viên | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| Gán quyền cho thành viên | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| Xem nhật ký kiểm toán | ✔ | ✔ | ✘ | ✔ | ✘ | ✔ |
| Xem hạn mức sử dụng | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ |
| Gọi API quyết định quyền | ✘ | ✘ | ✔ | ✔ | ✘ | ✘ |
| Khai báo sản phẩm / tier | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ |
| Khai báo capability & meter | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ |
| Duyệt capability rủi ro cao | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| Xem toàn bộ tenant | ✘ | ✘ | ✘ | ✔ | ✔ | ✔ |
| Kích hoạt / thu hồi máy | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| Cấu hình điều khoản pháp lý | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |

### 2.2 Nguyên tắc phân quyền

| # | Nguyên tắc |
|---|---|
| 1 | `Owner` là duy nhất được đổi gói và thêm thành viên |
| 2 | Không ai tự nâng quyền cho chính mình |
| 3 | Capability `requires_approval` chỉ cấp được bởi vai trò `Compliance` |
| 4 | `Ops` không tự cấp capability rủi ro cao — phải qua `Compliance` |
| 5 | Mọi thao tác `Product Admin` và `Compliance` đều ghi audit |

---

## 3. User story và tiêu chí chấp nhận

### 3.1 Nhóm: Xác thực và phiên

---

**US-001 — Đăng ký tenant doanh nghiệp**
*Tôi là Chủ doanh nghiệp khách hàng, để có thể bắt đầu dùng dịch vụ, thì tôi đăng ký thông tin doanh nghiệp.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-001.1 | Gửi tên pháp lý, mã số thuế, email, người đại diện, hợp đồng | API trả 201, tạo tenant ở trạng thái `pending_review` |
| AC-001.2 | Mã số thuế trùng tenant đang hoạt động | Trả 409 `tax_id_duplicate` |
| AC-001.3 | Thiếu `hợp đồng` | Trả 422 `contract_required` |
| AC-001.4 | Email đã đăng ký | Trả 409 `email_registered` |
| AC-001.5 | Hoàn tất | Tenant **không** tự chuyển `active` — cần Ops duyệt |

---

**US-002 — Nhà cung cấp duyệt đăng ký**
*Tôi là Nhân viên vận hành nhà cung cấp, để không bán nhầm cho tổ chức không hợp lệ, thì tôi duyệt hồ sơ đăng ký.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-002.1 | Mở danh sách chờ | Thấy tenant kèm hồ sơ đầy đủ, sắp xếp theo thời gian |
| AC-002.2 | Duyệt kèm lý do | Tenant → `active`, ghi audit gồm người duyệt và lý do |
| AC-002.3 | Từ chối kèm lý do | Tenant → `rejected`, lý do hiển thị cho khách, ghi audit |
| AC-002.4 | Duyệt không nhập lý do | Nút bị khoá — lý do bắt buộc |
| AC-002.5 | Mọi thao tác | Ghi `audit_log` không thể xoá |

---

**US-003 — Khách tạo PAT**
*Tôi là Quản trị viên IT khách hàng, để tích hợp hệ thống của mình, thì tôi tạo khóa truy cập cá nhân.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-003.1 | Tạo với tên và ngày hết hạn | Trả token dạng plaintext **đúng một lần** |
| AC-003.2 | Hiển thị token lần hai | Trả 404 — hệ thống không lưu bản rõ |
| AC-003.3 | Ngày hết hạn trong quá khứ | Trả 422 `expiry_in_past` |
| AC-003.4 | Xem danh sách PAT | Chỉ hiện 4 ký tự cuối, không hiện token |
| AC-003.5 | Thu hồi PAT | Lệnh sau đó trả 401 `pat_revoked` |
| AC-003.6 | Người không có quyền gọi API tạo PAT | Trả 403 `forbidden` |

---

**US-004 — Xác thực bằng PAT**
*Tôi là Nhà phát triển khách hàng, để gọi API quyết định quyền, thì tôi gửi PAT trong tiêu đề Authorization.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-004.1 | PAT hợp lệ | Trả 200 kèm tenant và quyền hiện tại |
| AC-004.2 | PAT sai định dạng | Trả 401 `pat_invalid` |
| AC-004.3 | PAT hết hạn | Trả 401 `pat_expired` |
| AC-004.4 | PAT bị thu hồi | Trả 401 `pat_revoked` |
| AC-004.5 | PAT tenant bị khoá | Trả 403 `tenant_suspended` |
| AC-004.6 | Lỗi xác thực | **Không** tiết lộ PAT nào còn tồn tại |
| AC-004.7 | Xác thực thất bại | Ghi audit, không ghi giá trị token vào log |

---

**US-005 — Người dùng đăng nhập phiên web**
*Tôi là Quản trị viên IT khách hàng, để quản trị hệ thống trên trình duyệt, thì tôi đăng nhập.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-005.1 | Đúng thông tin | Phiên đăng nhập, chuyển tới bảng điều khiển |
| AC-005.2 | Sai mật khẩu | Thông báo chung — không nói sai tên đăng nhập hay sai mật khẩu |
| AC-005.3 | Quá 5 lần sai trong 15 phút | Tạm khóa, có thông báo rõ thời gian chờ |
| AC-005.4 | Bot tự động đăng ký | Turnstile chặn |
| AC-005.5 | Phiên hết hạn | Yêu cầu đăng nhập lại, không mất trang đang xem |

---

### 3.2 Nhóm: Quản lý sản phẩm và quyền

---

**US-010 — Khai báo sản phẩm mới**
*Tôi là Quản trị viên sản phẩm, để bán một phần mềm mới, thì tôi khai báo sản phẩm mà không cần nhờ kỹ sư.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-010.1 | Nhập mã, tên, loại giấy phép | Tạo sản phẩm, trạng thái `draft` |
| AC-010.2 | Khai báo `license_type` | Hệ thống ghi cảnh báo nếu `PROPRIETARY` mà chưa có giấy phép thương mại |
| AC-010.3 | Mã sản phẩm trùng | Trả 409 `product_code_duplicate` |
| AC-010.4 | Kích hoạt sản phẩm | Có thể cấp entitlement cho sản phẩm đó |
| AC-010.5 | Sản phẩm chưa kích hoạt | Cấp entitlement trả `product_retired` |

> **Đây là user story hiện thực hoá mục tiêu G3.** Không deploy, không viết migration — chỉ thao tác UI.

---

**US-011 — Khai báo capability**
*Tôi là Quản trị viên sản phẩm, để kiểm soát mức độ nguy hiểm, thì tôi gắn cờ cho từng tính năng.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-011.1 | Khai báo capability thuộc sản phẩm | Hiện trong danh mục |
| AC-011.2 | Gắn `requires_approval` | Cấp quyền phải qua Compliance |
| AC-011.3 | Gắn `is_write_capability` | UI hiện cảnh báo cho khách trước khi bật |
| AC-011.4 | Bỏ gỡ capability khỏi sản phẩm | Bị từ chối nếu đang có entitlement cấp |
| AC-011.5 | Đổi cờ của capability đang cấp | Ghi audit kèm trước/sau |

---

**US-012 — Quyết định quyền**
*Tôi là Nhà phát triển khách hàng, để không vô tình gọi tính năng ngoài quyền, thì tôi hỏi hệ thống trước khi dùng.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-012.1 | Gửi `(sản phẩm, capability)` hợp lệ | `allowed: true` kèm hạn mức còn lại |
| AC-012.2 | Chưa mua sản phẩm | `allowed: false`, `reason_code: entitlement_missing` |
| AC-012.3 | Tier không có capability | `reason_code: capability_not_granted` |
| AC-012.4 | Capability cần duyệt, chưa duyệt | `reason_code: approval_pending` |
| AC-012.5 | Vượt hạn mức | `reason_code: quota_exceeded`, HTTP 429 |
| AC-012.6 | Hết hạn giấy phép phần mềm | `reason_code: license_expired` |
| AC-012.7 | Mọi quyết định | Có `decision_id` để tra cứu ngược |
| AC-012.8 | Trả kết quả | p95 ≤ 50 ms |

> **Điểm thiết kế quan trọng:** `approval_pending` tách riêng khỏi `capability_not_granted` vì đây là **lý do pháp lý**, không phải lý do kỹ thuật. Cách xử lý hoàn toàn khác nhau.

---

**US-013 — Cấp quyền cho tenant**
*Tôi là Nhân viên vận hành, để khách mới dùng được, thì tôi cấp entitlement.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-013.1 | Cấp sản phẩm + tier | Tạo entitlement, trạng thái `active` |
| AC-013.2 | Ghi kèm phiên bản điều khoản | Lưu `legal_terms_version` tại thời điểm cấp |
| AC-013.3 | Sửa tier | Entitlement chuyển sang tier mới, ghi audit trước/sau |
| AC-013.4 | Thu hồi | `active` → `revoked`, lệnh sau trả `entitlement_missing` |
| AC-013.5 | Cấp capability rủi ro cao | Bị từ chối — yêu cầu Compliance duyệt |
| AC-013.6 | Cấp lại sau khi thu hồi | Tạo bản ghi mới, không ghi đè bản ghi cũ |

---

**US-014 — Duyệt quyền rủi ro cao**
*Tôi là Quyển duyệt pháp lý, để chỉ cấp quyền đặt lệnh cho tổ chức đủ điều kiện, thì tôi duyệt kèm hồ sơ.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-014.1 | Mở hàng chờ duyệt | Thấy hồ sơ pháp nhân + lịch sử yêu cầu |
| AC-014.2 | Duyệt kèm `legal_terms_version` | Capability được cấp, ghi người duyệt + thời điểm |
| AC-014.3 | Từ chối kèm lý do | Khách thấy lý do (đã khử thông tin nhạy cảm) |
| AC-014.4 | Duyệt cho từng khách | Mỗi khách một quyết định, không cấp hàng loạt |
| AC-014.5 | Giấy phép phần mềm chưa ký | Chặn duyệt, hiện cảnh báo |

---

**US-015 — Đo định lượng**
*Tôi là Nhà phát triển khách hàng, để không vô tình vượt hạn mức, thì tôi xem mức dùng hiện tại.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-015.1 | Xem mức dùng | Danh sách meter: đã dùng / hạn / còn lại / trạng thái |
| AC-015.2 | Hạn `-1` | Hiển thị `không giới hạn`, không tính phần trăm |
| AC-015.3 | Vượt ngưỡng cảnh báo | Nhận cảnh báo qua thông báo |
| AC-015.4 | Vượt hạn cứng | Lệnh trả 429, không ghi nhận thêm |
| AC-015.5 | Kỳ mới | Bộ đếm về 0, lịch sử kỳ trước giữ nguyên |

---

**US-016 — Kích hoạt máy**
*Tôi là Quản trị viên IT khách hàng, để kiểm soát số máy chạy phần mềm, thì tôi xem và thu hồi kích hoạt.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-016.1 | Hết số máy theo gói | Trả `activation_limit_reached`, nêu rõ số đang dùng |
| AC-016.2 | Xem danh sách kích hoạt | Có thời điểm, địa chỉ, nhãn do khách đặt |
| AC-016.3 | Thu hồi một máy | Máy đó phải xác thực lại ở lần dùng sau |
| AC-016.4 | Xóa hàng loạt | Yêu cầu xác nhận, ghi audit |

---

### 3.4 Nhóm: Khách hàng cá nhân

> Nhóm mới, bổ sung 2026-10-02 theo ADR-007. Khác biệt cốt lõi: **không qua duyệt Ops, trả tiền trước theo tháng.**

---

**US-006 — Đăng ký tài khoản cá nhân**
*Tôi là nhà phát triển cá nhân, để dùng thử phần mềm mà không phải lập doanh nghiệp, thì tôi đăng ký bằng email.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-006.1 | Gửi email + họ tên | Tạo tenant, trạng thái `active` **ngay** — không qua duyệt |
| AC-006.2 | Email đã có tài khoản cá nhân | Trả 409 `email_already_registered` |
| AC-006.3 | Không yêu cầu MST | Trường MST cho phép trống |
| AC-006.4 | Không yêu cầu hợp đồng | Không có bước tải lên hợp đồng |
| AC-006.5 | Không yêu cầu người đại diện | Không có trường này |
| AC-006.6 | Không xác minh email | Tài khoản vẫn tạo được nhưng bị giới hạn |

> **AC-006.1 là khác biệt quan trọng nhất so với US-001.** Doanh nghiệp tạo `pending_review`; cá nhân tạo `active` thẳng. Nếu cá nhân cũng phải chờ duyệt thì nhân lực vận hành không đủ ở quy mô lớn.

---

**US-007 — Giới hạn một tài khoản trên mỗi email**
*Tôi là nhà cung cấp, để mỗi email chỉ có một tài khoản cá nhân, thì tôi chặn đăng ký trùng.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-007.1 | Email đã đăng ký cá nhân | Trả 409 `email_already_registered` |
| AC-007.2 | Email đang ở tài khoản **doanh nghiệp** | **Cho phép** tạo tài khoản cá nhân — giới hạn chỉ áp dụng trong nhóm cá nhân |
| AC-007.3 | Người dùng thử tạo nhiều tài khoản | Bị chặn khi vượt ngưỡng số tenant tạo trên IP trong 24 giờ |
| AC-007.4 | Nhiều người dùng chung IP văn phòng | **Không bị chặn nhầm** — ngưỡng đặt cao |

> **AC-007.4 là điều chỉnh quan trọng.** Giới hạn theo IP thấp sẽ chặn nhầm người dùng hợp lệ ở văn phòng và mạng di động. Ưu tiên tín hiệu email hơn tín hiệu IP.

---

**US-023 — Mua gói cá nhân trả tiền trước**
*Tôi là nhà phát triển cá nhân, để dùng ngay mà không cần hợp đồng, thì tôi trả trước một tháng.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-023.1 | Chọn gói, thanh toán thành công | Entitlement kích hoạt **ngay** trong 1 phút |
| AC-023.2 | Thanh toán thất bại | Không kích hoạt, hiển thị lỗi rõ ràng |
| AC-023.3 | Giao diện thanh toán | Không yêu cầu MST, không yêu cầu địa chỉ doanh nghiệp |
| AC-023.4 | Chứng từ nhận được | **Biên nhận**, không phải hoá đơn VAT |
| AC-023.5 | Hết hạn 3 ngày | Nhận cảnh báo qua email |
| AC-023.6 | Hết hạn | Entitlement → `expired`, mọtỉ năng trả về `entitlement_expired` |
| AC-023.7 | Gia hạn | Thanh toán lại, nâng `current_period_end`, không mất cấu hình |

> **AC-023.4 là khác biệt về mặt pháp lý, không chỉ kỹ thuật.** Biên nhận không phải hoá đơn giá trị gia tăng. Ràng buộc được cài ở D06 §6.1 bằng `CHECK` trên cơ sở dữ liệu, không phải bằng kiểm tra trong giao diện.

---

**US-024 — Không dùng thẻ tín dụng**
*Tôi là nhà phát triển cá nhân, để không bị mắc nợ khi thử nghiệm, thì tôi không bị hấp dẫn bởi hình thức trả góp.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-024.1 | Xem trang thanh toán cá nhân | **Không** hiển thị lựa chọn trả góp / thẻ tín dụng |
| AC-024.2 | Hết hạn mà chưa thanh toán | Dịch vụ dừng, **không phát sinh nợ** |
| AC-024.3 | Thanh toán trễ | Chỉ có trạng thái `expired`, không có `past_due` |
| AC-024.4 | Số tiền hiển thị | Số nguyên đồng, không làm tròn |

> **AC-024.4 bám theo phát hiện D-08:** `vnpay_service.py:29` nhận `amount: float` — số thực. Tiền Việt phải là số nguyên đồng. Sai số làm tròn ở giao diện là tiền thật.

---

**US-025 — Xem sản phẩm đủ mua**
*Tôi là nhà phát triển cá nhân, để biết mình mua được gì, thì tôi xem danh mục đã lọc theo loại tài khoản.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-025.1 | Mở trang sản phẩm khi là cá nhân | Chỉ thấy sản phẩm không yêu cầu xác minh pháp nhân |
| AC-025.2 | Sản phẩm yêu cầu xác minh pháp nhân | **Không hiển thị** trong danh mục cá nhân |
| AC-025.3 | Cố gọi API cho sản phẩm không được phép | Trả 403 `product_requires_organization` |

> **Quyết định Q-16 hiện là "cá nhân mua được mọi sản phẩm", nên AC-025.2 và AC-025.3 chưa có hiệu lực.** Chúng được viết sẵn để sẵn sàng khi Owner xác nhận đề xuất loại trừ sản phẩm `requires_kyc` trong ADR-007. Nếu Q-16 giữ nguyên, chỉ cần bỏ cờ `requires_kyc` khỏi mọi sản phẩm.

---

### 3.3 Nhóm: Thanh toán và vận hành

**US-020 — Mua gói sản phẩm**
*Tôi là Chủ doanh nghiệp, để dùng đủ tính năng, thì tôi nâng gói.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-020.1 | Chọn sản phẩm + tier | Tạo hóa đơn ở trạng thái `draft` |
| AC-020.2 | Thanh toán thành công | Webhook đánh dấu `paid`, entitlement kích hoạt |
| AC-020.3 | Thanh toán thất bại | Giữ nguyên entitlement cũ, ghi nhận giao dịch lỗi |
| AC-020.4 | Bỏ giữa chừng | Hóa đơn `expired`, không cấp quyền |
| AC-020.5 | Webhook trùng lặp | Xử lý đúng một lần |
| AC-020.6 | Gia hạn | Nâng `current_period_end`, không mất quyền |

---

**US-021 — Tải hợp đồng và hóa đơn**
*Tôi là Chủ doanh nghiệp, để lưu hồ sơ kế toán, thì tôi tải tài liệu.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-021.1 | Xem danh sách | Mỗi hóa đơn có file PDF |
| AC-021.2 | Xem hợp đồng | Có phiên bản đã ký + mã băm |
| AC-021.3 | Thuế | Hiển thị đúng tỷ lệ theo loại hàng |

---

**US-022 — Bảng điều khiển vận hành**
*Tôi là Nhân viên vận hành, để biết hệ thống có vấn đề không, thì tôi xem chỉ số tập trung.*

| AC | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-022.1 | Mở bảng điều khiển | Số tenant, doanh thu, tỉ lệ từ chối, độ trễ p95 |
| AC-022.2 | Lọc theo trạng thái | Tìm tenant sắp hết hạn, đang bị khoá |
| AC-022.3 | Cảnh báo | Doanh thu giảm, tỉ lệ lỗi tăng |
| AC-022.4 | Thời gian thực | Độ trễ ≤ 5 phút |

---

## 4. Yêu cầu phi chức năng chi tiết

| Mã | Yêu cầu | Đo | Cổng QG |
|---|---|---|---|
| NFR-D01 | Quyết định quyền p95 ≤ 50 ms | Tải thật trên staging | QG-5 |
| NFR-D02 | Cổng thông tin LCP ≤ 2.5 s | Lighthouse CI | QG-5 |
| NFR-D03 | Khả dụng ≥ 99.9% | SLO công bố | QG-6 |
| NFR-D04 | RTO ≤ 1 giờ, RPO ≤ 15 phút | Diễn tập khôi phục hằng quý | QG-6 |
| NFR-D05 | OWASP ASVS L2 | Quét tự động mỗi release | QG-5 |
| NFR-D06 | WCAG 2.2 AA | Trình kiểm tra tự động + thủ công | QG-5 |
| NFR-D07 | 0 secret trong log | Kiểm tra mẫu log mỗi release | QG-5 |
| NFR-D08 | Mọi quyết định quyền truy vết được | Kiểm tra mẫu ngẫu nhiên | QG-5 |
| NFR-D09 | ≥ 1 000 tenant | Tải thật trước phát hành | QG-6 |
| NFR-D10 | Thêm sản phẩm không cần deploy | Kiểm thử staging | QG-3 |

## 5. Quy tắc nghiệp vụ (BR)

| Mã | Quy tắc |
|---|---|
| BR-01 | Một tenant chỉ có một entitlement đang hoạt động cho mỗi sản phẩm |
| BR-02 | Entitlement có hiệu lực khi trạng thái `active` **và** trong kỳ thanh toán |
| BR-03 | Capability cần duyệt chỉ được cấp khi pháp nhân đã được Compliance đánh giá |
| BR-04 | Cấp quyền luôn ghi `legal_terms_version` tại thời điểm cấp |
| BR-05 | Sửa hoặc thu hồi quyền không xoá dữ liệu lịch sử |
| BR-06 | Quyền hết hạn không tự động gia hạn v1.0 |
| BR-07 | Một khách có thể dùng nhiều sản phẩm song song |
| BR-08 | Mỗi lần tiêu thụ meter ghi kèm `decision_id` để đối chiếu |
| BR-09 | Hạn mức không giảm giữa kỳ |
| BR-10 | Sản phẩm ngừng bán vẫn giữ entitlement hiện có đến hết kỳ |
| **BR-11** | **`tenant_type` phải được gán khi tạo tenant và không đổi sau đó** |
| **BR-12** | **Chỉ `organization` được cấp entitlement cho sản phẩm `requires_kyc = true`** |
| **BR-13** | **Chỉ `organization` được phát hành hoá đơn VAT; cá nhân nhận biên nhận** |
| **BR-14** | **Mỗi email tối đa 1 tài khoản cá nhân** |
| **BR-15** | **Cá nhân không có trạng thái `past_due` — chỉ `expired`** |
| **BR-16** | **Chỉ `organization` phải tải lên hợp đồng khi đăng ký** |

> **BR-12 là ranh giới pháp lý.** Theo phản biện trong ADR-007, nếu cá nhân mua được `brokerage.place_order` thì quy trình `US-014` không có phê duyệt hợp lệ nào — vì cá nhân không có người đại diện theo pháp luật. BR-12 đang chờ Owner xác nhận; nếu Q-16 giữ nguyên thì đặt `requires_kyc = false` cho mọi sản phẩm.
>
> **BR-15 là hệ quả của ADR-008:** không có hạn mức tín dụng nên không có khả năng "quá hạn nhưng chưa trả".

## 6. Ma trận truy vết yêu cầu

| Yêu cầu PRD | User story | Kiểm thử |
|---|---|---|
| FR-01 | US-004 | TC-AUTH-01..07 |
| FR-02 | US-012 | TC-ENT-01..08 |
| FR-03 | US-012 | TC-ENT-02..06 |
| FR-04 | US-002, 013, 014 | TC-AUD-01..05 |
| FR-05 | US-015 | TC-MET-01..05 |
| FR-06 | US-012, 015 | TC-MET-03,04 |
| FR-07 | US-020 | TC-BIL-01..06 |
| FR-08 | US-010 | TC-PRD-01..05 |
| FR-09 | US-014 | TC-CMP-01..05 |
| FR-10 | US-021 | TC-SRF-01..03 |
| FR-11 | — | TC-NTF-01..03 |
| FR-12 | US-022 | TC-OPS-01..04 |

### 6.1 Yêu cầu nhóm cá nhân

| Yêu cầu PRD | User story | Kiểm thử |
|---|---|---|
| FR-01 (đăng ký tự phục vụ) | US-006 | TC-IND-01..06 |
| FR-01 (giới hạn email) | US-007 | TC-IND-07..10 |
| FR-07 (trả trước) | US-023 | TC-IND-11..17 |
| FR-07 (không thẻ tín dụng) | US-024 | TC-IND-18..21 |
| FR-08 (lọc sản phẩm) | US-025 | TC-IND-22..24 |

**Điểm cần chú ý:** FR-11 (thông báo hết hạn) **chưa có user story**. Đề xuất bổ sung ở D03 hoặc hạ xuống P2. Ghi nhận đây là khoảng trống của bản PRD hiện tại.

---

## 7. Yêu cầu chưa làm rõ cần Owner quyết

| # | Câu hỏi | Ảnh hưởng |
|---|---|---|
| Q-07 | Hạn mức mỗi tier cụ thể bao nhiêu? | BR-09, TC-MET |
| Q-08 | Khi khách đổi tier tăng giữa kỳ, tính tiền thế nào? | AC-020.6 |
| Q-09 | Có cho phép nhiều PAT đồng thời không? Giới hạn? | US-003 |
| Q-10 | Kích hoạt máy tính theo gì: thiết bị, IP, hay cả hai? | US-016 |
| Q-11 | Hợp đồng điện tử có giá trị pháp lý không cần chữ ký? | AC-021.2 |
| Q-12 | Chu kỳ tính cước: tháng, quý, hay năm? | US-020 |

---

**Cổng chất lượng:** QG-2 — cần chốt 6 câu hỏi Q-07..Q-12 trước khi vào thiết kế chi tiết.
**Tài liệu sau:** D03 — Quy trình nghiệp vụ