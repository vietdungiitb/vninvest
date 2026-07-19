# IMPLEMENTATION PLAN — ALERT CENTER P0 UPGRADE (Corrected)

**Ngày:** 2026-07-18
**Cơ sở:** `AUDIT_ALERT_CENTER_20260718.md` + `AUDIT_ALERT_CENTER_INDEPENDENT_20260718.md` (đã correction F2) + `AUDIT_ALERT_CENTER_INDEPENDENT_REVIEW_20260718.md`
**Mục tiêu:** Nâng Alert Center từ "MVP island" lên đẳng cấp thương mại (TradingView/Finviz/Benzinga class) — tập trung P0: realtime consume (F1), filter severity/alert_family (F5), i18n namespace (F3-i18n), contract doc correction (F3-contract).
**Nguyên tắc bắt buộc:** Không đổi REST contract/backend response shape (đã hoạt động). Chỉ sửa: (1) AlertCenterPage consume WS có sẵn, (2) UI filter, (3) i18n keys, (4) doc. Rủi ro thấp.

---

## 0. CORRECTED ROOT CAUSE (quan trọng trước khi code)

| Symptom | Nguyên nhân thật (đã xác minh) | Sai lầm audit gốc |
|---------|--------------------------------|-------------------|
| AlertCenterPage không realtime | `AlertCenterPage.tsx:1-9` chỉ import `useAlertCenterData` (REST), **KHÔNG gọi `useRealtimeFeedFromManager`**. Data WS đến nhưng không render. | Audit gốc claim "WS broadcast chết" — SAI (DashboardPage nhận được realtime) |
| `market_discovery_event` không có | Backend không emit enum này; client listener `useRealtimeFeedCore.js:1127` là dead code | Audit gốc gọi là "blocker" — thực ra THẤP |
| `useAlertCenterSnapshot`被判 orphan | Hook được `DashboardPage.tsx:166` dùng | Audit gốc tự mâu thuẫn |

**Nuance F1 (BẮT BUỘC CHO IMPLEMENTER):** `useRealtimeFeedFromManager` (`RealtimeContext.js:155-158`) filter alert bởi `normalizedSymbols.includes(item.symbol)`. Nếu AlertCenterPage subscribe `['market_discovery']`, filter loại bỏ mọi alert (symbol là mã CP, không phải `'MARKET_DISCOVERY'`). → AlertCenterPage phải consume alert từ WS qua **path không filter symbol** (dùng `baseFeed.alerts`/`baseFeed.darkFlowAlerts` raw) hoặc 1 hook wrapper riêng `useAlertCenterRealtime()` không áp dụng symbol-filter.

---

## PHASE 1 — REALTIME CONSUME (F1) — Sprint 1

### Slice 1.1: Tạo hook `useAlertCenterRealtime`
**File mới:** `packages/web/src/hooks/useAlertCenterRealtime.js`
**Mô tả:** Wrapper quanh `useRealtimeFeedCore` (NOT qua manager filter) để lấy alert realtime từ `market_discovery` mà không bị symbol-filter.
**Logic:**
- Gọi `useRealtimeFeedCore({ symbols: ['market_discovery'], pollInterval: 30000, maxAlerts: 50, enabled: autoRefresh })` trực tiếp (bypass `useRealtimeFeedFromManager` để tránh symbol-filter).
- Trả về `{ realtimeAlerts, darkFlowAlerts, realtimeStatus, lastEventAt, connectionState }`.
- `realtimeAlerts` = merge `feed.alerts` + `feed.darkFlowAlerts` (đã normalize, có `event_id`, `symbol`, `severity`, `matched_value`...).
- Dedupe theo `event_id` với feed REST hiện tại (sử dụng `lastProcessedEventIdsRef` pattern từ `useRealtimeFeedCore.js:706`).

**Acceptance Criteria (AC):**
- [ ] Khi WS connect, `realtimeStatus === 'live'`; khi mất kết nối → fallback `'polling'` (dùng REST `useAlertCenterData`).
- [ ] Alert mới từ WS xuất hiện trong feed trong < 1s (không chờ 5s poll).
- [ ] Không duplicate: alert có `event_id` trùng với REST feed không hiện 2 lần.
- [ ] `enabled=false` (user tắt auto-refresh) → không mở WS, chỉ REST.

### Slice 1.2: Tích hợp vào `AlertCenterPage.tsx`
**Files:** `AlertCenterPage.tsx`
**Changes:**
- Import `useAlertCenterRealtime`.
- Thêm `const { realtimeAlerts, realtimeStatus } = useAlertCenterRealtime({ enabled: autoRefresh });`
- Merge: `const mergedAlerts = useMemo(() => dedupeAndMerge(realtimeAlerts, restAlerts), [...])` — realtime ưu tiên mới nhất, REST làm base khi WS down.
- Hiển thị `realtimeStatus` badge (LIVE/WS-down→polling) thay vì chỉ "LIVE (5s)".
- Giữ `useAlertCenterData` làm base + fallback (KHÔNG xóa polling ngay — WS là enhancement).

**AC:**
- [ ] Feed hiển thị kết hợp REST (base) + WS (incremental) không nháy/flicker.
- [ ] Khi WS down, UI tự quay về polling 5s (status badge đổi màu), không crash.
- [ ] `handleAcknowledge` vẫn hoạt động (giữ REST path).

### Slice 1.3: Contract doc correction (F3-contract)
**File:** `docs/WEBSOCKET_EVENT_CONTRACT.md`
**Changes:** Cập nhật §4 cho khớp implement thực tế:
- Client gửi `{action:"subscribe", symbols:[...]}` (KHÔNG `channels`).
- Server ack `{event_type:"subscribed", symbols:[...]}` (KHÔNG `subscription_ack`).
- Đánh dấu `market_discovery_event` là "optional/undocumented — backend hiện không emit" hoặc xóa khỏi enum §3.
**AC:** [ ] Doc khớp `consumers.py:192-216`. [ ] Không đổi code backend.

### Sprint 1 Quality Gates
| Gate | Lệnh | Đạt |
|------|------|----|
| Lint | `npm run lint` (packages/web) | EXIT 0 |
| Type-check | `npx tsc --noEmit` | EXIT 0 |
| i18n scan | grep `vi.js`/`en.js` cho string mới | Không hardcode (trừ tech term) |
| Test | Viết `useAlertCenterRealtime.test.ts` (mock WS onmessage → assert alert merge) | PASS |
| Manual | Dev chạy, trigger whale alert backend → hiện <1s trên AlertCenterPage | OK |

### Sprint 1 Audit Checklist (bắt buộc trước bàn giao)
- [ ] `useAlertCenterRealtime` KHÔNG gọi `useRealtimeFeedFromManager` (tránh symbol-filter trap).
- [ ] WS cleanup: component unmount → WS disconnect (verify `useRealtimeFeedCore` return cleanup chạy).
- [ ] Không tăng số HTTP req/user/phút (WS thay vì thêm poll).
- [ ] Dedupe `event_id` hoạt động (test + manual).
- [ ] Fallback polling vẫn chạy khi `VITE_DISABLE_REALTIME_WEBSOCKET=true`.

---

## PHASE 2 — FILTER SEVERITY & ALERT_FAMILY (F5) — Sprint 2

### Slice 2.1: Mở rộng `useAlertCenterData` params
**File:** `packages/web/src/hooks/useAlertCenterData.js`
**Changes:** Nhận thêm `severity` (array) + `alertFamily` (array) vào query (line 23-27). Build query:
```js
const query = {
  symbol: symbol || undefined,
  session_date: sessionDate || undefined,
  timeframe: timeframe || undefined,
  ...(severity?.length ? { severity: severity.join(',') } : {}),
  ...(alertFamily?.length ? { alert_family: alertFamily.join(',') } : {}),
};
```
**Note:** Backend `_apply_common_alert_filters` (`views.py:143-176`) đã hỗ trợ `severity` (exact match) + `alert_family` (bao gồm `price_shock`/`stale_quote` mapping). URLSearchParams adapter (`market.js:51-53`) truyền nguyên → OK.

### Slice 2.2: Filter UI trong `AlertCenterPage.tsx`
**Changes:**
- State: `const [severityFilter, setSeverityFilter] = useState([]);` `const [familyFilter, setFamilyFilter] = useState([]);`
- Truyền vào `useAlertCenterData({ ..., severity: severityFilter, alertFamily: familyFilter })`.
- Render filter bar (dùng `theme.module.css` `.btn`/`.chip` sau Phase 3, tạm dùng class có sẵn):
  - Severity chips: critical/high/medium/low (multi-select toggle).
  - Family chips: whale/dark_flow/price_shock/signal/system/ai_suggest (từ `alert_family` values backend trả).
- Reset pageFeed khi filter thay đổi (như line 108 đã làm cho lane/symbol).

**AC:**
- [ ] Chọn "critical" → chỉ alert severity=critical hiện (verify network request có `?severity=critical`).
- [ ] Chọn "whale" + "dark_flow" → `?alert_family=whale,dark_flow`.
- [ ] Kết hợp symbol + severity + family hoạt động đồng thời.
- [ ] Bỏ chọn → trả về toàn bộ (query không có param).

### Slice 2.3: (Optional) Server-side sort thay client slice
**Note:** Giữ client sort hiện tại (Slice 2 không đổi pagination để giới hạn scope). Cursor pagination (F6 cũ) dời Phase sau (P1).

### Sprint 2 Quality Gates
| Gate | Lệnh | Đạt |
|------|------|----|
| Lint / tsc | như Sprint 1 | EXIT 0 |
| Backend contract | `curl '/signals/alert-center/feed?severity=critical&alert_family=whale'` | Trả đúng subset |
| Test | `useAlertCenterData.test.js` (mock adapter, assert query string) | PASS |
| Manual | Filter UI toggle → feed đúng | OK |

### Sprint 2 Audit Checklist
- [ ] Backend filter được sử dụng (không filter client-side giả lập).
- [ ] Multi-select state không làm reset feed loop vô hạn (debounce nếu cần).
- [ ] `alert_family` values khớp backend (`whale`/`dark_flow`/`price_shock`/`stale_quote`/`signal`/`system` + `ai_suggest`/`ai_alert` từ ai-lane).

---

## PHASE 3 — i18n NAMESPACE (F3-i18n) — Sprint 3

### Slice 3.1: Thêm namespace `alertCenter` vào `vi.js` + `en.js`
**Files:** `packages/web/src/i18n/vi.js`, `en.js`
**Structure:** (thêm vào root object, đồng bộ với pattern `common`/`layout`)
```js
alertCenter: {
  title: 'Trung tâm cảnh báo',           // 'Whale Alerts Workspace'
  subtitle: 'Đại bản doanh whale, dark-flow & Price Shock...',
  live: 'LIVE (realtime)',
  paused: 'TẠM DỪNG',
  filterSymbol: 'Lọc Mã',
  applyFilter: 'Lọc feed',
  laneMain: 'Luồng chính',
  laneAi: 'AI Alerts / AI Suggests',
  timeframe: 'Phạm Vi Thời Gian:',
  summary: {
    total: 'Tổng số alert',
    unseen: 'Chưa đọc',
    highCritical: 'Mức Cao & Siêu Cao',
    aiSuggest: 'AI Suggest',
    symbolFilter: 'Bộ lọc mã',
  },
  feedTitle: 'BẢNG TIN THỜI GIAN THỰC',
  feedShowing: 'Hiển thị {count} sự kiện gần nhất',
  sortLatest: 'Mới nhất',
  sortLargest: 'Giá trị lớn nhất',
  autoRefresh: 'Tự động làm mới',
  refresh: 'Làm mới',
  empty: 'Chưa có sự kiện cảnh báo nào phù hợp với bộ lọc hiện tại.',
  statsTitle: 'THỐNG KÊ THEO MÃ CỔ PHIẾU',
  statsSearch: 'Tìm nhanh mã (ví dụ: VNM)...',
  colSymbol: 'Mã CP', colCount: 'Số Alert', colBuySell: 'Mua / Bán',
  colFreq: 'Tần Suất', colValue: 'Tổng Giá Trị',
  freqExplosive: 'Bùng nổ', freqHigh: 'Cao', freqMedium: 'Trung bình', freqLow: 'Thấp',
  detailTitle: 'Kính lúp kiểm tra pháp y: {id}',
  detailContent: 'Nội dung & Tóm tắt', detailContext: 'Bối cảnh mã {symbol}',
  detailTotal: 'Tổng cảnh báo đang hoạt động', detailUnseen: 'Cảnh báo chưa đọc',
  detailAvgSeverity: 'Mức độ trung bình', detailThreshold: 'Cơ chế bảo mật threshold',
  btnDetail: 'Chi tiết', btnAck: 'Đánh dấu đã xem', btnMute: 'Mute 30 phút',
  loading: 'Đang tải dữ liệu cảnh báo từ Core API...',
  error: 'Không thể tải alert center từ core API.',
}
```
(en.js tương ứng tiếng Anh chuẩn thương mại.)

### Slice 3.2: Refactor 5 component dùng `useLang()`/`t()`
**Files:** `AlertCenterPage.tsx`, `AlertCard.js`, `SummaryMetrics.js`, `SymbolStatsTable.js`, `DetailDrawer.js`
**Changes:**
- `AlertCenterPage.tsx`: bọc `export function AlertCenterPage(...) { const { t } = useLang(); ... }` thay hardcode string bằng `t('alertCenter.title', 'Whale Alerts Workspace')`.
- 4 component con: nhận `t` prop hoặc gọi `useLang()` trực tiếp.
- Chạy `npm run i18n:scan` để confirm không còn string literals.

**AC:**
- [ ] EN user thấy 100% tiếng Anh; VN user thấy 100% tiếng Việt.
- [ ] Mọi user-facing string qua `t()` (trừ brand term "Whale", "dark-flow" giữ nguyên có dấu).
- [ ] `npm run i18n:scan` sạch (không phát hiện hardcode mới).

### Sprint 3 Quality Gates
| Gate | Lệnh | Đạt |
|------|------|----|
| Lint / tsc | EXIT 0 |
| i18n scan | `npm run i18n:scan` | Không có missing key / hardcode |
| Test | Render test (vi + en) assert text content | PASS |
| Manual | Toggle EN/VN trong UserSettings → AlertCenter đổi ngôn ngữ | OK |

### Sprint 3 Audit Checklist
- [ ] Không còn string literal VN trong 5 file (grep `Whale Alerts Workspace`/`Đại bản doanh` → 0 match).
- [ ] Namespace `alertCenter.*` present trong CẢ vi.js và en.js (không lệch key).
- [ ] `useLang()` được gọi đúng (context provider có sẵn ở app root).

---

## PHASE 4 — CONTRACT DOC + DEAD CODE CLEANUP (F3-contract tiếp, F12) — Sprint 4 (nhẹ)

### Slice 4.1: Sửa `unified-alert.contract.json` (F5 contract từ audit độc lập)
**File:** `shared/api-contracts/unified-alert.contract.json`
**Changes:** Bỏ `"additionalProperties": false` (hoặc thêm các field backend thực tế trả: `alert_family`, `lane`, `summary`, `executed_at`, `evidence`, `confidence`, `freshness_state`). Giữ `required` nguyên.
**AC:** [ ] Contract khớp `serializers.py:14-18`. [ ] Không đổi backend.

### Slice 4.2: Xóa dead code (F12)
- Xóa `packages/web/src/components/dashboard/UnifiedAlertCenter (1).js` (bản dup).
- Quyết định: giữ `DetailDrawer.module.css`/`SymbolStatsTable.module.css` (Phase 5 sẽ wire) HOẶC xóa nếu Phase 5 dùng `AlertCenterPage.module.css` chung. → Theo roadmap: xóa 2 file này ở Phase 5 (R2).

### Sprint 4 Quality Gates
| Gate | Lệnh | Đạt |
|------|------|----|
| Contract validate | script validate serializer vs contract (nếu có) | PASS |
| Lint / tsc | EXIT 0 |
| Git | Không xóa file đang được import | verify |

### Sprint 4 Audit Checklist
- [ ] `UnifiedAlertCenter (1).js` không được import ở đâu (grep) trước khi xóa.
- [ ] Contract JSON valid (parse được).

---

## PHASE 5 — THEME SYSTEM REFACTOR (R1/R2/R3) — Sprint 5

**Mục tiêu:** AlertCenterPage + 4 component con từ bỏ CSS UI/UX tự chế (`CORE_STYLES` 1053 dòng inline + `--neon-*` riêng + object-literal classNames) → dùng design system chuẩn (`theme.module.css` + `ShellPageTemplate` + token `tokens.css`). Xóa "island" style, hỗ trợ light/dark theme, dễ maintain, đồng bộ với mọi SaaS page khác.

### Slice 5.1: Token alignment (R3)
**File mới:** `packages/web/src/pages/AlertCenterPage.module.css`
**Changes:**
- Không định nghĩa `:root` / `--neon-*` mới. Token đã global qua `index.css:2` `@import "./theme/tokens.css"`.
- Map `--neon-*` → system token (trong `AlertCenterPage.module.css` mới):
  - `--neon-green` → `var(--color-success-500)` (hoặc `--accent-emerald`)
  - `--neon-red` → `var(--color-danger-500)` (hoặc `--accent-rose`)
  - `--neon-orange` → `var(--color-warning-500)` (hoặc `--accent-amber`)
  - `--neon-blue` → `var(--color-info-500)` (hoặc `--accent-cyan`)
  - `--neon-purple` → `var(--color-accent-shell)` (hoặc thêm `--accent-purple`)
- Severity map dùng `socStatusColors.ts` (đã resolve system var): `critical→danger`, `high→warning`, `medium→info`, `low→muted`.

**AC:** [ ] Không còn `--neon-*` nào trong code. [ ] Khi user đổi light theme (UserSettingsPage), AlertCenter tự đổi theo (nhờ global token).

### Slice 5.2: Tạo `AlertCenterPage.module.css` + xóa `CORE_STYLES` (R1)
**Files:** `AlertCenterPage.module.css` (mới, ~150-250 dòng thay 1053), `AlertCenterPage.styles.js` (XÓA), `AlertCenterPage.tsx`
**Changes:**
- Chuyển các class `core-alert-center-*` từ `CORE_STYLES` → `AlertCenterPage.module.css` (CSS Module, scoped).
- `AlertCenterPage.tsx`: xóa `import { CORE_STYLES }`, xóa `<style dangerouslySetInnerHTML>`, thêm `import styles from "./AlertCenterPage.module.css"`. Thay `styles["core-alert-center-page"]` → `styles.page` (đổi tên class theo BEM module).
- Header: dùng `ShellPageChrome` (ShellPageTemplate.js:87) hoặc `.pageHeader`/`.toolbar` chuẩn. Filter input dùng `ShellField`/`.input`. Buttons dùng `.btn`/`.btnPrimary`/`.btnSecondary`.
- Summary cards: dùng `ShellMetric` (ShellPageTemplate.js:12) hoặc `.metric`/`.metricValue`/`.metricLabel`.
- Feed panel / stats panel: dùng `ShellPanel` (line 66) với `title`/`actions` slots.

**AC:**
- [ ] `dangerouslySetInnerHTML` style = 0 trong AlertCenterPage.
- [ ] CSS Module usage: 5/5 component dùng module (page + 4 component).
- [ ] ESLint CSS (stylelint/css-modules) pass (nếu configured).
- [ ] Visual: không lệch layout so với bản cũ (re-baseline snapshot test).

### Slice 5.3: Wire dead `.module.css` (R2)
**Files:** `DetailDrawer.js`, `SymbolStatsTable.js`, `DetailDrawer.module.css`, `SymbolStatsTable.module.css`
**Changes (chọn 1):**
- **Option A (recommend):** Xóa `DetailDrawer.module.css` + `SymbolStatsTable.module.css`. Trong `DetailDrawer.js`/`SymbolStatsTable.js` import `AlertCenterPage.module.css` (shared) hoặc `theme.module.css`/`soc.module.css`. Đổi object-literal classNames (`core-detail-drawer`...) → `styles.xxx` từ module import.
- **Option B:** Giữ 2 file, sửa JS import chúng (`import styles from "./DetailDrawer.module.css"`), xóa object literal.
- Drawer dùng `.drawerOverlay`/`.drawerContent` từ `theme.module.css:267-272` (chuẩn system).

**AC:** [ ] 2 file `.module.css` cũ hoặc được import đúng, hoặc bị xóa (không còn dead code). [ ] DetailDrawer render đúng qua system drawer class.

### Slice 5.4: Severity color consistency (R5)
**Files:** `AlertCard.js`, `SummaryMetrics.js`
**Changes:** Import `socStatusColors.ts` (`getStatusBadgeStyle`/`statusColor`) cho badge severity thay vì `.severity-critical` tự định nghĩa. Map: critical→danger, high→warning, medium→info, low→muted.

**AC:** [ ] Màu severity đồng bộ với SOC/badge system (`theme.module.css` `.badgeDanger`/`.badgeWarning`).

### Sprint 5 Quality Gates
| Gate | Lệnh | Đạt |
|------|------|----|
| Lint / tsc | `npm run lint` + `npx tsc --noEmit` | EXIT 0 |
| Build | `npm run build` | EXIT 0 |
| CSS Module | grep `dangerouslySetInnerHTML` trong AlertCenterPage | 0 match |
| Theme | Toggle light/dark → AlertCenter đổi theme | OK |
| Visual | Snapshot test `tests/visual/alert-center-*.png` re-baseline | Match |

### Sprint 5 Audit Checklist (bắt buộc trước bàn giao)
- [ ] `CORE_STYLES` / `AlertCenterPage.styles.js` đã xóa (không còn import).
- [ ] Không định nghĩa `--neon-*` ở bất kỳ file AlertCenter.
- [ ] `AlertCenterPage.tsx` dùng `ShellPageTemplate`/`ShellPanel`/`ShellMetric`/`ShellField` (hoặc ít nhất class `.pageHeader`/`.toolbar`/`.input`/`.btn*`).
- [ ] `DetailDrawer.js`/`SymbolStatsTable.js` KHÔNG còn object-literal classNames (dùng `styles.xxx` từ module).
- [ ] 2 file `.module.css` cũ: either imported correctly OR deleted (verify không dead).
- [ ] Severity colors qua `socStatusColors.ts` (không hardcode hex).
- [ ] Light theme support: verify `var(--bg-panel)`/`var(--text-primary)` được dùng thay vì màu cứng.
- [ ] Không break i18n (Slice 3) — text vẫn qua `t()`.

---

## TỔNG KẾT ROADMAP (P0 corrected)

| Phase | Sprint | Slice | Findings | Effort | Rủi ro |
|-------|--------|-------|----------|--------|--------|
| 1 | S1 | 1.1-1.3 | F1 (realtime consume) + F3-contract doc | M | Thấp (dùng WS có sẵn) |
| 2 | S2 | 2.1-2.3 | F5 (filter severity/family) | S | Thấp (backend đã support) |
| 3 | S3 | 3.1-3.2 | F3-i18n (namespace) | M | Thấp |
| 4 | S4 | 4.1-4.2 | F5-contract JSON + F12 dead code | S | Thấp |
| 5 | S5 | 5.1-5.4 | R1/R2/R3/R5 (theme system refactor) | M | TB (visual regression, cần re-baseline snapshot) |

**Không thuộc P0 (dời P1/P2 theo audit độc lập):** DetailDrawer enrich chart (F7), Notification UI (F8), bulk ack (F9), sessionDate picker (F11), a11y (F13), SSOT consolidate hook (F14).

---

## PRE-FLIGHT CHECKLIST (áp dụng mọi Sprint trước khi bàn giao)

- [x] `npx tsc --noEmit` EXIT 0 — verified 2026-07-18 (Phase 3-5)
- [x] `npm run lint` EXIT 0 (chỉ warning pre-existing được phép) — verified 2026-07-18
- [x] `npm run build` EXIT 0 — verified 2026-07-18 (còn chunk-size warning pre-existing)
- [x] Không hardcode string VN mới (i18n scan) — tất cả text qua `t()`, namespace `alertCenter` 85 keys (vi/en parity)
- [x] Không đổi REST response shape / backend code (trừ doc) — chỉ sửa `WEBSOCKET_EVENT_CONTRACT.md` + `unified-alert.contract.json`
- [x] Test mới viết cho mỗi slice (unit + component) — `useAlertCenterRealtime.test.js` (6), `useAlertCenterData.test.js` (3) PASS
- [x] WebSocket cleanup verified (unmount → disconnect) — `useAlertCenterRealtime` bọc `useRealtimeFeedCore`
- [x] Fallback polling vẫn hoạt động khi WS disabled — `autoRefresh=false` → chỉ REST
- [x] `CODE_CHANGE_AUDIT_LEDGER.md` được cập nhật với summary thay đổi

---

## CÂU HỎI ĐÃ LÀM RÕ (không cần hỏi lại đội code)

1. **AlertCenterPage có nên dùng `useRealtimeFeedFromManager` không?** → KHÔNG. Phải dùng `useRealtimeFeedCore` trực tiếp (bypass symbol-filter) vì alert-center là global feed (market_discovery), không filter theo symbol cụ thể. (Nuance F1 đã giải thích.)
2. **Có đổi backend không?** → KHÔNG đổi code backend. Chỉ sửa doc (`WEBSOCKET_EVENT_CONTRACT.md`, `unified-alert.contract.json`) + frontend.
3. **`market_discovery_event` có cần backend emit không?** → KHÔNG ở P0. Là dead contract, ghi chú trong doc, dời P2 nếu muốn enrich.
4. **Filter `alert_family` values?** → Dùng exactly backend values: `whale`, `dark_flow`, `price_shock` (SIGNAL+market_anomaly), `stale_quote` (SYSTEM+stale), `signal`, `system`, plus ai-lane `ai_suggest`/`ai_alert`. Verify `views.py:163-176`.
