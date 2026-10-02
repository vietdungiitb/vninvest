# D03 — Quy trình nghiệp vụ

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** BPMN 2.0 (OMG) · **Tài liệu trước:** D02 · **Tài liệu sau:** D04

---

## 1. Danh mục quy trình

| Mã | Quy trình | Tác nhân | Kết quả | Tần suất |
|---|---|---|---|---|
| BP-01 | Vòng đời đăng ký tenant | Khách → Ops | Tenant hoạt động | Khi có khách mới |
| BP-02 | Quyết định quyền | SDK → Hệ thống | Quyết định + ID tra cứu | Hàng triệu lần/ngày |
| BP-03 | Khai báo sản phẩm mới | Product Admin | Sản phẩm bán được | Khi thêm sản phẩm |
| BP-04 | Cấp quyền rủi ro cao | Ops → Compliance | Capability được cấp | Khi khách mua tier C |
| BP-05 | Mua và gia hạn gói | Khách → Cổng thanh toán | Entitlement kích hoạt | Khi khách mua |
| BP-06 | Quản lý hạn mức | Hệ thống tự động | Chặn hoặc cảnh báo | Tự động |
| BP-07 | Đăng ký kích hoạt máy | SDK → Hệ thống | Máy được cấp slot | Lần đầu mỗi máy |
| BP-08 | Thu hồi quyền | Ops | Quyền chấm dứt | Khi vi phạm |
| BP-09 | Xử lý sự cố vận hành | Ops | Phục hồi dịch vụ | Khi có sự cố |
| **BP-10** | **Đăng ký khách hàng cá nhân** | **Cá nhân → Hệ thống** | **Tenant tự phục vụ** | **Khi có người dùng mới** |

---

## 2. BP-01 — Vòng đời đăng ký tenant

### 2.1 Mức độ 0 — Khung

```
Khách hàng          Cổng thông tin       Hệ thống            Nhân viên vận hành
     │                    │                 │                        │
     │ ① Nộp hồ sơ       │                 │                        │
     ├───────────────────►│ ② Kiểm tra     │                        │
     │                    │   hồ sơ        │                        │
     │                    ├────────────────►│ ③ Lưu, trạng thái     │
     │                    │                 │   pending_review      │
     │ ④ Nhận thông báo   │◄────────────────┤                        │
     │◄───────────────────┤                 │                        │
     │                    │                 │ ⑤ Duyệt hồ sơ        │
     │                    │                 │◄───────────────────────┤
     │                    │                 │                        │
     │ ⑦ Đăng nhập,      │                 │ ⑥ Nhận quyết định     │
     │   tạo PAT          │                 │                        │
     │◄───────────────────┴─────────────────┤                        │
```

### 2.2 Mức độ 1 — Hoạt động chi tiết

```
[Khách]                [Hệ thống]              [Ops]              [Kho giấy phép]
    │                      │                      │                     │
    │ 1. Nộp tên PL, MST, │                      │                     │
    │    email, HĐ, người │                      │                     │
    │    đại diện         │                      │                     │
    ├────────────────────►│                      │                     │
    │                      │ 2. Kiểm tra: MST     │                     │
    │                      │    trùng? thiếu HĐ?  │                     │
    │                      │                      │                     │
    │              ┌───────┴───────┐              │                     │
    │              │ Không hợp lệ  │ Hợp lệ      │                     │
    │◄─────────────┘               │              │                     │
    │ 3. Trả 422/409                ├────────────────────────────────►│
    │                              │ 4. Kiểm tra     │                     │
    │                              │    chứng thực   │                     │
    │◄──────────────────────────────┤                 │                     │
    │ 5. Yêu cầu bổ sung          │ 6. Lưu tenant  │                     │
    │◄──────────────────────────────┤   pending_review│                     │
    │                              │                 │ 7. Vào hàng chờ    │
    │                              │                 ├────────────────────►│
    │                              │                 │                     │
    │                              │                 │ 8. Duyệt/Từ chối   │
    │                              │                 │    + LÝ DO BẮT BUỘC│
    │                              │◄────────────────┤                     │
    │                              │ 9. Ghi audit    │                     │
    │                              │   (không xoá)   │                     │
    │ 10. Nhận kết quả           │                 │                     │
    │◄─────────────────────────────┤                 │                     │
    │    active → đăng nhập       │                 │                     │
    │    rejected → lý do         │                 │                     │
```

### 2.3 Trường hợp biên

| Mã | Trường hợp | Xử lý |
|---|---|---|
| BC-01.1 | MST trùng nhưng tenant cũ đã `closed` | Cho phép, cảnh báo cho Ops xem lịch sử |
| BC-01.2 | HĐ mở rộng rút lại giữa chờ duyệt | Huỷ hồ sơ chờ, tenant → `cancelled` |
| BC-01.3 | Ops duyệt nhầm tenant khác | Có đường quay lại, ghi audit cả hai lần |
| BC-01.4 | Khách sửa thông tin sau khi đã duyệt | Tạo hồ sơ sửa đổi, tenant tạm `pending_review` lại |
| BC-01.5 | Đăng ký 10 lần/phút từ cùng IP | Chặn bằng Turnstile, có thể chặn cứng |

---

## 3. BP-02 — Quyết định quyền (quy trình cốt lõi)

### 3.1 Mức độ 0 — Khung

```
SDK khách          API quyết định         Cache quyền        Cơ sở dữ liệu
    │                  │                      │                   │
    │ ① POST verify    │                      │                   │
    │  (PAT, sản phẩm, │                      │                   │
    │   capability)    │                      │                   │
    ├─────────────────►│                      │                   │
    │                  │ ② Tra cache          │                   │
    │                  ├─────────────────────►│                   │
    │                  │ ③ Cache miss         │                   │
    │                  ├───────────────────────────────────────►│
    │                  │ ④ Nạp quyền, quota, audit            │
    │                  │◄───────────────────────────────────────┤
    │                  │ ⑤ Ghi cache        │                   │
    │                  ├─────────────────────►│                   │
    │ ⑥ Trả quyết định │                      │                   │
    │◄─────────────────┤ ⑦ Ghi audit quyết định ──────────────────►
    │                  │                      │                   │
    │ ⑧ KHÔNG gọi API  │                      │                   │
    │    nhà cung cấp  │                      │                   │
    │    nếu bị từ chối │                      │                   │
```

### 3.2 Mức độ 1 — Quy tắc quyết định (thứ tự kiểm tra)

> **Thứ tự này là quyết định thiết kế.** Kiểm tra rẻ trước, kiểm tra đắt sau. Và trả **lý do đầu tiên** không đạt — không phải tất cả các lý do.

| Bước | Kiểm tra | Nếu thất bại → `reason_code` | Chi phí | Lưu vết audit |
|:---:|---|---|---|---|
| 1 | Định dạng PAT | `pat_invalid` · 401 | Rẻ | ✘ |
| 2 | PAT còn hiệu lực | `pat_expired` · 401 | Rẻ | ✘ |
| 3 | PAT chưa thu hồi | `pat_revoked` · 401 | Rẻ | ✘ |
| 4 | Tenant đang hoạt động | `tenant_suspended` · 403 | Rẻ | ✔ |
| 5 | Sản phẩm tồn tại và đang bán | `product_retired` · 410 | Trung bình | ✔ |
| 6 | Có entitlement | `entitlement_missing` · 403 | Trung bình | ✔ |
| 7 | Entitlement còn hạn | `entitlement_expired` · 403 | Trung bình | ✔ |
| 8 | Tier đủ để chứa capability | `tier_insufficient` · 403 | Trung bình | ✔ |
| 9 | Capability được cấp cho tenant | `capability_not_granted` · 403 | Trung bình | ✔ |
| 10 | Nếu `requires_approval`: đã duyệt chưa | `approval_pending` · 403 | Trung bình | ✔ |
| 11 | Giấy phép phần mềm còn hiệu lực | `license_expired` · 403 | Trung bình | ✔ |
| 12 | Còn hạn mức meter | `quota_exceeded` · 429 | Đắt | ✔ |

**Quy tắc bất di bất dịch:** bước 12 là bước **duy nhất** tiêu thụ hạn mức. Nếu bị chặn ở bước 1–11, **không** trừ đo.

### 3.3 Mức độ 1 — Quy tắc ghi audit

| Khi nào | Ghi gì |
|---|---|
| Cho phép | `decision_id`, tenant, sản phẩm, capability, meter đã trừ, thời gian |
| Từ chối | `decision_id`, `reason_code`, bước dừng, tenant, sản phẩm, capability |
| Lỗi hệ thống | `decision_id`, mã lỗi, ngữ cảnh — **không** ghi nội dung PAT |

**Không bao giờ ghi:** giá trị PAT, nội dung Authorization header, secret trong log.

---

## 4. BP-03 — Khai báo sản phẩm mới

```
Product Admin     Hệ thống            Kho giấy phép        Khách hàng
     │               │                     │                    │
     │ ① Tạo SP     │                     │                    │
     ├──────────────►│ ② Kiểm tra mã     │                    │
     │               │    trùng            │                    │
     │ ③ Khai báo    │ ④ Nếu PROPRIETARY │                    │
     │   tier        │    chưa có GP TM   │                    │
     │               ├────────────────────►│                    │
     │               │ ⑤ Hiện cảnh báo    │                    │
     │ ⑥ Khai báo    │                     │                    │
     │   capability  │                     │                    │
     │ ⑦ Khai báo    │                     │                    │
     │   meter       │                     │                    │
     │               │ ⑧ Trạng thái draft │                    │
     │ ⑨ Kích hoạt  │                     │                    │
     ├──────────────►│ ⑩ Trạng thái       │                    │
     │               │    active           │                    │
     │               │                     │                    │
     │               │ ⑪ Có thể bán       │───────────────────►│
```

### 4.1 Quy tắc bắt buộc

| Mã | Quy tắc |
|---|---|
| BR-03.1 | Sản phẩm `PROPRIETARY` chưa có giấy phép thương mại → cảnh báo, không chặn tạo |
| BR-03.2 | Có entitlement đang cấp → **không** cho bỏ gỡ capability khỏi sản phẩm |
| BR-03.3 | Mọi thay đổi cờ capability đang được cấp → ghi audit kèm trước/sau |
| BR-03.4 | Sản phẩm `retired` giữ entitlement hiện có đến hết kỳ |

---

## 5. BP-04 — Cấp quyền rủi ro cao

```
Ops            Hệ thống         Compliance       Khách hàng      Kho giấy phép
  │                │                 │                 │                │
  │ 1. Ghi nhận   │                 │                 │                │
  │    nhu cầu    │                 │                 │                │
  ├───────────────►│ 2. Kiểm tra GP │                 │                │
  │                │    phần mềm ───────────────────────────────►│
  │                │◄───────────────────────────────  ┌─ chưa có    │
  │                │                                  │ → chặn     │
  │ 3. Chuyển hàng chờ duyệt (kèm lý do yêu cầu)     │             │
  ├───────────────────────────────►│                 │             │
  │                                │ 4. Xem hồ sơ  │             │
  │                                │    pháp nhân  │             │
  │                                │ 5. DUYỆT/TỪ CHỐI + lý do   │
  │                                ├────────────────►│             │
  │                                │ 6. Ghi audit  │             │
  │                                │ 7. Cấp capability (kèm legal_terms_version)
  │                                │                 │             │
  │                                │ 8. Thông báo ─┼─────────────►│
```

### 5.1 Quy tắc phân tách trách nhiệm

| Mã | Quy tắc |
|---|---|
| BR-04.1 | Ops **không** tự cấp capability `requires_approval` |
| BR-04.2 | Chỉ Compliance cấp được |
| BR-04.3 | Mỗi khách một quyết định — cấp hàng loạt không được phép |
| BR-04.4 | Giấy phép phần mềm chưa ký → hệ thống **chặn** duyệt |
| BR-04.5 | Lý do từ chối hiển thị cho khách phải đã khử dữ liệu nhạy cảm |

---

## 6. BP-05 — Mua và gia hạn gói

```
Khách          Cổng TT       Hệ thống        Cổng thanh toán     Kho giấy phép
  │               │              │                   │                │
  │ 1. Chọn SP   │              │                   │                │
  │    + tier    │              │                   │                │
  ├──────────────►│ 2. Tạo hóa  │                   │                │
  │               │    đơn      │                   │                │
  │               ├─────────────►│                   │                │
  │               │              │ 3. Tính tiền ────┼───────────────►│
  │               │ 4. Trả URL  │                   │                │
  │◄──────────────┤    thanh toán│                   │                │
  │ 5. Thanh toán │              │                   │                │
  ├──────────────────────────────────────────────────►│                │
  │               │              │ 6. Webhook        │                │
  │               │              │◄──────────────────┤                │
  │               │              │ 7. Kiểm tra chữ ký│                │
  │               │              │    chống giả mạo  │                │
  │               │              │ 8. Đánh dấu paid │                │
  │               │              │ 9. Kích hoạt    │                │
  │               │              │   entitlement    │                │
  │ 10. Nhận từ  │              │                   │                │
  │     chứng từ │              │                   │                │
  │◄──────────────┤              │                   │                │
```

### 6.1 Quy tắc thanh toán

| Mã | Quy tắc |
|---|---|
| BR-05.1 | Webhook trùng lặp xử lý **đúng một lần** (bằng khoá idempotency) |
| BR-05.2 | Chữ ký webhook không hợp lệ → bỏ qua, ghi cảnh báo |
| BR-05.3 | Thanh toán thất bại → giữ nguyên entitlement cũ |
| BR-05.4 | Bỏ giữa chừng → hóa đơn `expired`, **không** cấp quyền |
| BR-05.5 | Gia hạn → chỉ nâng `current_period_end`, không mất quyền |
| BR-05.6 | Mỗi hóa đơn có mã băm nội dung để chống sửa đổi |

---

## 7. BP-06 — Quản lý hạn mức

### 7.1 Mức độ 0

```
Sự kiện tiêu thụ ──► Ghi nhận ──► So với hạn ──► Ngưỡng?
                      (meter,     (tính từ      │
                       kỳ)        UsageRecord)  │
                                                  ├─ Còn dưới 80% ──► OK
                                                  ├─ Từ 80% đến 100% ──► Cảnh báo
                                                  └─ Vượt 100% ──► Chặn cứng
```

### 7.2 Quy tắc

| Mã | Quy tắc |
|---|---|
| BR-06.1 | Hạn `-1` = không giới hạn, không tính phần trăm |
| BR-06.2 | Hạn mức **không** giảm giữa kỳ |
| BR-06.3 | Sang kỳ mới: bộ đếm về 0, lịch sử kỳ trước giữ nguyên |
| BR-06.4 | Vượt hạn cứng → trả 429, **không** ghi nhận thêm |
| BR-06.5 | Mỗi lần trừ hạn ghi kèm `decision_id` để đối chiếu |
| BR-06.6 | Cảnh báo gửi một lần mỗi ngưỡng, không gửi lặp |

---

## 8. BP-07 — Đăng ký kích hoạt máy

```
SDK                    API                    Hệ thống
 │                       │                        │
 │ 1. Yêu cầu kích hoạt │                        │
 │    (PAT, nhãn máy,    │                        │
 │     địa chỉ mạng)     │                        │
 ├──────────────────────►│                        │
 │                       │ 2. Còn slot? ─────────►│
 │                       │                        │
 │              ┌────────┴────────┐               │
 │              │ Hết slot        │ Còn slot       │
 │◄─────────────┘                 │ 3. Cấp slot   │
 │   429                          │ 4. Ghi audit │
 │   activation_limit_reached      ├──────────────►│
 │                                │ 5. Trả token  │
 │ 6. Dùng token cho các         │    kích hoạt  │
 │    phiên sau                  │               │
 │◄──────────────────────────────┤               │
```

| Mã | Quy tắc |
|---|---|
| BR-07.1 | Hết slot → trả 429, nêu rõ số đang dùng |
| BR-07.2 | Máy đã kích hoạt vẫn nhận lại token, không tăng số đếm |
| BR-07.3 | Thu hồi slot → máy đó phải xác thực lại ở lần dùng sau |
| BR-07.4 | Xóa hàng loạt yêu cầu xác nhận, ghi audit |

---

## 9. BP-08 — Thu hồi quyền

| Mã | Quy tắc |
|---|---|
| BR-08.1 | Thu hồi có hiệu lực tức thời ở lần quyết định quyền kế tiếp |
| BR-08.2 | Cache quyền phải bị vô hiệu hoá **cùng lúc** khi thu hồi |
| BR-08.3 | Thu hồi không xoá dữ liệu lịch sử |
| BR-08.4 | Khách phải nhận được thông báo kèm lý do |
| BR-08.5 | Thu hồi phải ghi: người thực hiện, thời điểm, lý do, phạm vi |

> **BR-08.2 là rủi ro bỏ sót dễ xảy ra.** Nếu có cache và không vô hiệu hoá cùng lúc, khách vẫn dùng được sau khi bị thu hồi. Đã đưa thành kiểm thử bắt buộc TC-ENT-09.

---

## 10. BP-09 — Xử lý sự cố vận hành

### 10.1 Phân loại theo mức độ

| Mức | Định nghĩa | Ví dụ | Phản hồi |
|---|---|---|---|
| **S1** | Dịch vụ gián đoạn toàn bộ | API quyết định quyền không phản hồi | 15 phút · báo ngay |
| **S2** | Chức năng chính hỏng, có đường vòng | Thanh toán lỗi nhưng cấp quyền vẫn chạy | 1 giờ |
| **S3** | Chức năng phụ hỏng | Trang thống kê lỗi | 1 ngày |
| **S4** | Lỗi hiển thị | Nhãn sai, căn lề lệch | Theo lịch phát hành |

### 10.2 Quy trình xử lý

```
Phát hiện ──► Phân loại ──► Báo cáo ──► Khắc phục ──► Xác nhận ──► Post-mortem
   │             │            │           │            │            │
   │ Tự động    │ Theo mức  │ Kênh     │ Theo mức  │ Cả khách  │ Nếu S1/S2
   │ hoặc khách │ độ        │ theo mức │           │ hưởng    │ trong 5 ngày
   │ báo        │           │          │           │ thấy đã   │
   │             │           │          │           │ khôi phục │
```

| Mã | Quy tắc |
|---|---|
| BR-09.1 | S1 báo trong 15 phút, bất kể giờ |
| BR-09.2 | Post-mortem bắt buộc cho S1 và S2 trong 5 ngày |
| BR-09.3 | Post-mortem nêu nguyên nhân gốc, không đổ lỗi cá nhân |
| BR-09.4 | Mỗi hành động khắc phục có giờ bắt đầu / kết thúc để đo thời gian thực tế |

---

## 10.5 BP-10 — Đăng ký khách hàng cá nhân

> Bổ sung 2026-10-02 theo ADR-007. Điểm khác biệt cốt lõi: **không có bước Ops duyệt**.

### Mức độ 0 — Khung

```
Cá nhân              Cổng thông tin      Hệ thống          Cổng thanh toán
   │                    │                 │                    │
   │ ① Nhập email       │                 │                    │
   │   + họ tên         │                 │                    │
   ├───────────────────►│ ② Kiểm tra đã  │                    │
   │                    │   tồn tại chưa  │                    │
   │ ③ Nhận lỗi hoặc   │                 │                    │
   │   tạo tài khoản   │ ④ Tạo tenant   │                    │
   │◄───────────────────┤   active NGAY  │                    │
   │                    ├────────────────►│                    │
   │ ⑤ Chọn gói        │                 │                    │
   ├───────────────────►│ 6. Lọc SP theo│                    │
   │                    │   tenant_type  │                    │
   │ ⑦ Thanh toán trước│                 │                    │
   ├──────────────────────────────────────────────────────────►│
   │                    │                 │ 8. Webhook        │
   │                    │                 │◄───────────────────┤
   │                    │                 │ 9. Cấp entitlement│
   │ ⑩ Dùng được ngay  │                 │                    │
   │◄───────────────────┴─────────────────┤                    │
```

### Quy tắc riêng của luồng cá nhân

| Mã | Quy tắc | Đối chiếu |
|---|---|---|
| BR-10.1 | Không hỏi MST, hợp đồng, người đại diện | BR-16 |
| BR-10.2 | Tenant tạo ở trạng thái `active` ngay — không qua Ops | AC-006.1 |
| BR-10.3 | Email đã có tài khoản cá nhân → trả 409 | BR-14, AC-007.1 |
| BR-10.4 | Email đang ở tài khoản **doanh nghiệp** → vẫn cho tạo cá nhân | AC-007.2 |
| BR-10.5 | Không hiển thị sản phẩm `requires_kyc = true` | BR-12 |
| BR-10.6 | Chứng từ là biên nhận, không phải hoá đơn VAT | BR-13, AC-023.4 |
| BR-10.7 | Không hiển thị lựa chọn thẻ tín dụng / trả góp | AC-024.1 |
| BR-10.8 | Hết hạn → `expired`, không có `past_due` | BR-15 |
| BR-10.9 | Số tiền là số nguyên đồng | AC-024.4, D-08 |

### Trường hợp biên

| Mã | Trường hợp | Xử lý |
|---|---|---|
| BC-10.1 | Email có tài khoản doanh nghiệp | Cho tạo cá nhân — giới hạn chỉ tính trong nhóm cá nhân |
| BC-10.2 | Nhiều người dùng chung IP văn phòng | Không chặn — ngưỡng IP đặt cao |
| BC-10.3 | Tạo tài khoản hàng loạt từ một IP | Chặn khi vượt ngưỡng, hiển thị lý do |
| BC-10.4 | Thanh toán thành công nhưng webhook đến trễ | Hiển thị "đang xác nhận", không cấp quyền sớm |
| BC-10.5 | Cá nhân đổi email chính | Kiểm tra email mới chưa thuộc tài khoản cá nhân nào khác |
| BC-10.6 | Cá nhân gọi API cho sản phẩm `requires_kyc` | Trả 403 `product_requires_organization` |

> **BC-10.6 là lớp phòng thủ cuối.** Giao diện không hiển thị (BR-10.5) nhưng gọi API trực tiếp vẫn phải bị chặn. Ràng buộc cài ở tầng quyết định quyền, không phải ở giao diện.

---

## 11. Bảng trạng thái

### 11.1 Tenant

| Từ | Sang | Điều kiện |
|---|---|---|
| — | `pending_review` | Vừa đăng ký |
| `pending_review` | `active` | Ops duyệt |
| `pending_review` | `rejected` | Ops từ chối (có lý do) |
| `pending_review` | `cancelled` | Khách rút hồ sơ |
| `active` | `suspended` | Vi phạm hoặc quá hạn |
| `suspended` | `active` | Khắc phục xong |
| `active` / `suspended` | `closed` | Khách tự chấm dứt hoặc hết hợp đồng |

### 11.2 Entitlement

| Từ | Sang | Điều kiện |
|---|---|---|
| — | `pending_payment` | Tạo, chờ thanh toán |
| `pending_payment` | `active` | Thanh toán thành công |
| `pending_payment` | `expired` | Hết thời hạn thanh toán |
| `active` | `expired` | Qua `current_period_end` |
| `active` / `expired` | `revoked` | Ops thu hồi (có lý do) |
| `expired` | `active` | Gia hạn |
| `revoked` | `active` | Mua lại (tạo bản ghi mới) |

### 11.3 Quyết định cấp quyền capability

| Từ | Sang | Điều kiện |
|---|---|---|
| — | `requested` | Khách yêu cầu |
| `requested` | `approved` | Compliance duyệt (kèm phiên bản điều khoản) |
| `requested` | `rejected` | Compliance từ chối (kèm lý do đã khử nhạy cảm) |
| `approved` | `revoked` | Thu hồi (kèm lý do) |

---

## 12. Trường hợp biên toàn hệ thống

| Mã | Tình huống | Xử lý đúng |
|---|---|---|
| X-01 | Thu hồi quyền đúng lúc cache còn hiệu lực | Vô hiệu hoá cache đồng thời — BR-08.2 |
| X-02 | Khách đổi tier giữa lúc đang tiêu thụ | Áp dụng tier mới cho lần tiêu thụ **sau**; không đòi lại đã tiêu thụ |
| X-03 | Webhook thanh toán đến trước khi hóa đơn tạo | Từ chối webhook, ghi cảnh báo, không cấp quyền |
| X-04 | Đồng thời xoá tier trong lúc cấp quyền | Khoá chéo, một trong hai thất bại có thông điệp rõ |
| X-05 | Tenant bị khoá giữa lúc đang tiêu thụ | Lần tiêu thụ kế tiếp bị từ chối; phiên hiện tại tự hết hạn |
| X-06 | Đồng thời hai người duyệt cùng một yêu cầu | Khoá chéo; người thứ hai nhận thông báo đã xử lý |
| X-07 | Meter có lỗi ghi nhận | Không chặn khách; cảnh báo vận hành; bù trừ khi xác nhận |
| X-08 | Khách gọi capability không tồn tại | Trả 422, ghi log để phát hiện lỗi tích hợp |
| X-09 | Cache quyền hết hạn giữa chừng | Tải lại từ nguồn, không coi là quyền đủ |
| X-10 | Hệ thống cấp quyền nhưng ghi audit thất bại | **Hủy quyết định** — không có ghi vết thì không cấp quyền |

> **X-10 là nguyên tắc fail-closed.** Nếu không ghi được vết chứng minh, hệ thống không cấp quyền. Áp dụng chung cho mọi quyết định cấp quyền.

---

## 13. Ma trận truy vết

| Quy trình | User story | Kiểm thử | Phụ thuộc |
|---|---|---|---|
| BP-01 | US-001, 002 | TC-REG-01..06, TC-OPS-01..05 | — |
| BP-02 | US-004, 012 | TC-AUTH-01..07, TC-ENT-01..09 | Cache |
| BP-03 | US-010, 011 | TC-PRD-01..07 | — |
| BP-04 | US-014 | TC-CMP-01..05 | Kho giấy phép |
| BP-05 | US-020, 021 | TC-BIL-01..08 | Cổng thanh toán |
| BP-06 | US-015 | TC-MET-01..06 | Bộ đếm |
| BP-07 | US-016 | TC-ACT-01..05 | — |
| BP-08 | US-013 | TC-ENT-09, TC-REV-01..05 | Cache |
| BP-09 | — | TC-OPS-04 | Giám sát |

---

**Cổng chất lượng:** QG-2 — đã đủ 9 quy trình, 15 user story, 10 trường hợp biên.
**Điểm cần chú ý:** BR-08.2 (vô hiệu hoá cache khi thu hồi) và X-10 (fail-closed khi audit lỗi) là hai quy tắc dễ bỏ sót nhất. Đã đưa vào kiểm thử bắt buộc.
**Tài liệu sau:** D04 — Kiến trúc hệ thống