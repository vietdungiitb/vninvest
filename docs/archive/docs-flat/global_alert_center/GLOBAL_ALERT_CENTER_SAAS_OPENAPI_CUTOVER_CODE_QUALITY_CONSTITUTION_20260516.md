# Code Quality Constitution — Global Alert Center SaaS OpenAPI Cutover

## 1. Purpose

Chất lượng của chương trình này không được định nghĩa bằng “build pass”. Chất lượng nghĩa là:

1. `Global Alert Center` phải đọc đúng một source of truth từ core.
2. `Global symbol matrix` phải là foundation thật, không chỉ là naming decoration.
3. Alert feed phải đúng semantics hơn là “trông có vẻ hợp lý”.
4. Per-user delivery phải đúng audience hơn là “có data là được”.
5. Legacy cutover chỉ được phép khi parity và shadow gates đã đủ.

---

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Global matrix foundation | 95% risk coverage | Sai universe truth sẽ làm hỏng toàn bộ 4 workstreams còn lại |
| Planner + freshness | 95% risk coverage | Planner sai sẽ tạo crawl thừa hoặc thiếu dữ liệu alert-critical |
| Canonical alert facts | 95% risk coverage | Sai fact model sẽ làm feed “đúng-looking but wrong” |
| Per-user delivery | 95% risk coverage | Cross-user leakage là lỗi nghiêm trọng |
| OpenAPI contracts | 100% contract coverage | Contract drift sẽ phá cutover web/native |
| Legacy sunset gates | 100% gate coverage | Đây là hard-stop phase |

---

## 3. Coverage theater prevention

Những thứ sau không được coi là bằng chứng chất lượng:

1. Chỉ build pass nhưng không có payload proof cho alert-center contracts.
2. Chỉ render được UI nhưng browser vẫn đang tự synthesize alert nghiệp vụ.
3. Chỉ có list endpoint hoạt động nhưng thiếu pagination/rate limit/error envelope.
4. Chỉ có migration docs nhưng không có parity/shadow evidence trước cutover.

---

## 4. Fitness-to-purpose scenarios

### Scenario Q1 — Matrix đúng tên nhưng không đúng foundation

Hệ thống vẫn giữ một universe riêng trong scheduler hoặc alert engine. Đây là fail-level issue.

### Scenario Q2 — Browser hiển thị alert đẹp nhưng tự synthesize `stale_quote`

Đây là fail-level issue vì client đang làm business truth.

### Scenario Q3 — User nhận alert cho symbol họ không hold/track/watch

Đây là fail-level privacy/relevance issue.

### Scenario Q4 — AI lane bị trộn vào main feed mặc định

Đây là product failure vì main feed mất tính time-critical.

### Scenario Q5 — Legacy sunset trước parity/shadow

Đây là governance failure, block merge/release ngay.
