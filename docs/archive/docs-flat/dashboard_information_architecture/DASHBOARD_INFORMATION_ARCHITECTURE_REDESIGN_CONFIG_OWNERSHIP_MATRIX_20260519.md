# CONFIG OWNERSHIP MATRIX — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19

---

## 1. Ownership summary

| Area | Artifact / Config | Owner | Change in this workstream |
|---|---|---|---|
| Live dashboard route | `frontend/src/pages/modern/ModernDashboard.jsx` | Frontend Product UI | Yes |
| Package-host route shell | `frontend/src/pages/PackageDashboardHost.jsx` | Frontend Platform | Yes |
| Package page slot contract | `packages/web/src/pages/DashboardPage.js` | Frontend Platform | Yes |
| Global dashboard layout CSS | `frontend/src/index.css` | Frontend Product UI | Yes |
| Alert feed semantics | core-api alert endpoints | Backend Signal Intelligence | No |
| Portfolio analytics payload | core-api portfolio endpoints | Backend User Workspace | No |
| Realtime quote cadence | realtime hooks / backend streams | Frontend Realtime + Backend Market Serving | No |
| Existing package-host feature flag | `REACT_APP_ENABLE_PACKAGE_SHELL_HOST` | Frontend Platform | No new flag required |

---

## 2. Decision rights

### Frontend Product UI

- Quyết định triad proportions, panel order, visual hierarchy.
- Quyết định micro-metrics nào được giữ ở header.

### Frontend Platform

- Quyết định slot contract mới ở `DashboardPage.js`.
- Quyết định compatibility strategy cho `renderBubble` deprecation.

### Backend teams

- Không cần thay đổi contract cho v1.
- Chỉ can thiệp nếu frontend vi phạm route usage hoặc contract assumptions.

---

## 3. Hard governance notes

1. Không thêm feature flag mới cho layout v1 trừ khi rollout risk được chứng minh.
2. Nếu route swap xảy ra trong cùng nhịp triển khai, owner frontend platform phải sign-off parity trước.
3. Mọi yêu cầu backend change để hỗ trợ layout phải bị block mặc định và mở workstream mới nếu thực sự cần.

---

## 4. SaaS native architecture authority

| Decision | Owner | Non-owner constraints |
|---|---|---|
| Canonical dashboard frontend architecture (`packages/web` + host bridge) | Frontend Platform Lead | Legacy page owners không được tự declare `ModernDashboard` là end-state |
| Dashboard route cutover readiness | Frontend Platform Lead + Tech Lead | Product UI không được close workstream nếu package-host chưa parity |
| Backend contract changes for dashboard | Core API Guild / Backend Lead | Frontend team không được yêu cầu vá `backend/` legacy monolith như shortcut |
| OpenAPI metadata compliance | Core API Guild + QA | Không có contract change nào được merge thiếu metadata/gates |

Temporary legacy bridge nếu tồn tại phải có owner rõ ràng, expiry date, và recorded evidence. Không owner thì bridge bị coi là vi phạm kiến trúc.
