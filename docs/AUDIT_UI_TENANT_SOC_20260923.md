# AUDIT UI — SOC Users tab + Tenant Keys + Tenant Usage (từ 3 ảnh chụp 2026-09-23)

> Phương pháp (khung audit bắt buộc): mọi khẳng định kèm `file:line` từ đọc code thật
> (không suy luận); grep toàn repo gồm `.css`, config, i18n; không viết code trong audit.
> Ngôn ngữ: Tiếng Việt.

## 0. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **[U1-HIGH] Bảng Users không có CSS cell** — cột dính nhau ("vntenant_vietdungpro",
   "internalCó", header "Kích hoạt Staff" dính): `SocUsersPanel.tsx:180-202` dùng `<table>`
   trần, `soc.components.css` không có class table dùng chung (chỉ `.diffTable:1030-1045`
   có border-collapse/padding).
2. **[G1-HIGH — bug dữ liệu] Quota -1 lộ ra UI** ("Quota: -1"): `TenantUsageSummaryPage.tsx:72`
   chỉ `?? "-"`, trong khi `-1` = unlimited theo contract (`commercial/models.py:44`).
3. **[U6-MED — cấu trúc, user đã duyệt hướng fix] SOC 9 tabs tràn**, tab cuối bị cắt
   ("Hiệu năng thời gian th…"): `.tabBar` (`soc.components.css:5-22`) overflow-x auto +
   mask nhưng không có affordance (mũi tên/scroll hint) → trông như mất tab.
4. **[U2-MED] Ô lý do lock đặt full-width phía trên filter** (`SocUsersPanel.tsx:148-152`),
   tách rời nút Khóa từng dòng → không rõ áp dụng cho ai; đúng ra phải nằm trong modal xác nhận.
5. **[G2-MED] 2 nút tab Meters/Lịch sử dính nhau**, không gap/active state
   (`TenantUsageSummaryPage.tsx:78-83` button trần) — cùng lỗi dính như bảng Users.

---

## 1. ĐỌC TRƯỚC

- `docs/IMPLEMENTATION_PLAN_TENANT_SELF_SERVICE_20260923.md` (B+A, Entry 169/173)
- `docs/PHAN_BIEN_TENANT_SELF_SERVICE_20260923.md` (Entry 170)
- Ledger Entry 171 (F1), 172 (A2)

## 2. BẢN ĐỒ ẢNH → CODE

| Ảnh | Vùng lỗi thấy được | File:line gốc |
|---|---|---|
| 1 | Subtitle + "(4)" | `SocUsersPanel.tsx:142` (`t(subtitle) + \` (${total})\``) |
| 1 | Ô lý do full-width + filter chật | `SocUsersPanel.tsx:146-177` (input reason `:148` trước `metricGrid` filter `:153`) |
| 1 | Bảng dính cột | `SocUsersPanel.tsx:180-202` table trần; CSS chỉ có `.diffTable` (`soc.components.css:1030-1045`) |
| 1 | Pagination "‹ 1 ›" không tổng + next disable sai khi total % 20 == 0 | `SocUsersPanel.tsx:203-212` (`rows.length < 20`) |
| 1 | Tab bar cắt tab cuối | `soc.components.css:5-22` (overflow-x auto, scrollbar hidden, mask, không arrows) |
| 2 | Nút "Tạo key mới" + empty state cùng tồn tại, CTA yếu | `TenantKeysPage.tsx:156-184` |
| 3 | "Quota: -1" | `TenantUsageSummaryPage.tsx:72` |
| 3 | Nút tab dính + empty copy vô nghĩa | `TenantUsageSummaryPage.tsx:78-105` (empty dùng tên tab `:88,105`) |
| 3 | Cards là div thuần | `TenantUsageSummaryPage.tsx:70-76` |

## 3. CONTRADICTIONS (doc/kỳ vọng vs thực tế)

| # | Kỳ vọng | Thực tế | Tác động |
|---|---|---|---|
| C1 | Plan A2 §A2.2: panel "theo mẫu SocBrokerPanel" (có `.diffTable` sẵn) | `SocUsersPanel` dùng `<table>` trần, không tái dùng style table nào | Bảng xấu đúng như ảnh; fix bằng class dùng chung mới |
| C2 | Test A2 assert UI hiển thị đúng | Không có test nào assert cell spacing/badge (chỉ assert text tồn tại) | Lỗi visual lọt qua gate; bổ sung visual assertion tối thiểu |
| C3 | `QuotaRecord.api_calls_limit=-1` = unlimited (BE hiểu) | FE render raw `-1` ra màn hình | User hiểu nhầm bị giới hạn âm; fix 1 dòng + test |

## 4. FINDINGS CHI TIẾT

### Ảnh 1 — SOC Users (`SocUsersPanel.tsx`, `ShellOperationsCenterPage.tsx:27-110`)

- **[U1-HIGH] Table dính**: xem bảng §2. Fix: `.socDataTable` dùng chung trong
  `soc.components.css` (border-collapse, th/td padding, sticky header, row hover,
  right-align số) + badges (`statusBadge` sẵn có) cho Kích hoạt/Staff/Plan.
- **[U2-MED] Reason input lạc lõng**: chuyển vào modal xác nhận của nút Khóa/Mở
  (BE đã bắt reason ≥5 ký tự — modal hiện message lỗi inline thay vì `setError` chung).
- **[U3-LOW] "(4)" trong subtitle**: chuyển total thành `t("soc.users.count", {count})`
  đặt cạnh tiêu đề "Danh sách & thao tác" (bulk_title), subtitle giữ nguyên văn.
- **[U4-LOW] Pagination**: hiện "Trang X / Y trang (N users)" từ `total` đã có (`:73`);
  điều kiện next: `page * 20 < total` thay vì `rows.length < 20`.
- **[U5-LOW] Badge**: Kích hoạt/Staff/Plan dùng badge màu (xanh/xám), "—" giữ nguyên.
- **[U6-MED] Tab overflow**: xem §5 P0 (dời Users ra) + §5 P2 (arrows cho tabBar còn 8 tabs).

### Ảnh 2 — TenantKeysPage (`pages/tenant/TenantKeysPage.tsx:156-184`)

- **[K1-MED] CTA yếu**: empty state chỉ có text; thêm nút "Tạo key đầu tiên" NGAY TRONG
  empty state (mở form), + 1 dòng hint scopes (market/signals read-only mặc định).
- **[K2-LOW] Breadcrumb "keys"**: dùng titleKey `routes.tenantKeys` (đã có) thay vì path thô —
  kiểm tra breadcrumb component dùng catalog (nếu không, ghi ticket riêng, không block).

### Ảnh 3 — TenantUsageSummaryPage (`pages/tenant/TenantUsageSummaryPage.tsx:70-105`)

- **[G1-HIGH] Quota -1**: map `-1` → `t("tenantUsageSummary.unlimited")` (thêm key VI/EN);
  áp dụng mọi nơi hiển thị limit (card +Meters nếu có).
- **[G2-MED] Tabs**: bọc tab buttons bằng segmented control có gap + `aria-selected` +
  active style (mẫu `.tabButton` SOC hoặc ShellTabs nếu có); KHÔNG dùng button trần.
- **[G3-LOW] Empty copy**: `emptyMeters`/`emptyHistory` riêng ("Chưa có dữ liệu đo trong 7 ngày qua…")
  thay vì tên tab.
- **[G4-LOW] Metric cards**: dùng `renderShellMetric`/metricGrid chuẩn thay vì div thuần.

## 5. PHƯƠNG ÁN (đã chốt hướng với user)

### P0 — Dời "Người dùng" khỏi SOC sang menu Quản trị (user duyệt)

- BE giữ nguyên (`/api/soc/users/*` — tên path không bắt buộc đổi; ghi chú trong code).
- FE mới `pages/admin/AdminUsersPage.tsx` (wrapper render `SocUsersPanel` — component đã
  decoupled khỏi chrome SOC, chỉ dùng `soc.module.css` + toast/confirm dùng chung).
- `main.tsx`: route `admin/users` → `resolvePageComponent('admin-users')` (mẫu `admin/advertising` `:124`).
- `pageRegistry.js`: entry `admin-users` (mẫu `:260-268`).
- `sidebaritems.ts`: thêm vào group Quản trị
  `{ labelKey: 'layout.nav.adminUsers', path: '/admin/users', icon: 'User', staffOnly: true }`
  (icon `User` đã whitelist; `staffOnly:true` bắt buộc vì contract test
  `main-menu-contract:68` assert mọi item admin đều staffOnly).
- `routeCatalog.js`: entry `admin-users` (`group:"admin"`, capabilities `admin.operator.read`,
  mẫu `admin/advertising:428-434`).
- i18n: `layout.nav.adminUsers` + `routes.adminUsers` VI/EN.
- Xóa khỏi SOC: `SOC_TABS` (`ShellOperationsCenterPage.tsx:35`), `case "users"` (`:89-90`),
  `TAB_DESCRIPTIONS.users` (`:110`). Giữ `soc.users.*` keys (panel tái dùng) + `soc.tabs.users*`
  (xóa hoặc giữ — quyết: XÓA để `i18n:scan`/lint keys thừa không báo; không file test nào
  reference SOC_TABS/`"users"` — đã grep 0 hit).
- Test: menu-contract +1 (admin group chứa `/admin/users` staffOnly), SocUsersPanel tests giữ nguyên
  (render component trực tiếp, không qua SOC).
- DoD: tab SOC còn 8; menu Quản trị có Users (staff thấy, non-staff không); deep-link cũ
  `?tab=users` rơi về overview gracefully (logic `getInitialTab` sẵn có).

### P1 — Fix visual theo findings (cùng đợt với P0)

U1 (dataTable CSS + badges) · U2 (reason vào modal) · U3 (total ra bulk_title) · U4 (pagination
đúng) · U5 (badge) · G1 (quota map + test) · G2 (segmented tabs) · G3 (empty copy) · G4
(metric cards) · K1 (CTA empty state). Mỗi mục 1–2 tests component (assert class/badge/text).

### P2 — Tab bar affordance (backlog, không block)

Nút scroll ◀ ▶ + gradient hint cho `.tabBar` khi overflow (8 tabs còn lại vẫn tràn ở
màn hẹp); `scrollIntoView` tab active.

## 6. QUALITY GATES (bắt buộc, theo AGENTS.md)

- `npx tsc --noEmit` sau mỗi sub-step; `npm run build` cuối mỗi step.
- `npm run lint` 0 errors; `npm run i18n:scan` 0 (keys mới + keys xóa).
- vitest/jest suites chạm xanh (soc-users, menu-contract +1, tenant pages).
- BE không đụng → không cần BE gates (ghi rõ trong evidence).
- Evidence `docs/evidence/admin-users-move-20260923/`: 3 ảnh before/after + test logs.

## 7. ĐÁNH GIÁ TỔNG THỂ

Implementable, không blocker: BE giữ nguyên 100%; FE là di dời + CSS + copy.
Rủi ro thấp nhất là P0 (xóa tab SOC) — đã verify không test nào reference.
Ưu tiên: P0 → P1 (G1 trước vì là bug dữ liệu) → P2 backlog.
