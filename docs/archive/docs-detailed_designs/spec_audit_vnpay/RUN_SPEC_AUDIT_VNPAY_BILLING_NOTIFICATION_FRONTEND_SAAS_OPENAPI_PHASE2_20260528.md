# Run Spec Audit — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Audit questionnaire baseline

---

## 1. Mục tiêu

Kiểm định rằng implementation phase 2 bám đúng doc pack, không drift khỏi SaaS-native OpenAPI posture.

---

## 2. Audit questions

1. Commercial frontend có nằm hoàn toàn trong `packages/web` không.
2. Consumer billing/payment có chỉ dùng `coreApiAdapter` + commercial domain module không.
3. Route `/commercial/payment-return` có khớp với backend return URL policy không.
4. UI có dùng query params làm truth cuối cho payment không.
5. Invoices list có pagination posture đúng theo OpenAPI rules không.
6. Notification UX có bị ship vượt contract backend không.
7. Error envelope có được map vào UI thay vì dump raw payload không.
8. i18n tiếng Việt cho commercial flows có đầy đủ không.
9. Route catalog, page registry, build targets, capabilities có đồng bộ không.
10. Governance artifacts và evidence template có được điền đầy đủ không.

---

## 3. Output format bắt buộc

Mọi finding phải theo mẫu:

```text
[Severity] <Requirement ID> - <Tóm tắt finding>
Evidence:
- file/path
- hành vi quan sát được
Risk:
- regression hoặc drift gì sẽ xảy ra
Required fix:
- thay đổi bắt buộc để đóng finding
```

Severity levels:
1. `CRITICAL`: sai payment truth, direct legacy usage, security leak.
2. `HIGH`: contract drift, route drift, missing pagination, false notification state.
3. `MEDIUM`: maintainability, missing i18n, incomplete evidence.
4. `LOW`: copy/consistency issues.

---

## 4. Automatic block conditions

1. Payment return không dùng status endpoint.
2. Browser call đến IPN route.
3. Notification route/preferences ship khi backend contract chưa khóa.
4. Commercial code đặt ngoài `packages/web`.
5. Direct fetch còn tồn tại trong page/component/hook commercial.