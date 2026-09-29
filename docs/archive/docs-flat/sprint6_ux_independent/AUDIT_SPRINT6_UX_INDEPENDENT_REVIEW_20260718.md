# Đánh giá độc lập — Sprint 6: UX Improvements (Steps 6.1–6.5)

> **Ngày:** 2026-07-18
> **Phạm vi:** Sprint 6 (Step 6.1–6.5) của `docs/TENANT_MANAGEMENT_SPRINT_PLAN.md`
> **Framework:** AGENTS.md AI Audit/Research Framework
> **Phương pháp:** Đọc plan + code thực tế, chạy `tsc --noEmit`, trace luồng tenant-switch + React Query cache key, grep toàn bộ pages.
> **Ngôn ngữ:** Tiếng Việt.

---

## 1. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **Cross-tenant stale-data bug trong React Query cache (P0):** Toàn bộ 10 page đã migrate dùng `queryKey` **tĩnh**, KHÔNG chứa `tenant_id` (vd `["tenant-admin","members"]`, `useTenantAdminQuery.ts` + mỗi page). Backend resolve tenant từ session/PAT scope (`resolve_tenant.py:97-148`), không từ URL. Khi user switch tenant, query key giống hệt → React Query trả **data cũ của tenant trước** → lỗi correctness (có thể leak data giữa tenant). Vi phạm trực tiếp Acceptance Criteria Step 6.1: "No stale data from previous tenant", "All data refetched for new tenant".
2. **Step 6.1 listener bị hổng — không ai nghe `tenant-changed` (P1):** `switchTenant` (`PortfolioContext.js:280-287`) dispatch `CustomEvent('tenant-changed')`, nhưng **không có file nào** `addEventListener('tenant-changed')` để `invalidateQueries` (`grep invalidateQueries` chỉ thấy mutation hooks + advertising client). Nghĩa là event được bắn ra nhưng không có cơ chế refetch/invalidate nào gắn vào nó. Acceptance "All data refetched for new tenant" không được thực thi.
3. **Plan Step 6.2 Acceptance "All 13 pages use React Query" chưa đạt (P2):** 3/13 page (AuditLogs, Billing, Usage) vẫn dùng raw `coreGet` (`TenantAdminAuditLogsPage.tsx`, `TenantAdminBillingPage.tsx`, `TenantAdminUsagePage.tsx`). Được defer có chủ đích (cursor pagination / multi-endpoint) và có ghi chú trong AGENTS.md — hợp lệ nhưng chưa "complete" theo plan.
4. **Loading skeleton (Step 6.3) chưa xác minh đủ (P3):** Plan yêu cầu "All pages show skeleton while loading". Code chạy `tsc` pass, nhưng không có bằng chứng (screenshot/test) rằng 10 page đã migrate thực sự render skeleton component khi `isLoading`. Cần audit riêng từng page.
5. **Toasts trên mutation (Step 6.5) dùng pattern thủ công (P3):** `useTenantAdminMutation` hỗ trợ `onSuccess/onError` nhưng **không tự động toast** (`useTenantAdminQuery.ts:46-56`) — mỗi page tự gọi `toast(...)` trong callback. Đã verify các page (Members/PATs/Security/SA/Reports/Settings/SSO/Webhooks) có `toast.`, nhưng không đồng nhất (không có wrapper bắt buộc). Acceptance "Consistent positioning" chưa audit.

---

## 2. BẢN ĐỒ KIẾN TRÚC (Sprint 6)

| File | Trách nhiệm | Trạng thái |
|------|--------------|-----------|
| `providers/QueryProvider.tsx` | QueryClient (staleTime 30s, gcTime 5min, refetchOnWindowFocus) | ✅ Đúng spec |
| `pages/tenant-admin/useTenantAdminQuery.ts` | Wrapper `useTenantAdminQuery`/`useTenantAdminMutation` quanh `@tanstack/react-query` | ✅ Dùng đúng lib, có invalidation |
| `main.tsx` | Wrap app bằng `QueryProvider` (line 9, 134) | ✅ |
| `context/PortfolioContext.js` | `switchTenant` dispatch `tenant-changed` (line 280-287) | ⚠️ Không có listener |
| `components/TenantAdminLayout.tsx` | Convert createElement→JSX | ✅ 0 createElement |
| `components/TenantAdminSidebar.tsx` | Convert createElement→JSX; nav-only (không có tenant switcher) | ✅ 0 createElement |
| 10 page đã migrate | Dùng `useTenantAdminQuery` | ⚠️ queryKey thiếu tenant_id |
| 3 page còn lại | `TenantAdminAuditLogsPage/BillingPage/UsagePage` | ❌ vẫn `coreGet` (deferred) |

**Phân bố React Query thực tế** (grep `useTenantAdminQuery`/`useQuery`):
- Migrate đầy đủ: Members, PATs, Security, ServiceAccounts, Reports, UsageHistory, Roles, Settings, SSO, Webhooks (10 page).
- Chưa migrate: AuditLogs, Billing, Usage (3 page).

---

## 3. LUỒNG ĐÃ TRACE

### 3.1 Tenant switch (Step 6.1)
1. User switch tenant → `switchTenant(tenantId)` (`PortfolioContext.js:280`) → `localStorage.setItem("tenant_id")` + `setActiveTenantIdState` + `dispatchEvent('tenant-changed')` (`:284`).
2. **Không có listener** nào (`grep addEventListener('tenant-changed')` chỉ trả `PortfolioContext.js` — chính nơi bắn, không phải nơi nhận).
3. Backend resolve tenant từ session/PAT (`resolve_tenant.py:97-148`), không từ URL/query.
4. Kết quả: page dùng React Query với queryKey tĩnh → cache trả data tenant cũ. ❌

### 3.2 Data fetch (Step 6.2)
1. Page gọi `useTenantAdminQuery(['tenant-admin','members'], '/partner/members/')` (`useTenantAdminQuery.ts:25-35`).
2. `queryFn` → `coreFetch('get', url)` → `defaultCoreApiAdapter.coreGet` (`:14-23`).
3. Backend trả data tenant hiện tại (từ session).
4. Lần 2 switch tenant + revisit → cùng queryKey → React Query cache hit → **data tenant cũ**. ❌ (Finding F1)

---

## 4. CONTRADICTIONS (plan vs code)

| Plan | Code | Tác động |
|------|------|----------|
| Step 6.1 AC: "No stale data from previous tenant" | queryKey không có tenant_id (`useTenantAdminQuery.ts` + pages) | Stale cache cross-tenant → F1 |
| Step 6.1 AC: "All data refetched for new tenant" | Không có listener `tenant-changed` để invalidate | Event vô tác dụng → F2 |
| Step 6.2 AC: "All 13 pages use React Query" | 3/13 page vẫn `coreGet` (AuditLogs/Billing/Usage) | Chưa đạt 13/13 → F3 |
| Step 6.3 AC: "All pages show skeleton while loading" | Không có evidence/test render skeleton | Chưa xác minh → F4 |
| Step 6.5 AC: "Consistent positioning" toast | Toast gọi thủ công per-page, không có wrapper | Không đồng nhất → F5 |

---

## 5. FINDINGS

| ID | Loại | Mức | file:line | Thực tế | Đề xuất fix |
|----|------|-----|-----------|----------|-------------|
| F1 | BUG/SEC | **P0** | `useTenantAdminQuery.ts:30-34` + mọi page | queryKey tĩnh, không có tenant_id → cross-tenant stale cache | Thêm `activeTenantId` vào mọi queryKey (vd `['tenant-admin', tenantId, 'members']`); hoặc listener `tenant-changed` → `queryClient.invalidateQueries()` toàn bộ tenant-scoped |
| F2 | GAP | P1 | `PortfolioContext.js:280-287` | `tenant-changed` dispatch nhưng không có listener invalidate | Thêm listener global (trong `QueryProvider` hoặc AppShell) gọi `queryClient.invalidateQueries({ queryKey: ['tenant-admin'] })` |
| F3 | GAP | P2 | `TenantAdminAuditLogsPage.tsx`, `TenantAdminBillingPage.tsx`, `TenantAdminUsagePage.tsx` | 3 page chưa migrate React Query | Migrate sau (cursor pagination), hoặc ít nhất document rõ là out-of-scope Sprint 6 |
| F4 | GAP | P3 | Các page đã migrate | Skeleton loading chưa audit evidence | Check từng page render skeleton khi `isLoading` |
| F5 | GAP | P3 | `useTenantAdminQuery.ts:46-56` | Toast không tự động; gọi thủ công per-page | Tùy chọn: thêm toast mặc định trong `useTenantAdminMutation` (onSuccess green / onError red) |

---

## 6. QUALITY GATES AUDIT

- **A1 tsc --noEmit:** ✅ Đã chạy thực tế: `EXIT: 0`, không error.
- **A2 lint:** Không chạy trong scope này (PowerShell env). Cần `npm run lint` để xác nhận.
- **A3 build:** Không chạy (`npm run build` = tsc + vite build). Cần chạy để confirm.
- **A4 unit test FE:** Không có test mới cho Sprint 6 (React Query migration chủ yếu refactor, không test đơn vị). Plan A4 không yêu cầu test mới cho Sprint 6.
- **A6 i18n:** Không có hardcoded VN string mới trong các page đã đổi (dùng i18n keys). OK sơ bộ.
- **A7 file reference:** Plan trỏ `components/TenantAdminLayout.tsx`/`TenantAdminSidebar.tsx` — thực tế nằm ở `components/` (không phải `pages/tenant-admin/`). File tồn tại, chỉ khác đường dẫn. Không phantom.
- **A8 cross-border:** `useTenantAdminQuery` → `coreGet` → `defaultCoreApiAdapter` → backend `/partner/*`. Khớp contract. OK.
- **Compile:** `QueryProvider.tsx`, `useTenantAdminQuery.ts`, `PortfolioContext.js` compile clean (tsc pass).

---

## 7. CÂU HỎI CẦN LÀM RÌ

1. Query key có chủ định không bao gồm tenant_id (tin tưởng backend resolve từ session)? Nếu có, thì **bắt buộc** phải có `tenant-changed` listener invalidate, nếu không sẽ stale. Hiện tại listener không tồn tại → F1+F2 cùng là blocker.
2. 3 page còn lại (AuditLogs/Billing/Usage) có nằm trong scope Sprint 6 hay dời sang Sprint 8 (Testing)?
3. Step 6.3 skeleton có render thực sự không, hay chỉ `isLoading` boolean chưa gắn UI?

---

## 8. ĐÁNH GIÁ TỔNG THỂ

- **Implementable:** Có, code chạy, tsc pass.
- **Blocker:** **F1 (P0)** + **F2 (P1)** cùng một root cause: React Query cache không tenant-scoped và không có invalidation trên switch tenant → UI có thể hiển thị data tenant cũ (cross-tenant stale data). Đây là bug correctness bảo mật cấp tenant-isolation. Phải fix trước khi claim "no stale data".
- **Ưu tiên sửa:** F1+F2 (P0/P1, cùng fix: thêm tenant_id vào queryKey HOẶC listener invalidate) → F3 (P2) → F4/F5 (P3).

**Kết luận:** Sprint 6 Steps 6.1–6.5 "hoàn thành" về mặt refactor + tsc pass, nhưng **chưa đạt DoD** do (a) **P0 cross-tenant stale cache** (F1) do queryKey thiếu tenant_id, (b) **P1 thiếu listener `tenant-changed`** (F2) nên switch tenant không refetch, (c) 3/13 page chưa migrate (F3). Claim "All 10/13 pages on React Query" là chính xác, nhưng "no stale data from previous tenant" (Step 6.1) chưa được đảm bảo bằng code.

---

## 9. PHỤ LỤC — Evidence

- `tsc --noEmit` (packages/web): `EXIT: 0`.
- `QueryProvider.tsx:4-13`: staleTime 30s, gcTime 300s, refetchOnWindowFocus true.
- `useTenantAdminQuery.ts:1`: import từ `@tanstack/react-query` (wrapper thật).
- `useTenantAdminQuery.ts:30-34`: `queryKey` truyền thẳng, không append tenant_id.
- Query keys thực tế (grep): `["tenant-admin","members"]`, `["tenant-roles"]`, `["tenant-sso","config"]`, ... — **không có tenant_id**.
- `PortfolioContext.js:280-287`: `switchTenant` dispatch `tenant-changed`.
- `grep addEventListener('tenant-changed')`: chỉ `PortfolioContext.js` (producer), không có consumer.
- `grep invalidateQueries`: `useTenantAdminQuery.ts` (mutation) + advertising client + 4 page (mutation-only).
- 3 page `coreGet`: `TenantAdminAuditLogsPage.tsx`, `TenantAdminBillingPage.tsx`, `TenantAdminUsagePage.tsx`.
- `TenantAdminLayout.tsx` / `TenantAdminSidebar.tsx`: 0 `createElement` (đã convert JSX).
- `TenantAdminWebhooksPage.tsx:284`: `error={error?.message || undefined}` (fix type error confirmed).
- AGENTS.md:33-35 + CODE_CHANGE_AUDIT_LEDGER.md:10182 có Sprint 6 entries (F6 từ Sprint 5 đã compliant).
