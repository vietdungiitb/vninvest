# Code Quality Constitution — Project Hardening Backend
**Ngày**: 2026-05-28

---

## 1. Purpose

Chất lượng của workstream này không được đo bằng việc “đã có plan” hay “đã refactor xong” trên bề mặt. Chất lượng ở đây nghĩa là:

1. migration tenant isolation an toàn và trung thực với dữ liệu thật,
2. security hardening có guardrail ở cả app layer và gateway layer,
3. refactor không làm vỡ packaging/runtime path,
4. greenfield phase không rewrite sai những foundation đã tồn tại.

---

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Tenant isolation migration | 95% risk coverage | Sai migration gây lỗi dữ liệu lâu dài |
| Auth throttling | 90% risk coverage | Dễ regress silently khi refactor auth |
| Gateway throttle config | 85% risk coverage | Thiếu config sẽ mở abuse surface |
| Backend fat-file refactor | 85% risk coverage | Dễ drift contract hoặc import cycle |
| Web packaging integrity | 90% risk coverage | `packages/web` có build lane đặc thù `build-community` |
| VNPay/IPN foundation | 95% risk coverage | Payment logic sai gây data/financial risk |
| Notification delivery | 85% risk coverage | Retry/dedup sai dễ spam hoặc drop delivery |
| AI cost control | 85% risk coverage | Quota/cache/router sai dễ tăng chi phí hoặc degrade UX |

---

## 3. Coverage theater prevention

Những thứ sau không được tính là evidence đủ:

1. Chỉ nói “đúng manage.py path” nhưng không khóa env bootstrap.
2. Chỉ nói “đã fix tenant nullable” nhưng không có orphan audit/quarantine proof.
3. Chỉ giữ app-level throttling mà không thêm gateway-level guard theo plan.
4. Chỉ chạy `npm run build` thay cho `build-community` rồi kết luận web gate pass.
5. Chỉ nói Phase 2 là greenfield nhưng mô tả sai thực trạng `commercial/` foundation.

---

## 4. Fitness-to-purpose scenarios

### Scenario Q1 — Migration chạy khi còn orphan

What can go wrong:
- team set `NOT NULL` khi dữ liệu chưa sạch, làm migration fail giữa chừng hoặc ép workaround nguy hiểm.

What must be proven:
- pre-audit output và quarantine decision có thật.

### Scenario Q2 — QG-1 pass giả do env cũ

What can go wrong:
- test command đúng path nhưng env local thiếu dependency của `packages/core/backend`, dẫn đến gate không tái lập được.

What must be proven:
- bootstrap command và env vars tối thiểu được ghi rõ và chạy được.

### Scenario Q3 — Refactor web pass unit nhưng fail packaging lane

What can go wrong:
- `packages/web` refactor nhìn ổn ở test cục bộ nhưng `build-community` vỡ do shell/build ownership đặc thù.

What must be proven:
- `npm --prefix packages/web run build-community` pass.

### Scenario Q4 — Payment phase rewrite sai domain

What can go wrong:
- team xây lại subscription/invoice layer thay vì chỉ thêm payment flow, tạo drift business data.

What must be proven:
- reuse foundation `Subscription`, `QuotaRecord`, `Invoice`.

---

## 5. AI session discipline

1. Bắt đầu từ file neo gần nhất và gate gần nhất.
2. Sau edit đầu tiên phải chạy validation hẹp ngay.
3. Không kết luận “execution-ready” nếu chưa khóa prerequisite.
4. Không dùng workaround `system_tenant` để ép migration đi qua.
5. Không dùng `npm run build` thay `build-community` cho package-web gate.
6. Kết thúc slice phải cập nhật ledger/progress/modified-files và module tree.
