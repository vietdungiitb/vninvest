# D01 — Quy trình phát triển phần mềm & PRD

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất — chờ duyệt
**Vai trò:** Product Manager · **Phạm vi:** SaaS multi-tenant, cấp quyền phần mềm

---

# PHẦN A — QUY TRÌNH PHÁT TRIỂN ĐƯỢC ÁP DỤNG

## A.1 Chuẩn tham chiếu

| Chuẩn | Áp dụng cho | Nguồn |
|---|---|---|
| **IEC/ISO 26514** (System & software engineering — design & development) | Vòng đời thiết kế, phân ca chức năng | ISO/IEC 26514-1:2008 |
| **SWEBOK v4** (Software Engineering Body of Knowledge) | Kiến thức PM, khả năng thương lượng yêu cầu | IEEE CS, 2014 |
| **IEEE 830 / ISO/IEC/IEEE 29148** | Đặc tả yêu cầu (SRS) | ISO/IEC/IEEE 29148:2018 |
| **ISO/IEC 25010** (SQuaRE) | Chất lượng sản phẩm 8 đặc tính | ISO/IEC 25010:2023 |
| **C4 Model** (Context, Container, Component, Code) | Kiến trúc đa tầng | Simon Brown |
| **ArcGIS / ERD chuẩn Crow's Foot** | Mô hình dữ liệu | — |
| **OWASP ASVS L2 / L3** | Yêu cầu bảo mật ứng dụng | OWASP |
| **WCAG 2.2 AA** | Yêu cầu tiếp cận giao diện | W3C |
| **BPMN 2.0** | Mô hình quy trình nghiệp vụ | OMG |
| **OpenAPI 3.1** | Hợp đồng API | OpenAPI Initiative |

## A.2 Vòng đời 6 pha

```
     ┌───────────────────────── VÒNG LẶP LIÊN TỤC ─────────────────────────┐
     │                                                                      │
 ①  │  KHỞI TẠO & PHÂN TÍCH      ②  ĐẶC TẢ        ③  THIẾT KẾ            │
     │  Mô tả nghiệp vụ          Phân tích chi     Kiến trúc, dữ liệu,    │
     │  Stakeholder, phạm vi     tiết, nguy cơ     API, UI/UX               │
     │                           User story                               │
     │                                                                      │
 ④  │  LẬP KẾ HOẠCH & XÂY DỰNG  ④b KIỂM THỬ       ⑤  TRIỂN KHAI         │
     │  WBS, ước lượng,          Unit, integration,  Triển khai, hạ tầng,  │
     │  rủi ro                   E2E, UAT, security   giám sát, vận hành    │
     │                                                                      │
 ⑥  │  VẬN HÀNH & CẢI TIẾN ────────────────────────────────────────────────┘
        SLA, chỉ số, phản hồi khách hàng, roadmap v2
```

### Đầu ra bắt buộc mỗi pha

| Pha | Đầu ra | Tài liệu trong bộ hồ sơ |
|---|---|---|
| ① | PRD, sơ đồ phạm vi, danh sách stakeholder | **D01** (phần B) |
| ② | BRD, user story, acceptance criteria, risk register | **D02** |
| ③ | Quy trình nghiệp vụ, kiến trúc, ERD, API spec, UI/UX | **D03–D08** |
| ④ | WBS, kế hoạch sprint, tiêu chí nghiệm thu | **D12** |
| ④b | Test strategy, security test plan | **D10** |
| ⑤ | Kiến trúc triển khai, runbook, SLO/SLI | **D11** |
| ⑥ | KPI, cơ chế phản hồi, backlog v2 | D12 |

## A.3 Cổng chất lượng (Quality Gate) — điều kiện mới sang pha sau

| Cổng | Nội dung | Điều kiện pass |
|---|---|---|
| **QG-1** | Phạm vi đóng | PRD được stakeholder ký · ngoài phạm vi đã liệt kê tường minh |
| **QG-2** | Yêu cầu đầy đủ | 100% user story có acceptance criteria · không còn "TBD" |
| **QG-3** | Thiết kế | ERD không trùng khóa · API không trùng `operationId` · threat model đã lập |
| **QG-4** | Sẵn sàng build | WBS có ước lượng · phụ thuộc đã xác định · rủi ro đã ghi nhận |
| **QG-5** | Sẵn sàng phát hành | Unit ≥ 80% coverage · 0 lỗi nghiêm trọng · OWASP ASVS pass · UAT ký |
| **QG-6** | Vận hành | Runbook có · SLO định nghĩa · rollback test thành công |

## A.4 Vòng đời đặc biệt: SaaS khác gì

| Đặc điểm | Ảnh hưởng thiết kế |
|---|---|
| Đa khách thuê (multi-tenant) | **Tenant là tham số bắt buộc ở mọi truy vấn** — không phải tối ưu, là yêu cầu an toàn |
| Đa phiên bản | API cần versioning từ ngày đầu |
| Bán nhiều sản phẩm | Mô hình dữ liệu phải có chiều `product` ngay từ đầu (không thêm sau) |
| Doanh thu | Cần billing tích hợp từ đầu, không "thêm sau" |
| Khách tự phục vụ | UI phải tự giải thích, không phụ thuộc hỗ trợ thủ công |
| Pháp lý theo sản phẩm | License và điều khoản khác nhau theo từng sản phẩm → mô hình phải lưu được |

## A.5 Cấu trúc bộ hồ sơ 12 tài liệu

| Mã | Tài liệu | Tiêu chuẩn áp dụng |
|---|---|---|
| D01 | Quy trình PM + PRD | SWEBOK v4, ISO 26514 |
| D02 | BRD — yêu cầu nghiệp vụ chi tiết | ISO/IEC/IEEE 29148 |
| D03 | Quy trình nghiệp vụ | BPMN 2.0 |
| D04 | Kiến trúc hệ thống + ADR | C4, ISO/IEC 25010 |
| D05 | Phân rã chức năng + module map | ISO 26514-4 |
| D06 | ERD + mô hình dữ liệu | Crow's Foot |
| D07 | Đặc tả API | OpenAPI 3.1 |
| D08 | UI/UX | WCAG 2.2 AA, Nielsen |
| D09 | Bảo mật & tuân thủ | OWASP ASVS L2/L3 |
| D10 | Chiến lược kiểm thử | ISO/IEC/IEEE 29119 |
| D11 | Vận hành & triển khai | SRE — Google SRE Book |
| D12 | Quản lý dự án | PMI PMBOK |

---

# PHẦN B — PRD (PRODUCT REQUIREMENTS DOCUMENT)

## B.1 Tóm tắt điều hành

Xây dựng nền tảng SaaS đa khách thuê, cho phép khách hàng doanh nghiệp tự mua, tự quản lý và tự kiểm soát quyền sử dụng các phần mềm của nhà cung cấp. Nền tảng **không** thực hiện giao dịch tài chính, **không** nắm giữ tài sản, **không** thực thi lệnh thay khách hàng.

> **Phạm vi v1.0 đã chốt ngày 2026-10-02 (Q-20).** Chỉ bán hai sản phẩm không gắn brokerage:
>
> | Sản phẩm | Trạng thái v1.0 |
> |---|---|
> | `vninvestcharts` | ✅ Bán được ngay — MPL-2.0, không cần xin phép |
> | `vnbroker-data` | ⬜ Chờ Q-01 — cần license thương mại |
> | `vnbroker-brokerage` | ⬜ Chuyển sang v2.0 — cần license + tư vấn pháp lý |
>
> Hệ quả: **v1.0 không cần luật sư chuyên ngành chứng khoán**, không cần quy trình KYC, không cần cơ chế phê duyệt pháp lý. Nhưng vẫn phải cài sẵn các ranh giới đó trong mô hình dữ liệu để khi mở brokerage không phải thiết kế lại.

## B.2 Bối cảnh vấn đề

| Vấn đề | Hậu quả |
|---|---|
| Bán phần mềm dạng gói đóng cứng, không kiểm soát quyền | Không thu được tiền định kỳ · không có dữ liệu ai dùng gì |
| Kiểm soát quyền bằng cờ `is_pro` | Không truy vết được · không thu hồi được khi vi phạm |
| Mỗi phần mềm một hệ thống riêng | Chi phí vận hành nhân lên số sản phẩm |
| Không tách biệt quyền "đọc dữ liệu" và quyền "đặt lệnh" | Rủi ro pháp lý khi bán cả hai dưới một gói |

## B.3 Mục tiêu sản phẩm

| # | Mục tiêu | Chỉ số thành công |
|---|---|---|
| G1 | Kiểm soát quyền theo thời gian thực | Quyết định entitlement ≤ 50 ms p95 |
| G2 | Tách biệt quyền theo mức độ rủi ro | 100% capability nguy hiểm có cờ `requires_approval` |
| G3 | Thêm phần mềm mới không cần sửa code | Sản phẩm thứ N chỉ cần INSERT dữ liệu |
| G4 | Doanh thu định kỳ | Có VNPay + Stripe, đối soát tự động |
| G5 | Tuân thủ | Audit log đầy đủ 100% thao tác quản trị |
| G6 | Khách tự phục vụ | ≥ 80% yêu cầu hỗ trợ giải quyết được tự động |

## B.4 Đối tượng người dùng

> **Cập nhật 2026-10-02:** Hệ thống phục vụ **hai loại khách hàng** theo ADR-007. Xem B.4.1.

| Vai trò | Mô tả | Nhu cầu chính |
|---|---|---|
| **Chủ doanh nghiệp khách hàng** (Owner) | Người ký hợp đồng, quyết định ngân sách | Xem tổng chi, đổi gói, thêm người dùng |
| **Quản trị viên IT khách hàng** (Tenant Admin) | Người quản trị hạ tầng | Tạo PAT, cấp quyền thành viên, xem audit |
| **Nhà phát triển khách hàng** (Developer) | Người tích hợp SDK | Tạo PAT, kiểm tra entitlement, xem quota |
| **Nhà phát triển cá nhân** (Individual Dev) | Người dùng cá nhân, tự thanh toán | Đăng ký nhanh, mua gói tháng, không cần hợp đồng |
| **Nhân viên vận hành nhà cung cấp** (Ops) | Quản trị đa tenant | Duyệt đăng ký, xử lý sự cố, theo dõi chỉ số |
| **Quản trị viên sản phẩm** (Product Admin) | Người quyết định giá và quyền | Khai báo sản phẩm, tier, capability, hạn mức |
| **Quyển duyệt pháp lý** (Compliance) | Phê duyệt quyền rủi ro cao | Duyệt `requires_approval`, xem hồ sơ KYC |

### B.4.1 Hai mô hình khách hàng

> Quyết định của Owner, 2026-10-02. Nguồn: ADR-007.

| Tiêu chí | Doanh nghiệp | Cá nhân |
|---|---|---|
| `tenant_type` | `organization` | `individual` |
| Mã số thuế | Bắt buộc | Không có |
| Hợp đồng | Bắt buộc | Không cần |
| Người đại diện theo pháp luật | Bắt buộc | Không có |
| Cách đăng ký | **Ops duyệt thủ công** | **Tự đăng ký tức thì** |
| Chu kỳ thanh toán | Năm / quý | Tháng |
| Hình thức trả | Chuyển khoản, VNPay doanh nghiệp | **Tiền trả trước** (ADR-008) |
| Chứng từ | Hoá đơn VAT | Biên nhận |
| Gia hạn tự động | Không | Không |
| Số tài khoản trên 1 email | Không giới hạn | **Tối đa 1** (ADR-009) |

**Quyết định Q-16 của Owner:** cá nhân mua được **mọi** sản phẩm.

> **Phản biện đã ghi trong ADR-007:** nếu cá nhân mua được `brokerage.place_order`, quy trình `US-014` yêu cầu hồ sơ pháp nhân sẽ không có phê duyệt hợp lệ nào — vì cá nhân không có người đại diện theo pháp luật. Thiết kế đang chờ xác nhận xem có áp dụng đề xuất loại trừ sản phẩm `requires_kyc = true` hay không.

**Quyết định Q-18 của Owner:** chấp nhận tỷ lệ rời bỏ cao ở nhóm cá nhân là hiển nhiên.
**Quyết định Q-19 của Owner:** mỗi email chỉ 1 tài khoản cá nhân.
**Q-17:** chưa ấn định giá · thanh toán theo tháng.

### B.4.2 Đăng ký doanh nghiệp — duyệt thủ công (Q-03 đã chốt)

Owner chọn phương án B: doanh nghiệp phải được Ops duyệt, cá nhân tự đăng ký.

**Chi phí vận hành ước tính**

| Số doanh nghiệp | Công công trực | Ghi chú |
|---:|---|---|
| 20 | ~5 giờ/tháng | 1 người trực là đủ |
| 100 | ~25 giờ/tháng | Vẫn khả năng |
| 300 | ~75 giờ/tháng | Cần 2 người hoặc chuyển sang phương án C |

Ước lượng: 10–20 phút mỗi hồ sơ (đọc hợp đồng, tra MST, quyết định, ghi nhật ký).

> **Ngưỡng cân nhắc chuyển sang phương án C:** khi vượt 150 hồ sơ chờ, hoặc thời gian chờ trung bình vượt 2 ngày làm việc. Lúc đó duyệt tự động cho hồ sơ dưới ngưỡng rủi ro thấp.

### B.4.3 Quy tắc chặn hạn mức theo loại khách (NQ-01 đã chốt)

Owner chọn phương án B: doanh nghiệp cảnh báo mềm, cá nhân chặn cứng.

| Loại | Vượt hạn mức | Hành vi |
|---|---|---|
| Doanh nghiệp | Vẫn gọi được | Trả header cảnh báo + ghi nhật ký + gửi cảnh báo |
| Cá nhân | Chặn | Trả 429 `quota_exceeded` |

**Khớp với hành vi hiện có** tại `identity_access/middleware.py:404-409` — enterprise được đi tiếp kèm header `X-Quota-Warning`.

**Việc phải sửa:** hiện mã kiểm tra `tenant.plan == ENTERPRISE` (`:404`). Phải đổi sang kiểm tra `tenant_type`. Nếu không, khách cá nhân được cấu hình `plan` kiểu enterprise sẽ vô tình thoát chặn — đây là lỗ hổng logic.

## B.5 Phạm vi sản phẩm

### B.5.1 Trong phạm vi (v1.0)

| # | Chức năng | Mô tả |
|---|---|---|
| S1 | Đăng ký & xác minh tenant | Doanh nghiệp: luồng hồ sơ có duyệt · Cá nhân: tự đăng ký tức thì |
| S2 | Xác thực | Email/mật khẩu, PAT cho tích hợp máy, Turnstile chống spam |
| S3 | Quản lý thành viên | Owner/Admin/Member, phân quyền 3 vai trò |
| S4 | Danh mục sản phẩm | Khai báo product, tier, capability, meter |
| S5 | Cấp quyền (entitlement) | Kiểm tra quyền theo PAT + capability, trả quyết định có mã lý do |
| S6 | Hạn mức & định lượng | Meter theo kỳ, chặn cứng khi vượt |
| S7 | Thanh toán | Doanh nghiệp: chuyển khoản/quý/năm · Cá nhân: trả trước/tháng |
| S8 | Kích hoạt máy (activation) | Ràng buộc số máy / IP theo gói |
| S9 | Nhật ký kiểm toán | Ghi mọi thao tác quản trị, truy vấn được |
| S10 | Bảng điều khiển vận hành | Chỉ số tenant, doanh thu, sự cố |
| S11 | SDK gate | Hàm `require_capability()` chặn trước khi gọi API nhà cung cấp |
| S12 | Cổng thông tin sản phẩm | Giá, điều khoản, tài liệu |

### B.5.2 Ngoài phạm vi (v1.0) — ghi tường minh để tránh tranh chấp

| # | Hạng mục | Lý do |
|---|---|---|
| X1 | Xử lý giao dịch chứng khoán | SaaS không đặt lệnh — khách tự thực thi |
| X2 | Nắm giữ tài khoản / tài sản | Ngoài mô hình rủi ro đã chọn |
| X3 | Tư vấn đầu tư | Hoạt động cần giấy phép khác |
| X4 | Lưu trữ dữ liệu tài chính khách hàng | Khách tự lo dữ liệu |
| X5 | Đăng ký tự động không duyệt | Kiểm soát rủi ro ở v1.0 |
| X6 | Đa quốc gia / nhiều tiền tệ thanh toán | VND + USD là đủ v1.0 |
| X7 | Ứng dụng di động | Chưa có nhu cầu định lượng |
| X8 | Tự động đóng lệnh (auto-trading) | Khách tự chịu trách nhiệm |

## B.6 Yêu cầu chức năng (FR) — cấp cao

| Mã | Yêu cầu | Đo lường | Ưu tiên |
|---|---|---|---|
| FR-01 | Hệ thống xác thực PAT và trả về tenant tương ứng | 100% lệnh API có xác thực | P0 |
| FR-02 | Hệ thống quyết định quyền theo (tenant, sản phẩm, capability) | Trả quyết định ≤ 50 ms p95 | P0 |
| FR-03 | Hệ thống trả mã lý do chuẩn khi từ chối | 10 mã lý do định nghĩa sẵn | P0 |
| FR-04 | Hệ thống ghi nhật ký mọi thao tác quản trị | 100% thao tác có audit | P0 |
| FR-05 | Hệ thống đo định lượng theo meter theo kỳ | Chính xác ±0.1% | P0 |
| FR-06 | Hệ thống chặn cứng khi vượt hạn mức | Trả 429 `quota_exceeded` | P0 |
| FR-07 | Hệ thống xử lý thanh toán và đối soát tự động | 99% webhook xử lý thành công | P0 |
| FR-08 | Quản trị viên sản phẩm khai báo sản phẩm mới không cần deploy | Thêm sản phẩm = thao tác UI | P0 |
| FR-09 | Quyển duyệt pháp lý duyệt capability rủi ro cao | Có hồ sơ duyệt lưu vết | P0 |
| FR-10 | Khách tự tải hợp đồng, hóa đơn, giấy phép | Không cần gọi hỗ trợ | P1 |
| FR-11 | Hệ thống gửi thông báo hết hạn trước | Thông báo trước 14/7/1 ngày | P1 |
| FR-12 | Bảng điều khiển vận hành hiển thị chỉ số | Độ trễ dữ liệu ≤ 5 phút | P1 |

## B.7 Yêu cầu phi chức năng (NFR)

| Mã | Yêu cầu | Tiêu chí đo |
|---|---|---|
| NFR-01 | Hiệu năng API quyết định quyền | p95 ≤ 50 ms · p99 ≤ 150 ms |
| NFR-02 | Hiệu năng cổng thông tin | LCP ≤ 2.5 s (p75, chậm 4G) |
| NFR-03 | Khả dụng | 99.9% theo tháng (cho API quyết định quyền) |
| NFR-04 | RTO / RPO | RTO ≤ 1 giờ · RPO ≤ 15 phút |
| NFR-05 | Bảo mật | OWASP ASVS L2 tối thiểu · không rò rỉ dữ liệu tenant |
| NFR-06 | Tuân thủ WCAG | WCAG 2.2 AA |
| NFR-07 | Không lộ secret trong log | 0 secret trong log ở mọi mức log |
| NFR-08 | Truy vết được mọi quyết định quyền | 100% quyết định có ID tra cứu ngược |
| NFR-09 | Sao lưu | Sao lưu tự động hằng ngày · kiểm tra khôi phục hằng quý |
| NFR-10 | Mở rộng | Thêm sản phẩm không cần migration · hỗ trợ ≥ 1 000 tenant |

## B.8 Ràng buộc

| Mã | Ràng buộc | Nguồn |
|---|---|---|
| C-01 | `vnbroker` bị cấm dùng thương mại nếu không có văn bản cho phép | `vnbroker/LICENSE.md:28-36` |
| C-02 | `vninvestcharts-widget` MPL-2.0 — được sửa dụng thương mại nhưng **không được sửa file nguồn** | MPL-2.0 §3 |
| C-03 | Phải có `CORE_DATABASE_URL` và `DJANGO_DEBUG` hợp lệ ở production | `settings.py` raise `ImproperlyConfigured` |
| C-04 | Multi-tenant là yêu cầu bắt buộc, không phải tối ưu | Yêu cầu G2 |

## B.9 Rủi ro cấp sản phẩm

| Mã | Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|---|
| PR-01 | Chưa có license thương mại `vnbroker` | Cao | **Chặn bán** | Ký văn bản cho phép trước khi mở bán |
| PR-02 | Bị phân loại là bên trung gian tài chính | Thấp | Cao | Tách sản phẩm · hợp đồng định vị pháp nhân |
| PR-03 | Khách dùng quyền sai mục đích | Trung bình | Cao | KYC · duyệt pháp lý · audit log |
| PR-04 | Secret lộ trong kho mã | **Đã xảy ra** | Rất cao | Xoá lịch sử · xoay khoá · chặn tái diễn |
| PR-05 | Rò rỉ dữ liệu giữa các tenant | Thấp | Rất cao | Kiểm thử chéo tenant bắt buộc ở mỗi release |

## B.10 Giả định

| Mã | Giả định |
|---|---|
| A-01 | Khách hàng là pháp nhân Việt Nam |
| A-02 | Thanh toán qua VNPay là chính, Stripe là dự phòng quốc tế |
| A-03 | Khách hàng tự chịu trách nhiệm tuân thủ pháp luật khi tích hợp phần mềm |
| A-04 | Số tenant v1.0 ≤ 100, dự kiến 12 tháng ≤ 1 000 |
| A-05 | Có thể thuê ngoài cho hạ tầng và hỗ trợ |

## B.11 Tiêu chí thành công của sản phẩm

| Mã | Tiêu chí | Đo bằng |
|---|---|---|
| SC-01 | 0 rò rỉ dữ liệu tenant | Kiểm thử tự động chạy mỗi release |
| SC-02 | Thêm sản phẩm mới ≤ 30 phút, không deploy | Đo thực tế trên staging |
| SC-03 | Quyết định quyền p95 ≤ 50 ms | Dashboard giám sát |
| SC-04 | 99.9% khả dụng | SLO công bố |
| SC-05 | 0 lỗi nghiêm trọng tại thời điểm phát hành | Danh sách lỗi đóng |

## B.12 Câu hỏi cần Owner quyết

| # | Câu hỏi | Chặn cái gì |
|---|---|---|
| Q-01 | Ký license thương mại `vnbroker` khi nào? | FR-08, phát hành |
| Q-02 | Giá mỗi sản phẩm / mỗi tier? | S12, S7 |
| Q-03 | Có cho phép self-serve hay bắt buộc duyệt thủ công? | FR-01 v1.0 |
| Q-04 | Hạn mức mặc định mỗi gói? | FR-05 |
| Q-05 | Ai là người ký duyệt pháp lý tầng C? | FR-09 |
| Q-06 | Có dùng lại thương hiệu "vninvest" không? | Định pháp nhân |

---

## B.13 Phụ lục — Số liệu đo được trong repo nguồn

Đã đo ngày 2026-10-02 tại `packages/core/backend/src`:

| App | File | LOC | Migration | Test LOC |
|---|---|---|---|---|
| `identity_access` | 113 | 19 466 | 28 | 6 631 |
| `commercial` | 24 | 2 593 | 7 | 222 |
| `tenant_lifecycle` | 12 | 488 | 1 | 146 |
| `ops_audit` | 24 | 2 269 | 5 | 441 |
| **Tổng src/** | **663** | **117 327** | **117** | **41 032** |

**Quan sát quan trọng:** tỉ lệ test so với code của `commercial` là **222 / 2 593 = 8.6%** — thấp nhất trong các app được cắt. Đây là khu vực phải bù test khi tách.

**Phụ thuộc ra ngoài của `commercial` + `identity_access`:**

| Nhóm | Có dùng | Bắt buộc giữ? |
|---|---|---|
| Django, DRF, drf-spectacular | ✅ | Có |
| cryptography, stripe | ✅ | Có (PAT pepper, thanh toán) |
| `ops_audit`, `tenant_lifecycle`, `service_ops` | ✅ | **Phải giữ** |
| `user_workspace`, `data_ingest` | ✅ | Phải cắt phần phụ thuộc |

**Quan sát quan trọng:** tỉ lệ test so với code của `commercial` là **222 / 2 593 = 8.6%** — thấp nhất trong các app được cắt. Đây là khu vực phải bù test khi tách.

### B.13.1 Điều chỉnh sau khi xác minh mã (2026-10-02)

Bảng "Phụ thuộc ra ngoài" ở trên là đo theo toàn app. Đo chính xác theo **từng file** cho kết quả khác:

| Phụ thuộc | Số file mã thật | Chi tiết |
|---|---:|---|
| `user_workspace`, `data_ingest` | **4 file** | `register.py` (2 import) · `middleware.py` (1) · `models.py` (1) · `password_reset.py` (1) |
| Trong đó là file kiểm thử | 4 file | Không ảnh hưởng mã chạy thật |

⇒ **Nới ràng buộc này.** Chỉ **4 file mã thật** chạm app sẽ bị cắt, không phải cả app. Chi tiết ở D05 §2.2.

**Phát hiện mới, nghiêm trọng hơn kỳ vọng:**

| # | Phát hiện | Vị trí | Hệ quả |
|---|---|---|---|
| 1 | `middleware.py` chỉ đọc `QuotaRecord`, **không** đọc `QuotaHistory` | `:488,518` | Bỏ 8 cột cứng sẽ **làm hỏng middleware** — phải sửa cùng lúc |
| 2 | Doanh nghiệp `enterprise` vượt hạn vẫn được đi tiếp | `:404-409` | Trả 200 khi đã vượt — trái FR-06 |
| 3 | `features_map` chỉ có 4 plan, thiếu `custom`/`internal` | `views_webhooks.py:240-248` | Hai plan đó rơi về giá trị mặc định — **đang trả số sai** |
| 4 | `prorated_amount` cố định 0 | `:259-260` | Chưa tính tiền khi đổi gói giữa kỳ (liên quan Q-08) |

⇒ Nợ kỹ thuật D-01 và D-03 nặng hơn đánh giá ban đầu: không chỉ khó mở rộng, mà **đang có lỗi số liệu**.

### B.13.2 Điều chỉnh về phía giao diện

| Hạng mục | Kết quả xác minh |
|---|---|
| Tổng route | **57** (`routeCatalog.js`, `Object.freeze` tại `:5`) |
| Route cần cắt | **9** — `ai`, `vip`, `transactions`, `portfolios`, `watchlist`, `advertising`, `screener`, `whale` |
| Route giữ lại | **48** |
| Adapter có hardcode endpoint? | **KHÔNG** — `resolveCoreBaseUrl(env)` tại `coreAdapter.js:8,101` |

⇒ Phía giao diện **nhẹ hơn nhiều** phía máy chủ: chỉ 9/57 route. Adapter không cần sửa.

---

**Tài liệu tiếp theo:** D02 — BRD yêu cầu nghiệp vụ chi tiết
**Cổng chất lượng áp dụng:** QG-1 (chờ duyệt)