# Tổng hợp câu hỏi cần trả lời

**Ngày lập:** 2026-10-02 · **Trạng thái:** 5 câu đã chốt · 20 câu còn mở
**Dựa trên:** Bộ hồ sơ 12 tài liệu tại `docs/saas_design_pack/`

---

## Quyết định đã chốt ngày 2026-10-02

Owner đã trả lời 5 câu quyết định. Từ các câu này, phạm vi v1.0 được xác định.

| Mã | Câu hỏi | Quyết định |
|---|---|---|
| **Q-20** | v1.0 bán sản phẩm nào? | **B** — `vninvestcharts` + `vnbroker-data`. Trì hoãn brokerage |
| **Q-16** | Cá nhân mua được tầng brokerage? | **B** — mua mọi sản phẩm, trừ sản phẩm `requires_kyc = true` |
| **Q-01** | License thương mại `vnbroker` | ✅ **Đã giải quyết** — Mục 0 `LICENSE.md:9-16` giải phóng chủ sở hữu |
| **Q-03** | Đăng ký tự phục vụ hay duyệt tay? | **B** — doanh nghiệp duyệt thủ công, cá nhân tự đăng ký |
| **NQ-01** | Vượt hạn mức: chặn hay cảnh báo? | **B** — doanh nghiệp cảnh báo mềm, cá nhân chặn cứng |

### Hệ quả trực tiếp

| Hệ quả | Chi tiết |
|---|---|
| **Phạm vi v1.0 thu hẹp** | Chỉ 2 sản phẩm: widget + dữ liệu chung. Không có brokerage |
| **Không cần giấy phép thương mại** | Mục 0 `LICENSE.md:9-16` giải phóng chủ sở hữu |
| **Chưa cần tư vấn luật** | Không bán tầng brokerage thì chưa cần luật sư chuyên ngành chứng khoán |
| **Chưa cần `write_gate` cho `brokerage/`** | Để dành cho v2.0. Xem mục "Việc cần làm trước" bên dưới |
| **BR-12 trở thành quy tắc thật** | Sản phẩm brokerage chưa bán, nhưng ràng buộc vẫn cài sẵn để sau này mở không cần sửa thiết kế |
| **Cách kích hoạt khác nhau** | Doanh nghiệp vượt hạn vẫn gọi được, có header cảnh báo. Cá nhân bị chặn 429 |

### Điều chưa cần làm vì quyết định này

| Việc | Vì sao hoãn |
|---|---|
| ~~Ký license thương mại `vnbroker`~~ | ✅ **Không cần** — Mục 0 giải phóng chủ sở hữu |
| Tư vấn luật sư chứng khoán | Chưa bán tầng brokerage |
| Xây luồng KYC / xác minh pháp nhân | Chưa bán tầng brokerage |
| Đóng hàng rào `write_gate` trong `brokerage/` | Chưa bán tầng brokerage |

### Việc trở thành bắt buộc sau quyết định này

| # | Việc | Vì sao |
|---|---|---|
| 1 | Định nghĩa rõ `vnbroker-data` chỉ gồm lane nào | Chỉ lane VCI/KBS/RSS mới không cần broker. SSI **bắt buộc cần** tài khoản môi giới |
| 2 | Cài `BR-12` trong mô hình dữ liệu | Chuẩn bị cho v2.0, không cần sửa lại sau |
| 3 | Logic chặn hạn mức khác nhau theo `tenant_type` | Theo NQ-01 |
| 4 | Viết tài liệu hướng dẫn: lane nào cần broker | Khách sẽ hỏi khi mua |

> **Mục 1 là điểm cần chú ý nhất.** Theo xác minh I-02 ở D05, SSI là ngân hàng chứng khoán — Open API của họ *là* API trading, không có public data API riêng. Nên `vnbroker-data` **không thể** bao gồm lane SSI mà không yêu cầu tài khoản môi giới. Điều này cần nói rõ trên trang bán hàng, không thể giấu.

---

## Cách dùng phần còn lại

Còn **20 câu** chưa trả lời. Trong đó:

| Nhóm | Số | Ghi chú |
|---|---:|---|
| A — Kinh doanh | 7 | Q-02, Q-17, Q-08, Q-12 chặn Pha 6 |
| B — Pháp lý | 4 | Q-05, Q-04, Q-07, Q-11 — ít gấp hơn vì chưa bán brokerage |
| C — Đăng ký | 7 | Q-09, Q-10 chặn Pha 5 |
| D — Nguồn lực | 2 | Q-18, Q-19 |
| F — Kỹ thuật | 4 | NQ-01 đã chốt, còn 3 |

**Pha 1–2 không bị chặn bởi câu nào.** Có thể bắt đầu ngay: 5–8 ngày công.

**Pha 3–4** chỉ cần NQ-02, NQ-03.

**Pha 6** cần Q-02, Q-17 — hai câu về giá.

---

## Ba câu gấp nhất — còn mở

| Mã | Câu hỏi | Chặn |
|---|---|---|
| **Q-02** | Giá sản phẩm / tier? | Pha 6 |
| **Q-17** | Giá gói cá nhân? | Pha 6 |
| **Q-04** | Hạn mức mặc định? | Pha 3–4 |

---

# NHÓM A — QUYẾT ĐỊNH KINH DOANH

## A1. Giá cả

**Q-02 — Giá mỗi sản phẩm / tier?**

Bối cảnh: D06 đã thiết kế `catalog_product_tier.price_amount` và `billing_period`. Cần con số để làm hóa đơn và trang giá.

Gợi ý khung (D09 §6.5): miễn phí → cá nhân → nhóm → doanh nghiệp.

```
Q-02: ___________________________________________________

Khung giá mong muốn (có thể để trống nếu chưa chốt):
- Miễn phí:      ____________
- Cá nhân/tháng: ____________
- Doanh nghiệp/năm: ____________
```

**Q-17 — Giá gói cá nhân?**

Đã chốt: thanh toán theo tháng. Chưa chốt: con số.

```
Q-17: ____________ đồng / tháng
```

**Q-08 — Khách đổi tier tăng giữa kỳ thì tính tiền thế nào?**

Bối cảnh: mã hiện tại `views_webhooks.py:259-260` đang trả `prorated_amount = 0` cố định — tức là chưa tính gì cả. Đây là lỗi có sẵn.

Ba phương án thường dùng:

| Phương án | Cách tính | Hợp với |
|---|---|---|
| A · Trả phần chênh lệch ngay | Quý 1/2 + nâng cấp = trả ngay phần chênh | Khách thích không bị giật mình |
| B · Chuyển sang kỳ sau | Nâng cấp giữa kỳ = đợi kỳ sau mới trả phần chênh | Dễ cho cả hai bên |
| C · Tính theo ngày còn lại | Quý × số ngày còn lại / tổng ngày | Công bằng nhất |

```
Q-08: A / B / C / cách khác: ___________________________
```

**Q-12 — Chu kỳ tính cước: tháng, quý hay năm?**

Đã chốt cá nhân = tháng. Còn doanh nghiệp thì sao?

```
Q-12: Doanh nghiệp tính theo: tháng / quý / năm / theo hợp đồng riêng
```

## A2. Sản phẩm

**Q-06 — Có dùng lại thương hiệu `vninvest` không?**

Bối cảnh: `vnbroker` đã bị vắng mặt khỏi thư viện nhưng tên vẫn còn. Hơn nữa D06 §6.5 khuyến nghị không dùng chữ "broker"/"trade"/"sàn" trong tên.

Vì sao quan trọng: nếu tên gọi bị hiểu là sàn giao dịch thì rủi ro pháp lý tăng, dù kỹ thuật bạn không làm gì tài chính.

```
Q-06: Dùng lại "vninvest" / Đặt tên mới: ____________
```

**Q-01 — Ký license thương mại `vnbroker`? → ĐÃ GIẢI QUYẾT (Mục 0).**

Bối cảnh: `vnbroker/LICENSE.md:28-36` cấm dùng thương mại bên thứ ba nếu không có văn bản cho phép. Bạn là chủ sở hữu repo nên có thể tự ký.

Chặn: bán `vnbroker-data` và `vnbroker-brokerage`.

```
Q-01: Đã có / Đang xin / Không bán vnbroker trong v1.0
```

> **ĐÃ CHỐT: Không cần ký license thương mại.** Mục 0 `LICENSE.md:9-16` giải phóng chủ sở hữu.
> Hệ quả: v1.0 chỉ có `vninvestcharts` (MPL-2.0). `vnbroker-data` chỉ dùng được khi đã ký license. Cần xác nhận lại phạm vi này khi lập kế hoạch v2.0.

## A3. Sản phẩm nào bán trước

**Câu hỏi bổ sung — chưa có mã trong bộ hồ sơ: v1.0 bán sản phẩm nào?**

Đây là câu quan trọng nhất về mặt điều hành, tôi đề xuất thêm vào nhóm này.

| Tùy chọn | Mô tả | Rủi ro pháp lý |
|---|---|---|
| **A · Chỉ `vninvestcharts`** | Widget MPL-2.0, không có gì phải xin phép | Rất thấp |
| **B · Thêm `vnbroker-data`** | Chỉ lane VCI/KBS/RSS — 8 lane không cần broker | Thấp |
| **C · Đủ cả 3** | Gồm cả brokerage | Cao — cần Q-05, Q-16, tư vấn pháp lý |

Khuyến nghị của tôi: **B**. Vừa có doanh thu sớm, vừa không cần chờ pháp lý.

```
Q-20: A / B / C / khác: ______________________________
```

> **ĐÃ CHỐT: B** — v1.0 bán `vninvestcharts` + `vnbroker-data`. Trì hoãn brokerage sang v2.0.

---

# NHÓM B — PHÁP LÝ VÀ RỦI RO

## B1. Câu hỏi quan trọng nhất

**Q-16 — Cá nhân mua được tầng brokerage (`brokerage.place_order`) không?**

Đây là câu tôi đã hỏi và cần bạn xác nhận lại sau khi đọc ADR-007.

**Nội dung:**
- Thông tin billing ràng buộc được **thuế** — ai xuất hoá đơn, ai chịu thuế
- Nhưng **không** tạo ra **tư cách chủ tài khoản broker**

**Vì sao đây là vấn đề:** nếu cá nhân mua được quyền đặt lệnh, hệ thống sẽ cho họ đặt lệnh chứng khoán thật bằng tài khoản broker của họ. Mà quy trình duyệt `US-014` yêu cầu hồ sơ pháp nhân và người đại diện theo pháp luật — cá nhân không có. Nên **không tồn tại phê duyệt hợp lệ nào**.

| Lựa chọn | Mô tả | Hệ quả |
|---|---|---|
| **A · Giữ nguyên, cá nhân mua hết** | Như Q-16 ban đầu | Cần tư vấn pháp lý trước khi bán |
| **B · Cá nhân mua hết, trừ sản phẩm `requires_kyc`** | Đề xuất của tôi | Quy trình duyệt vẫn tồn tại được |
| **C · Cá nhân chỉ mua sản phẩm không ghi/chuyển tiền** | Chặn chặn hơn | An toàn nhất |

Khuyến nghị của tôi: **B**. Nó không hạn chế cá nhân mua gì thêm, chỉ loại trừ đúng sản phẩm mà quy trình phê duyệt không thể thực hiện nổi với họ.

```
Q-16: A / B / C
Lý do (nếu muốn giải thích): _________________________
```

> **ĐÃ CHỐT: B** — cá nhân mua mọi sản phẩm, trừ sản phẩm có `requires_kyc = true`.
>
> Với quyết định Q-20 (không bán brokerage trong v1.0), BR-12 chưa có tác dụng ngay. Nhưng ràng buộc này **vẫn phải cài trong mô hình dữ liệu** — để khi mở brokerage ở v2.0 không phải sửa lại thiết kế.

## B2. Người chịu trách nhiệm

**Q-05 — Ai là người ký duyệt tầng brokerage?**

Nếu bán `brokerage.place_order` thì cần ai đó có thẩm quyền ký.

```
Q-05: _______________________________________________

Có cần tư vấn luật sư chuyên ngành chứng khoán không? Có / Không
```

## B3. Ràng buộc hạn mức

**Q-04 — Hạn mức mặc định mỗi gói?**

Bối cảnh: hiện tại chỉ có **một** loại hạn mức (`api_calls`) — xem `middleware.py:511`. Muốn nhiều loại thì cần số cho từng loại.

```
Q-04: Số lời gọi/tháng cho gói: ____________
       Số máy cho gói: ____________
       Có cần giới hạn theo sản phẩm không? Có / Không
```

**Q-07 — Hạn mức cụ thể của từng tier?**

Chi tiết hoá Q-04 cho từng gói.

```
Q-07: free: ______ | starter: ______ | pro: ______ | enterprise: ______
```

## B4. Tuân thủ

**Q-11 — Hợp đồng điện tử có cần chữ ký không?**

Áp dụng cho cả khách cá nhân và doanh nghiệp.

```
Q-11: Không cần chữ ký / Cần chữ ký điện tử / Cần ký tay
```

---

# NHÓM C — ĐĂNG KÝ VÀ XÁC THỰC

## C1. Tài khoản cá nhân

**Q-15 — Chấp nhận người dùng email cá nhân không?**

Ví dụ `gmail.com`, `yahoo.com` — hay chỉ nhận email miền công ty?

| Lựa chọn | Mô tả |
|---|---|
| A · Chấp nhận tất cả | Đơn giản, nhiều người dùng hơn |
| B · Chỉ email miền công ty | Bền hơn, nhưng giảm số người dùng |
| C · Cả hai, nhưng khác nhau | Email cá nhân bị giới hạn hơn |

```
Q-15: A / B / C
```

**Q-13 — Có bắt buộc email miền công ty không?**

Nếu bán sản phẩm cần xác minh pháp nhân thì bắt buộc mọi thành viên phải dùng email công ty.

```
Q-13: Không / Bắt buộc với sản phẩm brokerage / Bắt buộc với mọi sản phẩm
```

## C2. Đăng nhập

**Q-14 — Google Workspace miễn phí hay trả phí?**

Câu này chỉ có ý nghĩa nếu bạn chọn làm tích hợp Google. Google Workspace có bản miễn phí (giới hạn người dùng) và bản trả phí.

```
Q-14: Không làm đăng nhập Google / Làm, dùng miễn phí / Làm, sẵn sàng trả phí
```

**Câu hỏi bổ sung — có thêm nhà cung cấp đăng nhập nào không?**

Đề xuất của tôi về thứ tự: ràng buộc email miền công ty → Google Workspace → GitHub/Facebook (v2.0).

```
Q-21: Chỉ email+mật khẩu / Thêm Google / Thêm cả GitHub, Facebook
```

## C3. Khóa API và kích hoạt

**Q-09 — Giới hạn số PAT đồng thời?**

Mỗi khóa API là một công cụ truy cập. Quá nhiều khóa làm khó kiểm soát.

```
Q-09: Số PAT tối đa mỗi tenant: ____________
```

**Q-10 — Kích hoạt máy tính theo gì?**

| Lựa chọn | Dễ dùng | Độ bảo mật |
|---|---|---|
| A · Theo thiết bị | Dễ | Trung bình |
| B · Theo địa chỉ IP | Dễ nhất | Thấp — IP động |
| C · Cả hai | Vừa | Cao |

Khuyến nghị: **C**.

```
Q-10: A / B / C
```

## C4. Quy trình đăng ký

**Q-03 — Cho phép tự đăng ký hay bắt buộc duyệt thủ công?**

Đã chốt: cá nhân tự đăng ký. Còn doanh nghiệp thì sao?

| Lựa chọn | Hợp với |
|---|---|
| A · Cả hai tự đăng ký | Nhanh, rủi ro cao hơn |
| B · Doanh nghiệp duyệt tay | An toàn, chậm ở quy mô lớn |
| C · Duyệt tay, trừ dưới ngưỡng cụ thể | Cân bằng |

```
Q-03: A / B / C
```

> **ĐÃ CHỐT: B** — doanh nghiệp duyệt thủ công, cá nhân tự đăng ký.
>
> Hệ quả vận hành: cần 1 người trực xử lý hồ sơ doanh nghiệp. Ước lượng 10–20 phút mỗi hồ sơ. Với 100 doanh nghiệp là 17–33 giờ công. Nếu vượt, cân nhắc C (duyệt tay trừ dưới ngưỡng).

---

# NHÓM D — NGUỒN LỰC VẬN HÀNH

**Q-18 — Nhân sự cho 80–92 ngày công thế nào?**

Ước lượng chi tiết ở D12 §2.13. Các pha nặng nhất: cắt mã (5–8 ngày), quyết định quyền (5–6), giao diện (18–20).

| Lựa chọn | Hệ quả |
|---|---|
| A · Đủ người làm hết | 80–92 ngày công, khoảng 4 tháng |
| B · Thuê ngoài một phần | Cần thêm công quản lý |
| C · Thu hẹp phạm vi | Chia sẻ trước |

```
Q-18: A / B / C
Nếu B hoặc C: giới hạn phạm vi v1.0 vào: _________________________
```

**Q-19 — Ngân sách hạ tầng hằng tháng?**

Chưa ấn định vì chưa biết giá thực tế. Cần cho các thành phần ở D11 §2.1.

```
Q-19: Ngân sách tối đa / tháng: ____________
Có sẵn hạ tầng không (VPS, hosting)? Có / Không / Một phần
```

---

# NHÓM E — CÂU HỎI KỸ THUẬT

Ba câu này **tôi tự điều tra được**, không cần bạn trả lời. Tôi đã đóng I-01..I-05, còn lại 3 câu:

| Mã | Câu hỏi | Tại sao chưa tự làm |
|---|---|---|
| I-06 | 18 route `tenant-*` và 14 route `admin-*` có route nào lẫn miền tài chính không? | Cần đọc 32 route |
| I-07 | Nội dung hàm `resolveCoreBaseUrl` (`coreAdapter.js:8`) là gì? | Cần đọc thân hàm |
| I-08 | Cổng `/access/capabilities` (`coreAdapter.js:105`) có khớp cổng trong D07 không? | Cần so khớp tên |

---

# NHÓM F — QUYẾT ĐỊNH KỸ THUẬT

Bốn câu này phát sinh sau khi xác minh mã. Chúng không phải việc bạn phải biết đáp, nhưng cần chốt để tôi thiết kế tiếp.

**NQ-01 — Doanh nghiệp vượt hạn mức thì chặn cứng hay chỉ cảnh báo?**

Hiện tại mã cho `enterprise` đi tiếp và chỉ gắn header cảnh báo (`middleware.py:404-409`). Nhưng PRD yêu cầu chặn cứng khi vượt hạn (FR-06). Hai thứ mâu thuẫn.

| Lựa chọn | Mô tả |
|---|---|
| A · Chặn tất cả khi vượt | Đúng như PRD |
| B · Cảnh báo cho doanh nghiệp, chặn cho cá nhân | Dễ thương lượng với khách lớn |
| C · Cảnh báo nhiều lần rồi mới chặn | Mềm nhất |

```
NQ-01: A / B / C
```

> **ĐÃ CHỐT: B** — doanh nghiệp cảnh báo mềm, cá nhân chặn cứng.
>
> Khớp với hành vi hiện có tại `middleware.py:404-409` (enterprise được đi tiếp kèm header cảnh báo). Nghĩa là với doanh nghiệp, code gần như giữ nguyên.
>
> **Việc phải làm:** tách nhánh theo `tenant_type`. Hiện mã dùng `tenant.plan == ENTERPRISE` (`:404`) — cần đổi sang kiểm tra `tenant_type`. Nếu không, khách cá nhân được cấu hình `plan` kiểu enterprise sẽ vô tình thoát chặn.

**NQ-02 — Plan `custom` và `internal` có giá trị hạn mức riêng không?**

`features_map` (`views_webhooks.py:240-245`) chỉ có 4 plan: free, starter, pro, enterprise. Hai plan `custom` và `internal` tồn tại ở `CoreTenant.PlanChoices` nhưng không có trong bản đồ — nên rơi về giá trị mặc định, tức **đang trả số sai**.

```
NQ-02: Bỏ 2 plan này khỏi hệ thống / Bổ sung giá trị cho chúng / Giữ nguyên
```

**NQ-03 — Giữ tên cổng `/access/capabilities` hay đổi theo thiết kế D07?**

D07 thiết kế cổng `/api/v1/entitlements/verify`. Nhưng adapter hiện dùng `/access/capabilities` (`coreAdapter.js:105`).

| Lựa chọn | Chi phí |
|---|---|
| A · Giữ `capabilities` | Không sửa adapter |
| B · Đổi theo D07 | Phải sửa adapter |

```
NQ-03: A / B
```

**NQ-04 — Công thức tính tiền khi đổi gói giữa kỳ?**

Trùng Q-08 ở mục A1. Kết quả sẽ dùng cho cả hai.

```
NQ-04: (dùng chung với Q-08)
```

---

# PHỤ LỤC — Bản đồ ảnh hưởng

Câu nào trả lời thì sửa được những gì.

| Mã | Sửa được | Trạng thái |
|---|---|---|
| Q-01 | Bán sản phẩm `vnbroker` | ✅ Chốt — Mục 0, không cần ký license |
| Q-02, Q-17 | Trang giá · hóa đơn · kiểm thử thanh toán | ⬜ Chặn Pha 6 |
| Q-03 | Luồng đăng ký doanh nghiệp | ✅ Chốt — duyệt tay |
| Q-04, Q-07 | Bảng `catalog_meter` · logic hạn mức | ⬜ Chặn Pha 3–4 |
| Q-05 | Cổng phê duyệt · KYC | ⬜ Hoãn — chưa bán brokerage |
| Q-06 | Tên sản phẩm · hợp đồng · UI | ⬜ Cần cho Pha 8 |
| Q-08, NQ-04 | Công thức tiền giữa kỳ | ⬜ Chặn Pha 6 |
| Q-09 | Giới hạn PAT | ⬜ Chặn Pha 5 |
| Q-10 | Bảng `tenant_activation` | ⬜ Chặn Pha 5 |
| Q-11 | Mẫu hợp đồng | ⬜ Chặn Pha 6 |
| Q-12 | Kỳ thanh toán | ⬜ Chặn Pha 6 |
| Q-13, Q-15 | Quy tắc đăng ký | ⬜ Chặn Pha 5 |
| Q-14, Q-21 | Tích hợp đăng nhập | ⬜ Tuỳ chọn |
| **Q-16** | **Ràng buộc BR-12 · ranh giới pháp lý** | ✅ Chốt — loại trừ `requires_kyc` |
| Q-18 | Phạm vi · lịch trình | ⬜ Chặn Pha 8+ |
| Q-19 | Hạ tầng | ⬜ Chặn Pha 9 |
| **Q-20** | **Phạm vi sản phẩm v1.0** | ✅ Chốt — widget + data |
| NQ-01 | Logic hạn mức theo loại khách | ✅ Chốt — cảnh báo / chặn |
| NQ-02 | `features_map` | ⬜ Chặn Pha 2 |
| NQ-03 | Tên cổng | ⬜ Chặn Pha 4 |

---

# ĐƯỜNG ĐI KHẢ THI

Sau khi chốt 5 câu, lộ trình rút gọn còn:

| Pha | Nội dung | Còn cần gì |
|---|---|---|
| **1** | Cắt mã | Không cần gì — **bắt đầu được ngay** |
| **2** | Nợ kỹ thuật | NQ-02 |
| **3** | Mô hình dữ liệu | Q-04, Q-07 |
| **4** | Quyết định quyền | NQ-03 |
| **5** | Xác thực | Q-09, Q-10, Q-13, Q-15 |
| **6** | Thanh toán | **Q-02, Q-17**, Q-08, Q-12 |
| **7** | Quản trị | Q-06 |
| **8** | Giao diện | Q-18 |
| **9** | Vận hành | Q-19 |
| ~~11~~ | ~~Tier C~~ | ~~Chuyển sang v2.0 — chờ license + luật~~ |

⇒ **Toàn bộ v1.0 còn 14 câu mở, trong đó 2 câu chặn nhiều nhất là về giá.**

---

# ĐIỀU KHÔNG CẦN CÂU TRẢ LỜI

Những việc này tôi đã tự quyết và ghi vào tài liệu:

| Quyết định | Lý do |
|---|---|
| Cắt 11 app khỏi mã nguồn | Giữ đường liên bảo mật và thanh toán đã chạy thật |
| 5 app giữ lại | Rẻ và đã kiểm thử |
| Cột `tenant_type` từ migration đầu | Thêm sau rất khó |
| Mỗi email 1 tài khoản cá nhân | Chống lạm dụng, không chặn nhầm |
| Cá nhân trả trước theo tháng | Tránh rủi ro nợ, không cần hạn mức VNPay |
| Không dùng Kubernetes · không dịch vụ vi mô | Quá nặng với quy mô v1.0 |
| Cache quyền chỉ bật khi có cơ chế vô hiệu hoá đồng thời | Nếu không thì không bật cache |
| Ghi nhật ký quyền theo nguyên tắc fail-closed | Không có vết chứng minh thì không cấp quyền |
| Trì hoãn tier C sang v2.0 | Quyết định Q-20 |

---

# VIỆC CẦN LÀM TRƯỚC MỌI THỨ KHÁC

Không phải câu hỏi, nhưng chặn mọi việc còn lại:

| # | Việc | Vì sao | Mức |
|---|---|---|---|
| 1 | **Xử lý bí mật trong kho mã** | Nếu khoá vẫn nằm trong lịch sử, mọi tính năng thêm vào đều không bảo đảm được điều gì | **Bắt buộc** |
| 2 | **Xác định lane nào của `vnbroker-data` không cần broker** | SSI bắt buộc cần tài khoản môi giới — phải nói rõ trước khi bán | **Bắt buộc** |

Vì Mục 0 `LICENSE.md:9-16` giải phóng chủ sở hữu, phạm vi v1.0 là:

| Sản phẩm | Trạng thái v1.0 | Ghi chú |
|---|---|---|
| `vninvestcharts` | ✅ Bán được ngay | MPL-2.0, không cần xin phép |
| `vnbroker-data` | ✅ **Bán được** | Cần văn bản cấp quyền cho khách (T2b) |
| `vnbroker-brokerage` | ⬜ V2.0 | Cần tư vấn pháp lý |

> **Không cần ký license.** Nhưng cần **văn bản cấp giấy phép thương mại cho khách hàng** — vì khách là licensee bên thứ ba, chịu ràng buộc Mục 2 của `LICENSE.md`. Chi tiết ở D06 §3.5.2.

### Về việc đóng `write_gate` cho `brokerage/`

Vì đã quyết định trì hoãn brokerage, việc này **không còn bắt buộc cho v1.0**. Nhưng vẫn nên làm trước v2.0 — vì `brokerage/base.py:278-288` có `place_order` mà không có `dry_run` mặc định. Đây là lỗ hổng trong thư viện bạn sở hữu, dù đang dùng hay không.
