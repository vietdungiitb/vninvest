# SCREENER SAAS NATIVE — AUDIT & UPGRADE PLAN (2026-07-10)

**Ngay tao**: 2026-07-10
**Pham vi**: Full-stack Screener feature — audit tinh trang hien tai, phan tich feature gap, va ke hoach nang cap
**Level**: A (Major — backend broken, UI gaps, missing commercial-grade features)
**Trang thai**: READY FOR REVIEW

---

## 1. Executive Summary

Screener feature (Bo loc co phieu) da duoc port tu legacy (`frontend/`) sang SaaS native (`packages/web/`) nhung **hien tai khong hoat dong duoc**. Backend API tra ve 404/empty stub, SOC panel thieu rule CRUD modal, type declarations mau thuan, va missing route catalog entries. Ngoai ra, tinh nang con thieu so voi cac san pham thuong mai noi bat nhu TradingView, Finviz, StockRover, TrendSpider.

**Tong ket tinh trang**:

| Phan | Hoan thanh | Muc do nghiem trong |
|------|-----------|---------------------|
| Backend URL routing | 0% | CRITICAL — 404 het |
| User ScreenerPage.tsx | ~70% | HIGH — UI co, API khong |
| SOC SocScreenerPanel.tsx | ~60% | HIGH — thieu rule CRUD |
| Type safety | ~30% | MEDIUM — `as any` tràn lan |
| Route/Nav catalog | 0% | MEDIUM — missing entries |
| i18n | ~90% | LOW — 1 typo key |
| Feature parity vs legacy | ~60% | HIGH — thieu nhieu tinh nang |
| Feature parity vs commercial | ~25% | HIGH — thieu presets, export, alerts, scheduling |

---

## 2. Hien Trang Chi Tiet (Current State Assessment)

### 2.1 Backend — CRITICAL: API Routes Not Mapped

**Problem**: `ScreenerRuleListCreateAPIView` (user-facing CRUD) duoc dinh nghia trong `portfolio_analytics_views.py` nhung **khong import va khong map trong `user_workspace/urls.py`**.

**Impact**:
- `GET /api/portfolio/screener/rules/` → 404 Not Found
- `POST /api/portfolio/screener/rules/` → 404 Not Found
- `PUT /api/portfolio/screener/rules/{id}/` → 404 Not Found
- `DELETE /api/portfolio/screener/rules/{id}/` → 404 Not Found
- `POST /api/portfolio/screener/rules/{id}/run/` → 404 Not Found

**Backend files affected**:
- `packages/core/backend/src/user_workspace/urls.py` — missing URL patterns
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py:1278-1441` — views exist but unreachable

**SOC Admin API** (OK): `service_ops/views/screener.py` (581 lines) — 10 DRF views hoat dong binh thuong duoi `/api/soc/screener/`.

### 2.2 Frontend — User ScreenerPage.tsx (533 lines)

**Hoan thanh**: ~70%

| Feature | Legacy | SaaS Native | Status |
|---------|--------|-------------|--------|
| Rule CRUD | Full | Full | OK |
| Rule Builder (multi-condition AND) | Full | Full | OK |
| 13 technical fields | Full | Full | OK |
| 5 comparison operators | Full | Full | OK |
| On-demand scanning | Full | Full | OK |
| Results table (10 columns) | Full | Full | OK |
| Color-coded results | Full | Full | OK |
| Symbol links | Full | Full | OK |
| Loading/Empty states | Full | Full | OK |
| Error handling | Full | Full (but uses `window.confirm`) | PARTIAL |
| Rule presets/templates | None | None | MISSING |
| Scheduled scans | None | None | MISSING |
| Export CSV/Excel | None | None | MISSING |
| Pagination (results) | None | None | MISSING |
| Column customization | None | None | MISSING |
| Share/clone rules | None | None | MISSING |

**Technical debt**:
- `(coreApiAdapter as any)` cast 5 lan — khong type safety
- `window.confirm()` cho delete — UX kem
- Khong co error boundary

### 2.3 Frontend — SOC SocScreenerPanel.tsx (344 lines)

**Hoan thanh**: ~60%

| Feature | Legacy | SaaS Native | Status |
|---------|--------|-------------|--------|
| Config view/edit | Grid of 5 inputs | Raw JSON textarea | REGRESSION |
| Config preview modal | Diff + warnings | Basic diff only | PARTIAL |
| Global rule CRUD | Full (create/edit/delete modal) | Delete only | CRITICAL GAP |
| Rule type selector | 9 types dropdown | None | MISSING |
| Rule enable/disable | Toggle checkbox | None | MISSING |
| Rules pagination | 10/page | None | LOW |
| Manual scan | Full | Full | OK |
| Results display | Full table | Top 20 scrollable | PARTIAL |
| Alerts display | Full table | Top 10 scrollable | PARTIAL |
| Metrics | 2 cards | 2 cards | OK |
| Error feedback | Inline messages | `alert()` | REGRESSION |
| i18n | Correct keys | Typo: `screenter` | BUG |

### 2.4 Type Declarations — CONFLICTING

| File | Declares | Model |
|------|----------|-------|
| `coreApiAdapter.d.ts:115-121` | `getScreenerPresets`, `createScreenerPreset`... | "Presets" model |
| `declarations.d.ts:32-37` | `getScreenerRules`, `createScreenerRule`... | "Rules" model |
| Runtime (`workspace.js`) | `getScreenerRules`... | "Rules" model |

**Problem**: 3 different interfaces. Main `.d.ts` says "presets", augmentation says "rules", runtime uses "rules".

### 2.5 Route/Nav Catalog — MISSING

- `routeCatalog.js` — khong co screener entry
- `navigationCatalog.js` — khong co screener entry
- Screener chi hoat dong vi `main.tsx` hardcode route + `sidebaritems.ts` co nav item
- Khong the filter by build target hay capability

### 2.6 i18n — MINOR

- `SocScreenerPanel.tsx:121` — `t("soc.screenter.scan_started")` typo "screenter" thay vi "screener"
- Key `scan_started` khong ton tai trong i18n files
- Con lai ~96 keys hoat dong binh thuong

---

## 3. Phan Tich Feature Gap — Commercial Platform Comparison

### 3.1 Benchmark Platforms

| Platform | Strength | Price | Screener Fields | Unique Feature |
|----------|----------|-------|-----------------|----------------|
| **TradingView** | Social charting + screener | Free/$12-60/mo | 100+ technical+fundamental | Custom Pine Script filters, community screens |
| **Finviz** | Visual screening | Free/$39.50/mo | 60+ filters | Heat maps, insider trading, backtesting |
| **StockRover** | Deep fundamentals | Free/$7.95/mo | 550+ metrics | 10-year financials, research reports, portfolio mgmt |
| **TrendSpider** | AI pattern recognition | $39-79/mo | Technical + AI | Auto trendlines, candlestick detection, backtesting |
| **Trade Ideas** | AI day trading | $84-167/mo | 500+ | Holly AI assistant, real-time scanning, sim trading |
| **MarketInOut** | Formula-based | $24-49/mo | 40+ exchanges | 25-year backtesting, custom formulas |
| **Yahoo Finance** | Free basic | Free | 20+ | Popular pre-built screens, community |
| **StockAnalysis** | Clean free screener | Free | 30+ | Export, watchlist integration |

### 3.2 Feature Gap Matrix — VNInvest vs Commercial

| Feature Category | VNInvest Current | TradingView | Finviz | StockRover | Priority |
|-----------------|------------------|-------------|--------|------------|----------|
| **Basic Screening** | | | | | |
| Technical indicators (RSI, SMA, MACD) | 5 indicators | 100+ | 30+ | 550+ | P1 — expand |
| Fundamental filters (PE, EPS, Dividend) | None | Yes | Yes | Yes | P2 — add |
| Volume/liquidity filters | RVOL only | Yes | Yes | Yes | P1 — expand |
| Whale/dark pool filters | Yes (unique!) | No | No | No | P0 — keep |
| Custom field builder | No | Pine Script | No | Formula | P3 — future |
| **UI/UX** | | | | | |
| Multi-condition builder | AND only | AND/OR/NOT | AND/OR/NOT | AND/OR | P1 — expand |
| Real-time result count | No | Yes | No | Yes | P2 — add |
| Column customization | Fixed 10 cols | Full | Full | Full | P1 — add |
| Inline chart preview | No | Yes | Thumbnail | Sparklines | P2 — add |
| Sort by any column | No | Yes | Yes | Yes | P1 — add |
| **Persistence & Collaboration** | | | | | |
| Save screening rules | Yes | Yes (Pine) | Yes | Yes | OK |
| Pre-built templates | No | Community | 30+ | 30+ | P1 — add |
| Share screens | No | Yes | URL sharing | Team sharing | P2 — add |
| Export CSV/Excel | No | Yes | Yes (Elite) | Yes | P1 — add |
| **Automation** | | | | | |
| Scheduled scanning | No | Yes (alerts) | Yes (Elite) | Yes | P2 — add |
| Real-time alerts | SOC only | Yes | Yes (Elite) | Yes | P2 — add |
| Email/webhook notifications | No | Yes | Yes (Elite) | Yes | P3 — future |
| **Analytics** | | | | | |
| Backtesting | No | Yes (Strategy Tester) | Yes | Yes | P3 — future |
| AI scoring | Planned (2026-04-25 plan) | No | No | No | P1 — implement |
| Heat map visualization | Portfolio only | Yes | Yes | No | P2 — add |
| Performance metrics | SOC only | No | No | No | OK |

### 3.3 VNInvest Unique Strengths (vs Commercial)

1. **Whale/Dark Pool screening** — khong co platform nao co tinh nang nay
2. **AI Advisory scoring 0-100** — da plan, chua implement (unique)
3. **SOC admin panel** — enterprise-grade monitoring/management
4. **Multi-tenant isolation** — SaaS-ready
5. **Vietnamese market focus** — CHUNG KHOAN VIET NAM

---

## 4. Ke Hoach Nang Cap (Upgrade Plan)

### 4.1 Phase 0 — Backend URL Fix + Type Cleanup (CRITICAL, 1-2 ngay)

**Muc tieu**: Screener co the hoat dong co ban — CRUD rules va run screening.

**Tasks**:
1. **Fix backend URL routing** (`user_workspace/urls.py`)
   - Import `ScreenerRuleListCreateAPIView`, `ScreenerRuleDetailView`, `ScreenerRuleRunView`
   - Map URL patterns: `screener/rules/`, `screener/rules/<int:pk>/`, `screener/rules/<int:pk>/run/`
   - Verify with `python manage.py show_urls | grep screener`

2. **Fix type declarations**
   - Align `coreApiAdapter.d.ts` voi `declarations.d.ts` — dung "Rules" model
   - Remove `(coreApiAdapter as any)` casts trong `ScreenerPage.tsx`
   - Add SOC screener methods to `coreApiAdapter.d.ts`

3. **Fix i18n typo**
   - `SocScreenerPanel.tsx:121` — `screenter` → `screener`
   - Add missing key `soc.screener.scan_started` to vi.js + en.js

4. **Add route catalog entries**
   - Add screener to `routeCatalog.js`
   - Add screener to `navigationCatalog.js`

**Exit Criteria**:
- `npx tsc --noEmit` pass
- `npm run build` pass
- CRUD + Run screener hoat dong tren SaaS native UI
- Backend test `test_screener_rule_crud.py` pass

### 4.2 Phase 1 — Legacy Parity (5-7 ngay)

**Muc tieu**: Dat duong feature parity voi legacy + fix SOC panel gaps.

#### 1A. SOC Panel Rule CRUD Modal (2-3 ngay)
- Tao `SocScreenerRuleModal.tsx` voi:
  - Rule name input
  - Rule type selector (9 types: `price_change_pct`, `volume_spike_ratio`, `cvd_threshold`, `whale_count`, `dark_pool_ratio`, `rsi_level`, `ma_cross`, `bollinger_band_break`, `custom`)
  - JSON value editor voi syntax highlighting
  - Enabled/disabled toggle
  - Create/Edit/Cancel actions
- Add "Add Rule" + "Edit" buttons to `SocScreenerPanel.tsx`
- Add rules pagination (10/page)

#### 1B. SOC Panel Config Form (1 ngay)
- Replace raw JSON textarea voi structured form voi 5 input fields:
  - `scan_interval_seconds` (number, min: 30)
  - `max_symbols_per_scan` (number, min: 1, max: 5000)
  - `alert_cooldown_seconds` (number, min: 60)
  - `max_alerts_per_symbol_per_hour` (number, min: 1)
  - `result_retention_hours` (number, min: 1)
- Add validation + error messages
- Keep JSON editor as advanced option

#### 1C. UX Improvements (2 ngay)
- Replace `alert()` voi Toast notification component
- Replace `window.confirm()` voi `ConfirmModal` component
- Add proper error boundary wrapping both screener components
- Fix `as unknown as` casts trong SocScreenerPanel

**Exit Criteria**:
- SOC panel co day du CRUD rules voi modal
- Config form hien thi 5 fields ro rang
- Khong con `alert()` hay `window.confirm()`
- Legacy parity hoan thanh

### 4.3 Phase 2 — Commercial-Grade Features (10-14 ngay)

**Muc tieu**: Vuoat legacy, gan bang commercial platforms.

#### 2A. Expanded Filter System (3-4 ngay)
- Them fundamental filters:
  - `pe_ratio` (Price/Earnings)
  - `market_cap` (Market Capitalization)
  - `dividend_yield` (Dividend Yield)
  - `eps_growth` (EPS Growth YoY)
  - `revenue_growth` (Revenue Growth YoY)
  - `debt_to_equity` (D/E Ratio)
- Them advanced technical filters:
  - `stochastic_k` / `stochastic_d`
  - `atr_14` (Average True Range)
  - `adx_14` (Average Directional Index)
  - `bollinger_upper` / `bollinger_lower` / `bollinger_width`
  - `vwap` (Volume Weighted Average Price)
  - `obv` (On Balance Volume)
  - `mfi_14` (Money Flow Index)
- Them operator OR/NOT (ngoai AND hien co)
- Update backend `screener_helpers.py` — allowed fields + computation

#### 2B. Results Table Upgrade (2-3 ngay)
- Sortable columns (click header de sort)
- Column picker (chon 5-15 columns hien thi tu 30+ available)
- Inline mini-chart/sparkline cho moi symbol (price trend 20 ngay)
- Pagination voi 25/50/100 rows per page
- Export CSV + Excel (dung `xlsx` library)
- Row click expand chi tiet symbol (dung stock detail link)

#### 2C. Pre-built Templates (1-2 ngay)
- Tao `ScreenerTemplates.tsx` voi 10+ templates:
  - "Oversold Bounce" (RSI < 30, Volume spike)
  - "Golden Cross" (SMA20 > SMA50 crossover)
  - "Momentum Breakout" (Price > SMA20, Momentum > 5%)
  - "Volume Anomaly" (RVOL > 3x, Price change > 2%)
  - "Whale Accumulation" (Whale net value > threshold)
  - "Dark Pool Signal" (Dark flow strength > threshold)
  - "Dividend Value" (Div yield > 3%, PE < 15)
  - "Small Cap Growth" (Market cap < 500B, EPS growth > 20%)
- Template UI: grid of cards voi description, click to apply
- Backend: template endpoint hoac frontend-only

#### 2D. Saved Screens + Quick Access (1-2 ngay)
- Rename "rules" → "saved screens" trong UI
- Quick-access dropdown tren results page
- Duplicate/clone screen feature
- Screen history (last 10 runs voi timestamp + matched count)
- Store history trong backend (Redis voi TTL)

#### 2E. Scheduled Scanning + Alerts (2-3 ngay)
- Schedule config cho moi screen:
  - Frequency: hourly / daily / weekly
  - Time window: pre-market / market hours / after-hours
- Alert delivery:
  - In-app notification (WebSocket push)
  - Email notification (configurable)
- Alert history voi ack/dismiss
- Backend: cron job hoac Celery beat scheduler
- Reuse `UnifiedAlert` system da co

**Exit Criteria**:
- Co it nhat 20 filters (technical + fundamental)
- Results table sort, paginate, export
- 10+ pre-built templates hoat dong
- Scheduled scanning voi email alerts

### 4.4 Phase 3 — AI-Powered Features (5-7 ngay)

**Muc tieu**: Vuoat commercial platforms voi AI integration.

#### 3A. AI Advisory Score (theo plan 2026-04-25)
- Implement `ai_advisory_helpers.py` adapter
- Them `ai_advisory` field vao screener response
- Frontend: hien thi AI score badge tren results table
- AI score badge voi mau sac: xanh (buy), do (sell), vang (hold)

#### 3B. Smart Screening Suggestions (2-3 ngay)
- AI-powered filter suggestions dua tren market conditions
- "AI recommends" badges tren templates
- Natural language query → screening criteria (future)

#### 3C. Performance Analytics (2 ngay)
- Screen performance tracking: chay screen A, theo doi ket qua 30 ngay
- Win rate calculator: bao nhieu % co phieu match thang/giam
- Backtesting engine co ban: chay screen tren du lieu lich su

**Exit Criteria**:
- AI score hien thi tren moi symbol trong results
- Smart suggestions hoat dong
- Performance tracking co ban

---

## 5. Target Architecture

### 5.1 Component Structure (Proposed)

```
packages/web/src/
├── pages/
│   ├── ScreenerPage.tsx          (refactor → thin orchestrator)
│   └── admin/
│       └── ShellOperationsCenterPage.tsx  (screener tab)
├── components/
│   └── screener/
│       ├── ScreenerFilterBuilder.tsx    (multi-condition filter UI)
│       ├── ScreenerResultsTable.tsx     (sortable, paginated results)
│       ├── ScreenerTemplates.tsx        (pre-built template grid)
│       ├── ScreenerExport.tsx           (CSV/Excel export)
│       ├── ScreenerSchedule.tsx         (scheduled scan config)
│       ├── ScreenerScoreCard.tsx        (AI score badge)
│       └── soc/
│           ├── SocScreenerPanel.tsx     (admin panel)
│           ├── SocScreenerRuleModal.tsx  (rule CRUD modal)
│           └── SocScreenerConfigForm.tsx (structured config form)
├── adapters/
│   └── core/
│       ├── screener.js           (user-facing API client)
│       └── soc.js                (SOC admin API client)
└── types/
    └── screener.d.ts             (unified type declarations)
```

### 5.2 Backend API Surface (Target)

```
# User-facing (Portfolio)
GET    /api/portfolio/screener/rules/              → list rules
POST   /api/portfolio/screener/rules/              → create rule
GET    /api/portfolio/screener/rules/{id}/          → get rule
PUT    /api/portfolio/screener/rules/{id}/          → update rule
DELETE /api/portfolio/screener/rules/{id}/          → delete rule
POST   /api/portfolio/screener/rules/{id}/run/      → run screening
GET    /api/portfolio/screener/templates/            → list templates
GET    /api/portfolio/screener/history/              → run history
POST   /api/portfolio/screener/export/              → export results

# SOC Admin
GET    /api/soc/screener/config/                    → get config
POST   /api/soc/screener/config/                    → apply config
GET    /api/soc/screener/rules/                     → list global rules
POST   /api/soc/screener/rules/                     → create rule
PUT    /api/soc/screener/rules/{id}/                → update rule
DELETE /api/soc/screener/rules/{id}/delete/          → delete rule
GET    /api/soc/screener/results/                   → latest results
GET    /api/soc/screener/alert-history/             → alert history
POST   /api/soc/screener/manual-scan/              → manual scan
GET    /api/soc/screener/ownership/                 → ownership matrix
GET    /api/soc/screener/templates/                 → admin templates
```

---

## 6. Execution Phases Summary

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|-------------|
| Phase 0: Backend Fix + Type Cleanup | 1-2 days | CRITICAL | None |
| Phase 1: Legacy Parity | 5-7 days | HIGH | Phase 0 |
| Phase 2: Commercial Features | 10-14 days | MEDIUM | Phase 1 |
| Phase 3: AI Features | 5-7 days | MEDIUM | Phase 2A |

**Total estimated**: 21-30 ngay lam viec

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Backend URL fix break existing SOC endpoints | HIGH | LOW | Test both user + SOC paths after change |
| Expanding filter fields slow down scan performance | MEDIUM | MEDIUM | Pagination + async scan + caching |
| Template system conflicts with existing rule model | LOW | LOW | Templates as frontend-only initially |
| Scheduled scanning adds server load | MEDIUM | MEDIUM | Rate limiting + Redis queue |
| AI scoring adds latency to scan | MEDIUM | LOW | Async enrichment, non-blocking |

---

## 8. Key Metrics (KPI)

| Metric | Current | Phase 1 Target | Phase 2 Target |
|--------|---------|----------------|----------------|
| API availability (non-404) | 0% | 100% | 100% |
| Type safety (no `as any`) | 30% | 90% | 95% |
| Feature parity vs legacy | 60% | 100% | 120% |
| Feature parity vs commercial | 25% | 40% | 70% |
| Screen execution time (p95) | N/A | < 5s | < 3s |
| UI error feedback quality | alert() | Toast | Toast + inline |

---

**Next Steps**: Review va approve ke hoach, sau do bat dau Phase 0 (backend URL fix).
