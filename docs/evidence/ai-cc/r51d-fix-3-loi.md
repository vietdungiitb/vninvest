# AI R5.1d — sửa 3 lỗi phát hiện khi **mở ảnh E2E** của R5.1c

**Claim**: `ai-r51d` · **Nhánh**: `feat/ai-r51d` → `dev` · **Ngày**: 2026-10-18
Nguồn: `docs/evidence/ai-cc/r51c-nav-e2e.md` §"3 lỗi mà assert không bắt được".

Cả 3 lỗi **test nào cũng xanh** trước khi sửa. Đây là bài học L-V05 (exit 0 không
chứng minh được gì) và L-V04 (đúng đường dẫn ≠ đúng chỗ) rút ra từ chính ảnh chụp.

## LỖI 1 — 3 tab AI hiển thị **tiếng Anh** trong locale VI

**Đo trước:** `vi.js` để nguyên giá trị tiếng Anh cho `aiCommandCenter.tabUsage/tabTraces/tabSlo`
(`'Usage'`, `'Traces'`, `'SLO'`), trong khi `tabOverview`/`tabAudit` đã dịch. Ảnh `01` cho thấy
`Tổng quan · Usage · Traces · SLO · Nhật ký audit` — lẫn hai ngôn ngữ trên **cùng một hàng**.

**Cách sửa:** lấy **nguyên văn** giá trị đã dịch sẵn trong `layout.nav.*` của chính `vi.js`
(`aiUsageAnalytics` → `Usage AI`, `aiTraces` → `Dấu vết AI`, `aiSlo` → `SLO AI`). Không dịch
mới, không bịa. Nhờ vậy nav hub và sidebar gọi **cùng một tên** (nguyên tắc R4.4).

## LỖI 2 — breadcrumb rơi về **chuỗi thô** ở 4 route AI

**Đo trước:** `Breadcrumb.tsx:66` — `raw = map[segment] || DEFAULT_MAP[segment] || segment`.
Bảng ánh xạ chỉ có `settings`/`ai` (R4.4 thêm). Hậu quả đo được trên staging:

| Route | Trước | Nguyên nhân |
|---|---|---|
| `/settings/ai/audit` | `audit` | không có ánh xạ ⇒ rơi về segment |
| `/settings/ai/traces` | `traces` | như trên |
| `/settings/ai/slo` | `slo` | như trên |
| `/settings/ai/usage` | nhãn của **trang tenant** | `usage` **đã có** ánh xạ → `tenantUsage.title` |

**Cách sửa:** thêm `AI_ROUTE_LABELS` tra theo **tiền tố đường dẫn** (`/settings/ai`), ưu tiên
trước `I18N_MAP`. Vì vậy `/tenant-admin/usage` **giữ nguyên** nhãn cũ — có test chặn hồi quy.

## LỖI 3 — `<table>` audit không có class nào ⇒ header **dính liền**

**Đo trước (đo cả bảng, không đo cái tôi thấy):** quét **mọi** `styles.X` của
`AIAuditPage.tsx` so với `aiSettings.module.css` ⇒ thiếu **đúng 1** class: `.auditTable`.
Không phải thiếu 2–3 như đoán. `styles.auditTable === undefined` ⇒ `<table>` không có
class ⇒ các `<th>` dính liền: `Thời điểmHành độngNgười thực hiện đó`.

**Cách sửa:** thêm `.auditTable` cùng `.auditTable th/td` trong `aiSettings.module.css`,
chỉ dùng token `--ai-*` (không màu cứng — quy ước của file). Khoảng cách đặt ở **descendant**
vì trang không gắn class lên `<th>/<td>` (không thể dựa vào `.th`/`.td` của
`AIUsageDashboard`).

## AC + Gates

| # | Điều kiện | Bằng chứng |
|---|---|---|
| AC1 | 4 nhãn breadcrumb AI đã dịch | test mới, **fail-before** 4 đỏ in ra đúng `"audit"` / `"traces"` / `"slo"` |
| AC2 | không phá nhãn tenant | test `/tenant-admin/usage` giữ `Usage và quota thành viên`, ≠ `Usage AI` |
| AC3 | nhãn VI cho 3 tab | `vi.js` +3 dòng, giá trị lấy từ `layout.nav` |
| AC4 | `.auditTable` tồn tại | script đo lại: "Không thiếu class nào" |
| AC5 | hồi quy không mất test | **455** test (trước 450, **+5** = đúng 5 test mới) |
| AC6 | tsc + build | exit 0 / exit 0 |

## Một test cũ phải sửa theo (và vì sao đó là đúng)

`ai-hub-nav-r18.component.test.tsx` AC2 **tìm nav hub bằng text khoá i18n**
(`textContent.includes("aiCommandCenter.tabUsage")`). Sau khi breadcrumb render khoá (khi
`t()` trả về chính khoá trong môi trường test), `find()` bắt nhầm **breadcrumb** là nav hub ⇒
test đỏ **vì lý do sai**.

Đã sửa để tìm theo **cấu trúc**: `nav:has(a[href="/settings/ai/usage"])` — link này chỉ có ở
tab nav. **Thử `a[href^="/settings/ai"]` trước vẫn sai** vì breadcrumb có link `/settings/ai`
và đứng trước trong DOM. Đây là cùng bài học L-V04 ở tầng **test**.

## Còn mở

- **CHƯA CHẠY**: E2E lại trên staging để chụp lại 2 ảnh và xác nhận bằng mắt — cần deploy
  bản này trước (sẽ làm sau khi merge).
- Ảnh `01` có "Đang tải …" ở 2 khối dữ liệu — chưa đo thời điểm hoàn tất nên **không** kết
  luận là lỗi tải.
- Chưa kiểm nav 5 tab ở viewport mobile/tablet.