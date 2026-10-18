# AI R5.1c — E2E nav AI trên staging (đóng nốt AC3/AC4 + tab Audit R4.5)

**Claim**: `ai-r51c` · **Nhánh**: `feat/ai-r51c-nav-e2e` → `dev` · **Ngày**: 2026-10-18
**Môi trường**: staging đã deploy R5.1 (`dev` @ `68480f1f2`), user `testuser` (`auth_user` id 2,
`is_staff=t`, `is_superuser=t`) ⇒ **5 tab** kỳ vọng.

## Kết quả E2E — chạy thật, không giả lập

```
PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test ai-hub-nav-r51 --project=chromium

  ✓ [setup]    auth.setup.ts — authenticate testuser            (15.3s)
  ✓ AC3+AC4:   hub AI có đúng 5 tab, không còn link tới Agents  (12.0s)
  ✓ AC-R4.5:   /settings/ai/audit render được                  (11.4s)
  ✓ AC2:       route Agents trả về trang 404 của app            (4.6s)
  4 passed (31.8s)
```

| AC | Kiểm tra | Kết quả |
|---|---|---|
| AC3 | menu bỏ tab Agents | `a[href="/settings/ai/agents"]` = **0** trên **toàn trang** (không chỉ nav) |
| AC4 | tab count **5** | `['/settings/ai','/settings/ai/usage','/settings/ai/traces','/settings/ai/slo','/settings/ai/audit']` — khớp **thứ tự** |
| AC2 | route Agents đã chết | điều hướng tới `/settings/ai/agents` **không** render hub, không có link Agents |
| R4.5 | tab Audit staff-only | `/settings/ai/audit` render breadcrumb 3 mức + `aria-current="page"` đúng tab Audit |

**Selector đã lo đúng chỗ:** `nav:has(a[href="/settings/ai/usage"])`. Dùng
`a[href="/settings/ai"]` sẽ khớp **cả link điều hướng toàn cục** trên layout ⇒ xanh dù hub
chưa render (L-V04 ở dạng hình ảnh).

## Ảnh bằng chứng — **đã mở ra xem**, không chỉ tin exit 0

`docs/evidence/ai-r51/visual/01-hub-5-tabs.png` (357.7 KB) · `02-audit-tab.png` (388.3 KB)

Mở ảnh ra xem là bắt được **3 lỗi mà assert không bắt được** (L-V05 đúng lúc):

### LỖI 1 — 3 tab hiển thị **tiếng Anh** trong locale VI

Ảnh `01` cho thấy nav: `Tổng quan · **Usage** · **Traces** · **SLO** · Nhật ký audit`.
Nguyên nhân đo được: `vi.js` để **nguyên giá trị tiếng Anh** cho 3 khoá
`aiCommandCenter.tabUsage/tabTraces/tabSlo`, còn `tabOverview`/`tabAudit` đã dịch.

### LỖI 2 — breadcrumb hiện **chuỗi thô** `audit` (và `traces`/`slo`)

Ảnh `02` cho thấy: `Cài đặt tài khoản / Trí tuệ nhân tạo / **audit**`.
Nguyên nhân: `Breadcrumb.tsx:66` — `raw = map[segment] || DEFAULT_MAP[segment] || segment`.
R4.4 đã thêm ánh xạ cho `settings`/`ai` nhưng **R4.5 thêm route `audit` mà không thêm ánh xạ**
⇒ mục cuối rơi về chuỗi thô. Tệ hơn: `usage` **đã có** ánh xạ nhưng trỏ sang
`tenantUsage.title` (nhãn của trang tenant, không phải AI) ⇒ `/settings/ai/usage` hiện sai tên.
Đây là **cùng lớp bug** R4.4 đã sửa cho `settings`/`ai`, tái diễn vì thêm route mà không
cập nhật bảng ánh xạ.

### LỖI 3 — header bảng audit **dính liền**: `Thời điểmHành độngNgười thực hiện đó`

Ảnh `02`: ba `<th>` không có khoảng cách ⇒ đọc như một chuỗi. Kiểm chứng chỉ bằng **mắt** —
assert HTML không phát hiện được thiếu khoảng cách hiển thị.

Cả 3 lỗi **chưa sửa** trong slice này (slice này chỉ đo). Đã ghi vào ledger Entry 377 và
mở ticket sửa riêng.

## Còn mở (không phải lỗi)

- `CÀU HÌNH AI RUNTIME` và `Nhật ký audit Command Center` hiện "Đang tải …" trong ảnh `01`
  ⇒ dữ liệu rỗng/ngoài phạm vi kiểm tra; **không** kết luận là lỗi tải (chưa đo thời điểm
  hoàn tất).
- Ảnh dùng viewport Desktop Chrome mặc định, **chưa** kiểm mobile/tablet cho nav 5 tab.