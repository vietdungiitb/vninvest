# IMPLEMENTATION PLAN — Tái cấu trúc UI Subpage Tín hiệu (SOC ?tab=signals) — Chuẩn Công nghiệp

**Base:** `39ef5009` (rev2 UI Config xong, `SocSignalsPanel.tsx:2133` 101508 bytes) — audit `docs/AUDIT_SOC_SIGNALS_UI_INDUSTRIAL_20260918.md` (11 findings, điểm 4.0/10).
**Mục tiêu:** Từ feed sơ sài + 7 subtabs cramped + 4/7 tabs raw dump → giao diện giàu thông tin, 4 nhóm, row đầy đủ severity/price, filter 2 hàng, metric có icon/delta, right sticky, đạt Bloomberg/TradingView/Datadog.
**Chuyển giao:** Đội code thực thi không cần hỏi lại. Mỗi slice có **Yêu cầu đạt (DoD)** + **Tiêu chí audit copy-paste** (`grep`/`tsc`/`build`/`vitest` + manual 1920/1100/480) + **Test**. Gate bắt buộc sau mỗi slice.

> **Ràng buộc giữ:** `LangContext t()`, `defaultCoreApiAdapter as SocSignalsAdapter:465`, `soc.module.css:glassPanel/sectionCard/metricCardSm/signalRow/subTabBar`, `soc.tokens.css` (`081734/0f172a/5078a8/22d3ee/94a3b8`), Vietnamese full dấu `vi.js:294-409`, `LucideIcon` whitelist `ui/lucide-icon.tsx:12`.
> **Không đổi contract BE** — chỉ `SocSignalsPanel.tsx` + `soc.components.css` + `vi.js/en.js` keys. Không thêm lib.
> **Tuân thủ theme hệ thống (bắt buộc):** Toàn bộ layout dùng **SOC glassmorphism** (`glassPanel 081734/0.4 blur 8px + sectionCard 0f172a/0.3 border 5078a8/0.15 radius 10-12`), **tokens** `soc.tokens.css` (không hardcode `#`), **header chuyên nghiệp** (`SOC / Tín hiệu` eyebrow `22d3ee 0.7rem 700` + `Tín hiệu — Luồng phát hiện` title `f1f5f9 1.5rem` + subtitle `94a3b8 0.85rem`), **format** `tabBar`/`metricGrid`/`sectionGrid`/`toolbar` như `SocDataOpsPanel.tsx` + `SocOverviewPanel.tsx`, **spacing** `gap 0.75-1.25rem` + `padding 1-1.25rem`, **radius** `8-12px`, `backdrop-filter`.

---

## 0. BỐI CẢNH & THIẾU HỤT ĐÃ CHỨNG MINH

- `SocSignalsPanel.tsx:1194` row: `Waves APF SELL 616.2M 15:48` — thiếu `severity`, `price`, `strength`, `rule_name` dù `RecentSignal:18-27` có → SIG-01.
- `2112` 7 `subTabBtn` cramped `gap 0.15rem` → `Vật chất hóa` gãy 2 dòng (ảnh 1-6) → SIG-02.
- `1340` `renderKVCard` `JSON.stringify` cho `Cấu hình/Phát hiện/Lưu trữ` → tràn (ảnh 3-5) → SIG-03.
- `1974` 6 `metricCardSm` chỉ số, không icon/trend → SIG-04.
- `2025` `signalFeedFilterBar` 2 dòng, 4 pill +2 select+search+`Chưa ack` → SIG-05.

---

## 1. KIẾN TRÚC ĐÍCH (wireframe — tuân theme SOC)

```
[Header chuyên nghiệp — glassPanel] eyebrow "SOC / Tín hiệu · Cập nhật: 15:48" (22d3ee 0.7rem) + title "Tín hiệu — Luồng phát hiện dòng tiền" (f1f5f9 1.5rem 700) + subtitle "Giám sát whale/dark-pool/screener theo thời gian thực" (94a3b8 0.85rem) + liveDot
[Header Metrics 6] icon+value+delta (click → filter) — metricCardSm with icon 32px + trend
[Two-col 1.6fr 1fr sticky] @1100 1fr
  Left 60% Feed: header "Luồng tín hiệu" + streamDot(6px) + unreadBadge + Xuất CSV
    → Row1: Type pills 4 (Tất cả/Whale/DarkPool/Screener)  active filterBtnActive
    → Row2: Mức độ [select 140px] + Hướng [select 140px] | Search [1fr] + Chưa ack [toggle] + Đã nhận(n) [runBtn]
    → Row: [icon 26px] APF · SELL · ●severity · 616.2M · 15:48 · (price if any) · [deliveryBadge] — hover → expand meta + Ack/Mute/Feedback
    → Pagination 5 numbers + PageSize 20/50/100 + showing_range
  Right 40% Details sticky top12: 4 tabs (icon+count) — Tổng quan | Vận hành | Cấu hình | Rules
    Tổng quan: sentimentBar 3 màu + Tăng/Trung/Giảm + Top5 symbols + volume distro
    Vận hành: Job Console (domain select + VNM input + Chạy) + Vật chất hóa timeline (3 matCard + execution plan table)
    Cấu hình: KVTable (field|value|help) + ownership footer bridge-write
    Rules: metric 3 + top noisy + table with request button
```

Tokens: `081734/0f172a` glass, `22d3ee` accent, `94a3b8` muted, spacing `0.75/1rem`, radius `10px`.

---

## 2. SLICES & TIÊU CHÍ AUDIT (copy-paste chạy được)

### SLICE S1 — Enrich Feed Row (P0) — FIX SIG-01

**Mục tiêu:** Row giàu, scan 1s hiểu chất lượng tín hiệu.

**Files:**
- `SocSignalsPanel.tsx:10-28` (`RecentSignal` + `formatVolume:308` + `getActionLabel:315`)
- `SocSignalsPanel.tsx:1146-1265` (`renderSignalRow`)
- `soc.components.css:1129-1215` (`.signalRow:1137`, `.signalLabel:1181`, `.signalVolume:1201`, `.signalTime:1208`)
- `socStatusColors.ts` (`toneColor`, `socStatusColor` cho severity)

**Yêu cầu đạt (DoD):**
- S1.1. Thêm `severity` dot: trước `symbol` hoặc sau `action`, `createElement("span",{className:styles.severityDot, style:{background: severityColor(s.severity)}, title: s.severity})` — `severityColor` map `critical:#ef4444, high:#f59e0b, medium:#22d3ee, low:#94a3b8` qua `socStatusColor`.
- S1.2. Thêm `price` nếu `s.price != null`: `createElement("div",{className:styles.signalPrice}, formatVolume? price.toLocaleString() + "₫")` ngay sau `volume`.
- S1.3. Giữ `action` `BUY/SELL` pill (`signalLabelBuy/Sell`) — không đổi.
- S1.4. `volume` đã có `formatVolume` — giữ, thêm `title: String(s.volume)` cho tooltip full.
- S1.5. `signalIcon` giữ `TYPE_ICONS`/`TYPE_BG` — không đổi.
- S1.6. Không đổi `expanded` meta `JSON.stringify(metadata)` — giữ cho P2.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocSignalsPanel.tsx -Pattern "severityDot|signalPrice|severity.*color" | Out-String  # expect ≥2 (S1.1+1.2)
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "\.severityDot|\.signalPrice" | Out-String  # expect 1-2 (nếu thêm CSS)
npx tsc --noEmit -p packages/web/tsconfig.json  # 0 (via .\packages\web\node_modules\.bin\tsc)
npm run build --prefix packages/web  # PASS
```

**Test (FE):** Thêm 1 test trong `SocSignalsPanel.component.test.tsx` — mock `whaleRecent: [{symbol:"APF", side:"SELL", severity:"high", value:616200000, timestamp:"2026-09-18T15:48:00Z"}]` → `getByText("APF")` + `getByText("SELL")` + `getByTitle("high")` severity dot hiện, `616.2M` + `price` nếu có.

---

### SLICE S2 — Gộp 7 subtabs → 4 nhóm + Icon/Count (P0) — FIX SIG-02

**Mục tiêu:** Không cramped, scan 2s biết nhóm nào quan trọng.

**Files:**
- `SocSignalsPanel.tsx:1841-1859` (`subTabContent`, `subTabKeys`), `2112-2128` (`subTabBar`)
- `soc.components.css:1242` (`.subTabBar`), `1254` (`.subTabBtn`)
- `ui/lucide-icon.tsx:12` (whitelist)
- `vi.js:294` (`soc.signals_overview.*_tab`)

**Yêu cầu đạt (DoD):**
- S2.1. Đổi `subTabKeys:1851` từ 7 → 4:
  ```ts
  {key:"overview", label:t("soc.signals_overview.overview"), icon:"BarChart3", count: filteredSignals.length},
  {key:"ops", label:"Vận hành", icon:"ServerCog", count: materialization.services.length}, // gộp job-console+materialization
  {key:"config", label:"Cấu hình", icon:"SlidersHorizontal", count: Object.keys(configTab.data?.config||{}).length}, // gộp config+detection+retention
  {key:"rules", label:"Rules", icon:"ListChecks", count: rulesTab.data?.rules.length}
  ```
  `subTabContent` gộp: `overview→renderOverviewTab`, `ops→createElement("div",null, renderJobConsoleTab(), renderMaterializationTab())`, `config→createElement("div",null, renderConfigTab(), renderDetectionTab(), renderRetentionTab())`, `rules→renderRulesTab`.
- S2.2. `subTabBar` thêm icon + count badge: `createElement(LucideIcon,{name:icon, className:"h-3.5 w-3.5"}), label, count? createElement("span",{className:styles.tabCountBadge}, String(count))` — badge `0.65rem` `rgba(80,120,168/0.15)`.
- S2.3. `soc.components.css:1242` `.subTabBar {gap:0.35rem; padding:0.2rem;}` + `.subTabBtn {gap:0.35rem; padding:0.45rem 0.75rem;}` + `.tabCountBadge {new}` — không `flex:1` nữa, để `auto` + `overflow-x:auto` như `tabBar:5`.
- S2.4. Giữ `role=tablist/tab` + `aria-selected` — thêm `aria-controls`.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocSignalsPanel.tsx -Pattern "subTabKeys.*overview.*ops.*config.*rules|tabCountBadge" | Out-String  # expect 4 nhóm
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "tabCountBadge" | Out-String  # expect 1
Select-String -Path packages/web/src/i18n/vi.js -Pattern "Vận hành" | Out-String  # expect label mới nếu thêm
```

**Test (FE):** `getByRole("tab",{name:/Vận hành/})` hiện, `getByRole("tab",{name:/Cấu hình/})` click → `getByText("whale_threshold_vnd")` (config) + `getByText("Phát hiện")` cùng panel.

---

### SLICE S3 — Config/Détection/Retention thành KVTable (P0) — FIX SIG-03

**Mục tiêu:** Không raw JSON.stringify, đọc 5s hiểu.

**Files:**
- `SocSignalsPanel.tsx:1332-1372` (`formatConfigValue`, `renderKVCard`, `renderConfigTab`, `renderDetectionTab`, `renderRetentionTab`)
- `soc.components.css:1333` (`.matGrid`, `.matCard`)

**Yêu cầu đạt (DoD):**
- S3.1. Thay `renderKVCard` (`div.matCard` với `...Object.entries.map div k: v`) bằng `KVTable`:
  ```ts
  createElement("div",{className:styles.kvTableWrap},
    createElement("table",{className:styles.kvTable},
      createElement("thead",null, createElement("tr",null, createElement("th",null,"Trường"), createElement("th",null,"Giá trị"))),
      createElement("tbody",null, ...Object.entries(obj).map(([k,v])=> createElement("tr",{key:k}, createElement("td",{className:styles.kvKey},k), createElement("td",{className:styles.kvVal}, formatConfigValue(v))))))
  ```
  CSS mới `.kvTableWrap {border:1px solid rgba(80,120,168/0.15); border-radius:8px; overflow:hidden}` `.kvTable {width:100%; border-collapse:collapse; font-size:0.75rem}` `.kvKey {color:#94a3b8; width:40%; padding:0.4rem 0.6rem; border-bottom:1px solid rgba(80,120,168/0.08)}` `.kvVal {color:#f1f5f9; padding:0.4rem 0.6rem; border-bottom:...; font-family:Menlo,monospace; word-break:break-all}`
- S3.2. `renderConfigTab` giữ 2 `KVTable` (config + ownership) + `bridge_write_note` ở footer `helpText` (không trong card).
- S3.3. `renderDetectionTab` 3 `KVTable` cho whale/dark/screener + input `VNM` + `Chạy thử` giữ.
- S3.4. `renderRetentionTab` 1 `KVTable` + `Xem ảnh hưởng` giữ.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocSignalsPanel.tsx -Pattern "kvTableWrap|kvTable|kvKey" | Out-String  # expect ≥3 (S3.1)
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "\.kvTable" | Out-String  # expect 1
```

**Test (FE):** `renderConfigTab` mock `config:{whale_threshold_vnd:500000000}` → `getByText("whale_threshold_vnd")` + `getByText("500000000")` trong `table`, không `JSON.stringify` raw tràn.

---

### SLICE S4 — Metric Cards + Filter Bar (P1) — FIX SIG-04, SIG-05

**Files:**
- `SocSignalsPanel.tsx:1111-1116` (`statCard`), `1974-1981` (6 metrics), `2025-2089` (`signalFeedFilterBar`)
- `soc.components.css:1369` (`.metricCardSm`), `1233` (`.signalFeedFilterBar`), `1484` (`.searchWrapper`)

**DoD:**
- S4.1. `statCard` thêm icon + trend: `createElement(LucideIcon,{name: iconForLabel(label), className:"h-4 w-4"}), value, label` — icon map `total→Activity, whale→Waves, dark_pool→EyeOff, screener→Search, detection→Percent, latency→Clock`. Thêm `title` tooltip `vi.js:294` help.
- S4.2. `signalFeedFilterBar` tách 2 hàng:
  - Row1: Type pills 4 (`filterBtn` group) `gap 0.35rem` — giữ `setTypeFilter` logic
  - Row2: `grid 140px 140px 1fr auto` — `Mức độ` select 140px + `Hướng` 140px + `Tìm mã` `searchWrapper 1fr` + `Chưa ack` toggle (đã có) + `Xuất CSV` phải — dùng `display:grid` mới `.filterRow2`.
- S4.3. `searchWrapper` giữ `Search` icon, thêm `clear` button `×` khi `symbolFilter` có giá trị.

**Audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocSignalsPanel.tsx -Pattern "statCard.*LucideIcon|filterRow2|searchWrapper" | Out-String  # expect S4.1+2
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "filterRow2" | Out-String  # expect 1
```

**Test:** `getByText("343")` + `getByText("283")` vẫn pass; `getByPlaceholderText("Tìm mã")` clear button hiện.

---

### SLICE S5 — Overview + Two-col + Empty (P1) — FIX SIG-06, SIG-07, SIG-08, SIG-09, SIG-10

**Files:**
- `SocSignalsPanel.tsx:1280-1330` (`renderOverviewTab`), `1520-1631` (`renderMaterializationTab`), `1982-2012` (`signalsTwoCol`)
- `soc.components.css:1116` (`.signalsTwoCol`), `1276` (`.sentimentBar`)

**DoD:**
- S5.1. `renderOverviewTab` thêm `Top 5 symbols` (từ `filteredSignals` countBy symbol sort top5) + `Volume distro` (histogram 5 buckets `formatVolume`) dưới `sentimentBar`.
- S5.2. `renderMaterializationTab` thêm header `Tâm lý`? keep, but add timeline dots for 3 services + `progress` already `matCardBar`.
- S5.3. `signalsTwoCol` đổi `3fr 2fr` → `grid-template-columns: minmax(380px, 1.6fr) minmax(420px, 1fr)` + `gap 1rem` + `align-items:start` + right `position:sticky; top:12px` (đã có `@1100 1fr` keep).
- S5.4. `signalRowNew` tăng contrast `border 1px solid rgba(00b4d8/0.6)` + `background 0.12` (đã có) + `aria-live="polite"` cho new badge.

**Audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocSignalsPanel.tsx -Pattern "Top 5|Volume distro|position:sticky" | Out-String  # expect S5.1+3
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "signalsTwoCol.*minmax" | Out-String  # expect 1
```

**Test:** `getByText("Tâm lý thị trường")` + `getByText("Tăng:")` vẫn pass; `getByText("Top 5")` mới.

---

### SLICE S6 — Docs & ledger

**Files:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md`

**DoD:** Entry S1→S5 + gates.

---

## 3. THỨ TỰ & GATE (bắt buộc sau mỗi slice)

| Bước | Slice | Verify ngay (copy-paste) | Gate |
|------|-------|--------------------------|------|
| 1 | **S1 Row** | `severityDot` + `signalPrice` + `tsc 0` | `vitest` row test |
| 2 | **S2 Tabs** | `tabCountBadge` + 4 tabs + `t("Vận hành")` | `tsc 0` + `build PASS` |
| 3 | **S3 KVTable** | `kvTableWrap` + `KVTable` | `vitest` config test |
| 4 | **S4 Metrics/Filter** | `filterRow2` + icon | `vitest` filter test |
| 5 | **S5 Overview/Two-col** | `Top 5` + `minmax` | `vitest` overview |
| 6 | **S6 Ledger** | `grep ^## Entry` | — |

**Gate chung mỗi slice:** `npx tsc --noEmit -p packages/web/tsconfig.json` **0** + `npm run build --prefix packages/web` **PASS**.
**Gate cuối:** `vitest run` 40 → 42+ PASS + `manage.py check 0` + manual 1920/1100/480.

---

## 4. VERIFY E2E SAU KHI XONG

```bash
# 1. Feed row: APF SELL 616.2M + severity dot high + price nếu có + 15:48
# 2. Tabs 4: Tổng quan (sentiment+Top5) | Vận hành (Job+Material) | Cấu hình (KVTable) | Rules (table) — không cramped
# 3. Cấu hình tab: bảng 2 cột Trường/Giá trị, không tràn
# 4. Filter: Type pills 1 hàng + Mức độ/Hướng 140px + Search 1fr + Chưa ack — 2 hàng rõ
# 5. Metric 6: icon + value (343) + click Whale → filter Whale
```

Manual: `http://localhost:8080/operations-center?tab=signals` — check row giàu, tabs 4, KVTable, filter 2 hàng, metrics icon.

---

## 5. RỦI RO & DESIGN

- Không đổi `createElement` — giữ.
- Không thêm lib — dùng `LucideIcon` whitelist (thêm `Snowflake` nếu cần, đã có `Waves/EyeOff/Search`).
- 4 nhóm gộp subtab: nếu UX phản đối, giữ 7 tabs nhưng thêm `overflow-x:auto` + `count` — đã chọn gộp để đỡ cramped.
- `severity` color dùng `socStatusColors.ts` có sẵn.

---

## 6. PHẠM VI NGOÀI

- BE thêm `price`/`confidence` vào `RecentRawItem` — để P3 nếu BE chưa trả.
- SSE `signal_stream` không đổi.
- Pagination `pageSize 20/50/100` giữ.

---

## 7. BÀN GIAO CHECKLIST

- [ ] S1 Row severity+price + `severityDot`
- [ ] S2 4 tabs icon+count + `tabCountBadge`
- [ ] S3 `kvTableWrap` commercial
- [ ] S4 Metrics icon + Filter 2 hàng `filterRow2`
- [ ] S5 Top5 + Two-col `minmax` sticky
- [ ] S6 ledger Entry + AGENTS sync + `tsc 0` + `build PASS` + manual 1920/1100/480

**File plan:** `docs/IMPLEMENTATION_PLAN_SOC_SIGNALS_UI_20260918.md` (file này).
**Audit:** `docs/AUDIT_SOC_SIGNALS_UI_INDUSTRIAL_20260918.md`.
**Ledger:** cập nhật sau mỗi slice.

