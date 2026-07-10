# Handoff Package: Tenant Admin Console Upgrade v1.0

> **Trạng thái:** `READY FOR REVIEW` — Chờ phê duyệt Sign-off (xem `09-SIGN-OFF.md`)
> **Phiên bản:** 1.0.0
> **Ngày tạo:** 2026-06-16
> **Tác giả:** Antigravity (Advanced Agentic Coding Agent)
> **Dự án:** VNInvest Workspace
> **Package gốc (DEPRECATED):** `docs/feedback/tenant_admin_master_upgrade_plan.md`

---

## 1. Mục đích Package này

Package này là **bộ tài liệu bàn giao hoàn chỉnh (Complete Handoff Package)** cho đội ngũ Engineering triển khai nâng cấp Tenant Admin Console từ MVP sang **Multi-Tenant SaaS chuẩn doanh nghiệp**.

**Mục tiêu:** Đội code có thể triển khai **ngay lập tức** mà **KHÔNG cần hỏi lại yêu cầu** (self-contained), tuân thủ nguyên tắc: **Không code khi chưa được phê duyệt**.

---

## 2. Cấu trúc thư mục & Thứ tự đọc khuyến nghị

```
docs/handoff/tenant-admin-upgrade/
├── 00-README-HANDOFF.md           ← BẮT ĐẦU TẠI ĐÂY (File này)
├── 01-ARCHITECTURE-DECISIONS.md   # ADR: Kiến trúc tổng thể, Middleware stack, Fallback logic
├── 02-DATA-MIGRATION.md           # Migration plan, scripts, rollback, verification queries
├── 03-BACKEND-SPEC/
│   ├── 01-middleware-spec.md      # TenantResolutionMiddleware, TenantQuotaMiddleware chi tiết
│   ├── 02-api-contracts.yaml      # OpenAPI 3.0 fragments cho TẤT CẢ endpoint mới
│   ├── 03-models-changes.md       # Model changes: CoreTenant, TenantMember, CorePATCredential, AuditLog, QuotaRecord
│   ├── 04-stripe-webhook-spec.md  # Stripe Webhook: Signature, Idempotency, Retry, DLQ
│   └── 05-saml-sso-spec.md        # SAML SSO: WorkOS/Auth0 integration, metadata flow
├── 04-FRONTEND-SPEC/
│   ├── 01-component-tree.md       # Component hierarchy, routes, props, state
│   ├── 02-state-management.md     # Tenant Context, Switcher sync, Persistence
│   ├── 03-api-client-interceptor.md # Axios/TanStack Query interceptor gắn X-Tenant-ID
│   └── 04-charts-data-contract.md # Recharts data contract cho Usage History
├── 05-CONSTANTS-ENUMS.md          # Single Source of Truth: Policies, Error Codes, Tenant Statuses, Roles
├── 06-SECURITY-HARDENING.md       # CORS, CSP, Rate Limits, Secret Rotation, IP Whitelist validation
├── 07-TEST-SPEC/
│   ├── 01-unit-test-cases.md      # Unit test cases chi tiết (middleware, services, utils)
│   ├── 02-contract-test-spec.md   # Contract test (Pact/OpenAPI) cho API endpoints
│   └── 03-e2e-scenarios.md        # E2E scenarios (Playwright/Cypress) critical paths
├── 08-DEPLOYMENT-ROLLBACK.md      # Feature flags, Migration order, Rollback procedures
└── 09-SIGN-OFF.md                 # Template phê duyệt: Tech Lead, Security, PM, QA, DevOps
```

### Thứ tự đọc bắt buộc cho từng vai trò

| Vai trò | Thứ tự ưu tiên |
|---------|----------------|
| **Tech Lead / Architect** | 00 → 01 → 03-BACKEND-SPEC/01 → 03-BACKEND-SPEC/02 → 05 → 08 → 09 |
| **Backend Developer** | 00 → 01 → 02 → 03-BACKEND-SPEC/* → 05 → 07-TEST-SPEC/01 → 09 |
| **Frontend Developer** | 00 → 01 → 04-FRONTEND-SPEC/* → 05 → 03-BACKEND-SPEC/02 (API contracts) → 07-TEST-SPEC/03 → 09 |
| **QA / SDET** | 00 → 07-TEST-SPEC/* → 03-BACKEND-SPEC/02 → 04-FRONTEND-SPEC/03 → 09 |
| **DevOps / Platform** | 00 → 08 → 03-BACKEND-SPEC/04 → 06 → 09 |
| **Security Reviewer** | 00 → 06 → 03-BACKEND-SPEC/01 → 03-BACKEND-SPEC/05 → 09 |
| **Product Manager** | 00 → 01 (Executive Summary) → 04-FRONTEND-SPEC/01 (UX flows) → 09 |

---

## 3. Quy tắc bắt buộc (Non-Negotiables)

1.  **KHÔNG CODE TRƯỚC KHI SIGN-OFF:** Không ai được tạo file `.py`, `.js`, `.ts`, `.yaml` (config thực thi), migration script, Dockerfile... cho tính năng này cho đến khi `09-SIGN-OFF.md` có đủ chữ ký: **Tech Lead + Security + PM**.
2.  **Single Source of Truth:** Tất cả constants (policies, error codes, roles, statuses) **CHỈ** được định nghĩa trong `05-CONSTANTS-ENUMS.md`. Backend & Frontend **bắt buộc** import/generate từ file này (hoặc shared package).
3.  **API First:** Backend triển khai theo `03-BACKEND-SPEC/02-api-contracts.yaml`. Frontend consume theo contract đó. Thay đổi contract → Cập nhật file YAML → Review lại → Sign-off lại.
4.  **Test-Driven Handoff:** Mỗi spec trong `03-BACKEND-SPEC/` và `04-FRONTEND-SPEC/` có checklist `Definition of Done` kèm test case tham chiếu trong `07-TEST-SPEC/`. Dev viết test **trước hoặc song song** implementation.
5.  **Observability by Default:** Mọi endpoint mới phải có: Structured logging (JSON), Metrics (Prometheus: latency, error rate, quota usage), Trace ID propagation.
6.  **Security by Default:** Mọi input validate, output encode. Không log secrets/PII. Mọi endpoint mới qua Security Review checklist trong `06-SECURITY-HARDENING.md`.

---

## 4. Phạm vi 3 Giai đoạn (Recap)

| Giai đoạn | Thời gian | Focus chính | Files liên quan chính |
|-----------|-----------|-------------|----------------------|
| **Phase 1: Foundation** | 3 tuần | Tenant Resolution Middleware, Data Migration, Audit Logs API, UI Migration, Tenant Switcher | 01, 02, 03/01, 03/02, 03/03, 04/01, 04/02, 04/03, 05, 07/01 |
| **Phase 2: Growth** | 4 tuần | Stripe Billing Portal, Checkbox Policies, Usage Charts, Quota Middleware | 03/01 (Quota), 03/02, 03/03, 03/04, 04/01, 04/04, 05, 07/01, 07/02 |
| **Phase 3: Enterprise** | 3 tuần | SAML SSO (WorkOS/Auth0), PAT IP Whitelisting (CIDR) | 03/02, 03/03, 03/05, 04/01, 05, 06, 07/01, 07/03 |

> **Lưu ý:** Package này bao gồm spec cho **TẤT CẢ 3 PHASE**. Đội có thể implement phase-by-phase nhưng spec đã hoàn chỉnh upfront để tránh rework kiến trúc.

---

## 5. Cross-reference với Audit Docs (Context)

Package này giải quyết các Gap từ các audit sau:
- `AUDIT_AI_ADVISORY_DESIGN_20260421.md` → Gap #1 (AuthZ), Gap #2 (Scopes)
- `AUDIT_MULTI_TIMEFRAME_OHLCV_20260521.md` → Gap #4 (Usage Observability)
- `AUDIT_JWT_PAT_CLEANUP_20260506.md` → Gap #5 (Billing), PAT Security
- `AUDIT_COMPAT_API_LAYER_20260509.md` → API Layer compatibility
- `AUDIT_DASHBOARD_DATA_SYNC_20260516.md` → Tenant Switcher data sync

---

## 6. Definition of "Package Complete" (Trước khi Sign-off)

- [ ] Tất cả 22 file markdown trong cấu trúc trên đã tồn tại và có nội dung.
- [ ] Mỗi file có: **Mục tiêu**, **Đầu vào/Đầu ra**, **Chi tiết kỹ thuật**, **Mermaid diagrams** (nếu áp dụng), **Checklist DoD**, **Rủi ro/Mitigation**.
- [ ] Cross-link giữa các file hoạt động (relative paths).
- [ ] `05-CONSTANTS-ENUMS.md` chứa **tất cả** constants dùng trong package.
- [ ] `03-BACKEND-SPEC/02-api-contracts.yaml` valid OpenAPI 3.0 (có thể validate bằng `swagger-codegen` hoặc `redocly`).
- [ ] `09-SIGN-OFF.md` liệt kê đầy đủ reviewer bắt buộc với vai trò.
- [ ] File gốc `docs/feedback/tenant_admin_master_upgrade_plan.md` đã có banner **DEPRECATED** trỏ về package này.

---

## 7. Liên hệ & Escalation

| Vấn đề | Người liên hệ |
|--------|---------------|
| Kiến trúc, Middleware, Data Model | Tech Lead / Architect (Author của 01, 02, 03-BACKEND-SPEC) |
| Frontend UX, State, Components | Frontend Lead (Author của 04-FRONTEND-SPEC) |
| API Contract, Integration | Backend Lead + Frontend Lead (Joint owner 03/02) |
| Security, Compliance | Security Engineer (Owner 06, Reviewer 03/01, 03/05) |
| Testing Strategy | QA Lead / SDET (Owner 07-TEST-SPEC) |
| Deployment, Infra, Feature Flags | DevOps / Platform (Owner 08) |
| Business Requirements, Priority | Product Manager (Approver 09) |

---

## 8. Changelog Package

| Phiên bản | Ngày | Tác giả | Thay đổi |
|-----------|------|---------|----------|
| 1.0.0 | 2026-06-16 | Antigravity | Tạo package handoff hoàn chỉnh từ plan gốc |

---

**➡️ BƯỚC TIẾP THEO:** Đọc `01-ARCHITECTURE-DECISIONS.md` để hiểu kiến trúc quyết định trước khi đi vào chi tiết spec.