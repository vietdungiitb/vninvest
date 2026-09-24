# IMPLEMENTATION PLAN — Dashboard Audit Fix (Image 1, audit 35 điểm #1–35)

> **Nguồn**: audit ảnh Image 1 (35 findings #1–35) + báo cáo audit/phản biện `Dashboard` ngày 2026-09-21 (sections A–G, findings F1–F9, contradictions C1–C7).
> **Phạm vi code duy nhất**: `packages/web` là SSOT. `frontend/` chỉ sync tối thiểu ở S7, không refactor.
> **Nguyên tắc**: không đoán — mọi khẳng định có `file:line`; không thêm dep mới; i18n qua `LangContext`; `npx tsc --noEmit` sau mỗi sub-step; `npm run build` cuối mỗi slice.

---

## 0. Quyết định khóa (LOCKED — đội code không hỏi lại, chỉ thực thi)

| ID | Quyết định | Lý do / bằng chứng |
|---|---|---|
| L1 SSOT | Screenshot được implement theo `packages/web/src/pages/DashboardPage.tsx:1-443` + `packages/web/src/index.css:269-303`. `frontend/src/pages/modern/ModernDashboard.jsx:489-546` + `frontend/src/index.css:262-299` là mirror cũ, chỉ sync ở S7 | Hai grid khác nhau (`1fr 1.5fr 1fr` vs `repeat(3,1fr)`), lane khác nhau (`580px overflow:auto` vs `526px overflow:hidden`). Sửa 2 nơi cùng lúc = vỡ. AGENTS.md: `packages/web` là SaaS native |
| L2 Grid | Giữ ratio `1fr 1.5fr 1fr` desktop ≥1280px. Thêm breakpoint: 1100–1280px → 2 cột (alert + heatmap, AI full row); <1100px → 1 cột stack. Lane height: `580px` cố định → `clamp(480px, calc(100dvh - var(--dash-chrome, 320px)), 720px)` + `min-height:0` + cuộn nội bộ. Không dùng `height:100dvh` full-page vì còn deck bên dưới (`DashboardPage.tsx:416-438`) | Audit C3/C6: số px audit chỉ đúng 1 viewport. `100dvh` cho cả `.dash` sẽ cắt deck. Công thức clamp giữ triad vừa viewport mà không mất deck |
| L3 Tên panel | Heatmap GIỮ `heatmap.title = 'Bản đồ danh mục'` (vi, `vi.js:2173`) / `'Portfolio Heatmap'` (en, `en.js:2178`) + thêm dòng scope subtitle. AI panel ĐỔI thành `'Tín hiệu AI'` (vi) / `'AI signals'` (en), sentence case | Audit C2: data là universe user (`DashboardPage.tsx:210-219`), không phải toàn thị trường → đổi tên là sai semantics. Title cũ `Trung Tâm Tín Hiệu AI Advisor` (`vi.js:2223`) quá dài gây wrap (F4) |
| L4 Ngày `14/12/24` | Coi là **stale-artifact chưa rõ nguồn** cho đến khi S0.3 chứng minh ngược lại (grep `14/12/24` toàn repo = 0 hit). Implement cơ chế thay thế (S1.4) rồi đóng, không block các slice khác | Audit C1: `SmartStatsHeader.js:91-124` không render date nào |
| L5 Treemap | **ECharts-only, cấm thêm `d3`** cho treemap. `d3-scale` có trong `package.json:77` nhưng treemap đang dùng `echarts/core + TreemapChart` (`PortfolioHeatmap.js:7-17`). Thang màu liên tục viết bằng color-callback + `visualMap` piecewise ẩn, kẹp ±7% (biên HOSE) | Audit C4: snippet `d3.scaleLinear` + hàm `textOn` lỗi logic, không chạy được |
| L6 Màu | Accent tương tác cyan `#22d3ee` duy nhất; tăng/mua `#22c55e`, giảm/bán `#ef4444`; 0/trung tính nền `#2f3747` + chữ slate; severity chỉ ở `border-left` + chip mức độ; danh mục (Cá mập/Dark flow) chip trung tính + icon | Code đã tách 2 domain (`severityCardStyles` `UnifiedAlertCenter.js:26-42` vs `getHeatColor` `PortfolioHeatmap.js:32-38`), audit gộp chung là quá mức |
| L7 Số/ngày | Một util `packages/web/src/utils/formatMarket.js`: `formatVNDCompact` (vi-VN, `1,52 tỷ ₫` / `660,5 triệu ₫`, `toFixed(1)` thập phân dấu phẩy) + `formatFullVND` cho tooltip + `formatSessionDate` (`dd/MM/yyyy` + `HH:mm`). Mọi panel dùng chung | Audit #17: `1,523,938,140đ / 1.5 tỷ / 660.5 triệu` lẫn kiểu Mỹ |

---

## 1. Baseline S0 — Khóa SSOT + bằng chứng nền (làm trước, ~1h, không code UI)

### S0.1 Xác nhận route demo
- Mở `packages/web` dev (`npm run dev` trong `packages/web`), vào route render `DashboardPage` (qua `FullLayout`, kiểm tra `src/app/routeCatalog.ts` + `src/pages/pageRegistry.js` để lấy path `/dashboard`).
- Chụp screenshot viewport 1905×1015 (khớp ảnh audit) lưu `docs/evidence/dashboard-fix/s0-baseline-1905.png`.
- Đo bằng DevTools: header height, KPI height, 3 lane widths, card height. Ghi vào `docs/evidence/dashboard-fix/s0-measurements.md` (4 số + so với audit #1: header ~100px, KPI ~115px, 507/761/507, card 202px — ghi khớp/lệch từng số).

### S0.2 Truy nguồn `14/12/24`
- Chạy `rg -n "14/12|12/24|dd/MM/yy" packages/web/src frontend/src --no-heading` + `rg -n "breadthLabel|marketBreadth|realtimeBreadth" packages/web/src frontend/src`.
- Đọc `frontend/src/components/modern/SmartStatsHeader.*` (file import ở `ModernDashboard.jsx:9`) xem có render date không; ghi file:line hoặc `KHÔNG TỒN TẠI`.
- Kết luận 1 trong 2: (a) tìm thấy nguồn → ghi file:line + API response mẫu; (b) không thấy → ghi `STALE-ARTIFACT`, S1.4 thay bằng `cập nhật HH:mm + badge`.
- Minh chứng: paste output 2 lệnh rg + 5 dòng đầu file nguồn (nếu có) vào `s0-measurements.md`.

### S0.3 Chốt danh sách file chạm
- Không sửa ngoài danh sách §7. Nếu cần thêm file → dừng, ghi lý do vào plan, không tự mở rộng.

**DoD S0**: có `s0-baseline-1905.png` + `s0-measurements.md` (4 số đo + kết luận date). Không cần build pass thêm.

---

## 2. Slice S1 — P0 truncation + KPI sign + date (F1, F4, F5, C1)

### Yêu cầu
1. Mã CP không bao giờ `truncate`; chỉ mô tả được ellipsis.
2. Nút Làm mới 1 dòng mọi width; title AI ngắn.
3. Giá trị 0 trung tính (xám), dương xanh, âm đỏ. Portfolio rỗng → 1 dòng CTA thay cho Alpha/Beta/Sharpe/DD.
4. Thay vị trí date cũ bằng `cập nhật HH:mm` + badge stale khi dữ liệu quá hạn.

### Files (khóa)
- `packages/web/src/components/dashboard/UnifiedAlertCenter.js:368-387` (row head)
- `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:125-148` (header + nút)
- `packages/web/src/components/dashboard/SmartStatsHeader.js:53-72,91-124` (dayPL, breadth, refresh)
- `packages/web/src/i18n/vi.js:2221-2229` + `en.js:2226-2234` (title AI, keys mới)
- `packages/web/src/utils/formatMarket.js` (MỚI, theo L7)
- `packages/web/src/index.css:269-303` (thêm `.pill[data-sign]`, `.btn-nowrap`, `.seg`)

### Steps
- **S1.1 Symbol flex** (`UnifiedAlertCenter.js:371-381`): `span` symbol đổi class `font-semibold … truncate` → `flex:none`; wrapper `flex items-center gap-2.5 flex-1 min-w-0` giữ nguyên; desc/body (`388`) thêm `min-w-0 overflow-hidden text-ellipsis whitespace-nowrap` cho dòng head-desc (tạo class `.alert-head .desc` trong index.css nếu cần). Time (`382`) thêm `margin-left:auto flex:none`.
- **S1.2 Nút + title** (`AIAdvisorAlertPanel.js:128-148`, `vi.js:2223`, `en.js:2228`): đổi title vi `Trung Tâm Tín Hiệu AI Advisor` → `Tín hiệu AI`; en `AI Advisor Signal Center` → `AI signals`. Nút refresh thêm `white-space:nowrap; flex:none` (class `.btn-nowrap`). Giữ `hidden sm:inline` cho label (`147`).
- **S1.3 Sign-0 + empty portfolio** (`SmartStatsHeader.js:58-72`): tách helper `signOf(dayPL)`; class màu: `>0 emerald`, `<0 rose`, `===0 slate/muted` (thêm CSS `.pill[data-sign="0"]` xám + bỏ `bg-emerald-500/20` khi 0). Khi `!marketValue && analytics null/undefined` (dùng điều kiện `loading || !marketValue` ở `49` + 4 metric `value==null` ở `85`): render 1 dòng `Chưa có danh mục. [Tạo danh mục] hoặc [Kết nối Paper Trading]` thay grid 4 metric (giữ grid khi có data). Keys mới: `smartStats.emptyCta`, `smartStats.createPortfolio`, `smartStats.connectPaper` (vi+en).
- **S1.4 Updated-time + stale badge** (`SmartStatsHeader.js:91-124`): thêm prop `updatedAt` (truyền từ `DashboardPage.tsx:339-346`, lấy `Date.now()` sau `refresh` hoặc `summary.updated_at` nếu có — KHÔNG bịa field, nếu không có thì dùng giờ render + ghi rõ trong code comment). Render `Cập nhật HH:mm` (`toLocaleTimeString vi-VN`) cạnh nút refresh (`113-122`); nếu `Date.now()-updatedAt > 15 phút` hiện badge `Dữ liệu cũ` (key `smartStats.stale`). Xóa mọi render date `dd/mm/yy` nếu phát hiện ở S0.2 (ghi file:line đã xóa).
- **S1.5 Util format** (MỚI `formatMarket.js`): `formatVNDCompact(v)` dùng `Intl.NumberFormat('vi-VN')`, ngưỡng tỷ/triệu, thập phân phẩy; `formatFullVND(v)` số đầy đủ + `₫`; `formatSessionDate(iso)` → `dd/MM/yyyy`. Export + unit test (S6).

### DoD (đo được)
- [ ] Viewport 1280px + 1905px: symbol `CAR/VBB/H…` hiện đầy đủ, không `C…`; nút Làm mới 1 dòng; title 1 dòng (`Tín hiệu AI`).
- [ ] `dayPL=0` → pill xám (computed color `rgb(138,148,166)`-hệ, không xanh/đỏ); `>0` xanh, `<0` đỏ.
- [ ] Portfolio rỗng (mock `summary=null, analytics=null`): KPI hiện đúng 1 dòng CTA có 2 button/link; không còn 4 ô `--`.
- [ ] Không còn chuỗi `14/12/24` trong DOM (inspect + `rg` build output 0 hit); có text `Cập nhật HH:mm`.
- [ ] `npx tsc --noEmit` = 0 (workdir `packages/web`).

### Minh chứng (bắt buộc, thiếu = chưa nghiệm thu)
- `docs/evidence/dashboard-fix/s1-symbol-nowrap.png` (row CAR đầy mã, desc ellipsis).
- `docs/evidence/dashboard-fix/s1-sign-zero.png` (pill 0 xám + DOM class `data-sign="0"` trong DevTools).
- `docs/evidence/dashboard-fix/s1-empty-portfolio.png` (1 dòng CTA).
- Paste output `npx tsc --noEmit` (0 errors) + `rg -n "14/12/24" packages/web/src` (0 hit).

### Phản biện nghiệm thu (người nghiệm thu cố bẻ)
- Thu nhỏ lane alert xuống 300px (DevTools): symbol vẫn đủ, chỉ desc cắt → PASS; nếu symbol cắt → FAIL.
- Set `dayPL = -0.001` và `+0.001`: phải đỏ/xanh đúng; `0` xám → sai màu nào cũng FAIL.
- Xóa `updatedAt` prop: vẫn render giờ render + comment ghi rõ nguồn → PASS; crash/blank → FAIL.

---

## 3. Slice S2 — Alert lane: filter có nhãn + card gọn 88–110px (F2, F6, F7)

### Yêu cầu
1. Filter severity có nhãn + count, 1 hàng cuộn ngang, `aria-pressed`, ẩn mức count=0 (làm mờ).
2. Card gọn 88–110px: 1 dòng head (`▲ SYM · source mua · giá trị compact`), 1 dòng meta (giá/cp, tin cậy, thời gian tương đối + tooltip giờ tuyệt đối). Bỏ chip `Phiên` riêng (gộp vào meta). 1 màu chip cho mua/bán.
3. Giữ badge = unread (không đổi trung tính). Thêm `Xem tất cả →` ở header + hover actions (đã xem/tắt tiếng đã có `320-352`, giữ + style hover).
4. Xóa hard-code VI trong component, chuyển hết qua i18n.

### Files
- `packages/web/src/components/dashboard/UnifiedAlertCenter.js` (toàn bộ `67-439`, trọng tâm `128-169` filters, `247-394` cards)
- `packages/web/src/i18n/vi.js:2198-2220` + `en.js:2203-2225` (keys filter/card/meta mới)
- `packages/web/src/utils/formatMarket.js` (dùng `formatVNDCompact` cho chip giá trị, thay `271-287`)
- `packages/web/src/index.css` (thêm `.seg`, `.alert-card`, `.alert-head`)

### Steps
- **S2.1 Filter bar** (`210-234`): đổi container `flex-wrap` → `flex-nowrap overflow-x-auto gap-1` (class `.seg`, `scrollbar-width:none`); mỗi nút render `{label} {count}` (label từ `t('alert.severity.*')` đã có `2209-2214`, thêm count luôn hiện kể cả 0? — KHÓA: hiện nhãn + count, mức count=0 thì `opacity-40` không ẩn hẳn để user biết taxonomy; khi hẹp thì cuộn ngang, không rớt hàng). Giữ `aria-pressed` (`227`) + `title=f.label` (`228`). Thêm key `alert.filterAll` nếu cần.
- **S2.2 Card compact** (`356-394`): restructure mỗi card: dòng 1 `.alert-head`: `▲/▼ SYM` (`flex:none font-700 15px`) + `·` + source label (`sourceLabel`, `375-380`, chip trung tính `bg-slate-800 text-slate-300`, bỏ màu severity ở chip này) + `·` + `formatVNDCompact(value)` + time `margin-left:auto` (`1 giờ trước`, tooltip `formatExecutionTime` tuyệt đối). Dòng 2 `.alert-meta`: `{qty} cp @ {price} · Tin cậy {pct}% ⓘ` (tooltip công thức khi có). Bỏ chip `Phiên: yyyy-mm-dd` riêng (`305-316` → gộp `· Phiên {formatSessionDate}` vào meta). Direction chip duy nhất: mua `emerald`, bán `rose` (`253-269` giữ, chuẩn hóa label qua i18n `alert.dirBuy/dirSell`). Chiều cao mục tiêu 88–110px: giảm `p-4` → `p-3`, `space-y-2` giữ, `metadataChips` 1 hàng `flex-nowrap overflow-hidden`.
- **S2.3 Badge + header link** (`184-193`): GIỮ badge đỏ = unread (`unreadAlertCount` `104`), thêm `title={t('alert.unreadTooltip')}` (`{count} chưa đọc`). Thêm link `Xem tất cả →` (key `alert.viewAll`) cạnh `clearFilters` (`194-207`), href tới AlertCenter route (lấy từ `pageRegistry.js`, không hard-code path — ghi path đã dùng vào plan evidence).
- **S2.4 i18n cleanup**: chuyển `↑ MUA/↓ BÁN` (`266`), `Giá trị:` (`285`), `Tin cậy:` (`300`), `Phiên:` (`313`), `Tắt 30p` (`349`) thành keys `alert.dirBuy/dirSell/val/conf/session/mute30m` (vi+en). Xóa raw `toFixed(1)} tỷ/triệu` (`273-277`) → dùng `formatVNDCompact`.
- **S2.5 Logic giữ nguyên**: không đổi `severityCardStyles` border-l (`26-42`), dedup (`DashboardPage.tsx:246-260` + `alertDedup.js`), filter behavior (`106-115`), pagination (`396-438`).

### DoD
- [ ] 5 filter hiện nhãn + count 1 hàng, không rớt; `aria-pressed` đúng; chụp 1280px + 360px (mobile cuộn ngang).
- [ ] Đo DevTools: card height 88–110px (3 card đầu); thấy ≥3 card trong lane 580px (trước chỉ 2,5).
- [ ] Không còn chip `Phiên:` riêng; meta có ngày `dd/MM/yyyy`; số tiền dấu phẩy VI (`660,5 triệu ₫`); tooltip hover hiện số đầy đủ.
- [ ] Badge = unread (test: mark-read 1 alert → badge giảm 1).
- [ ] `rg -n "MUA|Giá trị:|Tin cậy:|Tắt 30p" packages/web/src/components/dashboard/UnifiedAlertCenter.js` = 0 hit (đã qua i18n).

### Minh chứng
- `s2-filters-1280.png` + `s2-filters-360.png` (1 hàng, có nhãn).
- `s2-card-height.png` (DevTools box-model 3 card 88–110px).
- `s2-unread-decrement.png` hoặc clip ngắn (badge 20→19 sau mark-read).
- Output `rg` hard-code = 0 + `npx tsc --noEmit` = 0.

### Phản biện nghiệm thu
- Filter ở 360px: nút nào cũng bấm được bằng touch, không che; rớt hàng → FAIL.
- Card với symbol dài 4 ký tự + source dài (`price_shock`): head không vỡ 2 dòng (desc ellipsis thay vì đẩy time xuống) → vỡ → FAIL.
- Đổi locale EN: mọi chip/label EN đúng, không còn VI sót → sót → FAIL.

---

## 4. Slice S3 — Treemap: màu liên tục, contrast, nhãn, legend, scope (F3, C4)

### Yêu cầu
1. Thang màu liên tục đối xứng kẹp ±7%, nền đủ tối để chữ trắng; 0/trung tính trầm.
2. Chữ theo luminance nền; nhãn theo kích thước tile; tile nhỏ chỉ tooltip hoặc gom `Khác (n mã)`.
3. Legend `-7% … 0 … +7%` + scope subtitle (`Bản đồ danh mục · {N} mã · {phạm vi} · cập nhật HH:mm`).
4. Giữ ECharts, giữ resize hiện tại, giữ click → `/stocks/{ticker}`.

### Files
- `packages/web/src/components/dashboard/PortfolioHeatmap.js` (trọng tâm `23-38` màu, `65-121` data, `122-221` option, `306-383` header/body)
- `packages/web/src/i18n/vi.js:2172-2197` + `en.js:2177-2201` (keys legend/scope/other/tooltip mới)
- `packages/web/src/index.css` (legend styles)

### Steps
- **S3.1 Thang màu** (thay `23-38`): xóa `HEAT_COLORS` 5 nấc + `getHeatColor` ngưỡng ±3%. Viết `heatColorContinuous(pct)`: `t = clamp(pct/7, -1, 1)`; nội suy 5 stop tối: `-7 #7f1d1d · -3 #5b2228 · 0 #2f3747 · +3 #14532d · +7 #166534` (nền đủ tối cho chữ trắng; vàng `#eab308` chỉ dùng viền tile 0%, không fill). Áp dụng ở `108-110` (`itemStyle.color = heatColorContinuous(changePct)`). Tooltip giữ màu chữ xanh/đỏ theo sign (`146,149`) nhưng dùng palette mới.
- **S3.2 Chữ tương phản** (thay `170-179,208-217`): thêm `lum(hex)` + `textOn(bg) = lum>0.35 ? '#0b0f17' : '#fff'`; `label.color` dùng callback theo `data.changePct` (ECharts label formatter có `params.data` — dùng `color: (p)=>textOn(heatColorContinuous(p.data.changePct))`; nếu ECharts version không hỗ trợ callback color thì precompute `labelColor` trong `chartData` map ở `104-119`). Không copy hàm `textOn` lỗi của audit.
- **S3.3 Nhãn theo tile** (`172-176`): formatter nhận `(params) => { const {width,height} = params.rect || {}; const showT = width>=44 && height>=28; const showP = width>=56 && height>=40; if(!showT) return ''; const pct = …; return showP ? '{t|SYM}\n{pct}' : 'SYM'; }` + `fontSize: (p)=>clamp(sqrt(w*h)/6,10,22)` (nếu ECharts không cho function fontSize thì precompute `fontSize` trong data + dùng `rich`). Tile ẩn nhãn vẫn hover tooltip + click được.
- **S3.4 Gom tile vụn (tùy chọn nhưng khuyến nghị)**: nếu số tile có `value < 2% tổng` nhiều hơn 8 mã → gom thành node `Khác (n mã)` (key `heatmap.other`, value = tổng, changePct = bình quân gia quyền, tooltip liệt kê top 3 + `+n mã khác`). Ghi rõ có/không implement + lý do vào evidence (không để mập mờ).
- **S3.5 Legend + scope** (header `306-312` + dưới chart `373-383`): thêm dòng sub dưới `h3`: `{N} mã · Danh mục + theo dõi · cập nhật {HH:mm}` (keys `heatmap.scopeLine`, dùng `heatmapSymbols.length` từ `DashboardPage` — truyền prop `scopeCount/scopeLabel/updatedAt` mới, không tự đếm lại). Thêm legend gradient `-7% … 0 … +7%` (CSS linear-gradient qua 5 stop S3.1, keys `heatmap.legendMin/Mid/Max`). Legend tĩnh, không cần ECharts visualMap (tránh xung đột `nodeClick:false` `155`).
- **S3.6 Giữ nguyên**: `useEChartsResize` (`63`), tooltip dark (`125-135`), click navigate (`289-293` + `241-243` → `/stocks/{symbol}`), dialog overlay (`385-433`), sizeMode/viewMode toggle (S4 chuẩn hóa visual sau, S3 không đổi behavior).

### DoD
- [ ] `-3,33%` và `-9,73%` khác màu rõ (mắt thường + eyedropper 2 mã khác nhau); `0.00%` nền trầm/viền vàng, không còn là ô nổi nhất.
- [ ] Contrast chữ/nen tile đạti ≥4.5:1 ở tile lớn (đo bằng DevTools contrast hoặc axe); tile <44×28 không chữ, hover vẫn tooltip.
- [ ] Legend hiển thị + scope line có N mã + giờ cập nhật.
- [ ] Click tile → `/stocks/{ticker}` (giữ behavior cũ).
- [ ] Không thêm dep `d3*` mới vào `package.json` (diff package.json rỗng ở mục dependencies).

### Minh chứng
- `s3-scale-continuous.png` (toàn treemap + legend, thấy VNZ/CMF/IDP 3 màu độ sâu khác nhau).
- `s3-small-tiles.png` (vùng tile nhỏ: không chữ tràn, hover tooltip 1 tile).
- `s3-contrast-axe.png` (axe/DevTools contrast pass) hoặc bảng eyedropper 5 stop.
- `git diff -- packages/web/package.json` (không thêm dep).

### Phản biện nghiệm thu
- Set mock `changePct = -3.33` vs `-9.73`: cùng màu → FAIL.
- Tắt legend/subtitle bằng CSS: scope line mất → FAIL (phải là DOM thật, không phải ảnh ghép).
- Xóa `d3` khỏi node_modules rồi reload: treemap vẫn chạy → PASS (chứng minh ECharts-only).

---

## 5. Slice S4 — Layout/grid/scroll/radius/type (audit #1–7, #33–35)

### Yêu cầu
1. Triad vừa viewport, mỗi panel tự cuộn, 1 lớp card, padding 16–20px.
2. Scrollbar mảnh thống nhất, không cuộn trang lồng cuộn panel (trừ deck bên dưới).
3. Radius 3 mức `8/12/999`, type scale `panel 16–18/600 sentence-case, label 12/500, body 14`.

### Files
- `packages/web/src/index.css:269-323` (lane, grid, heatmap slot, scrollbar mới)
- `packages/web/src/pages/DashboardPage.tsx:333-414` (slots, giữ logic, chỉ đổi class nếu cần)
- `packages/web/src/components/dashboard/*` (bỏ card lồng: lane đã là card thì inner `bg-slate-900/40 border rounded-2xl` ở `AIAdvisorDeckPanel.jsx:86` và dialog giữ, còn list cards giữ 1 lớp)

### Steps
- **S4.1 Grid responsive** (thay `297-303`): `grid-template-columns:1fr 1.5fr 1fr` (≥1280px); `@media (max-width:1279px)` → `1fr 1fr` (AI span 2); `@media (max-width:1099px)` → `1fr`. Gap `16px`. Giữ `min-width:0` mọi lane.
- **S4.2 Lane height** (thay `269-280`): `height:clamp(480px, calc(100dvh - var(--dash-chrome,320px)), 720px)`; `display:flex; flex-direction:column; min-height:0; overflow:hidden` (scroll giao cho `.panel-body`, không phải cả lane). Mỗi panel body (`core-alert-list` `239`, heatmap `375`, AI list `172` trong AIAdvisorAlertPanel) thêm `flex:1; min-height:0; overflow:auto`.
- **S4.3 Một lớp card**: lane giữ `padding:16px` (trong `20px` cho phép 16–20); inner cards list giữ, nhưng bỏ wrapper card trung gian (nếu có `bg-slate-900/40 border rounded-2xl p-6` bao toàn lane như `AIAdvisorDeckPanel.jsx:83-86` → đổi thành transparent khi render trong lane; dialog `385-387` giữ nổi).
- **S4.4 Scrollbar**: thêm global mảnh: `*{scrollbar-width:thin; scrollbar-color:#2a3550 transparent}` + `::-webkit-scrollbar{width:8px;height:8px} thumb{background:#2a3550;border-radius:8px}`. Panel body thêm `mask-image:linear-gradient(#000 calc(100% - 24px), transparent)` (fade mép dưới).
- **S4.5 Radius/type**: audit toàn dashboard thay `rounded-2xl (16px)` panel → `rounded-xl (12px)`; chip/pill → `rounded-lg (8px)` hoặc `full (999px)` cho badge/count. Panel title: `600 16px/1.3 sentence-case` (sửa `UnifiedAlertCenter.js:187`, `AIAdvisorAlertPanel.js:128`, `PortfolioHeatmap.js:309` về cùng class `.panel-head h2`). Label `12px/500`, body `14px`.

### DoD
- [ ] 1905×1015: triad không bị cắt đáy (ATA/DPR/card thứ 3 hiện đủ hoặc cuộn nội bộ, không cuộn trang); header+KPI+triad vừa viewport (deck bên dưới cần cuộn trang 1 lần — chấp nhận).
- [ ] Không còn scrollbar native mũi tên ▲▼ trong card; chỉ scrollbar mảnh 8px.
- [ ] `rg -n "rounded-2xl" packages/web/src/components/dashboard packages/web/src/features/dashboard` sau fix chỉ còn dialog/overlay (liệt kê từng hit còn lại + lý do).
- [ ] 3 panel title cùng size/weight/case (screenshot so sánh).

### Minh chứng
- `s4-triad-1905.png` (triad đủ đáy) + `s4-triad-1280.png` + `s4-stack-900.png` (1 cột).
- `s4-scrollbar.png` (close-up scrollbar mảnh).
- Output `rg rounded-2xl` sau fix + `npx tsc --noEmit` = 0 + `npm run build` PASS (lần đầu ở slice này).

---

## 6. Slice S5 — Breadth/KPI/AI-empty/header polish (audit #9–12, #18–20, #29, #31–35)

### Yêu cầu
1. Breadth đọc được số + legend + tooltip; 1 nút refresh toàn KPI + `cập nhật Xs trước`.
2. AI empty có lý do + mốc quét + CTA (`Chạy phân tích` / `Xem phiên trước`).
3. Header: breadcrumb `Tổng quan`, search có hint `/`/`⌘K` (UI-only, không đổi behavior tìm kiếm), bell có badge = unread.
4. Viền trái = severity duy nhất; category chip trung tính; dùng chung formatter L7 với whale-alerts.

### Files
- `SmartStatsHeader.js:91-124`, `DashboardPage.tsx:189-207`, `AIAdvisorAlertPanel.js:164-169`, `UnifiedAlertCenter.js:26-42,375-380`, header shell (`FullLayout`/chrome — chỉ đọc, không refactor; nếu header nằm ngoài packages/web thì S5 chỉ làm bell badge + ghi rõ giới hạn)

### Steps
- **S5.1 Breadth** (`SmartStatsHeader.js:98-109`): text `${up}/${flat}/${down}` → `▲ {up} · ■ {flat} · ▼ {down}` (keys `smartStats.breadthUp/Flat/Down` hoặc 1 key có params); mỗi đoạn tooltip `Tăng/giảm/không đổi: {n} mã`; thanh giữ 3 màu nhưng thêm `aria-label`. Refresh gộp 1 nút (`113-122`) + text `cập nhật {relative}` (dùng `timeAgo` style `UnifiedAlertCenter.js:44-54`, chuyển vào util chung nếu trùng — ghi rõ đặt ở đâu).
- **S5.2 AI empty** (`AIAdvisorAlertPanel.js:164-169`): thay 1 câu thành block: icon 32px + title `Chưa có tín hiệu trong phiên này` (key `aiAdvisor.panel.emptyTitle`) + desc `Lần quét gần nhất {HH:mm} · 0 tín hiệu` (key `emptyDesc`, prop `lastScanAt` từ `getAIAlertsFeed` response hoặc `null` → hiển thị `Chưa có lượt quét`) + 2 buttons `Xem tín hiệu phiên trước` / `Chạy phân tích` (keys mới; behavior: nút 1 gọi `fetchFeed` với param session trước nếu API hỗ trợ, không thì disabled + tooltip `Sắp có` — KHÔNG bịa API, ghi rõ trong code comment + evidence).
- **S5.3 Header giới hạn**: trong phạm vi DashboardPage chỉ làm: bell badge = `unreadAlertCount` (đồng bộ với S2.3, nếu bell ở shell thì truyền prop hoặc ghi `OUT-OF-SCOPE` + file:line shell). Breadcrumb/search toca shell → không sửa behavior, chỉ ghi vào `s5-header-scope.md` (file nào sở hữu header, vì sao không chạm).
- **S5.4 Severity duy nhất** (`UnifiedAlertCenter.js:26-42,375-380`): viền trái giữ theo severity; chip category (`Cá mập`) đổi về trung tính `bg-slate-800 text-slate-300 border-slate-700/50` + icon (bỏ vàng riêng). Đối chiếu 1 màn whale-alerts (ghi route + screenshot side-by-side vào evidence).

### DoD
- [ ] Breadth hover từng đoạn có tooltip số mã; refresh 1 nút + relative time.
- [ ] AI empty cao ≤240px (đo), có last-scan + CTA bấm được (hoặc disabled có lý do).
- [ ] Bell badge = unread alert count (so với S2.3).
- [ ] Severity chỉ ở viền trái; chip category trung tính ở cả dashboard + whale-alerts screenshot.

### Minh chứng
- `s5-breadth-tooltip.png`, `s5-ai-empty.png` (kèm DevTools height), `s5-severity-compare.png` (dashboard vs whale-alerts).
- `s5-header-scope.md` (header sở hữu + giới hạn).

---

## 7. Slice S6 — Tests + gates + docs (bắt buộc cuối)

### Tests mới/cập nhật (tên khóa, không đổi tùy ý)
- `packages/web/src/utils/formatMarket.component.test.ts` (vitest): compact tỷ/triệu dấu phẩy VI, full tooltip, session date `dd/MM/yyyy`. ≥12 cases.
- `packages/web/src/components/dashboard/__tests__/alert-card-compact.component.test.tsx` (vitest): symbol không truncate (computed `flex:none`), card height ≤110px (mock 3 alerts), filter có nhãn + count, `aria-pressed`.
- `packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts` (vitest): `heatColorContinuous(-9.73) !== heatColorContinuous(-3.33)`, clamp ±7 (`±20` cùng màu biên), `textOn` trả `#fff`/`#0b0f17` đúng, label-gating thresholds 44×28 / 56×40.
- Cập nhật `AIAdvisorAlertPanel.i18n.test.js:8`: title mới `Tín hiệu AI` (vi) + en `AI signals`; giữ 2 tests còn lại.
- Giữ xanh `DashboardPage.breadth-dedup.component.test.ts` (không đổi logic dedup/breadth, chỉ UI).

### Gates (workdir `packages/web`, paste output vào evidence)
1. `npx tsc --noEmit` = 0 (sau mỗi sub-step S1–S5, cuối S6 tổng hợp).
2. `npm run build` PASS (cuối S4 + cuối S6). `tsc && vite build`, chunk-size warning pre-existing được chấp nhận, error = FAIL.
3. `npm run lint` — 0 errors (warnings pre-existing liệt kê số lượng, không tăng).
4. `npm run i18n:scan` exit 0 + `rg` hard-code S2.4 = 0.
5. `npm run test:components` (vitest) — toàn bộ dashboard files pass; `npm run test` (jest) — `AIAdvisorAlertPanel.i18n` + adapter tests pass.
6. `npm run check:shell` PASS (tokens/landmarks không vỡ do đổi class).

### Docs
- Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` 1 entry/slice (S0–S6) theo format Entry hiện hành (Date/Scope/Fix/Verify/Còn lại).
- Cập nhật `AGENTS.md` Progress ≤10 dòng (số slice, files, gates).

### DoD S6 = DoD toàn task
- [ ] Mọi checkbox S1–S5 xanh + evidence đủ file (thiếu 1 ảnh/log = FAIL).
- [ ] 6 gates trên PASS có log paste.
- [ ] Ledger + AGENTS cập nhật.

---

## 8. Danh sách file chạm (khóa — ngoài danh sách thì dừng)

```
packages/web/src/pages/DashboardPage.tsx
packages/web/src/components/dashboard/UnifiedAlertCenter.js
packages/web/src/components/dashboard/PortfolioHeatmap.js
packages/web/src/components/dashboard/SmartStatsHeader.js
packages/web/src/features/dashboard/AIAdvisorAlertPanel.js
packages/web/src/utils/formatMarket.js (MỚI)
packages/web/src/utils/formatMarket.component.test.ts (MỚI)
packages/web/src/components/dashboard/__tests__/alert-card-compact.component.test.tsx (MỚI)
packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts (MỚI)
packages/web/src/features/dashboard/__tests__/AIAdvisorAlertPanel.i18n.test.js (SỬA 1 assert)
packages/web/src/i18n/vi.js
packages/web/src/i18n/en.js
packages/web/src/index.css
docs/evidence/dashboard-fix/* (png/md/log)
docs/CODE_CHANGE_AUDIT_LEDGER.md
AGENTS.md (Progress ≤10 dòng)
```

## 9. Không làm (ghi rõ để khỏi hỏi lại)

- Không refactor `frontend/` ngoài S7 sync tối thiểu (S7 = copy class/grid tương đương + screenshot, không đổi logic `ModernDashboard.jsx`).
- Không thêm dep `d3` cho treemap; không đổi chart lib (giữ ECharts).
- Không bịa API mới (`lastScanAt`, `updatedAt`, `Xem phiên trước` có fallback disabled + comment).
- Không đổi dedup/breadth calculation logic (`DashboardPage.tsx:189-207`, `alertDedup.js`), chỉ đổi hiển thị.
- Không đụng header shell/search behavior; không đổi route `/stocks/{ticker}`.

## 10. Thứ tự + ước lượng

`S0 (1h) → S1 (0.5d) → S2 (1d) → S3 (1d) → S4 (0.5d) → S5 (0.5d) → S6 (0.5d)`. Mỗi slice kết thúc bằng `tsc` + evidence; build ở S4/S6. Bàn giao slice độc lập được (S1–S3 song song sau S0 nếu 2 dev, chung `formatMarket.js` thì S1 làm trước).
