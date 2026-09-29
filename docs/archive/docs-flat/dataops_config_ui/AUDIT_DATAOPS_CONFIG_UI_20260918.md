# AUDIT UI/UX — Cấu hình DataOps (SOC Operations Center) — Bố trí & Trải nghiệm

> **Ngày audit:** 2026-09-18 (ảnh `Cấu hình` 100% tái hiện code `SocDataOpsConfigSection.tsx:642-740` + `SocQueueTierFieldSet.tsx:112`)
> **Phạm vi:** `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:1` (935 dòng) + `SocQueueTierFieldSet.tsx:1` (141) + `soc.components.css:920-995`/`soc.module.css:3` + `soc.tokens.css` + `vi.js:687-690` i18n + `DataOpsContext.tsx:199` + benchmark `SocVnbrokerPanel.tsx:222`, `SocScreenerConfigForm.tsx:99`, `Datadog/AWS Config`
> **Phương pháp:** Khung AGENTS.md (Nguyên tắc 1-6, B1-B6) — `grep/glob/read` toàn repo `.tsx/.css/.tokens/.json/.js`, trace 1 use-case chỉnh `hot.poll 30→15`, đối chiếu code↔ảnh, benchmark công nghiệp.
> **Stack:** `dev 41b3326b` (C1-C8 xong) — chức năng đủ nhưng bố cục rời rạc.

---

## Tóm tắt 5 vấn đề bố cục nghiêm trọng nhất

**UI-01 (BLOCKER):** Tất cả 14 inputs + preset + lý do + 3 nút nhồi trong **1 `sectionCard` duy nhất** `SocDataOpsConfigSection.tsx:642` (`global_config` + `presetRow` + `queue_tiers_config` + `fieldRow` change_reason + 3 `actionBtn` 725-738). Không có phân cấp card → “wall of inputs” trên ảnh: 2 globals → preset bar → 4 tier cards (2×2) → textarea → nút — rời rạc, không có nhịp nghỉ, không sticky action.

**UI-02 (BLOCKER):** `SocQueueTierFieldSet.tsx:126` label = `${t(labelKey)} — ${label}` lặp hậu tố tier 3 lần/1 card (“Chu kỳ poll — Nhu cầu người dùng nóng” ×3). Trên ảnh mỗi field hàng đều mang đuôi dài → noise, scan chậm, truncate.

**UI-03 (HIGH):** Preset `saving|balanced|performance` `352-364` + `672-686` nằm **giữa** globals và tiers, không có `sectionCardTitle` riêng hay divider, không giải thích tác động — user không biết bấm sẽ ghi đè 12 field.

**UI-04 (HIGH):** Action bar `705-739` 3 nút `Xem trước`/`Đặt lại`/`Đặt lại mặc định` cùng `actionBtn` (màu trong suốt) — không phân biệt primary/secondary, không icon, không `type="button"`, không `disabled` theo `formErrors`/`can_apply`.

**UI-05 (HIGH):** Audit `742-920` là `sectionCard` thứ 2 duy nhất, nhưng filter `750-777` 3 inputs (`select` actor + `date` + `search`) cùng `fieldInput` 100% width, không label, chỉ `aria-label`, không grid, không total pages, không empty illustration.

> **Điểm UI:** **4.2/10** — đủ field (C1) nhưng bố cục 1-card, label noise, preset chìm, action không hierarchy, audit filter sơ sài → chưa đạt Datadog/Grafana.

---

## 1. Đọc trước

- `AGENTS.md` (SOC glassmorphism, `LangContext`, `soc.module.css` tokens `081734/0f172a/5078a8`, `text-primary f1f5f9 / muted 94a3b8`)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 121 (C1-C8), Entry 120 (phản biện)
- `docs/AUDIT_DATAOPS_CONFIG_20260918.md` + `docs/PHAN_BIEN_AUDIT_DATAOPS_CONFIG_20260918.md`
- Ảnh `Cấu hình` (2 globals trên, 4 tier cards 2×2, textarea lý do, 3 nút, audit filter)

---

## 2. Phạm vi

### A. FE Config Bố cục

- `SocDataOpsConfigSection.tsx:557-740` (globals `558-590` `fieldGrid`, preset `672-686` `presetRow`, tiers `688-704` `sectionGrid`, reason `705-723` `fieldRow`, actions `724-738`)
- `SocQueueTierFieldSet.tsx:70-141` (3 `NumberInput` `122-137`, `sectionCard` `114`, `fieldGrid` `118`)
- `soc.components.css:920-995` (`.fieldGrid 921`, `.fieldRow 927`, `.fieldLabel 933`, `.fieldInputWrap 940`, `.presetRow` (grep), `.sectionCardTitle 130`, `.sectionGrid 892`, `.helpText 982`, `.fieldError 989`, `.diffTable* 997`)
- `soc.tokens.css` (spacing, `soc-rgb-081734`, `soc-c-22d3ee`)
- `vi.js:687-690` tier names, `preset_*`, `field_*_help`, `change_reason`, `reset_defaults`, `audit_*`

### B. Benchmark

- `SocVnbrokerPanel.tsx:222` (raw `textarea` 454 dòng — không mẫu layout), `SocScreenerConfigForm.tsx:99` (per-field `NumberInput`)
- `SocPrefetchPanel.tsx`, `SocSignalsPanel.tsx` (sectionCard + toolbar hierarchy)
- Industrial: Datadog Config (sectionGroup + sticky footer), Grafana (collapsible), AWS (wizard + review)

### C. Cross

- `web↔core`: schema `a4f70798` đã có nhưng FE chưa dùng để group help
- `i18n`: `vi.js:403` `soc.dataops.*` 15 keys, `en.js` parity
- `a11y`: `NumberInput.tsx:58` `aria-invalid/aria-describedby/data-field`

---

## 3. Phương pháp (B1-B6)

1. Đọc 2 `soc` component + 3 `css` + `vi.js`.
2. `glob soc/*` + `grep NumberInput|sectionGrid|presetRow|fieldGrid`.
3. `read` toàn flow 935 dòng, trace chỉnh `hot.poll`.
4. Đối chiếu ảnh↔code: globals 2 cols, tier 2×2, preset bar, audit filter.
5. Check tokens, responsive, a11y.
6. Quality gates: `tsc 0`/`build 46.47s`/`i18n:scan 0`/`vitest 12/90`.

---

## 4. Đầu ra

### A. Bản đồ kiến trúc (bố cục hiện tại)

| Vùng (ảnh) | File:Line | Token/CSS | Vấn đề bố trí |
|------------|-----------|-----------|---------------|
| **Header** `Thông tin sở hữu` | `SocDataOpsConfigSection.tsx:626-640` `SocOwnershipBadge:627`, `SocWriteGuardBanner:634`, `lockedFieldList:654` | `glassPanel`, `statusBadge` | Badge nhỏ `0.7rem`, không sticky, `lockedFieldBadge` join `652` thành 1 dòng dài |
| **Card 1** `Cấu hình` (`642 sectionCard`) | `642-740` | `sectionCard 117` `padding 1rem`, `sectionCardTitle 130` `0.75rem gap 0.5rem`, `fieldGrid 921` `min 200px`, `sectionGrid 892` `min 320px` | **1 card chứa 6 nhóm** → wall, không divider, title `Cấu hình chung` `668` vs `Cấu hình queue tier` `687` cách nhau `presetRow` không separator |
| Globals `7 / 30` | `557-590` `fieldGrid 2col` | `NumberInput 26` `fieldRow 927` `fieldLabel 933 0.72rem`, `helpText 982 0.68rem` | OK 2 cols, nhưng help dưới unit gây dài |
| Preset `Tất cả/Cân bằng/Hiệu năng` | `672-686` `presetRow` | `presetLabel + presetButton` | Chìm giữa 2 titles, không card, không tooltip |
| Tier `Nhu cầu nóng …` (4 cards) | `688-704` `sectionGrid 2×2` → `SocQueueTierFieldSet 112` `sectionCard` nested + `fieldGrid` 1 col inside | `sectionCard` lồng `sectionCard` → double border `117`/`122` |
| Lý do | `705-723` `fieldRow` `textarea 713` `rows 2` | `fieldInput` | Nằm cuối card, không phân tách action |
| Nút `Xem trước/Đặt lại/Đặt lại mặc định` | `724-738` `actionBtn 636` | `636` `0.4rem 0.75rem` | 3 nút cùng style, không primary, không `gap` row, không sticky |
| **Card 2** `Kiểm toán cấu hình` | `742-920` `sectionCard`, `auditFilters 748` `select/date/search` | `fieldInput`, `diffTableWrap 997`, `auditPager 886` | Filter 3 inputs xếp `flex` không label, audit table 5 cols chật trên 320px |
| Conflict/Stale banner | `599-624` `inlineError/conflictBanner` | `899/604` | Nằm trước header, dễ miss khi scroll |

### B. Luồng trace (đổi `hot.poll 30→15`)

1. User tìm `hot_user_demand.poll_interval_seconds` trong grid tier 1 `SocQueueTierFieldSet.tsx:122` `id=hot_user_demand.poll_interval_seconds` `data-field`, label `Chu kỳ poll — Nhu cầu người dùng nóng` `126` → phải đọc đuôi dài.
2. Gõ `15` → `NumberInput 58 onChange parseInt` → `updateTierField 335` → `formErrors` check `10-3600` → inline `fieldError 989` nếu fail, nhưng help `helpText 982` ngay dưới unit → 3 dòng/cell.
3. Bấm `Hiệu năng` preset `681` → `applyPreset 353` ghi đè **cả 4 tiers** `357-359` `12 fields` không confirm — surprise.
4. Gõ lý do `Lý do thay đổi` `708` `textarea rows 2` `713` — không count, không `required` star.
5. Bấm `Xem trước 726` → `validateForm 299-318` → `firstErrorKey` focus `385` `querySelector[data-field]` → modal `SocConfigPreviewModal 922` diff 3-col — OK nhưng nút trong card 1 không sticky nên phải scroll lên.
6. Apply → banner `success 599` `inlineSuccess` trong card 1 top — không scroll-into-view.
7. Audit filter `750` `select Tất cả / date / search` — không label, chỉ `aria-label` → sighted user đoán.

### C. CONTRADICTIONS (thiết kế kỳ vọng vs code/ảnh)

| STT | Kỳ vọng thương mại | Thực tế `file:line` | Tác động |
|-----|--------------------|---------------------|----------|
| C1 | Header phải sticky + summary `Last updated` rõ | `envelope?.updated_at 646-652` `helpText` nhỏ `0.68rem` trong card, không eyebrow | Mờ, miss freshness |
| C2 | Preset phải là Toolbar riêng với tooltip | `presetRow 672` giữa 2 titles, không `title`/`help` | User không biết preset ghi đè 12 fields |
| C3 | Tier card title phải icon + tier name + cadence hint | `SocQueueTierFieldSet 115` chỉ `label` text (`t(TIER_LABEL_KEYS)`) không icon, không `poll 30s` subtitle | Khó phân biệt hot/warm |
| C4 | Action bar phải sticky footer trong `glassPanel` | `724-738` thường trong card, không `position: sticky`, không `border-top` | Scroll dài phải kéo lên |
| C5 | Audit filter phải có label + total + page/total | `750-777` 3 inputs + `auditTotal:747` `helpText` nhỏ, không `page/total`, không total pages | Lọc mù, không biết còn bao nhiêu |
| C6 | `locked_fields` phải disable field + 🔒 inline | `lockedFields.includes 569-585` đúng nhưng `lockedFieldReason` dùng `schemaFields[key]?.help` `220` fallback key — không phải `write_block_reason` | Tooltip sai nguồn |

### D. Findings

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất fix (cụ thể) |
|----|-----|-----------|---------|----------|----------------------|
| **UI-01** | **BLOCKER** | `SocDataOpsConfigSection.tsx:642` `sectionCard` (1 card cho 6 nhóm) / ảnh 1-card wall | Globals + preset + 4 tiers + reason + actions trong 1 padding `1rem` → không nhóm, scroll 800px không nghỉ | Tách thành **3 cards**: `Card A` Globals (`global_config` + preset toolbar), `Card B` Queue tiers (`2×2 grid` có `icon+subtitle`), `Card C` Reason + Sticky Action Bar. Mỗi card `sectionCardTitle` + `helpText` mô tả + `separator` `0.75rem`. |
| **UI-02** | **BLOCKER** | `SocQueueTierFieldSet.tsx:126` `label: ${t(f.labelKey)} — ${label}` | 12 labels đều mang đuôi `— Nhu cầu nóng` → 36 từ lặp, cell cao | Đổi thành **field label thuần** `t(f.labelKey)` (`Chu kỳ poll`, `Lô tối đa`, `Dispatch`) + **card subtitle** là tier name + cadence `poll 30s · batch 50`. Dùng `NumberInput help` cho unit. |
| **UI-03** | **HIGH** | `SocDataOpsConfigSection.tsx:672-686` `presetRow` | Preset 3 nút `presetButton` không viền active, không tooltip `Ghi đè 12 trường` | Đưa preset thành **segmented control** sticky dưới Globals: `presetLabel` + 3 `filterBtn` (`filterBtnActive` khi selected) + tooltip `title="Ghi đè 4 tier về …"` + `confirm` nếu form dirty. |
| **UI-04** | **HIGH** | `SocDataOpsConfigSection.tsx:724-738` | 3 nút cùng `actionBtn`, không hierarchy | Đổi: `Xem trước` **primary** (`background: rgba(22,215,160,0.2); color: accent-emerald; font-weight 700;`), `Đặt lại` **ghost** (`filterBtnInactive`), `Đặt lại mặc định` **danger ghost** (đỏ nhạt). Thêm `gap 0.5rem`, `justify-content: flex-end`, `border-top 1px`, `position: sticky; bottom: 0; backdrop-filter: blur(8px)` cho action bar. |
| **UI-05** | **HIGH** | `SocQueueTierFieldSet.tsx:112` `sectionCard` lồng `sectionCard` | Double border `522a vs 081734`, `sectionGrid 892` gap `1.25rem` quá rộng → 4 cards rời rạc | Đổi tier wrapper thành **`tierCard`** riêng: `background rgba(081734/0.2)`, `border 0.8`, `padding 0.85rem`, `title 0.8rem + icon (🔥/🌊/❄️/🔄)` + subtitle `poll 30s`. Gap `0.75rem`. |
| **UI-06** | **HIGH** | `SocDataOpsConfigSection.tsx:705-723` reason | `textarea rows 2` trong card 1, không `required *`, không count `0/200` | Tách reason ra **Action Card** cùng với buttons, thêm `label *` (đỏ), `placeholder` giữ, `maxLength 200`, `helpText` `Còn {200-len} ký tự`, `aria-required`. |
| **UI-07** | **HIGH** | `SocDataOpsConfigSection.tsx:750-777` auditFilters | 3 inputs cùng `fieldInput` không label, xếp `flex` wrap → date 100% trên mobile, search chìm | Đổi thành **toolbar** `auditFilters` `display: grid; grid-template-columns: 160px 160px 1fr; gap: 0.5rem` + `filterRowLabel` cho mỗi: `Người thực hiện` (select 160px), `Từ ngày` (date 160px), `Tìm tóm tắt` (search flex). Thêm `Tổng {auditTotal}` badge bên phải title. |
| **UI-08** | **MEDIUM** | `SocDataOpsConfigSection.tsx:784-885` diffTable | `diffTableWrap` không `max-height`, 5 cols `actor/timestamp/change/diff/actions` chật, `diffTableHeader 1004` sticky nhưng không shadow | Thêm `max-height 320px; overflow-y: auto` + `shadow`, col `Tóm tắt` `max-width 260px; truncate`, `Diff` nút `linkBtn`, `Hoàn tác` `actionBtn` nhỏ. Thêm `emptyState` illustration khi 0. |
| **UI-09** | **MEDIUM** | `soc.components.css:921` `fieldGrid min 200px` vs `892 sectionGrid min 320px` + `557 fieldGrid` globals `min 200px` | Grid tiers 321px bị 1-col sớm trên 900px, globals 2-col okay nhưng tier 2×2 vỡ thành 1-col ở 768 → layout nhảy | Thống nhất `fieldGrid: repeat(auto-fit, minmax(180px, 1fr))` cho globals, `sectionGrid: repeat(2, 1fr)` cố định 2-col (collapse 1-col at `900px` thay vì `auto-fit`), tier inner `fieldGrid: 1fr` (stack 3 rows). |
| **UI-10** | **MEDIUM** | `SocDataOpsConfigSection.tsx:599-624` banners | `conflictBanner` + `staleNote` + `ownership` badge + `writeGuard` xếp đầu trang, không group | Gom **Header Meta** thành 1 `glassPanel` eyebrow: `SOC / DataOps · Cập nhật: {last}` + `ownership` badge phải + `lockedFieldList` chips + `staleNote` dismissible. |
| **UI-11** | **MEDIUM** | `soc.components.css:982` `helpText 0.68rem #94a3b8` | Help dưới unit, 0.68rem trên `020b23 0.6` → contrast 4.1:1 borderline | Tăng `helpText` lên `0.7rem`, `line-height 1.4`, `max-width 32ch`, đặt dưới input 100% width. |
| **UI-12** | **LOW** | `SocDataOpsConfigSection.tsx:886-920` auditPager | `Prev 0.5rem / Trang 1 / Next / Xuất CSV` cùng line, `Xuất CSV` không icon, không `limit` hint | Tách `pager` trái + `export` phải (`justify-content: space-between`), thêm `Tổng {count}` và `limit 50` hint. |

### E. Quality gates (bố cục)

| Gate | Lệnh | Kết quả | Note |
|------|------|---------|------|
| Lint | `npm run lint` | 0 errors | Không lỗi bố cục |
| Type | `npx tsc --noEmit --project packages/web/tsconfig.json` | 0 | Pass |
| Build | `npm run build --prefix packages/web` | PASS 46.47s | Chunk warn |
| Tokens | `grep -n "soc-rgb\|soc-c-" soc.tokens.css` | Dùng `081734/0f172a/5078a8/22d3ee/94a3b8` đúng | Nhưng `fieldGrid` hard `200px` không token |
| Breakpoints | manual 1920/900/480 | Tier 2×2 → 1-col at 768 hiện nhảy sớm | Fix UI-09 |
| A11y | `NumberInput aria-invalid/aria-describedby` 58-66 | Có | Nhưng reason thiếu `aria-required` |
| i18n | `vi.js` 15 keys | Đủ | Thiếu preset tooltip key |

### F. Câu hỏi cần làm rõ

1. Preset ghi đè không `confirm` có chấp nhận không? (đề xuất confirm khi dirty)
2. Action bar sticky có chấp nhận `backdrop-filter` thêm không? (đẹp hơn nhưng tốn GPU)
3. Audit filter có cần thêm `Dịch vụ` không? (hiện chỉ `matrix`)
4. Có cần collapsible cho tier cards không? (tiết kiệm scroll 30%)

### G. Đánh giá tổng thể & Hướng bố trí công nghiệp

- **Hiện trạng:** Chức năng đủ (14 inputs + preset + audit) nhưng **1-card wall** + label noise + action không sticky → **rời rạc, sơ sài** như ảnh.
- **Hướng industrially:** Tách 3 cards + segmented preset + tier card riêng + sticky footer + audit toolbar grid — đạt **Datadog Config / Grafana / Linear** (sectionGroup + card + sticky bar).
- **Ưu tiên:** **P0** UI-01/02/03/04 (bố cục + label + preset + action) 0.5d → **P1** UI-05/06/07/09 (tierCard/grid/filter) 0.5d → **P2** UI-08/10/12 (table/a11y) 0.25d.
- **Không đổi logic:** Chỉ `tsx` + `css` + `vi.js` keys tooltip — không chạm BE/adapter.

---

## Phụ lục — Đề xuất wireframe (text)

```
[Header Meta glassPanel] eyebrow SOC/DataOps · Last updated | ownership badge | locked chips | stale dismiss
[Card A: Cấu hình chung] title + help | 2 NumberInput (decay/parity) side-by-side | [Preset segmented: Tiết kiệm | Cân bằng ★ | Hiệu năng]
[Card B: Cấu hình queue tier] title | subtitle "4 nhóm — chỉnh cadence & batch" | grid 2×2 tierCard (icon+subtitle) → 3 rows each
[Card C: Lý do & Hành động] textarea Lý do * (0/200) full width | sticky bar [Đặt lại mặc định] [Đặt lại] [Xem trước →] primary
[Card D: Kiểm toán] title + Tổng badge | toolbar grid 160/160/1fr | table | pager + export
```

**File audit:** `docs/AUDIT_DATAOPS_CONFIG_UI_20260918.md` (file này).
**Kế hoạch chi tiết:** có thể tách `IMPLEMENTATION_PLAN_DATAOPS_CONFIG_UI_20260918.md` nếu cần, nhưng 12 findings trên đủ để dev tự sửa 1-1.25d không hỏi lại.
