# Bundle — đo trước / sau (R6.7 + B3)

## Cách đo

Đo **đồ thị chunk thực sự** mà entry `/ai-advisory` phải tải, không chỉ chunk trực tiếp.

```powershell
cd packages/web
npm run build
node scripts/measure-route-graph.mjs WhaleAdvisoryPage
```

`scripts/measure-route-graph.mjs` BFS từ `WhaleAdvisoryPage-*.js` theo **cạnh import
tĩnh** (`from "./x.js"`, `import "./x.js"`) và **loại `import()` động**.

### Đính chính quan trọng: bản đo đầu tiên của chính script này ĐÃ SAI

Bản đầu tiên của script cảm nhận `import()` động vào cùng đồ thị nên báo
**94 chunk / 6.157 KB** và kéo theo `ScreenerPage`, `ShellOperationsCenterPage` —
những route mà người dùng **chưa hề mở**. Đo sai như vậy sẽ ra kết luận sai
("bundle nặng vô lý") và mất công sửa nhầm. Đây cũng chính là lý do
`manualChunks` **không đồng nghĩa** với "không tải": tách file chỉ có tác dụng
nếu cạnh vào nó là `import()` động.

Số liệu dưới đây lấy từ bản script đã sửa.

## Kết quả đo thật (2026-09-26, build sau B3)

| Chỉ số | Trước B3 | Sau B3 | Chênh lệch |
|---|---|---|---|
| Số chunk tải lần đầu | 7 | 15 | +8 (nhỏ hơn, tốt hơn) |
| **Tổng dung lượng tải đầu** | **1.998,6 KB** | **1.339,8 KB** | **−658,8 KB (−33%)** |
| `echarts-*.js` trong tải đầu | **623,0 KB — CÓ** | **0 — KHÔNG** | −623 KB |
| `xlsx-*.js` trong tải đầu | KHÔNG (con số 419 KB trong backlog cũ là SAI) | KHÔNG | 0 |
| `dashboard-*.js` trong tải đầu | 659,2 KB | **0** | −659 KB |

Chi tiết 15 chunk sau B3: `i18n` 488,2 · `react-vendor` 298,2 · `ui` 107,3 ·
`tanstack` 93,5 · `adapters` 70,4 · `index` (app shell) 61,7 · `hooks` 57,8 ·
`WhaleAdvisoryPage` 57,5 · `utils` 36,2 · `icons` 33,2 · `casl`/`context`/`shared`/`vite-helpers` phần còn lại.

Đối chiếu: `DashboardPage` **vẫn** tải `echarts` 623 KB (tổng 1.820 KB) — đúng
mong đợi, route vẽ biểu đồ thì phải tải thư viện vẽ biểu đồ.

## Vì sao `manualChunks` cũ không đủ, và nguyên nhân gốc thật

`manualChunks` cũ **đã có** sẵn rule echarts và rule dashboard. Thêm rule mới không
phải là câu trả lời, vì vấn đề nằm ở chỗ khác: các module dùng chung bị Rollup
gộp nhầm vào chunk của route khác.

Chuỗi phát hiện (đọc sourcemap Rollup, `build.sourcemap: "hidden"`):

1. Chunk `dashboard-*.js` tên nghe như chỉ chứa dashboard, nhưng sourcemap cho
   thấy nó chứa **122 module**, trong đó có `src/i18n/vi.js` + `en.js` (toàn bộ
   từ điển), `LangContext`, `PortfolioContext`, `PaginationBar`, 60 icon
   `lucide-react`, `@casl/ability` — tức đúng những thứ **mọi trang đều cần** —
   cộng thêm `PortfolioHeatmap` / `WhaleAnalyticsTab` (chỉ dashboard dùng, nhưng
   chúng import echarts).
2. `/ai-advisory` cần `LangContext` để hiển thị chữ → bị buộc tải cả chunk
   `dashboard` → kéo theo 623 KB echarts, dù trang không vẽ biểu đồ nào.
3. Sau khi tách `adapters`/`i18n`/`context`/`ui`/`shared`/`utils`/`hooks`/
   `icons`/`casl` ra chunk riêng, chunk `dashboard` còn 11 module (đúng dashboard
   thật) — **nhưng echarts vẫn còn** trong tải đầu.
4. Truy cạnh import trong `dist/`: app shell (`main.tsx` → `AppShell` →
   `Sidebar`/`Header`) chỉ dùng **một** symbol từ chunk `dashboard`
   (`import{_ as c}from"./dashboard-....js"`), và đọc export block cho thấy
   symbol đó chính là **`__vitePreload`** của Vite — helper runtime, không phải
   module dashboard. Rollup không có rule nào khớp nên đặt nó vào chunk
   `dashboard`; hệ quả là **mọi route** đều phải tải chunk đó.
5. Tách `vite/preload-helper` ra chunk riêng → echarts biến mất khỏi tải đầu.

Không thể tìm ra mắt xích (4) nếu chỉ nhìn log build hoặc đo bằng script BFS sai
như bản đầu.

## Thay đổi

`packages/web/vite.config.ts` — `manualChunks` (thứ tự rule từ hẹp tới rộng):

| Rule | Chunk | Vì sao |
|---|---|---|
| `vite/preload-helper` | `vite-helpers` | Đặt **trước tất cả**; nguyên nhân gốc khiến mọi route tải theo chunk dashboard |
| `node_modules/echarts` | `echarts` | giữ nguyên |
| `/src/adapters/` | `adapters` | Mọi trang cần, không phải của riêng dashboard |
| `/src/i18n/` | `i18n` | từ điển 488 KB, ai cũng dùng |
| `/src/context/` | `context` | |
| `/src/components/ui/` | `ui` | |
| `/src/components/shared/` | `shared` | |
| `/src/utils/` | `utils` | |
| `/src/hooks/` | `hooks` | |
| `lucide-react` | `icons` | 60 icon |
| `@casl` / `@ucast` | `casl` | phân quyền |
| `src/components/dashboard/`, `src/features/dashboard/` | `dashboard` | giữ nguyên |

Cả hai dạng dấu gạch chéo được kiểm tra (`/src/adapters/` và `\src\adapters\`) vì
id module trên Windows có thể dùng backslash.

## Ghi nhận

- Bubble chart **không** còn trong tải đầu của `/ai-advisory` (giữ ở dashboard) — đạt từ R6.7.
- API call dư mỗi mã: **2 → 0** (đã bỏ `getWhaleAnalyticsSnapshot` + `getStockOrderFlow`).
- Con số "chunk advisory phải không import `dashboard-*.js`" trong plan §R6.7 là
  **AC viết sai** — xem mục đính chính bên dưới.
