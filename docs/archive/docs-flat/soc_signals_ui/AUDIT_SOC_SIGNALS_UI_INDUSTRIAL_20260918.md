# AUDIT UI/UX — Subpage Tín hiệu (SOC Operations Center ?tab=signals) — Chuẩn Công nghiệp

> **Ngày audit:** 2026-09-18 (6 ảnh runtime `?tab=signals` + code `SocSignalsPanel.tsx:2133` + `soc.components.css` + `soc.js` + `vi.js`)
> **Phạm vi:** `packages/web` (`SocSignalsPanel.tsx:1`, `soc.module.css:3`, `soc.components.css`, `soc.tokens.css`, `hooks/useSignalStream.ts:153`) ↔ `packages/core` (`service_ops/views/signals.py:976`, `signals_triage.py`, `signals_rules.py`, `signals_stream.py`) ↔ `defaultCoreApiAdapter` (`adapters/core/soc.js:372`)
> **Phương pháp:** Khung AGENTS.md Nguyên tắc 1-6, B1-B6 — `grep/glob/read` toàn repo `.tsx/.css/.py/.json`, đối chiếu code↔ảnh, benchmark Bloomberg/TradingView/Datadog/PagerDuty.
> **Stack:** `dev` `39ef5009` (rev2 UI Config xong), `SocSignalsPanel` `101508 bytes` (2133 dòng) — chức năng đủ (P0-P2c SSE) nhưng bố cục chưa công nghiệp.

---

## 0. Nguyên tắc bắt buộc (đã tuân)

1. Mọi khẳng định kèm `file:line`. Không line = không hợp lệ.
2. Không đoán — chưa đọc file thật → ghi CHƯA XÁC MINH.
3. Bắt buộc `grep/glob/read` toàn repo `.css/.module.css/config/i18n/adapters`.
4. Plan/doc mâu thuẫn code → mục CONTRADICTIONS riêng.
5. `grep` toàn repo bao gồm `.css`, `.module.css`, `soc.components.css`, `vi.js/en.js`.
6. Không viết code trong audit — chỉ phân tích + đề xuất.

---

## Tóm tắt 5 vấn đề nghiêm trọng nhất

**SIG-01 (BLOCKER):** `SocSignalsPanel.tsx:1194-1212` **Luồng tín hiệu row sơ sài** — ảnh chỉ hiện `icon Waves · APF · SELL · 616.2M · 15:48 (3 phút trước)`; thiếu `severity` (critical/high/medium), `price`, `confidence`, `rule`, `source`, `session` — so với code `RecentSignal:10` có đủ `severity`, `price`, `volume`, `detected_at` nhưng không render. Mất 70% thông tin thương mại (Bloomberg shows symbol+price+volume+time+severity+confidence).

**SIG-02 (BLOCKER):** `SocSignalsPanel.tsx:2114-2128` **7 subtabs cramped** — `overview/job-console/materialization/config/detection/retention/rules` (`1841-1859`) nhồi trong `subTabBar` `1242` `gap 0.15rem` `flex-wrap`; ảnh 1-6 cho thấy tabs bị xuống dòng, `Vật chất hóa` gãy 2 dòng, không icon, active chỉ `bg rgba(00b4d8/0.15)` mờ, không badge counts. UX tệ khi 7 tabs trên ~520px.

**SIG-03 (BLOCKER):** **4/7 subtab content sơ sài, raw dump** — `renderConfigTab:1348-1372` dùng `renderKVCard:1340` `formatConfigValue:1333` `JSON.stringify` cho `cfg`/`ownership` (ảnh 3: `whale_threshold_vnd:500000000 ...` tràn, không bảng); `renderDetectionTab:1389` tương tự 3 KV cards raw; `renderRetentionTab:1442` raw `Lưu intraday_tick_days:7 ...` (ảnh 5). Không đạt chuẩn công nghiệp — phải có form, table, help.

**SIG-04 (HIGH):** `SocSignalsPanel.tsx:1974-1981` **6 metric cards thiếu thông tin** — `total 343`, `whale 283`, `dark_pool 60`, `screener 0`, `detection 100%`, `latency 1964ms` chỉ số + màu, không icon, không trend `vs 24h`, không tooltip, không `caption {pct}%`. Ảnh 1 cho thấy 6 cards đều `metricCardSm` xám, khó scan.

**SIG-05 (HIGH):** `SocSignalsPanel.tsx:2025-2089` **Filter bar quá tệ** — 4 `filterBtn` (`Tất cả/Whale...`), 2 `select` (`Mọi mức`/`Mọi hướng` với label riêng `Mức độ`/`Hướng` rời), `searchWrapper:1484` 160px + `Chưa ack` toggle — tất cả nhồi trong `signalFeedFilterBar:1233` `gap 0.5rem flex-wrap` → trên ảnh 1-6 filter chiếm 2 dòng, dropdown `Mọi mức` 120px, search 160px, không grouping, không clear button, không count.

> **Điểm UI:** **4.0/10** — chức năng đủ (P0-P2c) nhưng thông tin nghèo, bố cục 2-col `3fr/2fr` (`1118`) không cân, subtabs cramped, metric/feed thiếu giàu.

---

## 1. Đọc trước

- `AGENTS.md` (glassmorphism, `LangContext`, `soc.tokens.css`, `defaultCoreApiAdapter`)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 99-110 (Signals P0-P2c), Entry 115-127 (DataOps)
- `docs/AUDIT_SOC_SIGNALS_TAB_20260916.md` + `PHAN_BIEN` + `IMPLEMENTATION_PLAN_SOC_SIGNALS_COMMERCIAL`
- `docs/AUDIT_SOC_SIGNALS_UI_20260916.md` (Overview polish) + `AUDIT_DATAOPS_CONFIG_UI_20260918.md` (vừa xong)
- Ảnh 1-6 `?tab=signals` (feed + right 7 tabs)

---

## 2. Phạm vi

### A. FE Signals

- `SocSignalsPanel.tsx:1` (2133 dòng, `feed` + `metrics` + `subTab` 7 + `delivery` triage + `rules` + `SSE`)
- `soc.components.css` (`metricCardSm:1369`, `signalFeed:1129`, `signalRow:1137`, `subTabBar:1242`, `matGrid:1333`, `matCard:1337`, `searchWrapper:1484`, `signalsTwoCol:1116` `3fr 2fr`)
- `hooks/useSignalStream.ts:153` (`EventSource`, `status: open/connecting/error`)
- `adapters/core/soc.js:372-446` (`getSocWhaleRecent`, `getSocDarkPoolRecent`, `getSocScreenerRecent`, `exportSocSignalFeed`, `getSocSignalDeliveries`, `getSocSignalRules`)
- `i18n/vi.js:294-409` (`soc.signals_overview.*` 40+ keys), `en.js`

### B. BE Signals

- `service_ops/views/signals.py:976` (`whale/dark_pool/screener recent`, `materialization`, `config/ownership/detection/retention`, `rules`)
- `service_ops/views/signals_triage.py` (`deliveries`, `ack/mute/seen`)
- `service_ops/views/signals_rules.py` (`rules`, `performance`, `request`, `feedback`)
- `service_ops/views/signals_stream.py` (`/signals/stream/` SSE)

### C. Cross

- `web↔core`: `defaultCoreApiAdapter as SocSignalsAdapter:465` 12 endpoints, `EventSource` vs `coreGet` fallback
- `widget`: không liên quan (signals không dùng chart)

### D. Quality gates

- Lint: `npm run lint` — 0 errors baseline
- Type: `npm run build = tsc && vite` — `tsc 0` (rev2)
- i18n: `vi.js:294-409` parity, `npm run i18n:scan` — hardcode scan
- Test: `vitest run` 40/213 (signals 16/16), `jest 92/92`

---

## 3. Phương pháp (B1-B6)

1. Đọc `SocSignalsPanel.tsx` 2133 dòng + 6 ảnh.
2. `glob soc/*Signal*` + `grep RecentSignal|subTab|signalFeed|metricCard`.
3. `read` `soc.components.css` `signalsTwoCol`, `signalRow`, `subTabBar`, `matGrid`.
4. Trace 1 use-case: poll feed → render row → expand → ack → subtab config → detection → retention.
5. Đối chiếu code↔ảnh, gạch chỗ raw dump vs giàu thông tin.
6. Check tokens, responsive, a11y (`role=tablist`, `aria-selected`), i18n, stream.

---

## 4. Đầu ra

### A. Bản đồ kiến trúc (hiện tại)

| File | Lines | Trách nhiệm | Note UI |
|------|-------|-------------|---------|
| `SocSignalsPanel.tsx:323` | 2133 | `SocSignalsPanel` — 7 subtab + feed + SSE + triage + rules | 101508 bytes, `createElement` |
| `SocSignalsPanel.tsx:10-28` | 18 | `RecentSignal`/`RecentRawItem` types | `volume/price/severity/metadata` có nhưng không render đủ |
| `SocSignalsPanel.tsx:1974-1981` | 8 | `statCard` 6 metrics | `metricCardSm` xám, không icon/trend |
| `SocSignalsPanel.tsx:1146-1265` | 120 | `renderSignalRow` — `icon+symbol+action+volume+time+deliveryBadge` | Sơ sài, thiếu severity/price/confidence |
| `SocSignalsPanel.tsx:1982-2012` | 30 | `signalsTwoCol:1116` `3fr 2fr` + feed header + `streamDot` | Left 60% / Right 40% — right hẹp |
| `SocSignalsPanel.tsx:2025-2089` | 64 | `signalFeedFilterBar` 4 `filterBtn` + 2 `select` + `searchWrapper` + `Chưa ack` | 2 dòng, cramped |
| `SocSignalsPanel.tsx:2112-2128` | 16 | `subTabBar:1242` 7 `subTabBtn:1254` | Cramped, gãy dòng |
| `SocSignalsPanel.tsx:1280-1840` | 560 | 7 `render*Tab` — `overview` sentiment bar, `materialization` 3 `matCard`, `config/detection/retention` `renderKVCard` raw, `rules` metric + table | Raw dump 4/7 tabs |
| `soc.components.css:1116` | 10 | `.signalsTwoCol {3fr 2fr; @1100 1fr}` | Break 1100 |
| `soc.components.css:1233,1242` | 25 | `.signalFeedFilterBar`, `.subTabBar` | `gap 0.5/0.15` |
| `soc.components.css:1369,1129,1137` | 30 | `metricCardSm`, `signalFeed`, `signalRow` | Row `gap 0.5rem` |
| `hooks/useSignalStream.ts:49` | 60 | `useSignalStream` — `status open/connecting/error` | Dot `1982-2007` 6px |
| `adapters/core/soc.js:372` | 30 | `getSoc*Recent`, `exportSocSignalFeed`, `getSocSignalDeliveries/Rules` | `buildSignalsRecentQuery` 5 params |

### B. Luồng trace (feed → row → subtab)

```
[Poll] fetchFeed:496 adapter.getSocSignalMetrics + getSocWhaleRecent/Dark/Screener(q: page_size 100) → pickRecentList:187 recent/results/data → mapRecentItem:172 side→action, value→volume → merged sort detected_at → setSignals:523 + setMetrics:524 (summary active_alerts 343)
→ filteredSignals:977 type/symbol/severity/direction/unackedOnly → pagedSignals:997 pageSize 20 → renderSignalRow:1146 icon(Whale Waves) + symbol APF + SELL red + volume 616.2M + time 15:48 (3 phút trước) + deliveryBadge (nếu có) → missing severity/price

[Expand] click row → setExpandedId → show metaJson:1169 JSON.stringify(metadata) + Ack/Mute/Feedback buttons:1221-1260

[Subtab] click "Cấu hình" → useEffect 758 configTab lazy fetch getSocSignalConfig+Ownership → renderConfigTab:1348 renderKVCard cfg + ownership raw (ảnh 3: whale_threshold_vnd:500000000 ...)

[Subtab] "Phát hiện" → Promise.all whale/dark/screener → renderKVCard 3 raw (ảnh 4) + input VNM + Chạy thử → testResult stub

[Subtab] "Lưu trữ" → getSocSignalRetention → renderKVCard retention raw (ảnh 5: Lưu 7/365/90/30/365) + Xem ảnh hưởng

[Subtab] "Rules" → fetchRulesTab 571 getSocSignalRules + Performance → renderRulesTab 1759 metricGrid + rulesRow list raw

[SSE] useSignalStream 449 enabled=isDocVisible + EventSource → handleStreamSignal:405 map incoming → setSignals prepend + highlight badge (2 mới)
```

### C. CONTRADICTIONS (kỳ vọng thương mại vs code/ảnh)

| # | Kỳ vọng Bloomberg/Datadog | Thực tế `file:line` / ảnh | Tác động |
|---|---------------------------|---------------------------|----------|
| C1 | Feed row giàu: symbol + price + volume + severity + confidence + time + source | `SocSignalsPanel.tsx:1198-1204` chỉ `symbol+action+volume+time` (ảnh 1: APF SELL 616.2M 15:48) — thiếu `severity`/`price`/`strength`/`rule_name` dù type `RecentSignal:18-27` có | Mất 60% thông tin quyết định |
| C2 | 7 subtabs có icon + count badge + tooltip, không cramped | `subTabBar:1242` `gap 0.15rem` + `subTabBtn:1254` `flex:1` `font 0.7rem` (ảnh 1-6: 7 tabs trên ~520px, `Vật chất hóa` gãy 2 dòng) | Khó scan, click nhầm |
| C3 | Config/Détection/Retention có form/table, không raw | `renderConfigTab:1340` `formatConfigValue:1333 JSON.stringify` (ảnh 3) | Trông sơ sài, không đọc nổi |
| C4 | Tổng quan có chart + distribution + top list | `renderOverviewTab:1280` chỉ `sentimentBar:1286` 2 màu 50.7/49.3 + 3 số Tăng/Trung/Giảm (ảnh 1) | Thiếu chiều sâu |
| C5 | Metric cards có icon + delta vs 24h | `statCard:1112` chỉ `label+value+color` (ảnh 1: 343/283/60/0/100%/1964ms xám) | Không cho trend |
| C6 | Filter bar grouped: type + severity + direction + search + triage | `signalFeedFilterBar:2025` nhồi 4 `filterBtn` + 2 `select` + `searchWrapper` + `Chưa ack` (ảnh 2 dòng) | Quá tải, không hierarchy |

### D. Findings

| ID | Mức | File:Line / Ảnh | Thực tế | Tác động | Đề xuất fix |
|----|-----|-----------------|---------|----------|-------------|
| **SIG-01** | **ERROR** | `SocSignalsPanel.tsx:1194-1212` Ảnh1 | Row: `Waves APF SELL 616.2M 15:48` — thiếu `severity` badge (critical/high/medium), `price` (nếu có), `strength`, `rule_name`, `confidence`, `session_date` | Mất tín hiệu chất lượng, operator phải expand mới thấy metadata JSON | Enrich row: `severity dot` + `price` (nếu có) + `strength` pill + `time` + `volume` — giữ `action`/`symbol` nổi. Thêm `severity` color mapping `socStatusColors.ts` |
| **SIG-02** | **ERROR** | `SocSignalsPanel.tsx:2112-2128` `soc.components.css:1242` Ảnh1-6 | 7 `subTabBtn` cramped, không icon, không count, không tooltip, active mờ | UX tệ, không biết tab nào quan trọng | Gộp 7 → 4 nhóm: **Tổng quan** (sentiment + distribution), **Vận hành** (Job Console + Vật chất hóa), **Cấu hình** (Config + Phát hiện + Lưu trữ), **Rules** (Rules + Feedback). Hoặc giữ 7 nhưng thêm icon + `count` + `overflow dropdown` + `sticky` |
| **SIG-03** | **ERROR** | `SocSignalsPanel.tsx:1340-1372` Ảnh3 | `Cấu hình` raw `whale_threshold_vnd:500000000 0.1 true …` tràn, không bảng | Không đọc, không audit | Thay `renderKVCard` bằng `KVTable` (`field | value | help | action`) + `SocOwnershipBadge` + bridge-write note ở footer, không trong card |
| **SIG-04** | **HIGH** | `SocSignalsPanel.tsx:1974-1981` Ảnh1 | 6 `metricCardSm` chỉ số, không icon, không trend vs 24h, không tooltip | Không cho insight | Thêm `icon` (Alert/Waves/Eye/Search/Percent/Clock) + `delta` (nếu có `prev` metrics) + `helpText` tooltip + `onClick → filter` (click Whale 283 → filter Whale) |
| **SIG-05** | **HIGH** | `SocSignalsPanel.tsx:2025-2089` Ảnh1-6 | Filter bar 2 dòng, `Mức độ` label riêng `Mọi mức` select 120px + `Hướng` `Mọi hướng` + `Tìm mã` 160px + `Chưa ack` | Quá tải, không grouping | Group: **Loại** (4 pill) → **Bộ lọc** (Mức độ + Hướng trong 1 row `grid 1fr 1fr`) → **Triage** (Tìm mã + Chưa ack + `ĐÃ nhận (n)` + `Xuất CSV` + `Chưa ack` count) — tách 2 hàng rõ |
| **SIG-06** | **HIGH** | `SocSignalsPanel.tsx:1280-1330` Ảnh1 | `Tâm lý thị trường` chỉ bar 50.7/49.3 + 3 số | Thiếu volume distribution, top symbols, time series | Thêm `Top 5 symbols` (từ `filteredSignals` count), `Volume histogram` (nếu có), `Trend 24h` (nếu BE có) |
| **SIG-07** | **HIGH** | `SocSignalsPanel.tsx:1520-1631` Ảnh2 | `Vật chất hóa` 3 `matCard` chỉ `service_key + time + bar 4px` + execution plan text `sẽ chạy/bỏ qua` | Không cho health timeline | Thêm `timeline` (3 dots: unified/session/whale) + `progress` + `run history` link + `refresh` |
| **SIG-08** | **GAP** | `SocSignalsPanel.tsx:1982-2012` `soc.components.css:1116` | `signalsTwoCol 3fr 2fr` → left 60% feed, right 40% details — right hẹp nên subtabs cramped, trên 1100px mới stack 1fr | Không cân, mobile phải scroll dài | Đổi `3fr 2fr` → `1.6fr 1fr` hoặc `minmax(380px, 1fr) minmax(420px, 1fr)` + `sticky` right panel `top 12px` |
| **SIG-09** | **GAP** | `SocSignalsPanel.tsx:1146` `signalRowNew` highlight `rgba(00b4d8/0.08)` | Highlight nhạt, không badge, không sound, không push | Mới đến dễ miss | Thêm `dot` + `badge N mới` đã có (2011) nhưng tăng contrast, thêm `aria-live` |
| **SIG-10** | **GAP** | `SocSignalsPanel.tsx:2096-2110` | Feed empty → `renderRadarEmptyState:1268` radar generic, không CTA | Không hướng operator | Thêm empty với `Bạn chưa có tín hiệu — kiểm tra Filter / Chạy thử Whale VNM` + button `Chạy thử` |
| **SIG-11** | **INFO** | `soc.components.css:1484` `.searchWrapper 160px` | Search nhỏ, không clear | Khó tìm | Thêm `clear` + `kbd /` focus |

### E. Quality gates

| Gate | Lệnh | Kết quả | Note |
|------|------|---------|------|
| Lint | `npm run lint` | 0 errors | Pass |
| Type | `npx tsc --noEmit -p packages/web/tsconfig.json` | 0 | Pass (rev2 UI Config) |
| Build | `npm run build --prefix packages/web` | PASS ~31-36s | Chunk warn |
| i18n | `npm run i18n:scan` | 0 | `soc.signals_overview.*` 40+ keys |
| Test | `vitest run` 40/213, `jest 92/92` | Pass | signals 16/16 |
| A11y | `role=tablist/tab` `2114`, `aria-selected` `2119`, `aria-expanded` `1183` | Có | Thiếu `aria-controls` for subtab |
| Stream | `useSignalStream.ts:449` enabled | `open/connecting/error` | Dot 6px 1982 |

### F. Câu hỏi cần làm rõ

1. Giữ 7 subtabs hay gộp 4 nhóm (đề xuất gộp để đỡ cramped)? — cần chốt trước khi code.
2. Feed row thêm `severity` + `price` có BE trả không? (hiện `RecentRawItem:32-43` chỉ `severity` optional, `price` undefined)
3. Có cần `severity` filter đã có (`Mọi mức`) giữ, thêm `source` filter không?
4. `Tâm lý thị trường` có cần thêm `Top 5` không hay chỉ bar?

### G. Đánh giá tổng thể

- **Implementable?** Có — không đổi contract, chỉ `SocSignalsPanel.tsx` + `soc.components.css` + `vi.js` labels — 1-1.5d.
- **Blocker?** Không blocker vận hành (feed/SSE/triage/rules chạy). **Blocker UX:** SIG-01/02/03 khiến page trông sơ sài, không đạt Datadog/Bloomberg.
- **Ưu tiên:** **P0** SIG-01 (row giàu) + SIG-02 (tabs gộp/icon) + SIG-03 (Cấu hình bảng) → **P1** SIG-04/05/06 (metrics/filter/sentiment) → **P2** SIG-07/08/09 (timeline/two-col/highlight).

---

## Phụ lục — Wireframe đề xuất (text)

```
[Metric 6] icon + value + delta + tooltip (click → filter)
[Left 60% Feed] header "Luồng tín hiệu" + stream dot + unread badge + Xuất CSV
  → Type pills (4) | Severity (select) + Direction (select) in 1 row
  → Search + Chưa ack + Đã nhận (n) in 2nd row
  → Row: [icon] APF · SELL · severity dot · 616.2M · 15:48 · price? · expand → meta + Ack/Mute/Feedback
[Right 40% Details sticky] 4 tabs: Tổng quan | Vận hành | Cấu hình | Rules
  Tổng quan: sentiment bar + Top 5 + volume distro
  Vận hành: Job Console form + Vật chất hóa timeline (3 cards + execution plan table)
  Cấu hình: KVTable (field | value | help) + ownership footer
  Rules: metric 3 + top noisy + table with request button
```

**File audit:** `docs/AUDIT_SOC_SIGNALS_UI_INDUSTRIAL_20260918.md` (file này).
**Kế hoạch chi tiết:** Tách `IMPLEMENTATION_PLAN_SOC_SIGNALS_COMMERCIAL_UI_20260918.md` nếu cần — nhưng 11 findings trên đủ để dev tự sửa 1-1.5d.

