# AUDIT Dashboard `http://localhost/dashboard` — Chuẩn Thương mại (2026-09-10)

**Ngày:** 2026-09-10  
**Phạm vi:** `packages/web/src/pages/DashboardPage.tsx:429` + `features/dashboard/useCoreDashboardData.js:225` + `components/dashboard/SmartStatsHeader.js:172` + `PortfolioHeatmap.js:495` + `UnifiedAlertCenter.js:490` + `CoreDashboardPositionDeck.tsx:494` + `features/dashboard/AIAdvisorAlertPanel.js:280` + `hooks/useRealtimeFeedCore.js:1256` + `context/RealtimeContext.js:197` + `hooks/useAlertCenterSnapshot.ts:112` + `adapters/core/market.js:541` + `utils/dashboardSymbols.js:19`  
**Chuẩn đối chiếu:** `AGENTS.md:6` SOC glassmorphism, `soc.module.css`, i18n `LangContext`, `defaultCoreApiAdapter`, khung audit 6 nguyên tắc  
**Loại:** Chỉ nghiên cứu — không code

---

## 0. Nguyên tắc bắt buộc (đã tuân thủ)
1. file:line, 2. CHƯA XÁC MINH nếu chưa đọc, 3. grep/glob/read, 4. CONTRADICTIONS, 5. quét CSS/config/i18n, 6. không viết code

---

## 1. Đọc trước
- `AGENTS.md:1-160`, `CODE_CHANGE_AUDIT_LEDGER.md:Entry 38-40`, `AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md:1-231` (20 findings cũ), `AUDIT_DASHBOARD_ALERT_REALTIME_20260908.md` (11 findings)

---

## 2. Phạm vi
- **A Dashboard orchestrator:** `DashboardPage.tsx:429` triad + deck
- **B Realtime:** `useRealtimeFeedCore.js:1256` + `RealtimeContext.js:197` + `useAlertCenterRealtime.js:50`
- **C Data:** `useCoreDashboardData.js:225` + `dashboardSymbols.js:19` + `market.js:541`
- **D Quality:** `tsc+build`, `i18n`, `test`, widget coupling

---

## 3. Phương pháp
B1 đọc docs cũ, B2 glob dashboard/*, B3 grep `market_discovery|getPortfolioAnalytics|collectUniqueSortedSymbols`, B4 read 12 file, trace portfolioId→holdings→symbols→realtime→mergedAlerts→breadth→heatmap, B5 đối chiếu, B6 gates

---

## 4. Đầu ra

### 4.1 Tóm tắt 5 lỗi nghiêm trọng nhất
1. **P0 poll rác `MARKET_DISCOVERY`** `RealtimeContext.js:14` + `DashboardPage.tsx:179` + `useRealtimeFeedCore.js:330` — vẫn còn, mỗi 10s poll `symbols=MARKET_DISCOVERY`
2. **P1 dedup sai key** `DashboardPage.tsx:252` `a.id || symbol-ts` bỏ `alert_id/event_id` — lệch BE `broadcasting.py:108` `alert_id`
3. **P1 breadth sai** `DashboardPage.tsx:193` `change_value ?? change_pct ?? change` không normalize fraction 0.01 vs 1% — flat sai
4. **P2 no ErrorBoundary per lane** `DashboardPage.tsx:328-424` — 1 lane crash sập cả triad
5. **P2 watchlistGroups hardcode `[]`** `useCoreDashboardData.js:160` — technicals thiếu mã groups

### 4.2 Bản đồ kiến trúc
| File | L | Trách nhiệm | Note |
|---|---|---|---|
| `DashboardPage.tsx:429` | 429 | Orchestrator triad+deck | 5-step memo, breadth, heatmap, alerts merge |
| `useCoreDashboardData.js:225` | 225 | Phase1 6 fetch + Phase2 bulk | `watchlistGroups:[]` hardcode :160 |
| `SmartStatsHeader.js:172` | 172 | Header marketValue/PNL/breadth | Trước có async IIFE bug — nay đã fix? CHƯA XÁC MINH file mới |
| `PortfolioHeatmap.js:495` | 495 | ECharts treemap | fallback 1 đã fix |
| `UnifiedAlertCenter.js:490` | 490 | Alert bento | filter client+server chồng |
| `CoreDashboardPositionDeck.tsx:494` | 494 | Deck 4 tabs | thiếu virtualize |
| `AIAdvisorAlertPanel.js:280` | 280 | AI lane | props ma trước — nay? CHƯA XÁC MINH |
| `useRealtimeFeedCore.js:1256` | 1256 | WS+poll hybrid | market_discovery bug, heartbeat 10s gắt |
| `RealtimeContext.js:197` | 197 | Singleton manager | pollInterval min vs maxAlerts max |
| `useAlertCenterSnapshot.ts:112` | 112 | Poll 20 cursor | off-by-one trước hạ P3 — cần test |
| `market.js:541` | 541 | Market client | `getRealtimeTickers` |
| `dashboardSymbols.js:19` | 19 | Collect `\|` join | lệch `,` vs `\|` |

### 4.3 Luồng trace (portfolio X)
`DashboardPage:122` `activePortfolioId` → `useCoreDashboardData:106` 6 fetch → `dashboardSymbols:37` `watchlistGroups:[]` hardcode → `getBulkTechnicals:312` → `DashboardPage:176` `collectUniqueSortedSymbols` → `symbols` `market_discovery` fallback → `useRealtimeFeedFromManager:181` + `useAlertCenterRealtime:182` (bypass) → `useAlertCenterSnapshot:167` poll 20 → `mergedQuotes:185` → `calculatedBreadth:188` raw change → `heatmapSymbols:209` → `mergedAlerts:245` dedup `id` → `filteredUnifiedAlerts:265` → render 3 lane + deck → `fetchDigest:143` global `getPortfolioNewsDigest` no portfolioId

### 4.4 CONTRADICTIONS
| # | Plan/Doc | Code | Impact |
|---|---|---|---|
| C01 | `AUDIT_DASHBOARD_COMMERCIAL_GRADE: C01` SOC tokens | `DashboardPage` `core-dashboard-skeleton` not soc tokens | Vi phạm AGENTS.md |
| C02 | `useCoreDashboardData:160` hardcode `[]` vs comment keep all | Code hardcode | technicals thiếu |
| C03 | `DashboardPage:389` 7 props → AIAdvisorAlertPanel:105 `({className})` | CHƯA XÁC MINH sau reset | Nếu còn thì SSOT sai |
| C04 | `market_discovery` poll bug `AUDIT_ALERT_CENTER:69` | `useRealtimeFeedCore:330` còn | Poll rác |

### 4.5 Findings
| ID | Mức | file:line | Thực tế | Tác động | Fix |
|---|---|---|---|---|---|
| F01 | P0 | `DashboardPage:179` + `useRealtimeFeedCore:330` | `market_discovery` vào poll | Poll rác `GET tickers?symbols=MARKET_DISCOVERY` | Filter trước poll, WS giữ riêng |
| F02 | P1 | `DashboardPage:252` | dedup `a.id \|\| symbol-ts` | Trùng lặp khi BE `alert_id` | `alert_id \|\| event_id \|\| id` |
| F03 | P1 | `DashboardPage:193` | `change_value ?? change_pct` raw | Breadth flat sai 0.01 | Reuse `normalizeChangePct` |
| F04 | P1 | `DashboardPage:302-310` | autoSelectedRef not reset on portfolioId change | Highlight sai | Reset on portfolioId change |
| F05 | P2 | `DashboardPage:328-424` | no per-lane ErrorBoundary | 1 lane sập cả | Wrap each lane |
| F06 | P2 | `useCoreDashboardData:160` | `watchlistGroups:[]` | Heatmap universe thiếu | Truyền `watchlistGroups` thật |
| F07 | P2 | `DashboardPage:143` | `getPortfolioNewsDigest()` no portfolioId | Digest global | Truyền portfolioId |
| F08 | P2 | `useRealtimeFeedCore:1021` | heartbeat 10s | WS live force close offhours | Tăng 30s, gate market_phase |
| F09 | P3 | `DashboardPage` vs `dashboardSymbols:18` | join `\|` vs `,` | Encode lệch | Chuẩn hóa string[] |

### 4.6 Quality Gates
- **tsc:** CHƯA CHẠY (sau reset cần chạy) — trước `b8a7fff5` là PASS 0
- **build:** CHƯA CHẠY — trước 3623 modules, index 2.1MB
- **i18n:** local I18N dict in 4 files — cần xóa, chuyển `useI18n`
- **test:** `DashboardPage.breadth-dedup 5 tests` + `useAlertCenterSnapshot pagination 2 tests` — thiếu E2E triad

### 4.7 Đề xuất roadmap (3 phase, 12 ngày như cũ)
- **Phase 0 hotfix (1d):** F01 poll filter + F02 dedup + F03 breadth
- **Phase 1 UX (5d):** F05 ErrorBoundary + F06 watchlistGroups + F07 digest + i18n
- **Phase 2 perf (5d):** split echarts, virtualize deck, heartbeat tune, Cmd+K global cho Dashboard

### 4.8 Câu hỏi
- AIAdvisorAlertPanel scope theo universe hay global? (như tenant-admin Q2)
- WatchlistGroups có đưa vào universe không? (C02)
- market_discovery có giữ cho WS không? (F01)
