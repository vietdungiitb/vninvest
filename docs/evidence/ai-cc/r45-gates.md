# AI R4.5 — `AiHubNav`: tab "Nhật ký kiểm toán" (chỉ staff) + route guard

**Claim**: `ai-r45` · **Nhánh**: `feat/ai-r45-audit-tab` → `dev` · **Ngày**: 2026-10-18
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1237-1248`

## Kết quả AC

| # | Điều kiện | Bằng chứng | AC |
|---|---|---|---|
| AC1 | 6 tab (thêm tab thứ 6) | `ai-audit-tab.component.test.tsx` — staff thấy đúng 6 link, tab mới **cuối danh sách**, 5 tab cũ giữ nguyên thứ tự | ✅ |
| AC2 | User thường không thấy tab cần staff | Member thấy **5** tab; superuser vẫn thấy tab audit (không khóa nhầm người quản trị) | ✅ |
| AC3 | Tab ẩn **không truy cập được bằng URL trực tiếp** | Route `/settings/ai/audit` bọc `StaffRoute` (test đọc `main.tsx`) **và** test render `StaffRoute` với non-staff ⇒ bị đưa về `/dashboard`, không thấy nội dung trang | ✅ |
| AC4 | Active state đúng trên các route | **6/6** route có đúng 1 `aria-current="page"` và trỏ đúng tab | ✅ |

## Plan chỗ nào phải sửa trước khi làm

- **AC1 trong plan STALE**: plan ghi *"6 tab (thêm Traces)"* nhưng Traces **đã có từ R3.2**;
  đo thật cho **5 tab** khớp 5 route `/settings/ai{,/agents,/usage,/traces,/slo}`. Để AC1
  đúng nghĩa, tab thứ 6 lấy chỗ trống thật: **Nhật ký kiểm toán** — BE đã có sẵn
  endpoint audit (`portfolio_analytics_views.py:2162`) và export CSV của R4.3.
- **AC2/AC3 không có dữ kiện trong plan**: trong hub **không có tab nào staff-only ở tầng
  BE** (audit log của user thường vẫn xem được log của chính họ — R0.11). **Đã hỏi
  Owner**, Owner chọn: thêm tab Audit và **chỉ staff thấy**.
- AC3 yêu cầu *"route guard, không chỉ ẩn UI"* — repo **đã có** `StaffRoute`
  (`StaffRoute.tsx:14`) nên dùng lại, không tự chế guard mới; BE cũng đã tự scope dữ liệu
  nên không có đường vòng đọc log qua URL.

## Ba quyết định thiết kế

1. **Cờ staff lấy từ `userIdentity`** — đúng nguồn mà `StaffRoute` dùng. Nếu nav đọc
   `localStorage`/session riêng thì sẽ có **hai câu chuyện về quyền** và chúng sẽ lệch
   (cùng lớp lỗi với `resolve_tenant`).
2. **`requiredCapabilities` trong `routeCatalog` không phải guard.** Cả 5 route AI khai
   `system.ai_command_center.manage`; route audit khai **giống hệt** cho nhất quán, và
   ghi rõ trong catalog rằng ranh giới staff nằm ở `StaffRoute`. Bịa một capability
   "staff-only" trong catalog sẽ là khóa giả không ai kiểm.
3. **Export CSV dùng thẻ `<a download>`**, không `fetch` + tải tay: response có BOM và
   cờ `truncated` **nằm ở header HTTP**; đọc bằng `fetch` sẽ phải expose header qua CORS
   chỉ để hiện một con số.

## Một hồi quy do chính tôi gây ra (đã sửa)

Thêm `usePortfolio()` vào `AiHubNav` làm **21 test của R3.2/R3.3 đỏ**
(`ai-traces.component.test.tsx`, `ai-slo-dashboard.component.test.tsx`) với lỗi
`usePortfolio must be used inside PortfolioProvider`. Nguyên nhân: các test đó mock
adapter nhưng **không** có `PortfolioProvider`. Đã thêm `vi.mock` vào cả 2 file và ghi
rõ trong comment rằng thiếu nó làm **mọi** test trong file chết — kể cả test vốn xanh.
Sau sửa: **60 file / 385 test xanh**.

## Một lỗi công cụ tôi tự gây ra (đã hoàn tác)

Lệnh PowerShell `Replace` + gộp dòng trống toàn cục của tôi đã sửa **14.538 dòng** ở
`i18n/vi.js` và `en.js`. Phát hiện qua `git diff --numstat` (**7274/7264**), đã
`git checkout --` cả hai file rồi chèn lại bằng Node script byte-exact (17 + 16 dòng).
Bài học: với file lớn, **không dùng `Replace` toàn cục**; luôn kiểm `--numstat` sau khi
sửa file (cùng lớp với `tooling-traps.md` L-T01).

## Gates

| Gate | Kết quả |
|---|---|
| FE mới `ai-audit-tab.component.test.tsx` | **13/13 OK** (fail-before: 6 đỏ / 7 xanh) |
| FE hồi quy `pages/__tests__` + `components/__tests__` | 60 file · **385/385 OK** |
| `tsc --noEmit` | exit 0 (sau khi thêm khai báo `getAIAuditLogs` vào `.d.ts` — runtime đã có từ R0.7 nhưng **thiếu type**) |
| `npm run build` | exit 0 (`built in 46.00s`) |
| `eslint` (3 file R4.5) | 0 error, 18 warning (`react/jsx-no-literals` — nhiễu nền) |
| `i18n:scan` | exit 0 |
| `check-system-design --check` | SACH (exit 0) |

## Còn mở

- **Chưa chụp ảnh E2E** cho tab Audit (AC của R4.5 không yêu cầu ảnh; AC3 của R4.4 đã
  chụp). Muốn có thì thêm vào `ai-settings-nav.spec.ts` sau khi deploy.
- Chưa đo trên staging: cần deploy + chụp ảnh mới khẳng định được tab ẩn/hiện ngoài đời
  (unit test đã khoá logic, nhưng chưa phải bằng chứng chạy thật trên trình duyệt).
- Trang Audit hiện dùng `getAIAuditLogs` với phân trang **client-side theo `limit/offset`**;
  chưa thêm lọc theo ngày/actor (đã có ở endpoint, chưa đưa lên UI).