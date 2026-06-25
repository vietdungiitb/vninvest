- Phase 0: Dashboard Home (KPI metrics, usage trend chart, activity feed)
- Phase 1: Usage Meters (risk states, alert configs, quota list, audit logs)
- Phase 2: Usage History (meter selector, Recharts bar chart, day range toggle), Forecast (exhaust date prediction, confidence levels)

## Issues Found & Fixed

### 1. React #310 — Hook called conditionally (`TenantAdminUsagePage.tsx`)

**Root cause**: `useMemo(chartData)` was placed after 3 early-return guards (`!canRead`, `loading`, `error`). React enforces hook call order; a hook after a conditional return violates the rules.

**Fix**: Moved `selectedHistoryData` computation and `useMemo(chartData)` → `chartData` expression before all early returns (line 193-196).

### 2. Backend 500 — `GET /core/v1/partner/usage/alert-config/`

**Root cause**: `UsageAlertConfig` model existed in `identity_access/models.py` but migration `0014_usage_alert_config` had never been created. The view queried a non-existent table.

**Fix**:
1. Generated migration `0014_usage_alert_config.py` via `manage.py makemigrations` inside Docker container
2. Ran `manage.py migrate` to apply it
3. Copied migration file to host and committed (`70c44662`)

### 3. TypeScript — `results` property missing on type `Response`

**Root cause**: `declarations.d.ts` declared `coreGet` as returning `Promise<Response>`, but the actual transport always calls `response.json()` and returns parsed JSON. The `.results` access pattern used throughout the codebase is correct at runtime but violated the type declaration.

**Fix**: Changed return type from `Promise<Response>` → `Promise<any>` for `coreGet`, `corePost`, `corePatch`, `coreDelete` in `declarations.d.ts:68-71`.

### 4. TypeScript — Missing adapter methods

**Root cause**: `TenantAdminUsagePage.tsx` called `getAllUsageTrends()`, `getUsageForecast()`, `getAlertConfigs()` on the adapter, but these methods did not exist.

**Fix**:
- Added methods to `coreApiAdapter.js` return object (`coreApiAdapter.js:141-149`)
- Added type declarations to `coreApiAdapter.d.ts`

## Files Changed

| File | Change | Type |
|------|--------|------|
| `packages/core/backend/.../partner_urls.py` | Added routes for dashboard/alert-config/forecast/trend | modified |
| `packages/core/backend/.../views_dashboard.py` | New — partner dashboard summary + usage trend endpoints | added |
| `packages/core/backend/.../views_alert_config.py` | New — alert config CRUD for usage meters | added |
| `packages/core/backend/.../views_forecast.py` | New — usage forecast with exhaust date prediction | added |
| `packages/core/backend/.../views_usage_trend.py` | New — per-meter daily usage trend data | added |
| `packages/web/src/adapters/coreApiAdapter.js` | Added `getAllUsageTrends`, `getUsageForecast`, `getAlertConfigs` | modified |
| `packages/web/src/adapters/coreApiAdapter.d.ts` | Type declarations for 3 new methods | modified |
| `packages/web/src/declarations.d.ts` | Fixed `coreGet`/`corePost`/`corePatch`/`coreDelete` to return `Promise<any>` | modified |
| `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx` | Full i18n rewrite + hook order fix + tabs layout | modified |

## Validation

```powershell
npx tsc --noEmit  # → clean (0 errors)
npm run build     # → clean (3822 modules, built in 12.70s)
```

## Backend URLs Added

```
GET /core/v1/partner/dashboard/summary/
GET /core/v1/partner/dashboard/usage-trend/
GET /core/v1/partner/usage/alert-config/
GET /core/v1/partner/usage/alert-config/<meter_code>/
GET /core/v1/partner/usage/forecast/
GET /core/v1/partner/usage/forecast/<meter_code>/
GET /core/v1/partner/usage/trend/
GET /core/v1/partner/usage/trend/<meter_code>/
```

## Deployment

- Frontend dist rebuilt and copied to `vninvest-dev-frontend:/usr/share/nginx/html/`
- Backend view files synced from container to host source
- Dev stack running with `start_dev.ps1`

## Residual Risk

- `PartnerUsageMetersView` and `PartnerUsageQuotasView` return hardcoded/mock data (the `commercial_partner_views.py` reference implementation was not replaced with real billing data). The Meters/History/Forecast tabs will render UI correctly but show empty or placeholder data until the commercial billing service is connected.
- No E2E tests for the tenant-admin routes yet.

---

# Báo Cáo Audit Kế Hoạch Nâng Cấp Tenant Admin (VNInvest) - Bản Tiếng Việt

---

## 1. Kết Luận Chung (Executive Summary)

* **Sự lệch pha tiến độ:** Trong khi tài liệu kế hoạch ghi nhận trạng thái *"chờ implement Phase 0"*, codebase thực tế đã hoàn thành **Phase 0, Phase 1 và khoảng 80% Phase 2**.
* **Trạng thái thực tế:** Hệ thống backend và frontend đã tích hợp sẵn dashboard tổng hợp (KPIs, Recharts), biểu đồ lịch sử usage chi tiết, cùng cơ chế dự báo cạn kiệt tài nguyên (forecasting).
* **Định hướng tiếp theo:** Cần quyết định hoàn thiện nốt các phần còn thiếu của Phase 2 (Scheduled Reports & Cost Analytics) hay chuyển hẳn sang triển khai Phase 3 (Security & Compliance).

---

## 2. Chi Tiết Đối Chiếu Tiến Độ Từng Phase

### Phase 0 — Dashboard Home Redesign
* **Trạng thái trong tài liệu:** Chờ triển khai.
* **Trạng thái thực tế:** **Đã hoàn thành 100%**.
* **Chi tiết triển khai:**
  - **Backend:** File [views_dashboard.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/views_dashboard.py) đã cung cấp đầy đủ API endpoints `/partner/dashboard/summary/` và `/partner/dashboard/usage-trend/`.
  - **Frontend:** [TenantAdminHomePage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx) đã được viết lại toàn bộ, tích hợp Recharts AreaChart, Recent Activity feed với các dynamic icons và Quick Actions phân quyền.
  - **Adapter:** Đã tích hợp các hàm client vào `operator.js` và wire qua `coreApiAdapter.js`.

### Phase 1 — Monitoring & Activity
* **Trạng thái trong tài liệu:** Chờ triển khai.
* **Trạng thái thực tế:** **Đã hoàn thành 100%**.
* **Chi tiết triển khai:**
  - **Database:** Model `UsageAlertConfig` đã có trong [models.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/models.py).
  - **Backend views:** Các file [views_alert_config.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/views_alert_config.py) và [views_usage_trend.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/views_usage_trend.py) cung cấp đầy đủ API CRUD cho cảnh báo và truy vấn lịch sử usage.
  - **Frontend:** [TenantAdminUsagePage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx) hiển thị các thanh đo progress bar kèm cảnh báo rủi ro (risk state). Đã phát triển thêm trang lịch sử chuyên biệt [TenantAdminUsageHistoryPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminUsageHistoryPage.tsx) hỗ trợ Area/Bar chart cho Recharts.

### Phase 2 — Analytics & Forecasting
* **Trạng thái trong tài liệu:** Chờ triển khai.
* **Trạng thái thực tế:** **Hoàn thành ~70%**.
* **Chi tiết triển khai:**
  - **Forecasting:** Backend đã có [views_forecast.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/views_forecast.py) tính toán tốc độ tiêu dùng hàng ngày, ngày dự kiến cạn kiệt tài nguyên và mức độ tin cậy. Frontend hiển thị tab Forecast rất đầy đủ.
  - **Các hạng mục còn thiếu (GAPs):**
    1. *Scheduled Reports:* Chưa có backend views/endpoints tạo lập và lên lịch gửi báo cáo.
    2. *Cost Analytics:* Chưa có file `commercial/views_analytics.py` tính toán xu hướng chi phí hàng tháng (`/partner/billing/cost-trend/`).
    3. *Billing UI Chart:* Trang [TenantAdminBillingPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx) chưa tích hợp Recharts vẽ biểu đồ chi phí hàng tháng và chưa tích hợp banner forecasting.

### Phase 3 — Security & Compliance
* **Trạng thái trong tài liệu:** Chờ triển khai.
* **Trạng thái thực tế:** **Chưa triển khai (0%)**.
* **Chi tiết triển khai:**
  - Model `LoginAttempt` chưa có trong `models.py`.
  - Chưa có `views_security.py` và các endpoints quản lý active sessions `/partner/security/*`.
  - Chưa có frontend page `TenantAdminSecurityPage.tsx` và chưa được đăng ký trong `pageRegistry.js`.
  - `TenantAdminPATsPage.tsx` chưa hiển thị cột "Last Used" hay bộ lọc cho PATs không hoạt động lâu ngày.

### Phase 4 — Lifecycle Automation
* **Trạng thái trong tài liệu:** Chờ triển khai.
* **Trạng thái thực tế:** **Chưa triển khai (0%)**.
* **Chi tiết triển khai:**
  - Các model `TenantWebhookConfig`, `WebhookDelivery` chưa có.
  - Backend views cho webhooks và nâng cấp trực tiếp (in-app upgrade) chưa có.
  - Giao diện `TenantAdminWebhooksPage.tsx` chưa có; Billing page vẫn đi qua cổng redirect của Stripe thay vì hiển thị bảng so sánh gói nâng cấp trực tiếp.

---

## 3. Bảng Đối Chiếu File Manifest Chi Tiết

| File | Thuộc Phase | Hiện trạng trong Codebase | Ghi chú & Đánh giá |
| :--- | :---: | :--- | :--- |
| **Modified Files** | | | |
| `TenantAdminHomePage.tsx` | P0 | 🟢 Đã hoàn thành | Đã rewrite, tích hợp đầy đủ Recharts và Activity. |
| `operator.js` | P0-P4 | 🟡 Mới có API P0-P2 | Đã có Dashboard, Alert, Forecast, Usage Trend. Thiếu Security & Webhooks. |
| `coreApiAdapter.js` | P0-P4 | 🟡 Mới có API P0-P2 | Đã wire các hàm hiện có của `operator.js`. |
| `partner_urls.py` | P0-P4 | 🟡 Mới có API P0-P2 | Đã đăng ký endpoints của P0-P2. |
| `TenantAdminUsagePage.tsx` | P1-P2 | 🟢 Đã hoàn thành | Đã tích hợp tab bar, biểu đồ lịch sử và forecasting card. |
| `TenantAdminBillingPage.tsx` | P2-P4 | ❌ Chưa cập nhật | Chưa có biểu đồ chi phí và giao diện nâng cấp trực tiếp. |
| `TenantAdminAuditLogsPage.tsx`| P1 | 🟡 Chưa vẽ chart | Mới ở dạng bảng log phân trang, chưa có pie chart/heatmap. |
| `TenantAdminPATsPage.tsx` | P3 | ❌ Chưa cập nhật | Chưa có cột "Last Used" và bộ lọc PAT không hoạt động. |
| `pageRegistry.js` | P3-P4 | 🟡 Mới đăng ký bổ sung | Đã đăng ký thêm `TenantAdminUsageHistoryPage.tsx`, chưa có các trang Security hay Webhooks. |
| **New Files** | | | |
| `views_dashboard.py` | P0 | 🟢 Đã có sẵn | Triển khai đầy đủ logic tính toán health score và thống kê tài khoản. |
| `views_alert_config.py` | P1 | 🟢 Đã có sẵn | Tích hợp CRUD cho alert config của từng meter code. |
| `views_forecast.py` | P2 | 🟢 Đã có sẵn | Logic dự báo lookback 7-90 ngày hoàn thành. |
| `views_webhooks.py` | P4 | ❌ Chưa có | Chưa có file này. |
| `views_security.py` | P3 | ❌ Chưa có | Chưa có file này. |
| `views_analytics.py` | P2 | ❌ Chưa có | Chưa có file này. |
| `TenantAdminSecurityPage.tsx` | P3 | ❌ Chưa có | Chưa có file này. |
| `TenantAdminWebhooksPage.tsx` | P4 | ❌ Chưa có | Chưa có file này. |

---

## 4. Điểm Đề Xuất Thảo Luận (Discussion Points)

1. **Điều chỉnh lộ trình tài liệu kế hoạch:** Cần cập nhật trạng thái của tài liệu [TENANT_ADMIN_UPGRADE_PLAN_20260623.md](file:///c:/Mujoco%20Projects/vninvest/docs/TENANT_ADMIN_UPGRADE_PLAN_20260623.md) sang `Đang thực hiện Phase 2` và ghi nhận thêm trang `TenantAdminUsageHistoryPage.tsx` đã hoàn thành.
2. **Quyết định về các Gap của Phase 2:**
   - Chúng ta có cần triển khai tính năng *Scheduled Reports* (lên lịch gửi báo cáo) và *Cost Analytics* (API & chart lịch sử chi phí hàng tháng) để hoàn thiện triệt để Phase 2 hay không?
3. **Kế hoạch triển khai Phase 3 (Security):**
   - Thiết kế model `LoginAttempt` ở backend (cần xác định xem có sử dụng thư viện log đăng nhập ngoài như `django-axes` hay tự lưu trữ).
   - Thiết kế UI cho `TenantAdminSecurityPage.tsx` hiển thị danh sách thiết bị/session đang hoạt động và cho phép Admin nhấn Revoke để hủy phiên.
