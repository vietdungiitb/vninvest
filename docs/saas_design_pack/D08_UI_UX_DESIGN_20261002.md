# D08 — Thiết kế UI/UX

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** WCAG 2.2 AA · Nguyên tắc Nielsen · **Tài liệu trước:** D07 · **Tài liệu sau:** D09

---

## 1. Nguyên tắc thiết kế

| # | Nguyên tắc | Hệ quả cụ thể |
|---|---|---|
| 1 | **Khách tự phục vụ trước** | 80% yêu cầu hỗ trợ phải tự giải quyết được (mục tiêu G6) |
| 2 | **Hiển thị lý do, không chỉ kết quả** | Khi bị từ chối quyền, nói rõ vì sao và làm gì tiếp |
| 3 | **Không bao giờ im lặng** | Mọi thao tác có phản hồi, kể cả thất bại |
| 4 | **Không giả định chuyên môn** | Giải thích từ ngữ pháp lý bằng ngôn ngữ thường |
| 5 | **Đường ngắn nhất tới giá trị** | Cá nhân từ đăng ký tới dùng được ≤ 5 phút |
| 6 | **Trạng thái rõ ràng** | Luôn biết đang ở đâu, quyền hiện tại là gì |

> **Nguyên tắc 2 là khác biệt lớn nhất so với phần lớn SaaS.** Hệ thống quyền thường chỉ trả "403 Forbidden". Ở đây, mỗi `reason_code` trong D07 §2.2 có một thông điệp riêng kèm hành động gợi ý.

---

## 2. Hai trải nghiệm khác nhau

### 2.1 Người dùng cá nhân — đường ngắn nhất

```
   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │  1. Vào │──►│ 2. Nhập  │──►│  3. Chọn │──►│ 4. Thanh │
   │  trang   │   │  email   │   │   gói    │   │  toán    │
   └──────────┘   └──────────┘   └──────────┘   └──────────┘
        5 giây        30 giây       30 giây       60 giây
                                                     │
                                                      ▼
                                            ┌──────────────┐
                                            │ 5. Tạo PAT   │
                                            │  sao chép    │
                                            └──────────────┘
                                               60 giây

   TỔNG: khoảng 3 phút — không cần hợp đồng, không cần chờ duyệt
```

**Quyết định thiết kế:** không hỏi MST, không hỏi hợp đồng, không hỏi người đại diện. Ba màn hình đăng ký của doanh nghiệp **không xuất hiện**.

### 2.2 Doanh nghiệp — có hợp đồng nên có quy trình

```
   ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐
   │1. Hồ sơ│─►│2. Chờ  │─►│ 3. Duyệt │─►│ 4. Thanh │─►│5. Tạo │
   │ doanh  │  │ duyệt  │  │  (Ops)   │  │  toán    │  │  PAT   │
   │ nghiệp │  │        │  │          │  │          │  │        │
   └────────┘  └────────┘  └──────────┘  └──────────┘  └────────┘
        10 phút     Thời gian chờ không đo được trước
```

**Phải công khai thời gian chờ.** Nếu không nói khách sẽ tưởng hệ thống treo.

---

## 3. Sơ đồ thông tin

### 3.1 Khách doanh nghiệp

```
Đăng ký ─► Đăng nhập ─► ┌─────────────────────────────────┐
                         │  BẢNG ĐIỀU KHIỂN               │
                         │  · Quyền hiện tại              │
                         │  · Hạn mức đang dùng            │
                         │  · Hạn thanh toán sắp tới      │
                         │  · Cảnh báo                    │
                         └────────┬────────────────────────┘
                                  │
      ┌───────────┬───────────┬───┴────┬───────────┬────────────┐
      ▼           ▼           ▼        ▼           ▼            ▼
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  ┌────────┐
  │Sản phẩm│ │Hạ tốc  │ │Thành   │ │Thanh   │ │Nhật ký │  │Kích    │
  │và gói  │ │độ dùng │ │viên    │ │toán    │ │kiểm toán│ │hoạt máy│
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  └────────┘
      │                              │            │
      │                              ▼            ▼
      │                         ┌─────────┐  ┌──────────┐
      │                         │Hợp đồng│  │ Cài đặt  │
      │                         │hóa đơn │  │ thành viên│
      │                         └─────────┘  └──────────┘
      │
      ▼
  ┌──────────────┐
  │Tạo khóa API │
  │(PAT)         │──► Hiển thị MỘT LẦN ──► Sao chép ──► Xác nhận đã lưu
  └──────────────┘
```

### 3.2 Khách cá nhân — gọn hơn 4 mục

```
Đăng ký ─► Đăng nhập ─► BẢNG ĐIỀU KHIỂN
                         ├─ Gói hiện tại + ngày hết hạn
                         ├─ Hạn mức
                         ├─ Tạo khóa API
                         └─ Gia hạn / nâng cấp
```

**Không có:** nhật ký kiểm toán, quản lý thành viên, quản lý hạ tài khoản máy.
Lý do: một cá nhân không có tổ chức để quản trị.

---

## 4. Màn hình chính

### 4.1 Bảng điều khiển doanh nghiệp

```
┌────────────────────────────────────────────────────────────────┐
│ VNInvest Platform            [Công ty ABC]         [Hồ Sơ A] ◄ │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ SẢN PHẨM     │ │ HẠN MỨC      │ │ THANH TOÁN   │          │
│  │              │ │              │ │              │          │
│  │  3 gói đang  │ │  API call    │ │  Còn 21 ngày │          │
│  │  dùng        │ │  1,240 /100K │ │              │          │
│  │              │ │  ▓░░░░░░░ 1%│ │  Doanh nghiệp│          │
│  │ [+ Mua thêm] │ │              │ │  Năm 2026    │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ CẢNH BÁO                                            │      │
│  │ ⚠ Hạn mức "seat" đạt 80% (8/10)                     │      │
│  │ ⚠ VNInvest Charts hết hạn sau 21 ngày               │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                │
│  ┌──────────────────────┐ ┌────────────────────────────────┐  │
│  │ QUYỀN HIỆN TẠI      │ │ NHẬT KÝ GẦN ĐÂY               │  │
│  │                      │ │                                │  │
│  │ VNInvest Charts      │ │ 14:20  Tạo PAT "ci-pipeline"    │  │
│  │  Enterprise          │ │ 09:15  Nâng cấp lên Enterprise │  │
│  │  Hết hạn 31/12/2026  │ │ 08:02  Đăng nhập               │  │
│  │                      │ │                                │  │
│  │ VNInvest Broker Data │ │ Xem tất cả ──►                 │  │
│  │  Professional        │ │                                │  │
│  │  ⚠ Chờ duyệt pháp lý │ │                                │  │
│  └──────────────────────┘ └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Quyết định thiết kế quan trọng:** cảnh báo hạn mức và hạn thanh toán nằm **ngay trên đầu**, không nằm trong trang riêng. Người dùng không mở trang riêng để xem thứ họ cần xử lý ngay.

### 4.2 Bảng điều khiển cá nhân

```
┌─────────────────────────────────────────────────────────┐
│ VNInvest                    [dev@example.com]     [◄] ◄ │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────────────────────────────────────┐      │
│   │  Gói: Cá nhân          Hết hạn 31/10/2026  │      │
│   │                                             │      │
│   │  Hạn mức API    ▓▓▓░░░░░░░░  1,240 / 100K │      │
│   │                                             │      │
│   │  [Gia hạn]  [Nâng cấp]                    │      │
│   └─────────────────────────────────────────────┘      │
│                                                         │
│   ┌─────────────────────────────────────────────┐      │
│   │  Khóa API của bạn                            │      │
│   │  ┌──────────────────────────────────────┐   │      │
│   │  │ my-laptop      vnp_live_a7b3…  31/12 │   │      │
│   │  └──────────────────────────────────────┘   │      │
│   │  [+ Tạo khóa mới]                            │      │
│   └─────────────────────────────────────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Bốn thông tin trong một màn hình: gói, hạn mức, gia hạn, khóa API. Không có thông tin nào không dùng được ngay.

---

## 5. Khung bố cục

### 5.1 Bàn phím và thị giác

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]   Sản phẩm  Hạn mức  Thành viên  Thanh toán   │ ← Điều hướng chính
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  Điều hướng   │   Nội dung                              │
│  phụ          │                                         │
│               │   ┌─────────────────────────────────┐   │
│  ▸ Hồ sơ     │   │  Tiêu đề trang                  │   │
│  ▸ Khóa API  │   ├─────────────────────────────────┤   │
│  ▸ Nhật ký   │   │                                 │   │
│               │   │  Nội dung chính                 │   │
│               │   │                                 │   │
│               │   ├─────────────────────────────────┤   │
│               │   │  Hành động                      │   │
│               │   └─────────────────────────────────┘   │
├───────────────┴─────────────────────────────────────────┤
│  Trạng thái      [© 2026]      Liên hệ · Điều khoản     │ ← Chân trang
└─────────────────────────────────────────────────────────┘
```

**Vị trí cảnh báo:** góc trên bên phải, đóng được, không chặn nội dung.

### 5.2 Lưới và khoảng cách

| Thành phần | Số cột | Khoảng cách | Ghi chú |
|---|---|---|---|
| Biểu mẫu một cột | 1 | 8 | Rộng tối đa 640px — trường dài gây mệt mắt |
| Biểu mẫu hai cột | 2 | 8 | Chỉ với trường độc lập, không phụ thuộc nhau |
| Thẻ nội dung | 3–4 | 6 | Trên máy tính ≥ 1280px |
| Bảng dữ liệu | — | 4 | Cột quan trọng nhất đặt bên trái |
| Biểu đồ hạn mức | — | — | Thanh tiến trình, không phải biểu đồ tròn |

> **Không dùng biểu đồ tròn cho hạn mức.** Người dùng cần so sánh với một con số cụ thể. Thanh tiến trình cho phép đọc chính xác còn bao nhiêu; đồ hình tròn không.

---

## 6. Thông báo trạng thái quyền

Đây là phần khác biệt nhất. Mỗi `reason_code` có thông điệp riêng.

| `reason_code` | Tiêu đề | Thông điệp | Hành động | Mức |
|---|---|---|---|:---:|
| `entitlement_missing` | Chưa có quyền | Bạn chưa mua gói này. | Xem giá | Thông tin |
| `entitlement_expired` | Gói đã hết hạn | Gói của bạn hết hạn ngày 31/10. | Gia hạn ngay | **Cảnh báo** |
| `tier_insufficient` | Gói chưa đủ | Gói Cơ bản không có tính năng này. Nâng cấp lên Chuyên nghiệp. | Xem nâng cấp | Thông tin |
| `capability_not_granted` | Tính năng không có | Gói của bạn không gồm tính năng này. | Xem gói khác | Thông tin |
| `approval_pending` | **Đang chờ duyệt** | Yêu cầu đã được gửi, chúng tôi sẽ phản hồi trong 1–2 ngày làm việc. | Xem hồ sơ | **Thông báo** |
| `product_requires_organization` | Cần tài khoản doanh nghiệp | Sản phẩm này chỉ dành cho tổ chức có pháp nhân. | Đăng ký doanh nghiệp | **Thông tin** |
| `license_expired` | Giấy phép phần mềm hết hạn | Nhà cung cấp cần gia hạn giấy phép. Tạm thời chưa dùng được. | Liên hệ hỗ trợ | **Lỗi** |
| `quota_exceeded` | Đã vượt hạn mức | Đã dùng 100.000 / 100.000 lời gọi. | Nâng hạn mức | **Lỗi** |

### 6.1 Nguyên tắc phân biệt "lỗi của bạn" và "lỗi của chúng tôi"

| Nhân quả | Cách diễn đạt | Mức hiển thị |
|---|---|---|
| Khách thiếu cấu hình | Nêu rõ cần làm gì | Thông tin |
| Khách cần nâng cấp | Nêu rõ chi phí và lợi ích | Thông tin |
| Chờ bên trong xử lý | Nêu rõ thời gian chờ dự kiến | Thông báo |
| **Hệ thống chưa sẵn sàng** | **Xin lỗi, không đổ lỗi khách** | **Lỗi** |

> `license_expired` là trường hợp của **nhà cung cấp**, không phải khách. Thông điệp phải thừa nhận điều đó thay vì bắt khách chờ.

---

## 7. Màn hình đăng ký

### 7.1 Đăng ký cá nhân — một màn hình

```
┌──────────────────────────────────────────────┐
│                                              │
│              Tạo tài khoản                   │
│      Miễn phí 30 ngày, không cần thẻ       │
│                                              │
│  Email                                       │
│  ┌────────────────────────────────────────┐  │
│  │ dev@example.com                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Họ và tên                                   │
│  ┌────────────────────────────────────────┐  │
│  │ Nguyễn Văn A                          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Mật khẩu                                    │
│  ┌────────────────────────────────────────┐  │
│  │ ••••••••••                      👁      │  │
│  └────────────────────────────────────────┘  │
│  Ít nhất 10 ký tự, có chữ và số             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         [ Tạo tài khoản ]              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Đã có tài khoản? Đăng nhập                 │
│                                              │
└──────────────────────────────────────────────┘
```

**Ba trường. Không có MST, không có hợp đồng, không có người đại diện.**

Dòng "Miễn phí 30 ngày, không cần thẻ" chống hiểu nhầm rằng phải trả tiền ngay.

### 7.2 Đăng ký doanh nghiệp — có tiến độ

```
┌──────────────────────────────────────────────────────────────┐
│  Đăng ký tổ chức              [1] Hồ sơ  ●  [2] Duyệt ○     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tên pháp lý *                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Công ty TNHH ABC                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Mã số thuế *          Người đại diện *                     │
│  ┌──────────────┐     ┌────────────────────────────────┐   │
│  │ 0312345678   │     │ Nguyễn Văn B                   │   │
│  └──────────────┘     └────────────────────────────────┘   │
│                                                              │
│  Email liên hệ *                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ admin@abc.vn                                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Hợp đồng đã ký *                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📎 hop-dong-abc.pdf          Xóa                      │  │
│  └────────────────────────────────────────────────────────┘  │
│  PDF hoặc DOCX, tối đa 10 MB                                │
│                                                              │
│              [ Gửi hồ sơ ]         [ Quay lại ]             │
│                                                              │
│  ────────────────────────────────────────────────────────  │
│  ⓘ Bước 2: chúng tôi xem xét trong 1–2 ngày làm việc.       │
│    Bạn sẽ nhận email khi có kết quả.                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Tiến độ 2 bước** làm rõ rằng có một bước chờ. Dòng thông tin ở chân giải quyết câu hỏi "mất bao lâu".

### 7.3 Màn hình chờ duyệt

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         ✓  Hồ sơ đã được gửi                       │
│                                                      │
│     Mã hồ sơ: REG-2026-10-0042                     │
│     Gửi lúc: 10:02 31/10/2026                       │
│                                                      │
│     Chúng tôi sẽ phản hồi trong 1–2 ngày làm việc   │
│     qua email admin@abc.vn                          │
│                                                      │
│         [ Quay về trang chủ ]                       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Cho mã hồ sơ để khách có thể trao đổi khi gọi hỗ trợ.

---

## 8. Màn hình tạo khóa API

### 8.1 Bước 1 — điền thông tin

```
┌──────────────────────────────────────────────────────┐
│  Tạo khóa API                          [Hủy] [Tiếp]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Tên khóa *                                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ Máy của tôi                                   │  │
│  └────────────────────────────────────────────────┘  │
│  Giúp bạn nhận biết khóa nào đang ở đâu              │
│                                                      │
│  Hạn sử dụng *                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ 30 ngày    90 ngày    1 năm    Không hạn      │  │
│  └────────────────────────────────────────────────┘  │
│  ⓘ Khóa không hạn rủi ro cao hơn nếu bị lộ        │
│                                                      │
│  Phạm vi truy cập                                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ ☑ Đọc dữ liệu                                 │  │
│  │ ☐ Tạo báo cáo                                  │  │
│  │ ☐ Quản trị                                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 8.2 Bước 2 — hiển thị token

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│     ⚠  Lưu khóa này ngay — sẽ không hiện lại        │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  vnp_live_a7b3c9d2e4f5a6b7c8d9e0f1a2b3c4      │  │
│  │                                      [Sao chép]│ │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ☑ Tôi đã lưu khóa này vào nơi an toàn              │
│                                                      │
│              [ Hoàn tất ]                            │
│                                                      │
│  ─────────────────────────────────────────────────  │
│  ⓘ Không thể xem lại. Nếu làm mất, hãy thu hồi và  │
│    tạo khóa mới.                                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Nút "Hoàn tất" bị khoá cho tới khi tick ô xác nhận.** Không thể vô tình đóng màn hình và mất token.

> Đây là hiện thực hoá AC-003.1 — token hiện **đúng một lần**. Vì hệ thống không lưu bản rõ nên không thể hiện lại.

---

## 9. Mẫu trang đăng ký cá nhân

```
┌──────────────────────────────────────────────────────┐
│  ✕                                                  │
│                                                      │
│     🎉 Tạo khóa thành công!                        │
│                                                      │
│     Bước tiếp theo: dán khóa vào SDK của bạn       │
│                                                      │
│     ┌────────────────────────────────────────────┐   │
│     │  export VNINVEST_KEY="vnp_live_a7b3..."  │   │
│     └────────────────────────────────────────────┘   │
│                                                      │
│     ┌────────────────────────────────────────────┐   │
│     │  from vninvest import require_capability  │   │
│     │                                          │   │
│     │  require_capability("chart.render")       │   │
│     └────────────────────────────────────────────┘   │
│                                                      │
│     [ Sao chép ví dụ ]      [ Đi tới bảng điều khiển ]│
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Cho ví dụ ngay sau khi tạo khóa.** Người dùng tự nhập khóa tay sẽ có 20% khả năng sai ký tự.

---

## 10. Trảng thái rỗng và lỗi

### 10.1 Chưa có gói nào

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         Bạn chưa có gói nào                         │
│                                                      │
│     Chọn một gói để bắt đầu dùng.                    │
│                                                      │
│              [ Xem các gói ]                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Trạng thái rỗng phải **nêu hành động**, không chỉ nêu trạng thái. "Chưa có gói nào" mà không có nút bấm là vết chết.

### 10.2 Lỗi tải trang

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         Không tải được dữ liệu                       │
│                                                      │
│     Đã ghi nhận sự cố. Vui lòng thử lại sau vài     │
│     phút hoặc [tải lại].                             │
│                                                      │
│     Mã lỗi: req_01H8XQ2M4K7P                        │
│     (giữ mã này khi liên hệ hỗ trợ)                 │
│                                                      │
│              [ Tải lại ]                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Hiện mã lỗi** để người dùng báo lỗi mà không cần chụp màn hình.

---

## 11. Trạng thái hạn mức

### 11.1 Bốn mức

| Mức | Hình dạnh | Màu | Nhãn |
|---|---|---|:---:|
| Bình thường | Thanh xanh nhạt | xanh | 1.240 / 100.000 |
| Cảnh báo | Thanh vàng | vàng | ⚠ 80.000 / 100.000 |
| Nghiêm trọng | Thanh cam | cam | ⚠ 95.000 / 100.000 |
| Vượt hạn | Thanh đỏ, cảnh báo cả trang | đỏ | **Đã vượt hạn mức** |

### 11.2 Ngưỡng

| Ngưỡng | Hành động |
|---|---|
| 80% | Cảnh báo trên bảng điều khiển + trang hạn mức |
| 95% | Cảnh báo + gợi ý nâng cấp |
| 100% | Chặn · trả `quota_exceeded` |

**Không dùng màu đỏ làm tín hiệu duy nhất.** Người mù màu không phân biệt được — phải có nhãn chữ đi kèm (WCAG 2.2 AA §1.4.1).

---

## 12. Hệ thống thiết kế

### 12.1 Màu sắc

| Vai trò | Giá trị | Dùng cho |
|---|---|---|
| Nền chính | `#0F1117` | Nền trang |
| Nền nâng cao | `#161922` | Thẻ |
| Đường viền | `#242838` | Phân cách |
| Chữ chính | `#E8EAF0` | Nội dung |
| Chữ phụ | `#9AA0AE` | Nhãn phụ |
| Nhấn chính | `#3B82F6` | Nút hành động |
| Thành công | `#22C55E` | Trạng thái tốt |
| Cảnh báo | `#F59E0B` | Sắp hết hạn |
| Nguy hiểm | `#EF4444` | Lỗi, vượt hạn |


> **Nguồn sự thật (O5, wave 17 — 2026-10-10).** Bảng màu §12.1 này là nguồn
> duy nhất cho giao diện **Django admin**. `check_admin_ux.py` **parse trực
> tiếp bảng dưới đây** rồi so với `vnadmin.css` — sửa một giá trị ở đây thì
> gate báo đỏ ngay (`token --vn-bg phai la … nguon D08 §12.1`). Trước đó bảng
> màu bị chép **hai lần** (một lần trong gate, một lần trong CSS) nên hai bản
> có thể trôi dạt mà không ai biết.
>
> Ba điểm D08 **không** quy định, vì vậy gate chỉ kiểm bằng quy tắc riêng có tên:
> - `--vn-surface-2` (`#1e2130`): sắc +1 bậc so với `--vn-surface`, dùng cho header/sidebar.
> - `--vn-gain` / `--vn-loss`: **bắt buộc bằng** `--vn-success` / `--vn-danger`
>   (chuẩn Bloomberg tăng/giảm, L-F08). Gate chặn nếu lệch.
>
> Phạm vi: D08 cho Django admin; `packages/web/src/components/soc/soc.tokens.css`
> là bảng màu riêng của vỏ SPA. Hai bảng cùng sống là chấp nhận được, **chép màu
> của nhau vào token** thì không — gate có cảnh báo `mau soc.tokens.css loot vao
> admin (O5)`.
**Tỷ lệ tương phản:** chữ chính trên nền chính đạt ≥ 12:1. Chữ phụ ≥ 4.5:1.

### 12.2 Giãn cách

| Bậc | Giá trị | Dùng cho |
|---|---:|---|
| 1 | 4px | Trong thành phần nhỏ |
| 2 | 8px | Giữa nhãn và trường |
| 3 | 16px | Giữa khối nhỏ |
| 4 | 24px | Giữa các phần |
| 5 | 40px | Khoảng cách lớn |
| 6 | 64px | Chia đoạn chính |

### 12.3 Kiểu chữ

| Vai trò | Cỡ | Độ đậm | Cao |
|---|---:|---:|---:|
| Tiêu đề trang | 28px | 600 | 36px |
| Tiêu đề phần | 20px | 600 | 28px |
| Tiêu đề nhóm | 16px | 600 | 24px |
| Nội dung | 14px | 400 | 20px |
| Nhãn phụ | 13px | 400 | 18px |

### 12.4 Bo góc và đổ bóng

| Thành phần | Bo góc | Đổ bóng |
|---|---:|---|
| Nút | 6px | không |
| Thẻ | 10px | rất nhẹ |
| Hộp thoại | 12px | trung bình |
| Thông báo | 8px | không |

---

## 13. Tiếp cận — WCAG 2.2 AA

| Yêu cầu | Mức | Áp dụng |
|---|---|---|
| Tương phản văn bản | AA (4.5:1) | Bảng màu §12.1 |
| Không chỉ dựa vào màu | AA | Hạn mức có nhãn chữ |
| Điều hướng bàn phím | AA | Đơn vị cổng · tab focus rõ |
| Nhãn biểu mẫu | AA | Mọi trường có `<label>` gắn |
| Vùng nhấn tối thiểu | 2.2 (24×24px) | Nút và liên kết |
| Nhãn thay thế ảnh | A | Biểu tượng có `aria-label` |
| Tiêu đề cấu trúc | AA | H1–H3 không bỏ qua cấp |
| Giảm chuyển động | 2.3.3 (AA) | Tôn trọng `prefers-reduced-motion` |

### 13.1 Điều hướng bàn phím bắt buộc

| Phím | Hành động |
|---|---|
| `Tab` / `Shift+Tab` | Di chuyển giữa các phần tử |
| `Enter` | Kích hoạt nút, gửi biểu mẫu |
| `Esc` | Đóng hộp thoại, hủy thao tác |
| `↑` `↓` | Di chuyển trong danh sách chọn |

**Vòng focus phải nhìn thấy rõ** trên nền tối — sai số thường gặp là dùng viền tối trên nền tối.

---

## 14. Ngôn ngữ và bản địa hoá

### 14.1 Hai ngôn ngữ

| Ngôn ngữ | Dùng cho |
|---|---|
| Tiếng Việt | Mặc định |
| Tiếng Anh | Khách quốc tế |

### 14.2 Quy tắc văn bản

| Quy tắc | Đúng | Sai |
|---|---|---|
| Không viết tắt trong thông báo lỗi | Không đủ hạn mức | Không đủ HĐ |
| Tiếng Việt đủ dấu | "hết hạn" | "het han" |
| Dùng bảng thuật ngữ thống nhất | "tổ chức" / "doanh nghiệp" | trộn lẫn |
| Số: dấu chấm phân tách | 1.240.000 | 1240000 |
| Tiền: ký hiệu trước | 199.000 ₫ | ₫199.000 |

### 14.3 Nội dung nhạy cảm về pháp lý

Thông báo quyền phải **không** dùng từ mang tính pháp lý mơ hồ:

| Không dùng | Dùng |
|---|---|
| "Vi phạm điều khoản" | "Yêu cầu chưa được cho phép" |
| "Bị khóa" | "Tạm thời không hoạt động" |
| "Không hợp lệ" | "Chưa đủ điều kiện" |

> **Lý do:** thông báo của hệ thống có thể được sao chép ra ngoài. Tránh ngôn ngữ pháp lý không chính xác tránh tạo hiểu lầm về nghĩa vụ pháp lý.

---

## 15. Đáp ứng truy cận thiết bị

| Thiết bị | Kích thước | Bố cục |
|---|---|---|
| Máy tính | ≥ 1280px | Điều hướng ngang + điều hướng phụ |
| Máy tính nhỏ | 768–1279px | Điều hướng gộp, thẻ 2 cột |
| Máy tính bảng | 600–767px | Thẻ 1 cột, điều hướng thu gọn |
| Điện thoại | < 600px | 1 cột, điều hướng dưới cùng |

**Bảng dữ liệu trên điện thoại:** chuyển sang thẻ xếp dọc, không cuộn ngang. Cuộn ngang trên điện thoại khiến người dùng không thấy cột quan trọng.

### 15.1 Ưu tiên trên điện thoại

Nếu chỉ giữ được ba màn hình, giữ: **tạo khóa API** · **xem quyền** · **gia hạn**. Vì đó là ba việc người dùng làm nhiều nhất.

---

## 16. Bảng trạng thái cảm xúc

| Trạng thái | Khi nào | Mặc định |
|---|---|---|
| Tải đầu tiên | Chờ dữ liệu | Khung xương, không xoay vòng |
| Tải thêm | Lọc hoặc phân trang | Giữ nội dung cũ, làm mờ phần mới |
| Thành công | Thao tác xong | Thông báo tự biến mất sau 4 giây |
| Thông tin | Cần chú ý, không chặn | Giữ tới khi đóng |
| Cảnh báo | Cần xử lý | Giữ, có nút hành động |
| Lỗi | Không thao tác được | Giữ, có cách khắc phục |
| Trống | Chưa có dữ liệu | **Nêu hành động tạo dữ liệu** |

> **Sai lầm thường gặp:** dùng thông báo thành công tự biến mất cho thao tác quan trọng như thu hồi quyền. Người dùng tưởng thành công nhưng thực ra đã mất quyền — phải dùng thông báo **không tự biến mất** cho mọi thao tác phá huỷ.

---

**Cổng chất lượng:** QG-3 — 2 hành trình khác nhau · 16 màn hình chính · 8 trạng thái quyền có thông điệp riêng · hệ thống thiết kế đầy đủ · 8 yêu cầu WCAG 2.2 AA.
**Tài liệu sau:** D09 — Bảo mật & tuân thủ