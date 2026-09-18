# IMPLEMENTATION PLAN — Tái bố trí UI Cấu hình DataOps (2026-09-18) — Từ AUDIT UI Entry 122

**Base:** `41b3326b` (C1-C8 xong, `SocDataOpsConfigSection.tsx:935` + `SocQueueTierFieldSet.tsx:141` + `soc.components.css:920`) — audit `docs/AUDIT_DATAOPS_CONFIG_UI_20260918.md` Entry 122 (12 UI findings, điểm 4.2/10).
**Mục tiêu:** Từ 1-card wall → 3-card + tierCard + sticky bar + toolbar grid — đạt chuẩn Datadog/Grafana, liền mạch, không rời rạc, giữ glassmorphism tokens.
**Chuyển giao:** Đội code thực thi không cần hỏi lại. Mỗi slice có **Yêu cầu đạt (DoD)** + **Tiêu chí audit copy-paste** (`grep`/`tsc`/`build`/`vitest` + manual 1920/900/480) + **Test**. Gate bắt buộc sau mỗi slice.

> **BẢN VÁ SH.1-6 (2026-09-18-rev1) — theo phản biện Entry 123:** Đã sửa 3 contradictions làm gate thất bại (SH.1 wrapper gap, SH.2 test harness key thô, SH.3 .sectionGrid shared) + 3 gap (SH.4 emoji→LucideIcon, SH.5 2-3→4 keys, SH.6 hardcode → i18n). Xem chi tiết SH.1-SH.6 trong ledger Entry 124.

> **Ràng buộc giữ:** `LangContext t()`, `defaultCoreApiAdapter`, `soc.module.css:sectionCard/glassPanel/inlineError/actionBtn`, `soc.tokens.css` (`081734/0f172a/5078a8/22d3ee/94a3b8`), Vietnamese full dấu `vi.js`.
> **Không đổi BE/adapter** — chỉ `tsx` + `css` + `vi.js/en.js` keys tooltip/label. Không thêm lib.

---

## 0. BỐI CẢNH & THIẾU HỤT ĐÃ CHỨNG MINH (Entry 122)

- `SocDataOpsConfigSection.tsx:642` **1 `sectionCard` chứa 6 nhóm**: `global_config` (`668`) + `presetRow` (`672`) + `queue_tiers_config` (`687`) + `sectionGrid` 4 tier `688` + `fieldRow` reason `705` + 3 `actionBtn` `724-738` → wall 800px, không divider, không sticky.
- `SocQueueTierFieldSet.tsx:126` label = `${t(f.labelKey)} — ${label}` lặp đuôi tier ×3 → 36 từ noise, cell cao.
- `presetRow 672` giữa 2 titles, không card, không tooltip → user không biết ghi đè 12 field.
- `724-738` 3 nút cùng `actionBtn` (trong suốt) → không primary/secondary, không icon, không `disabled` theo `formErrors/can_apply`.
- `750-777` audit filter 3 inputs cùng `fieldInput` 100% + chỉ `aria-label` → không label nhìn thấy, không `Tổng {count}` badge.

---

## 1. KIẾN TRÚC ĐÍCH (wireframe)

```
[Header Meta glassPanel] eyebrow "SOC / DataOps · Cập nhật: 18/09 14:32" | ownership badge phải | locked chips + stale dismiss
[Card A: Cấu hình chung] title "Cấu hình chung" + help "2 tham số cho toàn cụm" | fieldGrid 2col (decay | parity) | [Preset segmented: Tiết kiệm | Cân bằng ★ | Hiệu năng] + tooltip
[Card B: Cấu hình queue tier] title + subtitle "4 nhóm — chỉnh cadence & batch" | grid 2×2 tierCard (icon 🔥/🌊/❄️/🔄 + subtitle "poll 30s · batch 50") → 3 rows each
[Card C: Lý do & Hành động] label "Lý do thay đổi *" (đỏ) + textarea 0/200 + help | sticky bar bottom: [Đặt lại mặc định] [Đặt lại] [Xem trước →] primary (flex-end, backdrop-blur, border-top)
[Card D: Kiểm toán] title + Tổng badge | toolbar grid 160/160/1fr (Người thực hiện | Từ ngày | Tìm tóm tắt) | table max-height 320 | pager trái + export phải
```

Tokens: `081734/0f172a` glass, `22d3ee` accent, `94a3b8` muted, spacing `0.75rem/1rem`, `radius 10px`.

---

## 2. SLICES & TIÊU CHÍ AUDIT (copy-paste chạy được)

### SLICE U1 — Tách 1-card thành 3 cards + Header Meta (P0) — FIX UI-01, UI-10

**Mục tiêu:** Nhịp nghỉ rõ, header không chìm.

**Files:**
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:596-740` (return 935 dòng)
- `packages/web/src/i18n/vi.js:645` (`field_decay_days`), `687-690` tier i18n giữ
- `packages/web/src/components/soc/soc.components.css:116` (`.sectionCard 117`, `.sectionCardTitle 130`)

**Yêu cầu đạt (DoD):**
- U1.1. Trong `return createElement("div",{}, ...)` hiện tại, thay **1 `sectionCard` 642** bằng **3 `sectionCard` liên tiếp**:
  1. `Card A` `createElement("div",{className:styles.sectionCard}, title "Cấu hình chung" (`t("soc.dataops.global_config")`) + `helpText` `t("soc.dataops.global_config_help")` (key mới, xem U1.4) + `globals` `558` `fieldGrid` + `presetRow` (giữ nguyên cho U2)
  2. `Card B` `title "Cấu hình queue tier"` (`t("soc.dataops.queue_tiers_config")`) + `helpText` `t("soc.dataops.queue_tiers_help")` + `sectionGrid` `688` 4 tier
  3. `Card C` `title "Lý do & Hành động"` + `fieldRow` reason `705` + action bar `724`
- U1.2. **Header Meta** gom `596-640`: tạo `createElement("div",{className:styles.glassPanel + " " + styles.configHeaderMeta}, ...)` chứa 1 dòng `flex` `justify-content: space-between; align-items: center`: trái `eyebrow` `SOC / DataOps · ${t("soc.dataops.last_updated")}: ${formatLastCheck(updated_at)}` `651`, phải `SocOwnershipBadge:627`; dòng 2 `lockedFieldList:654` chips; `conflictBanner/staleNote:599-624` giữ trong header (dismissible, không trong card). Không đổi `SocWriteGuardBanner:634` (giữ dưới header).
- U1.3. Thêm wrapper `className: styles.configPageStack` cho root `div` `SocDataOpsConfigSection.tsx:596-598` (`display: flex; flex-direction: column; gap: 1.25rem;`) — hiện root `div {}` rỗng và `ShellPageTemplate.js:83` `.panel` không flex nên 2 card dính nhau. Mỗi card giữ `padding 1rem`. Không dùng margin thủ công. CSS mới `.configPageStack { display:flex; flex-direction:column; gap:1.25rem; }` trong `soc.components.css`.
- U1.4. Thêm `vi.js: `soc.dataops.global_config_help: "2 tham số áp dụng cho toàn cụm, thay đổi có hiệu lực ngay sau khi áp dụng"` + `queue_tiers_help: "4 nhóm — chỉnh chu kỳ poll và lô xử lý cho từng mức độ ưu tiên"` + `reason_section_help` (nếu cần), `en.js` parity. Không `alert`.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "Cấu hình chung|global_config_help|queue_tiers_help|Header Meta|configHeaderMeta" | Out-String  # expect ≥3 (2 titles + header)
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "createElement.*sectionCard" | Measure-Object | ForEach-Object Count  # expect 4 (A+B+C+D audit =4)
Select-String -Path packages/web/src/i18n/vi.js -Pattern "global_config_help|queue_tiers_help" | Out-String  # expect 2
npx tsc --noEmit --project packages/web/tsconfig.json  # 0
npm run build --prefix packages/web  # PASS
```

**Test:** Không thêm test BE. FE snapshot `SocDataOpsConfigSection.component.test.tsx` cập nhật (harness **không có LangProvider** nên `t()` trả key thô — như `SocDataOpsConfigSection.component.test.tsx:188,204` hiện assert `"soc.dataops.audit_total: 2"`): `getByText("soc.dataops.global_config")` + `getByText("soc.dataops.queue_tiers_config")` + `getByText("soc.dataops.change_reason")` 3 cards hiện (hoặc bọc `LangProvider` và assert tiếng Việt — chọn 1, không mix).

---

### SLICE U2 — Tier card + label thuần + preset segmented (P0) — FIX UI-02, UI-03, UI-05

**Mục tiêu:** Label sạch, tier phân biệt, preset rõ.

**Files:**
- `SocQueueTierFieldSet.tsx:26,81-141` (`NumberInput`, `SocQueueTierFieldSet`)
- `SocDataOpsConfigSection.tsx:352-386` (`applyPreset`, `presetRow 672`)
- `soc.components.css:920-995` (`.fieldGrid 921`, `.fieldLabel 933`, `.tierCard` + `.tierSubtitle` mới, `.configPageStack` mới)
- `packages/web/src/components/common/lucide-icon.tsx:12-71` (whitelist — thêm `Zap`, `Snowflake` nếu thiếu)
- `vi.js:687-690` + `preset_*` + tooltip mới

**Yêu cầu đạt (DoD):**
- U2.1. **Label thuần:** `SocQueueTierFieldSet.tsx:126` đổi `label: `${t(f.labelKey)} — ${label}`` → `label: t(f.labelKey)` (ví dụ `Chu kỳ poll`, `Lô tối đa`, `Dispatch`). **Card title** giữ `label` tier `115` (`Nhu cầu người dùng nóng`), thêm **subtitle** `createElement("p",{className:styles.tierSubtitle}, `${poll}s · batch ${batch}`)` dưới title (lấy `config.poll_interval_seconds`, `config.max_batch_size`). Không đổi `id`/`data-field`.
- U2.2. **Tier card riêng:** `SocQueueTierFieldSet.tsx:112` đổi `className: styles.sectionCard` → `styles.tierCard` **MỚI**: `background: rgba(08 17 34 /0.2); border: 1px solid rgba(80 120 168 /0.08); border-top: 2px solid rgba(00 180 216 /0.25); padding: 0.85rem; border-radius: 10px;` + `title 0.8rem weight 700 + LucideIcon` (không emoji) — map `tierKey → {icon, color}`: `hot_user_demand: {icon:"Zap", color:"#f59e0b"}`, `warm_liquid_market: {icon:"Waves", color:"#22d3ee"}`, `cold_full_market: {icon:"Snowflake", color:"#94a3b8"}`, `recovery_backlog: {icon:"RefreshCw", color:"#a855f7"}`. Nếu `Snowflake`/`Zap` chưa có trong `lucide-icon.tsx:12-71` whitelist thì thêm entry vào file đó (liệt kê `lucide-icon.tsx` vào **Files** của slice). `fieldGrid` bên trong đổi `grid-template-columns: 1fr` (stack 3 rows, không 3 cols).
- U2.3. **Preset segmented:** `SocDataOpsConfigSection.tsx:672-686` giữ `presetRow` nhưng đổi 3 `presetButton` sang `filterBtn` pattern: `className: presetKey===selected ? styles.filterBtnActive : styles.filterBtnInactive` (selected = `JSON.stringify(form[TierKey]) === JSON.stringify(PRESET_TIERS[presetKey])` cho mọi tier — hoặc `balanced` mặc định nếu chưa dirty). Thêm `title` tooltip `t("soc.dataops.preset_tooltip",{count:12})` ("Ghi đè 12 trường trong 4 tier") + `onClick` nếu `formDirty` (`JSON.stringify(form)!==JSON.stringify(readForm(envelope.config))` — **không** so với `DEFAULTS` để tránh false dirty khi server defaults khác, SH.7) → `if(!confirm(t("soc.dataops.preset_confirm"))) return;` trước `applyPreset`. Lưu `selected` state để highlight đúng tier.
- U2.4. Thêm `vi.js` `soc.dataops.preset_tooltip: "Ghi đè 12 trường trong 4 tier"` + `preset_confirm: "Bạn có chắc ghi đè 12 trường? Thao tác này sẽ thay thế giá trị hiện tại."` + `chars_remaining: "Còn {count} / {max} ký tự"` (cho U3.1) + `en.js` parity. Tổng **4 keys mới** (không phải 2-3 như ghi cũ).

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocQueueTierFieldSet.tsx -Pattern "tierCard|tierSubtitle|—" | Out-String  # expect tierCard + tierSubtitle, không còn "—" trong label 126 sau fix (grep "—" 0)
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "preset_tooltip|preset_confirm|filterBtnActive" | Out-String  # expect 3
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "\.tierCard|\.tierSubtitle|\.presetRow" | Out-String  # expect tierCard
```

**Test (FE):** Thêm 2 tests: `preset segmented` render 3 nút, bấm `Hiệu năng` khi dirty → `confirm` mock `false` thì không đổi; `Số ngày decay` label không chứa `—`.

---

### SLICE U3 — Action bar hierarchy + sticky + reason (P0) — FIX UI-04, UI-06

**Mục tiêu:** Primary rõ, sticky không mất khi scroll.

**Files:**
- `SocDataOpsConfigSection.tsx:705-740` (`fieldRow` reason + 3 `actionBtn`)
- `soc.components.css:636` (`.actionBtn`), `899` (`.inlineError`), mới `.stickyActionBar`

**Yêu cầu đạt (DoD):**
- U3.1. **Reason tách:** `fieldRow 708` thêm `required` visual: `label` `708` thêm `createElement("span",{className:styles.fieldRequired}," *")` màu `f87171`, `textarea 713` `maxLength 200`, `aria-required true`, `placeholder` giữ, dưới có `helpText` `t("soc.dataops.chars_remaining", {count: 200 - changeReason.length, max: 200})` `className: styles.helpText` (không hardcode tiếng Việt nội tuyến — dùng `vi.js:chars_remaining`).
- U3.2. **Sticky bar:** Gộp reason + buttons trong `Card C` cuối: `createElement("div",{className:styles.stickyActionBar}, reasonRow + buttonRow)`. CSS mới `.stickyActionBar { position: sticky; bottom: 0; z-index: 2; display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.75rem; margin-top: 0.5rem; border-top: 1px solid rgba(80 120 168 /0.15); background: rgba(08 17 34 /0.85); backdrop-filter: blur(8px); }`
- U3.3. **Hierarchy:** Button row `display: flex; justify-content: flex-end; gap: 0.5rem;` — `Xem trước` primary: `style={{background:"rgba(22,215,160,0.2)", color:"var(--accent-emerald, #10b981)", fontWeight:700}}` + `disabled={Object.keys(formErrors).length>0 || !envelope?.ownership?.can_apply}`; `Đặt lại` ghost `className: styles.filterBtnInactive`; `Đặt lại mặc định` ghost danger `style={{color:"var(--soc-c-f87171)", borderColor:"rgba(239,68,68,0.2)"}}`. Thêm `type="button"` cho cả 3.
- U3.4. Success/error banners `599-624` giữ trong Header, không duplicate.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "stickyActionBar|fieldRequired|chars_remaining" | Out-String  # expect 3 (không hardcode "Còn")
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "\.stickyActionBar|\.configPageStack" | Out-String  # expect 2
Select-String -Path packages/web/src/i18n/vi.js -Pattern "chars_remaining" | Out-String  # expect 1
```

**Test (FE):** `Đặt lại mặc định` bấm → form về `DEFAULTS`; `Xem trước` disabled khi `formErrors` có `decay_days`; sticky bar có `position: sticky` (snapshot).

---

### SLICE U4 — Audit toolbar grid + table + responsive grid (P1) — FIX UI-07, UI-08, UI-09, UI-12

**Mục tiêu:** Filter có label, table thoáng, grid không nhảy.

**Files:**
- `SocDataOpsConfigSection.tsx:742-920` (`auditFilters 750`, `diffTable 784`, `auditPager 886`)
- `soc.components.css:892` (`.sectionGrid`), `921` (`.fieldGrid`), `997` (`.diffTable*`), mới `.auditToolbarGrid`

**Yêu cầu đạt (DoD):**
- U4.1. **Toolbar grid:** `auditFilters:750` đổi `className: styles.auditToolbarGrid` **MỚI**: `display: grid; grid-template-columns: 160px 160px 1fr; gap: 0.5rem; align-items: end;` Mỗi cột bọc `fieldRow` có `label` `filterRowLabel`: `Người thực hiện` (select 160px `audit_actorFilter`), `Từ ngày` (date 160px `audit_fromDate`), `Tìm tóm tắt` (search 1fr `audit_search`). Giữ `Tổng {auditTotal}` badge bên phải `audit_title` `745` (đã có `auditTotal`).
- U4.2. **Table:** `diffTableWrap 782` thêm `max-height: 320px; overflow-y: auto;` + `diffTableHeader 1004` đã sticky giữ, thêm `box-shadow: 0 2px 6px rgba(0,0,0,0.15)` khi scroll (nếu đủ thời gian, không bắt buộc). Col `Tóm tắt` `813` thêm `style={{maxWidth:"260px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}` + `title` full.
- U4.3. **Pager:** `auditPager 886` đổi `justify-content: space-between` — trái `Prev/Trang 1/Next` flex, phải `Xuất CSV` `actionBtn` + `Tổng {auditTotal}` hint `limit 50`.
- U4.4. **Grid responsive (scoped):** Tạo class mới `styles.configTierGrid` cho `Card B` (copy `sectionGrid` nhưng `repeat(2,1fr)` cố định 2-col) thay vì sửa `styles.sectionGrid` base — vì `.sectionGrid` đang dùng chung `SocScreenerPanel.tsx:349`, `SocPrefetchPanel.tsx:187`, `SocVnbrokerPanel.tsx:217` — đổi global sẽ vỡ 3 panel kia. `configTierGrid` có `@media (max-width: 900px) { grid-template-columns: 1fr; }`. `fieldGrid` globals `921` giữ `min 200px`; tier inner `fieldGrid` 1-col giữ.
- U4.5. **Empty:** `778-779` `audit_empty` `emptyState` đã có, giữ.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/soc.components.css -Pattern "auditToolbarGrid|configTierGrid.*repeat\(2" | Out-String  # expect 2 (không động sectionGrid base)
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "auditToolbarGrid|configTierGrid|Tổng.*auditTotal" | Out-String  # expect 2
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "audit_filter_search|audit_filter_all" | Out-String  # harness không LangProvider → key thô "soc.dataops.audit_filter_search", không "Người thực hiện"
Select-String -Path packages/web/src/i18n/vi.js -Pattern "audit_filter_all|audit_filter_from|audit_filter_search" | Select-Object -Last 5 | Out-String  # parity check
```

**Test (FE):** Cập nhật `SocDataOpsConfigSection` test audit (harness **không LangProvider**): `getByLabelText("soc.dataops.audit_filter_search")` + `getAllByLabelText("soc.dataops.audit_filter_search")` / `getByPlaceholderText` key thô hiện, hoặc bọc `LangProvider` và assert tiếng Việt — chọn 1, sửa test để không FAIL như `SocDataOpsConfigSection.component.test.tsx:431` hiện dùng key thô.

---

### SLICE U5 — Docs & ledger (cuối)

**Files:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md`

**DoD:** Entry `123` (U1→U4) + `AGENTS.md` Progress sync.

---

## 3. THỨ TỰ & GATE (bắt buộc sau mỗi slice)

| Bước | Slice | Verify ngay (copy-paste) | Gate |
|------|-------|--------------------------|------|
| 1 | **U1 Cards** | `getByText("Cấu hình chung")` + `getByText("Cấu hình queue tier")` | `tsc 0` + `build PASS` |
| 2 | **U2 Tier/Preset** | `label` không `—` + `tierCard` + `preset_tooltip` | `vitest` preset test |
| 3 | **U3 Action** | `stickyActionBar` + primary `Xem trước` | `tsc 0` |
| 4 | **U4 Audit/Grid** | `auditToolbarGrid` `160/160/1fr` + `sectionGrid 2col` | `vitest` audit filter |
| 5 | **U5 Ledger** | `grep ^## Entry 123` | — |

**Gate chung mỗi slice:** `npx tsc --noEmit --project packages/web/tsconfig.json` **0** + `npm run build --prefix packages/web` **PASS**.
**Gate cuối:** `vitest run soc` 90+ (hiện 12/90) + `manage.py check 0` + manual 1920/900/480 (xem §4).

---

## 4. VERIFY E2E SAU KHI XONG (không hỏi lại)

```bash
# 1. 1920px: globals 2-col, tiers 2×2, preset segmented, sticky bar visible khi scroll
# 2. 900px: tiers 1-col (không 2-col nhỏ), globals vẫn 2-col, toolbar 3 cols stack 1-col at 600px
# 3. 480px: 1-col toàn trang, nút Xem trước full width, audit table scroll-x
# 4. Chỉnh hot.poll 30→5 → inline error đỏ, preset confirm khi dirty, action Xem trước disabled
# 5. Audit: filter Người thực hiện → 1 row, search tóm tắt → highlight, Xuất CSV → file 50 rows
```

Manual: `http://localhost:8080/operations-center?tab=dataops&subtab=config` — check 3 cards, preset tooltip, tierCard icon, sticky footer (scroll 800px vẫn thấy Xem trước).

---

## 5. RỦI RO & DESIGN (đã chốt)

- Không đổi `createElement` → giữ như `SocDataOpsConfigSection` 935 dòng (AGENTS không cấm JSX nhưng thống nhất).
- Không thêm lib `diff` — dùng `diffUtil.ts` đã có.
- Preset `confirm` chỉ khi `dirty` (tránh spam).
- Sticky bar `backdrop-filter` tốn GPU nhẹ — chấp nhận, fallback `background solid` nếu lag.
- Không chạm BE — chỉ `vi.js/en.js` thêm **4 keys** `global_config_help`, `queue_tiers_help`, `preset_tooltip`, `preset_confirm` + `chars_remaining` (U2.4/U3.1) đã có.

---

## 6. PHẠM VI NGOÀI

- Approval 2-step, bulk import, analytics simulation — P3.
- Collapse tier cards — để P3 nếu scroll >1000px thực tế phàn nàn.
- i18n `en.js` parity — làm cùng `vi.js`.

---

## 7. BÀN GIAO CHECKLIST

- [ ] U1 3 cards + Header Meta + tsc 0 + build PASS
- [ ] U2 tierCard + label thuần + preset segmented + tooltip/confirm
- [ ] U3 stickyActionBar + reason * + hierarchy + disabled theo errors
- [ ] U4 auditToolbarGrid 160/160/1fr + table max-height + sectionGrid 2col@900
- [ ] U5 ledger Entry 123 + AGENTS sync + manual 1920/900/480 PASS

**File plan:** `docs/IMPLEMENTATION_PLAN_DATAOPS_CONFIG_UI_20260918.md` (file này).
**Audit:** `docs/AUDIT_DATAOPS_CONFIG_UI_20260918.md`.
**Ledger:** cập nhật sau mỗi slice (U1→U5).

