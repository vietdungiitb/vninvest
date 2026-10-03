# Traceability Matrix (RTM): SaaS Native Remediation (2026-05-26)

| Req ID | Mô tả Yêu cầu | Code Task | Tech Spec | Test Case |
|---|---|---|---|---|
| REQ-01 | Token xác thực lưu Hash | BE-1.1.1 -> BE-1.1.4 (DONE) | TS-1.1 | TC-1.1 |
| REQ-02 | Chống spam/rate limit | BE-1.1.3, BE-1.1.4 (DONE) | TS-1.1 | TC-1.2 |
| REQ-03 | Outbox Celery Beat 30s | BE-1.2.3 (DONE) | TS-1.2 | TC-1.3 |
| REQ-04 | Đăng ký UI hoàn thiện | FE-2.2.1 -> FE-2.2.4 (DONE) | TS-2.2 | TC-2.2 |
| REQ-05 | Lỗ hổng Idempotency (select_for_update) | BE-1.2.4 | TS-1.2 | TC-1.4 |
| REQ-06 | URL routing views_operator phải được wire vào urls.py | BE-1.3.1 | TS-1.3 | TC-1.5 |
| REQ-07 | coreApiAdapter.js phải có 7 phương thức mail config | FE-2.1.1 | TS-2.1 | TC-2.1 |
| REQ-08 | Route /operations-center/mail-config trong routeCatalog | FE-2.1.2 | TS-2.1 | TC-2.1 |
| REQ-09 | pageRegistry phải có entry ShellMailConfigPage | FE-2.1.3 | TS-2.1 | TC-2.1 |
| REQ-10 | ShellMailConfigPage.js phải được tạo mới | FE-2.3.1 -> FE-2.3.4 | TS-2.3 | TC-2.3 |
| REQ-11 | ShellOperationsCenterPage phải có card/link mail-config | FE-2.3.5 | TS-2.3 | TC-2.3 |
