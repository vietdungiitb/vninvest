# PHẢN BIỆN ĐỘC LẬP — Session 24/09/2026 (Entries 182–192, 9 commits)

> Phương pháp (khung audit bắt buộc): 2 auditors độc lập (BE/FE surface) + tôi
> spot-verify trực tiếp + chạy gates rẻ. Mọi khẳng định kèm `file:line`.
> Không đổi code trong audit này.

**Tóm tắt 5 findings nghiêm trọng nhất:** claims code của session ĐÚNG ở mức
substance (nginx whitelist, xóa mock, shared kit, xóa Mui, namespaces i18n đều khớp
diff), nhưng (1) trùng số Entry 186 ở cả git log (2 commits) lẫn thiếu row `|185|`
trong ledger gây nhiễu traceability; (2) claim "fully i18n" chỉ đúng cho tiếng Việt —
còn option labels EN hardcode và 3 trang format số cứng `vi-VN`; (3) các con số
định lượng (contrast 1.3→4.5+, build/vitest/curl gates) là tuyên bố chưa kèm evidence
đo/chạy lại; (4) wording tuyệt đối ("NO mock", "7 commits", tên exports rút gọn)
sai phạm vi so với code; (5) gates tôi chạy lại (tsc 0, check-admin-spa-routes PASS)
xanh, các gates nặng khác (build, vitest, eslint, curl live) chưa re-run trong audit này.

## A. Bản đồ kiến trúc (đã verify)

| Commit | Entry | Nội dung | Stat khớp? |
|---|---|---|---|
| `36ad198d` | 186 (trùng, xem C6) | H0+R8 Admin Console | ngoài phạm vi session này |
| `74c7f366` | 185 (trùng tên, xem C6) | Dashboard S6 leftover | ngoài phạm vi |
| `18d58a46` | 186 (trùng, xem C6) | Docs audit Entry 186 | ngoài phạm vi |
| `cedfd4ec` | 187 | nginx whitelist 10 prefix + gate script | ✅ 5 files khớp |
| `137bf70e` | 188 | adminTone + dark variant | ✅ 13 files khớp |
| `b898f72e` | 189 | crawl honest + adminCrawl 32 keys | ✅ 9 files khớp |
| `d4ef5961` | 190 | adminUi kit + dedup keys | ✅ 17 files khớp |
| `99a3c980` | 191 | Mui cleanup + responsive + dead key | ✅ 6 files khớp |
| `a3c6ffed` | 192 | 5 namespaces + tenants ext + deps fix | ✅ 12 files khớp |

Working tree sạch, branch `dev` == `origin/dev` (verify trực tiếp).

## B. Luồng dữ liệu đã trace

1. **Nginx routing** (`packages/web/docker/nginx.conf`): `/admin/core/` (:42) và
   10 fleet blocks (`:57` users, `:64` tenants, `:71` billing, `:78` usage,
   `:85` audit, `:92` audit-trace, `:99` analytics, `:106` overview, `:113` jobs,
   `:120` advertising) đều `try_files ... /index.html`, đứng TRƯỚC generic
   `location ^~ /admin/` (`:128` → `proxy_pass` Django `:129`). `^~` longest-prefix
   nên `/admin/audit-trace` không bị nuốt bởi `/admin/audit`. Gate script
   `packages/web/scripts/check-admin-spa-routes.mjs:1-69` đếm động (không hardcode
   14/11); chạy thật **PASS** (`14 catalog /admin/* paths covered by 11 SPA locations`).
2. **SOC tab fallback**: `?tab=users` cũ rơi về `"overview"`
   (`ShellOperationsCenterPage.tsx:42-50`, validate `SOC_TABS.some` + localStorage).
3. **Dark variant**: `index.css:13` `@custom-variant dark` bind
   `:root:not([data-theme="light"])`, thay default `prefers-color-scheme` của Tailwind v4.

## C. CONTRADICTIONS

| # | Doc/Summary | Thực tế code | Tác động / Fix |
|---|---|---|---|
| C1 | Script `scripts/check-admin-spa-routes.mjs` (AGENTS, commit msg) | Thật là `packages/web/scripts/...:1-69`; root không có `scripts/` tương ứng | Thấp — sửa doc thành path đầy đủ |
| C2 | "14 ↔ 11" như thuộc tính của script | Script đếm động (`:30-47`); số nằm ở prose/commit msg | Thấp — không đọc nhầm thành assert tĩnh |
| C3 | "8 trang fully i18n / NO hardcoded" (AGENTS:12-17) | Còn option EN hardcode: `AdminCorePATsPage.tsx:235-237,263-265`; `AdminCoreServiceAccountsPage.tsx:224,235-237,248-250` | Trung bình — EN locale vẫn thấy `active/Disabled/prod/...` thô |
| C4 | "`kindLabel`/`toLocaleString` theo locale" | `AdminCoreTenantsPage.tsx:96` thiếu `localeTag`; `AdminCoreBillingPage.tsx:21` + `AdminCoreUsagePage.tsx:25` cứng `'vi-VN'` | Trung bình — EN vẫn format kiểu VI |
| C5 | "Ledger chứa Entries 187–192" | Đúng nhưng dạng **table rows** (`:4564-4569`), grep `^## Entry 18[789]` = 0 hit | Thấp — tooling parse `##` sẽ báo thiếu giả |
| C6 | 1 số Entry = 1 change | **2 commits cùng số 186** (`36ad198d` impl vs `18d58a46` docs, verify `git log --grep`); thiếu row `\|185\|` (nhảy 184→186) dù `## Entry 185` tồn tại | Trung bình — traceability nhiễu; cần alias/quy ước |
| C7 | "7 commits đã push" (summary) | Thực tế **9 commits** `36ad198d→a3c6ffed` trên dev == origin/dev | Thấp — đếm lại |
| C8 | "xoá 8 toneClasses" | Diff `137bf70e`: **7 `toneClasses` + 1 `kindTone`** (Jobs) | Thấp — ghi 7+1 |
| C9 | Exports "Header/Panel/MetricCard/..." | Thật: `AdminPageHeader/AdminPanel/AdminMetricCard/AdminValueRow/AdminEmptyState` (`adminUi.tsx:16,41,68,88,97`) | Thấp — dùng tên đầy đủ |
| C10 | "adminCrawl 30 keys", "NO mock/console/emoji" | Thật **32/32 parity**; mock/console/emoji chỉ sạch **trong crawl** (repo còn 34 emoji hits, console.* ở Dashboard/Watchlist) | Thấp — scope wording |
| C11 | Contrast "1.3→4.5+" | Không script đo/evidence trong commit; comment tự tuyên bố (`adminTone.ts:4-7`) | Trung bình nếu dùng cho WCAG compliance — cần đo lại |
| C12 | Gates build/vitest/eslint/curl trong summary | Tôi **không re-run** các gates nặng này (chỉ tsc 0 + check script PASS) — coi là tuyên bố của session, chưa kiểm chứng độc lập | Ghi rõ coverage audit |

## D. Findings (mức | vị trí | đề xuất)

- **[MEDIUM] F-A**: i18n nốt option labels EN (C3) + `localeTag` cho Tenants/Billing/Usage (C4). ~10 dòng + keys.
- **[MEDIUM] F-B**: ledger numbering — alias 1 trong 2 Entry 186, bổ sung row `|185|`, quy ước header-vs-row (C5-C6).
- **[LOW] F-C**: sửa doc path script → `packages/web/scripts/...` (C1); "7→9 commits", "8+1 toneClasses", tên exports đầy đủ, "32 keys" (C7-C10).
- **[LOW] F-D**: đo contrast thật hoặc hạ claim readability (C11).
- **[INFO] F-E**: Billing `currency:'USD'` cứng (`AdminCoreBillingPage.tsx:21-24`) trong khi amounts VND — kiểm tra ngoài scope, đề xuất ticket riêng.
- **[INFO] F-F**: dist-CSS evidence là artifact tạm — contract thật là `index.css:13`.

## E. Quality gates audit

| Gate | Session claim | Tôi chạy lại | Kết quả |
|---|---|---|---|
| tsc | 0 | `npx tsc --noEmit` | ✅ 0 |
| check:admin-spa-routes | PASS | `node ./scripts/check-admin-spa-routes.mjs` | ✅ PASS 14/11 |
| build 24–56s | PASS | không re-run (nặng) | ⚪ tuyên bố session |
| vitest/eslint | xanh | không re-run | ⚪ tuyên bố session |
| curl live 14/14 | 200 | không re-run (cần dev stack) | ⚪ tuyên bố session |
| visual QA tay | PENDING (user) | — | ⏳ chưa làm (đúng như summary ghi) |

## F. Câu hỏi cần làm rõ

1. Chốt alias cho trùng 186 (đổi số 1 bên hay giữ cả 2 + ghi chú)?
2. Có muốn ticket riêng cho currency USD/VND ở Billing (F-E)?
3. Visual QA tay có checklist TC-01..07 chưa, ai chạy?

## G. Đánh giá tổng thể

Session claims **đúng substance, sai wording/đếm ở mức thấp-trung bình**; không phát hiện
bịa file, không blocker vận hành (nginx + i18n + gates đã verify ở mức có thể).
Ưu tiên sửa: F-A (i18n nốt) → F-B (ledger) → F-C/F-D (doc). Không yêu cầu revert hay
rework lớn. Visual QA tay vẫn là gate cuối chưa đóng như summary đã ghi.
