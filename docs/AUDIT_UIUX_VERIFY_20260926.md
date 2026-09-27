# KIỂM CHỨNG ĐỘC LẬP — `AUDIT_UIUX_DASHBOARD_20260926.md`

**Base SHA:** `686cff45` (branch `dev`) · **Ngày:** 2026-09-27 · **Claim:** `uiux-verify` (`docs/CLAIMS.md`)
**Phương pháp:** Stage 2 của protocol — 3 auditor độc lập, `edit: deny`, mỗi agent một phần, **không agent nào kiểm chéo agent khác** (giữ nguyên điều kiện mà 5 agent viết bản gốc đã có).
**Phân công:** A = §0 (5 việc P0) + §3 (24 CONTRADICTIONS) · B = §5 (design system) · C = §1 (verdict) + mọi phép đo định lượng §4.

> **Lưu ý về worktree:** cả 3 auditor xác nhận `git status --short` không đổi trong suốt phiên: `M docs/CLAIMS.md` · `?? docs/AUDIT_UIUX_DASHBOARD_20260926.md` · `?? packages/core/backend/run_tests.py`. **Không file source nào đang sửa dở** ⇒ mọi citation kiểm ở HEAD = kiểm ở worktree, và claim "đang có agent khác sửa `portfolio_analytics_views.py`" ở §8-Q11 **không đúng**.

---

## VERDICT: `NEED_REVISION`

**Không lật ngược nội dung nào của tài liệu gốc.** 3 claim mạnh nhất đều đứng vững sau kiểm chứng. Nhưng có:

- 🔴 **1 lỗi có thể làm hỏng build** (Wave 0.7)
- 🔴 **1 con số không tái lập được, có dấu hiệu bịa** (DV-4 deuteranopia)
- 🟠 **5 con số sai** (852 dòng · 31 vi-VN · 390/103 uppercase · 9/9/4 màu · `--fs-3xl` 0 dùng)
- 🟡 **2 claim REFUTED** trong §3 (C12, C24)
- 🟡 **~30 citation lệch nhỏ / gán sai phạm vi**

| Nhóm | Auditor A | Auditor B | Auditor C |
|---|---|---|---|
| Claim được kiểm | 29 | ~50 | ~60 |
| CONFIRMED | 20 | 33 | 40 |
| OVERSTATED | 7 | 5 | 7 |
| REFUTED | 2 | 5 | 5 |
| STALE (citation) | 0 | 0 | 0 |
| KHÔNG VERIFY ĐƯỢC | 0 | 2 | 3 |
| `confidence` | — | cao | **0.88** |

---

## 🔴 P0 — SỬA NGAY: Wave 0.7 sẽ làm vỡ `tsc`

**Claim gốc (§4.10, Wave 0.7, §0 dòng 24):** "**852 dòng file chết**" · gồm `PortfolioHeatmap (1).js`, `SmartStatsHeader (1).js`, `FactsFirstModularPositionDeck.jsx` · gate ghi rõ là `tsc`.

**Auditor C đã kiểm `src/` + `tests/` + `e2e/` + `docs/`:**

| File | Dòng thật | Importer | Kết luận |
|---|---|---|---|
| `PortfolioHeatmap (1).js` | 255 | **0** | ✅ chết thật |
| `SmartStatsHeader (1).js` | 172 | **0** | ✅ chết thật |
| `FactsFirstModularPositionDeck.jsx` | **490** | ❌ **`FactsFirstModularPositionDeck.js:5`** + re-export `components/dashboard/index.js:2` | 🔴 **KHÔNG chết** |

⇒ Chết thật: **427 dòng / 2 file** (không phải 852/3).
⇒ Xoá `.jsx` mà không gỡ bridge ⇒ `tsc` vỡ ngay, đúng tại gate mà chính tài liệu viết.

**Sửa:** tách thành 2 task —
- **Wave 0.7a** (an toàn): xoá 2 file `(1)`, 427 dòng. Không đụng bridge.
- **Wave 4.x** (sau khi gỡ export): gỡ `FactsFirstModularPositionDeck.js` + dòng 2 của `components/dashboard/index.js` **rồi mới** xoá `.jsx`. `DashboardPage.tsx:419` đang dùng `CoreDashboardPositionDeck.tsx` chứ không dùng bản `.jsx` ⇒ xoá được sau khi gỡ 2 export.

---

## 🔴 P0 — Con số không tái lập được: DV-4 deuteranopia

**Claim gốc (§4.6 DV-4):** "Mô phỏng deuteranopia: cặp −7%/−3% → **1,00:1** (giống hệt)."

| Nguồn | Kết quả |
|---|---|
| Raw (chưa mô phỏng) | **1,23:1** |
| Machado 2009 severity 1.0 (auditor C tự tính) | **1,30:1** — `#7f1d1d`→`#534a19`, `#5b2228`→`#3d3927` |
| Claim trong tài liệu | 1,00:1 |

**`git grep -i "machado\|deuteran\|protan" packages/web` = 0 hit** ⇒ repo **không có** implementation nào. Không có script, không có output, không có bảng.

⇒ **Con số 1,00:1 không tái lập được.** Kết luận định tính ("2 màu gần như không phân biệt được dưới mù đỏ–lục") vẫn **đúng** và là điều cần giữ. Nhưng số phải gỡ hoặc kèm script.

**Tương tự — DV-3:** "đã thử giải trong khoảng lum… khoảng chỉ rộng **1,45:1**". Con số 1,45 trùng đúng với *min contrast ô-vs-nền của DV-1* ⇒ nghi ngờ **chép nhầm**. Không có script nào trong doc chứng minh. Gỡ hoặc đánh dấu CHƯA XÁC MINH.

---

## 🟠 SAI — 5 con số

| Claim | Tài liệu ghi | Đo lại được | Ảnh hưởng |
|---|---|---|---|
| §1 dòng 12 | **31** chỗ `toLocaleString("vi-VN")` | **61** chỗ / 26 file (dashboard riêng = 17; `PortfolioHeatmap.js` một mình = 7) | Sai ~2× **theo hướng nhẹ hơn** ⇒ giảm mức nghiêm trọng |
| §4.4 TP-2 | **390 match / 103 file** `uppercase` "toàn repo" | `web/src` = **300/69** · chỉ js/jsx/ts/tsx = 233/61 · toàn repo 985/206. **Không scope nào ra 390/103** | Không tái lập. Cùng hàng "22× 9px / 48× 10px" thì **exact** ⇒ bản thảo lẫn lộn scope |
| §5.4 | "tăng" **9** dạng / "giảm" **9** / "cảnh báo" **4**; tiêu đề "**14** class màu" | class string distinct: **26 / 20 / 24** (hoặc 16/12/23 nếu chỉ closure sống). distinct **hue** = **1 / 2 / 3** | Số 9/9/4 và 14 không tái lập dưới metric nào |
| §5.5 | `--fs-3xl`/`--fs-4xl` **0 lần dùng** | **mỗi token 1 lần**: `aiSettings.module.css:112`, `ShellPageTemplate.module.css:91` | **REFUTED** (có fallback nên xoá vẫn render được) |
| §5.6 | **16** hex ngoài allowlist trong `index.css` | **25** (18 distinct). 9 bị bỏ sót vì nằm trong `@theme{}` mà `stripRootBlocks` (`:31`) không strip | Quan trọng cho Wave 5.1: kỳ vọng đỏ là **25**, không phải 16 |

**Ngoài ra (auditor C):** §1 dòng 11 ghi "5 hệ format tiền, 4 đơn vị" — thật **≥6 hệ** + `đ` viết tay + `VND` hardcode, và **5 dạng** đơn vị (`₫`/`đ`/`VNĐ`/`VND`/`tỷ`·`triệu` **không** `₫`). Dạng thứ 5 chính là nguồn lệch 1dp/2dp. Lần này claim **giảm** số ⇒ ngược hướng với phần còn lại.

---

## 🟡 2 CLAIM REFUTED trong §3

### C24 — "mojibake UTF-8" ❌ **REFUTED**

Claim: `lucide-icon.tsx:29,34` và `theme/tokens.css:18` có byte hỏng.

Auditor A đọc bằng tool đúng encoding:

```
lucide-icon.tsx:29  = "  Building2: Icons.Building2,"
lucide-icon.tsx:34  = "  LogOut: Icons.LogOut,"
theme/tokens.css:18 = "  /* ── Typography scale (chuẩn hệ thống SOC) ── */"
```

⇒ **Cả 3 dòng đều sạch UTF-8.** Dấu `��` trong tài liệu là hậu quả **đọc file qua console cp1252** — chính output PowerShell của auditor cũng ra `Kh?ng th? t?i…` trong khi file thật là `Không thể tải…`.

**Đây là bài học quy trình, không phải lỗi nội dung:** 1 finding trong 24 là do **đọc sai encoding**, tức là chính skill cảnh báo "citation thối" đã xảy ra dưới dạng khác. `AGENT_PROTOCOL.md` §1 #4 liệt kê "trích dẫn thối" — đây là biến thể "trích dẫn đúng dòng nhưng sai nội dung vì công cụ đọc". **Xoá C24.**

### C12 — "20/22 rule ⇒ 0 pixel đổi" ❌ **REFUTED** (nhưng finding thực tế mạnh hơn)

File có **21** class-rule (không phải 22). Đúng là **17 trùng hex, nhưng 4 rule ĐỔI PIXEL**:

| Rule | Đổi gì |
|---|---|
| `.text-slate-300` → `var(--color-text-secondary)` | `#94a3b8` thay vì `#f1f5f9` (Tailwind `slate-300` thật là `#cbd5e1`) |
| `.text-rose-400` → `var(--color-danger-400)` | `#f87171` thay vì `#fb7185` |
| `.ring-emerald-400\/80` | hardcode `0 0 0 2px` (Tailwind mặc định 1px) |
| `.bg-current\/10` | `opacity` trên element, không phải `color-mix` |

⇒ Sửa thành: *"21 rule; 17 trùng hex, 4 đổi pixel"*.

---

## 🟠 2 CLAIM OVERSTATED trong §0 (phần owner đọc đầu tiên)

| Claim | Sửa thành | Vì sao |
|---|---|---|
| **§0 dòng 15** "Ở màn **1900px** mất 304px = 15,8%" | **"Ở màn 1920px mất 304px = 15,8%. Ở 1900px là 284px = 14,9%. Ở 2560px là 944px = 36,9%"** | `1900−288−48−1280 = 284`. §1 dòng 36 và LY-1 đã dùng đúng 1920 ⇒ **doc tự mâu thuẫn**. LY-1 còn ghi "2560px mất 688px" — phải là **944px**, sai 27% |
| **§0 dòng 16** "1080p ⇒ **720px cố định**" | "**cao 480–720px bất kể số mã; clamp chạm 720 chỉ khi `100dvh ≥ 1040` (fullscreen). Cửa sổ trình duyệt thường ở 1080p cho ~580–680px**" | `clamp(480, 100dvh−320, 720)` không cho con số đơn. Doc tự mâu thuẫn với "386–526px nhìn được" ở §1 dòng 37 |
| **§0 dòng 17** "1 dòng (~44px) ra khối **456px**" | "ra khối **≈545px**" | Phép tính gốc bỏ 2 hàng toolbar `Deck.tsx:244` (≈41px) + `:264` (≈46px). Sàn thật ≈545, rỗng ≈500 — **nặng hơn** doc nói |

---

## ✅ 3 CLAIM MẠNH NHẤT ĐỨNG VỮNG

| Claim | Cách xác nhận |
|---|---|
| **C15/C16** — `params.rect` không được ECharts truyền | Auditor A đọc `echarts@6.1.0/lib/chart/treemap/TreemapSeries.js:124-131` (chỉ thêm `treeAncestors`/`treePathInfo`) + `model/mixin/dataFormat.js:54-86` (20 khoá, không có `rect`) + `grep params.rect` toàn `echarts/lib` = **0 hit** (chỗ duy nhất gán `rect` cho label là `pie/labelLayout.js:418`). `PortfolioHeatmap.js:95-97` đọc `params.rect` ⇒ `w=h=0` ⇒ `if (w && h)` (`:99`) **không bao giờ vào** ⇒ **DV-2 P0 hợp lệ** |
| **C21** — dialog 49 dòng không bao giờ mở | `grep setSelectedDetail` = **2 hit duy nhất**: `:159` (useState) và `:594` (gọi với `null`). `fetchTrendData` (`:370-386`) được định nghĩa và **không được gọi lần nào** ⇒ `getStockChartHistory:374` chết ⇒ **DV-10 P0 hợp lệ** |
| **A4/§5.2** — token SOC trong lazy chunk | `dist/index.html` chỉ link `index-*.css`; `soc-BvBuXLMB.css` chỉ nằm trong `__viteMapDeps` của nhóm dynamic-import. `:root` của nó có `@layer` = **0**. Auditor B: **cơ chế đúng, phạm vi sai** — rò rỉ xảy ra ở **3 route** (`/soc` + `/alert-center` + `/watchlist`, vì `AlertCenterPage.tsx:9` và `WatchlistMainWorkspace.tsx:6` import tĩnh `soc.module.css`) |

### Toàn bộ dải contrast — khớp **tuyệt đối**

Auditor C tự viết script WCAG 2.x, copy nguyên văn `HEAT_STOPS`/`mixHex`/`textOnHeat` từ source. **18/18 con số khớp tới 2 chữ số thập phân:**

| Dải | Doc | Đo lại |
|---|---|---|
| Chữ `#fff` trên 5 stop | 7,13 – 12,32 AAA | 7,1303 – 12,3219 ✅ |
| 5 stop vs `#0f172a` | 1,45 – 2,50, fail 1.4.11 5/5 | 1,45 / 1,78 / 1,49 / 1,96 / 2,50 ✅ |
| Viền ô vs nền | 1,00:1 | 1,00:1 ✅ |
| `#64748b` đề xuất | 3,75:1 | 3,75:1 ✅ |
| 4 cặp stop liền kề | 1,23 / 1,03 / 1,31 / 1,28 | 1,2318 / 1,0341 / 1,3113 / 1,2834 ✅ |
| Palette owner | 7,26 / 5,04 / 7,89 | 7,26 / 5,04 / 7,89 ✅ **tuyệt đối** |

Mô hình chiều cao alert item cũng khớp tuyệt đối: **130,50px** (chip 2 hàng) · **105,50px** (1 hàng) · **2762,00px** scrollHeight · chip row 52,00px.

⇒ **Phần định lượng cứng của tài liệu đáng tin. Phần số tổng hợp ("toàn repo", "toàn hệ") thì không.**

---

## GATE CHẠY THẬT (không ai tin báo cáo, tự chạy lại)

| Lệnh | Exit | Kết quả |
|---|---|---|
| `npx tsc --noEmit` | **0** | ✅ 0 lỗi — khớp §7 |
| `npm run check:shell` | **0** | ✅ PASS 7/7 sub-gate — khớp §7. **Bổ sung phát hiện mới:** `i18n:scan` in `Error: Line 8: Unexpected identifier` nhưng **vẫn exit 0** ⇒ đây là lý do thứ hai khiến `check:shell` không bảo vệ được i18n |
| `npm run check:tokens` | **0** | ✅ `PASS (72 allowlisted hex, 0 violations outside)` |
| `npm run check:contrast` | **0** | ✅ `PASS (7 tone pairs × 2 modes >= 4.5:1)` |
| `node scripts/check-i18n-hardcoded.mjs src/components/dashboard` | **1** | ❌ `TOTAL_HARDCODED_VI=23` |
| `node scripts/measure-route-graph.mjs DashboardPage` | **0** | 15 chunk / 1828,8 KB / echarts **623,0 KB** |

**Bổ sung auditor B — phạm vi i18n gate rõ hơn doc:** trong 5 file doc liệt kê là unscanned, **4 file SẠCH** (`UnifiedAlertCenter.js`=0, `PortfolioHeatmap.js`=0, `AIAdvisorAlertPanel.js`=0, `SmartStatsHeader.js`=0 khi chạy thật), chỉ `CoreDashboardPositionDeck.tsx` có 10 hit. Và `WhaleAnalyticsTab.jsx` **CÓ** trong scope. ⇒ 23 hit gồm **9 từ file chết** ⇒ **sống thật = 14**.

---

## ⚠️ 2 SỐ ĐÃ SỬA ƯU TIÊN CAO

### §4.9 bảng "Chart px" và "Tỉ lệ khung" — **KHÔNG VERIFY ĐƯỢC**

Kích thước chart do ECharts `resize()` quyết định lúc runtime. Không có browser ⇒ auditor C **không verify được** bảng 519×629 / 375×489 / 672×489 / 704×489.

⇒ Bảng này **phải** mang nhãn "suy ra từ CSS, chưa đo trong browser" — hiện nó trông như đo thật.

### §5.2 bảng "Trước / Sau khi vào `/soc`" — cần browser

Cùng lý do: cần load route rồi đọc `getComputedStyle`. Token *trong file* thì khớp (đọc `soc.tokens.css:5-16` trực tiếp), nhưng **hiệu ứng runtime chưa đo**.

⇒ Đây là claim tác động lớn nhất ngoài §1 mà **chưa có bằng chứng runtime**. Nên có 1 bước verify bằng browser trước khi Wave 4.1 sửa.

---

## CẬN NHẬT DANH SÁCH SỬA (~30 mục)

| # | Vị trí | Sửa |
|---|---|---|
| 1 | §0 dòng 24 + Wave 0.7 | 852/3 → **427/2** (chết thật). Tách `FactsFirstModularPositionDeck.jsx` ra Wave 4.x, kèm cảnh báo bridge |
| 2 | §0 dòng 15 | 1900px → **1920px**; thêm 1900px = 284px/14,9% và 2560px = 944px/36,9% |
| 3 | §0 dòng 16, §4.2 LY-2 | "1080p ⇒ 720px cố định" → có điều kiện `100dvh ≥ 1040` |
| 4 | §0 dòng 17, §4.2 LY-3 | 456px → **≈545px** (thiếu 2 hàng toolbar) |
| 5 | §4.6 DV-4 | Gỡ `1,00:1`; đổi thành Machado 2009 sev 1.0 = **1,30:1**; ghi rõ repo không có script Machado |
| 6 | §4.6 DV-3 | Gỡ hoặc đánh dấu CHƯA XÁC MINH con số "khoảng lum 1,45:1" |
| 7 | §1 dòng 12 | 31 → **61** chỗ / 26 file |
| 8 | §1 dòng 11 | "5 hệ / 4 đơn vị" → "≥6 hệ / **5** dạng đơn vị" |
| 9 | §1 dòng 5, §4.6 DV-8 | 25 key → **17** key `heatmapTooltip*` |
| 10 | §4.4 TP-2 | 390/103 → **300/69** (`web/src`); ghi rõ bản thảo không tái lập được |
| 11 | §5.4 tiêu đề + bảng | "14 class màu" → **76** (26+20+24); bảng 9/9/4 → 26/20/24 |
| 12 | §5.4 | "6 họ màu" → **5**; đổi kết luận: lỗi thật là `critical`+`high` **dùng chung icon `Flame`** (`:137`,`:145`), không phải hue trùng |
| 13 | §5.4 | "4 bản pagination button chỉ khác màu" → **2 button / 2 class string trùng nhau**; lỗi là markup nhân bản |
| 14 | §5.4 | `#16C7D9` ~8,3:1 → **9,36:1**; Surface ~1,15:1 → **1,09:1** |
| 15 | §5.5 | `--fs-3xl`/`--fs-4xl` "0 dùng" → **1 dùng mỗi token** |
| 16 | §5.5 | "19 token chỉ 1–2 lần (40%)" → **8 (17%)**; thêm chân thúc: phải đếm cả class Tailwind |
| 17 | §5.5 | 44 → **43** distinct raw radius; 609 → **668** Tailwind class; 19 → **16 px đơn giá trị** (+3 dạng ghép) |
| 18 | §5.5/§0 | "22/30 component" → **22/28** (32 file gồm 2 CSS + 2 barrel) |
| 19 | §5.6 | 16 hex → **25** (18 distinct); nêu nguyên nhân `@theme{}` không bị strip |
| 20 | §5.2 | Gỡ "unlayered ⇒ thắng `@theme`" — cơ chế thật là **thứ tự inject** (cả 2 hệ đều unlayered) |
| 21 | §5.2 | Phạm vi rò rỉ: **`/soc` + `/alert-center` + `/watchlist`**, không chỉ 1 |
| 22 | §5.2 | Bảng token: thay dòng `--fs-xs` bằng `--bg-panel-soft` (nằm trong khoảng 1-16 ↔ 5-16 đã trích) |
| 23 | §5.2 fix | "chỉ giữ 24 `--soc-c-*`" → **39** (19 `--soc-c-*` + 20 `--soc-rgb-*`) |
| 24 | §5.3 | "26 chỗ Radix portal" → **8 `.Portal` ở 5 file**; nhưng phạm vi thật rộng hơn: 23/28 file `ui/` có nền tối không `dark:`, toàn repo 97 file/605 occurrence |
| 25 | §5.7 | Tooltip row: `ui/tooltip.tsx` **0 consumer** (nằm trong nhóm 22 file chết) — doc tự mâu thuẫn |
| 26 | §5.1 | `soc.components.css` 3482 = **non-empty**; tổng **3916**; `theme.module.css` 383 = tổng ⇒ không nhất quán phép đo |
| 27 | §5.1 | `WorkstationShell.tsx:32` trích sai nguyên văn: thật là `// P3-1: ensure theme.module.css has consumer (grep)` |
| 28 | §3 C12 | 21 rule; **17 trùng hex, 4 đổi pixel** (liệt kê 4 rule) |
| 29 | §3 C24 | **XOÁ** — mojibake là artifact console cp1252, file sạch UTF-8 |
| 30 | §3 C2 / C6 / C7 / C11 | Hạ xuống **WEAK** hoặc chuyển sang nhóm dead code (xem bảng dưới) |
| 31 | §3 C14 | Comment `:76-77` mô tả **đúng** hành vi code; mâu thuẫn nằm ở tầng **render/nhãn**, không phải comment↔code |
| 32 | §3 C20 | Trích nguyên văn: `render dd/MM/yyyy **without TZ shift**`. Bổ sung: `formatMarket.component.test.ts:48` chỉ xanh ở **TZ ≥ UTC** ⇒ CI đang che đúng lỗi này |
| 33 | §3 C18 | "9 key" → **21 key** trong `vi.js:2607-2628` |
| 34 | §3 C23 | "3 khai báo" → **4** (bỏ sót `ring-offset-color`) |
| 35 | §2 | `SmartStatsHeader.js` **176** → **185** dòng |
| 36 | §4.2 LY-1 | "2560px mất 688px" → **944px** |
| 37 | §4.6 | `+1.76%` vs `+4.38%` = 1,22:1 → **1,24:1** |
| 38 | §4.6 DV-8 | "4 `toLocaleString` ở `:279-291`" → 2 ở `:287,289` + 2 ở `:338,340` |
| 39 | §4.6 DV-16 | `tokens.css:69` → **`:70`** |
| 40 | §4.10 | build `21:00:43` → **`23:47:06`**; 1828,7 → **1828,8** |
| 41 | §4.9 | Bảng "Chart px" phải gắn nhãn **suy ra từ CSS, chưa đo trong browser** |
| 42 | §1 dòng 14 | `.core-dashboard-page` **có** ở `frontend/src/index.css:309,316` (legacy, không nạp) — chỉ đúng nếu giới hạn `packages/web/` |
| 43 | §4.5 | "3 test khóa `cardCount===20`" → **2 assertion dùng `cardCount`** + 1 dùng `querySelectorAll('.alert-card').length` |
| 44 | §4.1 dòng 4 | Thêm điều kiện `N > 8` cho công thức `0.3N/(H+0.3N)` (`groupTinyTiles:119` trả về nguyên danh sách nếu `tiny.length ≤ 8`) |
| 45 | §8-Q11 | Bỏ "đang có agent khác sửa" — worktree sạch tại `686cff45`, **Wave 1.9 có thể claim ngay** |

---

## BẢNG PHÂN LOẠI LẠI 24 CONTRADICTIONS

| Phán | ID | Ghi chú |
|---|---|---|
| **CONFIRMED** | C1, C3, C4, C5, C8, C9, C10, C13, C15, C16, C17, C19, C20, C21, C22 | C15/C16/C21 là 3 claim mạnh nhất — đã verify sâu |
| **WEAK** (đúng sự kiện, sai phân loại) | C2 (cùng giá trị 12px, chỉ khác ký hiệu) · C6 (rule rỗng = dead code) · C7 (token chết) · C11 (trùng tên 2 họ radius, comment **đúng**) · C14 (mâu thuẫn ở tầng render) | Nên chuyển C6/C7 sang nhóm dead code |
| **REFUTED** | C12 (4 rule đổi pixel, không phải 0) · C24 (không có mojibake) | |

---

## GATE 5→6 CỦA SKILL

| Điều kiện | Kết quả |
|---|---|
| Mọi claim verify được có `file:line @ sha` | ✅ Có |
| Số nào không tái lập được đã ghi rõ, không giấu | ✅ 8 mục |
| Không claim nào bị lật ngược nội dung | ✅ 0 lật ngược |
| **Còn lỗi chặn PR** | 🔴 **1** — Wave 0.7 (sẽ vỡ `tsc`) |
| **Còn số không tái lập được** | 🔴 **2** — DV-4 deuteranopia, DV-3 khoảng lum |
| `confidence` | **0.88** (auditor C) / **cao** (auditor B) |

**Kết luận Stage 2: `NEED_REVISION`.** Cho phép Stage 3 (claim) + Stage 4 (code) **sau khi** sửa 3 mục 🔴. Ưu tiên: (1) Wave 0.7 · (2) §0 dòng 15 · (3) gỡ DV-4 + TP-2.

---

## PHỤ LỤC — Bài học quy trình (2 điều, đều đáng ghi vào AGENTS.md)

**① Mojibake do đọc file, không phải file hỏng.** `docs/AGENT_PROTOCOL.md` §1 #4 liệt kê "trích dẫn `file:line` thối" là xung đột đã xảy ra thật. Phiên này bổ sung một biến thể: **trích dẫn đúng dòng nhưng sai nội dung**, vì công cụ đọc file (PowerShell mặc định cp1252) giải mã UTF-8 thành `?`. Bằng chứng: chính output của auditor cũng ra `Kh?ng th? t?i…` cho file có thật là `Không thể tải…`. ⇒ **Bắt buộc dùng `Read` tool (UTF-8) cho file có dấu tiếng Việt, không dùng `Get-Content`.**

**② "0 citation thối" là kết quả có lợi — nhưng không phải lý do để tin.** Auditor A xác nhận **0/29 citation sai dòng** trong 5 việc P0 + 24 contradictions, dù 5 agent viết song song không hề kiểm chéo. Tuy nhiên 3/24 claim sai **về nội dung** và 5/24 đúng nhưng không phải mâu thuẫn. ⇒ **Citation đúng dòng ≠ claim đúng.** Skill yêu cầu auditor "refute the plan's own premises" là chính xác; nếu chỉ kiểm tra citation sẽ bỏ sót toàn bộ 3 lỗi này.
