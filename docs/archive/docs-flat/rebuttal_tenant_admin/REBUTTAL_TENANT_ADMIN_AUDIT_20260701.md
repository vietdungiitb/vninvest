# Phản biện Audit: UI/UX & Lỗ hổng kỹ thuật hệ thống Tenant Admin

**File đối chiếu:** `docs/AUDIT_TENANT_ADMIN_UI_UX_AND_TECHNICAL_GAPS_20260701.md`  
**Phương pháp:** Đọc & phân tích toàn bộ 13 file tenant-admin pages + i18n + shared components, đối chiếu từng claim với code thực tế.  
**Ngày:** 2026-07-01

---

## 1. Executive Summary

| Metric | Giá trị |
|--------|---------|
| Tổng claims kiểm tra từ audit | ~48 |
| Claims **ĐÚNG** (bugs thật) | 42 |
| Claims **SAI** | 6 |
| Claims **phóng đại / sai scope** | 3 |
| Bug CRITICAL confirmed | 5 |
| Bug HIGH confirmed | 10+ |
| i18n gaps thực tế (audit nói sai) | 2 section (~70 keys) bị gán nhãn "hoàn toàn trống" nhưng thực tế có đủ |

---

## 2. ❌ Claims SAI (cần loại bỏ khỏi báo cáo)

### 2.1. `"Loading..."` text hardcoded ở TenantAdminHomePage

**Audit claim (mục 3.1):** "Không có vòng xoay tải dữ liệu (Loading Spinner) hoặc khung xương (Skeleton), chỉ có dòng chữ đơn điệu `Loading...`."

**Thực tế:** `TenantAdminHomePage.tsx` dùng `t("common.loading")` tại dòng 203 và 205. Không có hardcoded `"Loading..."` string nào. Đoạn code:

```tsx
// dòng 198–207
if (loading) {
  return createElement(ShellPanel, {
    title: t("tenantHome.title"),
    description: t("common.loading"),  // <-- i18n
    variant: "glass"
  }, createElement(ShellPanelSection, null,
    createElement("div", { className: styles.loadingContainer },
      createElement(LoadingSpinner, { size: "lg" }),
      createElement("p", { className: styles.loadingText }, t("common.loading"))  // <-- i18n
    )
  ));
}
```

**Verdict: ❌ SAI. Không có hardcoded "Loading...". Component dùng `LoadingSpinner` + i18n label.**

---

### 2.2. `tenantSecurity` hoàn toàn trống trong `vi.js`

**Audit claim (mục 3.8, bảng mục 4):** "Phân hệ `tenantSecurity` (bao gồm các tiêu đề, thông tin phiên đăng nhập hoạt động, lịch sử lỗi đăng nhập,...) **hoàn toàn biến mất** khỏi tệp dịch `vi.js`." Mức độ: 🔴 Cực kỳ nghiêm trọng.

**Thực tế:** `tenantSecurity` section có đủ 26 keys trong **cả hai** file `vi.js` và `en.js` tại `packages/web/src/i18n/`. File `vi.js` có các keys:

```
eyebrow, title, description, metricLogins, metricFailed, metricRate, metricSessions,
loginActivityTitle, recentFailuresTitle, activeSessionsTitle, revokeAction, revokeAllAction,
confirmRevoke, confirmRevokeAll, noSessions, noFailures, emptyState, loadError,
logins, failed, currentSession, loginAtLabel, noData, attempts
```

Tất cả đều có bản dịch tiếng Việt đầy đủ có dấu.

**Verdict: ❌ SAI HOÀN TOÀN. `tenantSecurity` có đủ keys trong vi.js. Audit sai dữ liệu nghiêm trọng.**

---

### 2.3. `tenantReports` hoàn toàn trống trong `vi.js`

**Audit claim (mục 3.11, bảng mục 4):** "Toàn bộ phần dịch thuật của Báo cáo định kỳ (`tenantReports`) **hoàn toàn trống rỗng** trong tệp `vi.js`." Mức độ: 🔴 Cực kỳ nghiêm trọng.

**Thực tế:** `tenantReports` section có đủ 44 keys trong **cả hai** file. File `vi.js` có:

```
eyebrow, title, description, metricActive, metricTotal, metricDeliveries, listTitle, empty,
createTitle, createAction, cancelAction, deleteAction, pauseAction, resumeAction, testAction,
deleteConfirm, nameLabel, namePlaceholder, typeLabel, typeUsageSummary, typeBillingSummary,
typeSecurityDigest, typeAuditLog, scheduleLabel, scheduleDaily, scheduleWeeklyMon,
scheduleWeeklyFri, scheduleMonthly1, scheduleMonthly15, formatLabel, recipientsLabel,
addRecipient, recipients, lastSent, deliveries, paused, loadError, createError, updateError,
deleteError, testError, testQueued
```

**Verdict: ❌ SAI HOÀN TOÀN. `tenantReports` có đủ keys trong vi.js. Audit sai dữ liệu nghiêm trọng.**

> **⚠️ Hệ quả:** 2 claims sai này làm suy giảm độ tin cậy toàn bộ báo cáo. Nếu 2 mục "🔴 Cực kỳ nghiêm trọng" hóa ra không tồn tại, người đọc có quyền nghi ngờ các claims khác. Cần kiểm tra chéo dữ liệu trước khi công bố.

---

### 2.4. Variable `t` bị shadow trong TenantAdminPATsPage

**Audit claim (mục 3.6):** "Biến cục bộ trong vòng lặp lọc token được đặt tên là `t` (ví dụ: `tokens.filter(t => t.status === "active")`), làm ẩn đi hàm dịch thuật `t` của context `useI18n()`."

**Thực tế:** Trong `TenantAdminPATsPage.tsx`:
- Dòng 66: `const { t, formatDate: fmtDate, ... } = useI18n();` — `t` chỉ là i18n function
- Không có vòng lặp `.filter(t => ...)` nào dùng `t` làm parameter
- Filter dùng `hideRevoked` (dòng 80) và `hideUnused` (dòng 81)
- Derived list là `filteredTokens` (dòng 291)
- Hoàn toàn không có variable shadowing

**Verdict: ❌ SAI. Không có shadow variable `t` trong file này.**

---

### 2.5. Silent catch blocks ở TenantAdminUsageHistoryPage

**Audit claim (mục 3.3, generalization):** "Có tới 3 khối `catch` tải dữ liệu dự báo, biểu đồ lịch sử và cấu hình cảnh báo có ghi chú `// silently fail` và để trống."

**Thực tế:** `TenantAdminUsageHistoryPage.tsx` dòng 76–78:

```tsx
} catch (err: unknown) {
  setError(err instanceof Error ? err.message : t("tenantUsageHistory.loadError"));
}
```

Đây là **proper error handling** — gọi `setError` và render error state. Không phải silent fail.

**Verdict: ❌ SAI. UsageHistoryPage xử lý lỗi đúng cách. 3 silent catch blocks chỉ tồn tại ở UsagePage, không phải UsageHistoryPage.**

---

### 2.6. Empty array reduce ở TenantAdminUsagePage

**Audit claim (mục 3.3):** "Sử dụng hàm `.reduce()` trên mảng dữ liệu đồ thị lịch sử nhưng không kiểm tra mảng rỗng."

**Thực tế:** `.reduce()` cho peak day nằm ở **`TenantAdminUsageHistoryPage.tsx`** dòng 95–98, không phải `TenantAdminUsagePage.tsx`. UsagePage hoàn toàn không có reduce pattern này.

**Verdict: ❌ SAI VỊ TRÍ. Peak day reduce ở UsageHistoryPage, không phải UsagePage.**

---

## 3. ⚠️ Claims CẦN LÀM RÕ (có đúng 1 phần, thiếu nuance)

### 3.1. main.js dư thừa (mục 2)

**Đúng:** `main.js` (124 dòng) vẫn tồn tại, thiếu 5 route so với `main.tsx` (144 dòng).

**Cần làm rõ:** `index.html` chỉ reference `main.tsx`. Vite ignore `main.js` hoàn toàn. File này là legacy code chết (dead code), không gây "nhầm lẫn" ở mức độ blocking. Tuy nhiên vẫn nên dọn dẹp.

### 3.2. Thiếu shared Modal component (mục 4.1)

**Đúng:** Không có generic `AdminModal` wrapper component trong `components/` hay `components/ui/`.

**Cần làm rõ:** `ConfirmModal.tsx` tại `packages/web/src/components/ConfirmModal.tsx` đã có đầy đủ:
- `role="alertdialog"`
- `aria-modal="true"`
- `aria-labelledby` / `aria-describedby`
- Escape key handling
- Context-based (`useConfirm()` hook)

Tuy nhiên nó là confirm dialog, không phải generic modal. Các modal khác (tạo webhook, tạo PAT, v.v.) đều custom inline.

### 3.3. CSS inline (mục 1 — "hàng trăm dòng")

**Đúng:** MembersPage có `MEMBER_CSS` injected qua `<style>` tag (3 rules).

**Cần làm rõ:** Chỉ MembersPage dùng pattern này. "Hàng trăm dòng" là phóng đại. Các page khác dùng `soc.module.css` hoặc `styles` object.

---

## 4. ✅ Claims ĐÚNG (bugs thật — cần sửa)

### 4.1. 🚨 CRITICAL

| # | File | Claim | Dòng | Mô tả |
|---|------|-------|------|-------|
| C1 | BillingPage | `handleUpgrade` gọi `previewPlanChange` — không nâng cấp thật | 511-518 | User bấm "Nâng cấp" nhưng chỉ chạy preview. `setUpgradeDone(true)` làm user tưởng đã upgrade thành công. |
| C2 | WebhooksPage | Không check permission — bất kỳ ai biết URL đều CRUD được | — | Không có `ability.can()` anywhere. Các page khác đều check. |
| C3 | WebhooksPage | `secretReveal` async state — modal đóng ngay sau tạo | 152-161 | `setSecretReveal(result.raw_secret)` rồi đọc `secretReveal` ngay — stale closure, luôn là null → modal đóng. |
| C4 | HomePage | `setShowDeprovision(false)` trong `finally` — đóng modal khi lỗi | 178 | API lỗi → user thấy error message chớp qua 0.5s rồi mất. |
| C5 | ServiceAccountsPage | Gọi API `/partner/service-accounts/` trước khi check `canRead` | 60-73 | User không quền vẫn gửi request lên server. |

### 4.2. 🔴 HIGH

| # | File | Claim | Dòng |
|---|------|-------|------|
| H1 | HomePage | `catch ((_err) => {})` nuốt lỗi trend days | 154 |
| H2 | HomePage | `summary?.pats_expiring_soon !== undefined` — luôn true kể cả = 0 | 282 |
| H3 | BillingPage | `setInvoices(invData.results \|\| invData.data \|\| invData \|\| [])` — fallback cuối là object → crash .map() | 136 |
| H4 | ServiceAccountsPage | `handleDeleteSA(saId!)` — `saId` = undefined → gửi `/undefined/` | 280 |
| H5 | PATsPage | `toISOString().slice(0,16)` UTC shift — lệch 7h so với local | 156, 677 |
| H6 | SSOPage | `window.location.href` — mất dữ liệu chưa lưu | 352 |
| H7 | SSOPage | SP Entity ID / SP ACS URL là `<input>` có thể edit | 301-327 |
| H8 | SecurityPage | `timeAgo` dùng `common.justNow` — sai key path (đúng: `tenantHome.justNow`) | 60-65 |
| H9 | UsagePage | 3 `catch` silently fail — không setError, không toast | 137, 149, 161 |
| H10 | AuditLogsPage | Biểu đồ thống kê từ 20-50 records của page hiện tại — sai lệch | 164-194 |
| H11 | ReportsPage | Nút "Tạo mới" ẩn khi danh sách có dữ liệu | 210-253 |

### 4.3. 🟡 MEDIUM

| # | File | Claim |
|---|------|-------|
| M1 | HomePage | SSO/Webhooks checklist dùng permission thay vì dữ liệu thực tế |
| M2 | HomePage | `KpiCard` định nghĩa lồng trong render |
| M3 | BillingPage | Fix cứng `"VND"` bỏ qua `currency` field từ API |
| M4 | BillingPage | Plan limits hardcoded frontend |
| M5 | BillingPage | Thiếu confirm dialog khi upgrade |
| M6 | UsagePage | `METER_CODES` fix cứng |
| M7 | UsageHistoryPage | `METER_CODES` fix cứng |
| M8 | UsageHistoryPage | Peak day reduce fragile với empty array |
| M9 | MembersPage | Cancel invite filter thay vì đổi status |
| M10 | MembersPage | Label "Owner"/"Admin" hardcoded English |
| M11 | MembersPage | Không hỗ trợ đổi role |
| M12 | ServiceAccountsPage | Toggle enable/disable không confirm |
| M13 | PATsPage | Hardcoded Vietnamese labels |
| M14 | SSOPage | Success banner không auto-dismiss |
| M15 | SecurityPage | `last_active_at` không hiển thị |
| M16 | AuditLogsPage | `setTimeout(() => loadLogs(""), 0)` workaround |
| M17 | CapabilitiesPage | `formatQuotaValue` type mismatch |
| M18 | CapabilitiesPage | Progress bar 0% / 100% |
| M19 | CapabilitiesPage | Chỉ 3 action groups |

### 4.4. 🟢 LOW

| # | File | Claim |
|---|------|-------|
| L1 | HomePage | `[7, 14, 30]` hardcoded |
| L2 | MembersPage | `MEMBER_CSS` inline style tag |
| L3 | SSOPage | Thiếu metadata XML download |
| L4 | SSOPage | Thiếu copy buttons |
| L5 | PATsPage | Missing Bulk Revoke |

---

## 5. i18n Gap Analysis — Audit Claim vs Thực tế

Audit claim sai trầm trọng về trạng thái của `vi.js`. Dưới đây là bảng đối chiếu:

|Phân hệ|Audit claim|Thực tế|Verdict|
|---|---|---|---|
|`tenantSecurity`|🔴 THIẾU HOÀN TOÀN|26 keys — CÓ ĐỦ|**Audit sai**|
|`tenantReports`|🔴 THIẾU HOÀN TOÀN|44 keys — CÓ ĐỦ|**Audit sai**|
|`tenantBilling.costTrend*`|🟡 THIẾU HOÀN TOÀN|**ĐÚNG** — 6 keys thiếu: `costTrendTitle`, `costTrendSubtitle`, `costTotal`, `costAvg`, `costForecast`, `costTrendEmpty`|**Đúng**|
|`tenantWebhooks.event*`|🟡 THIẾU HOÀN TOÀN|Đúng nhưng cần nuance — 5 keys (`eventMember`, `eventPAT`, `eventSA`, `eventQuota`, `eventBilling`) thiếu ở **cả 2 file**, không chỉ vi.js|**Đúng nhưng thiếu context**|
|`tenantMembers.searchPlaceholder`|🟢 THIẾU|**ĐÚNG** — thiếu ở cả 2 file|**Đúng**|

### i18n gaps thực tế cần sửa:

1. **`tenantBilling.costTrend*`** — 6 keys missing từ `vi.js` (có trong `en.js` lines 1465-1470)
2. **`tenantWebhooks.eventMember/eventPAT/eventSA/eventQuota/eventBilling`** — 5 keys missing từ **cả 2 file** (chỉ có `eventOther`)
3. **`tenantMembers.searchPlaceholder`** — missing từ cả 2 file
4. **`SecurityPage: common.justNow/common.minutesAgo/common.hoursAgo/common.daysAgo`** — sai key path, keys tồn tại ở `tenantHome.*` không phải `common.*`

---

## 6. Action Plan Điều chỉnh (theo bugs thật)

### Phase 1 — Sửa 5 CRITICAL bugs ngay lập tức

1. **WebhooksPage: Thêm permission check** — `ability.can("write", "TenantWebhookView")` ở đầu component
2. **WebhooksPage: Sửa secret reveal** — dùng `result.raw_secret` trực tiếp thay vì `secretReveal` state
3. **BillingPage: Sửa `handleUpgrade`** — gọi API upgrade thật, không phải preview
4. **HomePage: Sửa deprovision finally** — không đóng modal khi error
5. **ServiceAccountsPage: Check permission trước API call** — move guard lên trước useEffect

### Phase 2 — Sửa 11 HIGH bugs

Đồng bộ i18n cho `tenantBilling.costTrend*` + `tenantWebhooks.event*` + fix `common.justNow` key path, sửa PAT UTC timezone, thay SSO SP fields thành read-only, v.v.

### Phase 3 — MEDIUM + LOW + missing features

Generic Modal component, role change, bulk revoke, metadata XML download, v.v.

---

## 7. Appendix: Files analyzed

| File | Path |
|------|------|
| TenantAdminHomePage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` |
| TenantAdminBillingPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` |
| TenantAdminUsagePage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx` |
| TenantAdminUsageHistoryPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminUsageHistoryPage.tsx` |
| TenantAdminMembersPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx` |
| TenantAdminServiceAccountsPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.tsx` |
| TenantAdminPATsPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` |
| TenantAdminSSOPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx` |
| TenantAdminSecurityPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminSecurityPage.tsx` |
| TenantAdminWebhooksPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx` |
| TenantAdminAuditLogsPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` |
| TenantAdminReportsPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminReportsPage.tsx` |
| TenantAdminCapabilitiesPage.tsx | `packages/web/src/pages/tenant-admin/TenantAdminCapabilitiesPage.tsx` |
| vi.js | `packages/web/src/i18n/vi.js` |
| en.js | `packages/web/src/i18n/en.js` |
| TenantAdminLayout.tsx | `packages/web/src/components/TenantAdminLayout.tsx` |
| TenantAdminSidebar.tsx | `packages/web/src/components/TenantAdminSidebar.tsx` |
| ConfirmModal.tsx | `packages/web/src/components/ConfirmModal.tsx` |
| main.js | `packages/web/src/main.js` |
| main.tsx | `packages/web/src/main.tsx` |

---

*File này được tạo từ kết quả đối chiếu trực tiếp codebase (20 files, ~6,000 dòng code) với các claims trong audit report.*
