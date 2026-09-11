# Tenant Admin Console — i18n + Permission Gating + CSS Refactor Plan

> **Version:** 1.0  
> **Date:** 2026-06-23  
> **Status:** Active  

---

## I. Tổng quan

**Mục tiêu:** Đưa 8 trang tenant-admin còn lại lên cùng chuẩn với `TenantAdminHomePage.tsx` đã redesign:
1. **i18n** — `useI18n()` cho toàn bộ text, thêm keys vào `en.js`/`vi.js`
2. **Permission gating** — `ability.can()` cho actions và navigation
3. **JSX/CSS** — Thay `createElement` → JSX (SSOPage), inline styles → `shellPage__*` classes
4. **SPA navigation** — Thay `<a>` → `<Link>` (SSOPage)
5. **Tạo UsageHistoryPage** — Nếu cần legacy parity

**Ràng buộc:**
- Chỉ dùng `coreApiAdapter.js` cho API calls
- Không dùng `response.ok` pattern
- Text mới qua i18n tiếng Việt đầy đủ dấu
- Chạy validation: `npx tsc --noEmit` → `npm run build` → `.\start_dev.ps1`

## II. Danh sách files cần thay đổi

| File | Loại thay đổi |
|------|--------------|
| `packages/web/src/pages/tenant-admin/TenantAdminCapabilitiesPage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | i18n + permission + inline styles |
| `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx` | i18n + permission + JSX rewrite + `<Link>` |
| `packages/web/src/pages/tenant-admin/TenantAdminUsageHistoryPage.tsx` | Tạo mới (nếu legacy có) |
| `packages/web/src/i18n/en.js` | Keys mới cho `tenantAuditLogs`, bổ sung thiếu |
| `packages/web/src/i18n/vi.js` | Keys mới cho `tenantAuditLogs`, bổ sung thiếu |
| `packages/web/src/pages/pageRegistry.js` | Route cho UsageHistoryPage (nếu tạo) |
| `packages/web/src/main.tsx` | Route cho UsageHistoryPage (nếu tạo) |

## III. Thứ tự thực hiện

| Step | Page | Dòng | Độ phức tạp | Lý do |
|------|------|------|-------------|-------|
| 1 | CapabilitiesPage | 126 | Thấp | Đã dùng `usePortfolio()`, đơn giản nhất |
| 2 | BillingPage | 203 | Thấp | Ngắn thứ 2, pattern `FieldCard` dễ extract |
| 3 | UsagePage | 297 | Trung bình | `UsageBar` component, `Intl` → i18n |
| 4 | MembersPage | 342 | Trung bình | Tab buttons, table, `confirm()` → modal |
| 5 | ServiceAccountsPage | 370 | Trung bình | Modal overlay trùng với PATs |
| 6 | AuditLogsPage | 344 | Trung bình | Log cards, pagination, filter form |
| 7 | PATsPage | 570 | Cao | Dài nhất, token cards, secret reveal |
| 8 | SSOPage | 437 | Cao | `createElement` → JSX, `<a>` → `<Link>` |
| 9 | UsageHistoryPage | — | Trung bình | Tạo mới từ legacy |

## IV. Pattern chung cho mỗi trang

### 4.1 Thêm imports

```diff
+ import { useI18n } from "../../context/LangContext.js";
+ import { usePortfolio } from "../../context/PortfolioContext.js";
```

### 4.2 Lấy hooks

```tsx
const { t, formatNumber, formatDate } = useI18n();
const { ability, userPlan, userEntitlements } = usePortfolio();
```

### 4.3 Các i18n blocks sẵn có

| Block | Tồn tại? | Vị trí en.js | Vị trí vi.js | Notes |
|-------|----------|-------------|-------------|-------|
| `tenantHome` | ✅ | #651 | #652 | 25 keys |
| `tenantCapabilities` | ✅ | #685 | #686 | 12 keys |
| `tenantMembers` | ✅ | #701 | #702 | 26 keys |
| `tenantServiceAccounts` | ✅ | #735 | #736 | ~12 keys |
| `tenantPats` | ✅ | #766 | #767 | ~30 keys |
| `tenantUsage` | ✅ | #828 | #829 | ~12 keys |
| `tenantBilling` | ✅ | #855 | #856 | ~16 keys |
| `tenantSSO` | ✅ | #930 | #931 | 28 keys |
| `tenantAuditLogs` | ❌ | — | — | Cần tạo mới |
| `common` | ✅ | #2 | #2 | loading, notAvailable, save, cancel, edit, delete, refresh (vi) |
| `plans` | ✅ | #13 | #15 | free, basic, starter, pro, premium, enterprise, custom, internal, admin |

### 4.4 Pattern permission gating

```tsx
// Check quyền trước khi render action
if (!ability.can("delete", "TenantMember")) {
  return null; // hoặc ẩn nút xóa
}

// Check quyền trước khi render page
const canRead = ability.can("read", "TenantCapabilities");
const noPermissionNotice = canRead ? "" : t("common.noPermission");
```

### 4.5 CSS class mapping

| Inline style | CSS class |
|-------------|-----------|
| `display: flex; flexDirection: column; gap: Xpx` | `shellPage__list` |
| Individual card | `shellPage__listItem` |
| Card header | `shellPage__listItemHeader` |
| Card title | `shellPage__itemTitle` |
| Card metadata | `shellPage__itemMeta` |
| Empty state | `shellPage__empty` |
| Grid layout | `shellPage__summaryGrid` |
| Panel | `shellPage__panel` |
| Surface card (clickable) | `shellPage__surfaceCard` |
| Button primary | `shellPage__button shellPage__button--primary` |
| Button secondary | `shellPage__button shellPage__button--secondary` |
| Pill/tag | `shellPage__pill` |
| Notice banner | `shellPage__banner shellPage__banner--notice` |
| Error banner | `shellPage__banner shellPage__banner--error` |

### 4.6 JSX thay createElement (SSOPage)

```diff
- createElement("a", { href: "/tenant-admin/home" }, "Back")
+ <Link to="/tenant-admin/home">{t("tenantSSO.backToHome")}</Link>

- createElement("input", { style: { ... }, value, onChange })
+ <ShellField label={...} value={value} onChange={onChange} />

- createElement("div", { style: { ... } }, children)
+ <ShellPanel title={...}>{children}</ShellPanel>
```

## V. Validation command

Mỗi step phải chạy:

```powershell
Push-Location packages/web
npx tsc --noEmit       # 0 errors
npm run build          # must succeed
Pop-Location
```

Cuối cùng: `.\start_dev.ps1`

## VI. Residual Risks

1. **SSOPage rewrite** — `createElement` → JSX có thể miss event handler binding nếu không cẩn thận
2. **PATsPage secret reveal** — flow nhạy cảm, cần giữ nguyên logic `clipboard.writeText()`
3. **MembersPage cancel invite** — hiện là no-op (`alert`), cần confirm với backend team
4. **AuditLogs i18n keys mới** — block `tenantAuditLogs` chưa tồn tại, cần define đầy đủ
5. **UsageHistoryPage** — chưa có route hay component trong `packages/web`

## VII. Execution Evidence

> **Completed:** 2026-06-23  
> **Validator:** AI session (big-pickle)  
> **Build:** 3244 modules, 0 errors ✅  
> **Dev stack:** Healthy (core-api 200, frontend 200) ✅

### Files Changed

| Action | File |
|--------|------|
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminCapabilitiesPage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` |
| Modified | `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx` |
| Modified | `packages/web/src/i18n/en.js` |
| Modified | `packages/web/src/i18n/vi.js` |
| Created | `docs/TENANT_ADMIN_I18N_REFACTOR_PLAN.md` |

### Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (after each page) | 0 errors across all 8 pages |
| `npm run build` (final) | 3244 modules, 0 errors ✅ |
| `.\start_dev.ps1` | Stack healthy, both core-api and frontend return 200 ✅ |

### i18n Keys Added

| Block | Keys | Description |
|-------|------|-------------|
| `common` | `noPermission` | Permission-denied banner text |
| `tenantBilling` | `paidLabel`, `pendingLabel` | Invoice status labels |
| `tenantUsage` | `overageAllowed`, `hardStop` | Quota policy mode labels |
| `tenantMembers` | `roleOptions`, `statuses`, `tableHeaderUsername`, `tableHeaderActions`, `invitedBySystem`, `cancelInviteAction`, `cancelNotImplemented` | Member table + invite form keys |
| `tenantAuditLogs` | (22 keys, full block) | New block for AuditLogsPage — includes `title`, `description`, `searchPlaceholder`, `searchAction`, `clearButton`, `logTypeAll`, `logTypeInfo`, `logTypeWarning`, `logTypeError`, `noLogs`, `loading`, `tableHeaderUser`, `tableHeaderAction`, `tableHeaderIp`, `tableHeaderTimestamp`, `exportButton`, `autoRefresh`, `detailTitle`, `detailClose`, `filterLabel`, `filterType`, `filterUser` |
| `tenantServiceAccounts` | ~14 keys | Service account create/edit form + list |
| `tenantPats` | ~11 keys | PAT create/edit form + token display |
| `tenantSSO` | 4 keys | SSO configuration form + back link |

### Residual Risk Status

| # | Risk | Status |
|---|------|--------|
| 1 | SSOPage createElement → JSX | ✅ Clean (0 createElement calls) |
| 2 | PATsPage secret reveal | ✅ Intact (clipboard.writeText preserved) |
| 3 | MembersPage cancel invite | ⚠️ Still no-op (alert only) — needs backend |
| 4 | AuditLogs new i18n block | ✅ Created and populated en+vi |
| 5 | UsageHistoryPage | ⏳ Not yet created (medium priority) |
| 6 | new i18n keys not in all blocks | ✅ All keys in both en.js and vi.js |
| 7 | HomePage nav links hidden (subject name mismatch) | ✅ Fixed — frontend subjects aligned with backend `_build_abilities` |

### Page Execution Summary

| Step | Page | Method | tsc | Build | Status |
|------|------|--------|-----|-------|--------|
| 1 | CapabilitiesPage | Direct | 0 errors | ✅ | Complete |
| 2 | BillingPage | Direct | 0 errors | ✅ | Complete |
| 3 | UsagePage | Direct | 0 errors | ✅ | Complete |
| 4 | MembersPage | Direct | 0 errors | ✅ | Complete |
| 5 | ServiceAccountsPage | Sub-agent | 0 errors | ✅ | Complete |
| 6 | AuditLogsPage | Sub-agent | 0 errors | ✅ | Complete |
| 7 | PATsPage | Sub-agent | 0 errors | ✅ | Complete |
| 8 | SSOPage | Sub-agent (JSX rewrite) | 0 errors | ✅ | Complete |
| 9 | UsageHistoryPage | — | — | — | ⏳ Pending |
| 10 | Subject name fix (TenantCapabilities→TenantCapabilityView, etc.) | Direct | 0 errors | ✅ | Complete |

### Command Log

```powershell
# After Steps 1-4
Push-Location packages/web
npx tsc --noEmit    # 0 errors each
npm run build       # 3244 modules
Pop-Location

# After Steps 5-8 (sub-agents)
npx tsc --noEmit    # 0 errors each
npm run build       # 3244 modules

# After Step 10 — Subject name fix
npx tsc --noEmit    # 0 errors
npm run build       # 3244 modules
.\start_dev.ps1     # All services healthy

# Final dev stack restart
.\start_dev.ps1     # All services healthy
```
