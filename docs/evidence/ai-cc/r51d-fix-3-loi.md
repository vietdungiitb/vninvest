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

## VERIFY SAU KHI SỬA — chạy thật trên staging, **đã mở ảnh xác nhận bằng mắt**

Deploy `dev` @ `cbafa4b47` → chạy lại `ai-hub-nav-r51`: **4 passed (37.3s)**, 2 ảnh chụp lại.

| Lỗi | Trước (ảnh cũ) | Sau (ảnh mới) — xác nhận bằng mắt |
|---|---|---|
| 1 nhãn VI | `Tổng quan · Usage · Traces · SLO · Nhật ký audit` | `Tổng quan · **Usage AI** · **Dấu vết AI** · **SLO AI** · Nhật ký audit` |
| 2 breadcrumb | `Cài đặt tài khoản / Trí tuệ nhân tạo / **audit**` | `Cài đặt tài khoản / Trí tuệ nhân tạo / **Nhật ký audit**` |
| 3 bảng audit | `Thời điểmHành độngNgười thực hiện đó` (dính liền) | 4 cột rời nhau: `THỜI ĐIỂM │ HÀNH ĐỘNG │ NGƯỜI THỰC HIỆN │ LÝ DO` + đường kẻ ngang |

## Còn mở

- ~~Quan sát "Đang tải …"~~ → **ĐÃ ĐO, KHÔNG PHẢI LỖI.** Probe Playwright (đã xoá sau khi
  đo) trên staging: sau khi `.loading-subtext` ẩn, hai khối đó **biến mất ngay**; quét
  `body` ở t=0/2/4/6s đều **sạch**, không còn chuỗi "Đang tải" nào. Nguyên nhân: ảnh được
  chụp **giữa lúc tải**, không phải kẹt loading. Đo kèm: hub chỉ phát **2 XHR**
  (`GET /core/v1/auth/me/`, `GET /core/v1/identity/profile/`) — **không** gọi API AI nào,
  nên các thẻ cấu hình hiện trạng thái chưa cấu hình. **CHƯA** kết luận việc không gọi API AI
  là đúng hay sai — cần đọc code trang, chưa đo.
- Nav phụ trong card hub vẫn có nhãn **tiếng Anh** `Runtime` (thuộc component khác, không
  nằm trong `AiHubNav`) — chưa đo khoá của nó.
- Ô nhập "Lọc theo hành động" có placeholder bị **cắt** (`vd: t…`) — nghi vấn do bề rộng ô
  nhập, **chưa** đo, không sửa trong slice này.
- Chưa kiểm nav 5 tab ở viewport mobile/tablet.