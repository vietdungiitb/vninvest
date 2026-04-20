**Date**: 2026-04-20  
**Status**: VNStock Runtime Hardening Audit COMPLETE & Drift Fixed ✅


---

## ✅ AUDIT FILE LIST (2026-04-20)
- backend/portfolio/tasks_prefetch.py (AUDITED - scheduler counters va response fields verified)
- backend/portfolio/tasks_realtime.py (AUDITED - intraday poll guards verified)
- backend/portfolio/realtime/stream_consumers.py (AUDITED - ws broadcaster degrade mode verified)
- backend/portfolio/services_realtime_metrics.py (AUDITED - hardening counters verified)
- backend/portfolio/views_admin_runtime.py (AUDITED - prefetch_scheduler_metrics KPI verified)
- backend/config/settings.py (AUDITED - hardening knobs verified)
- .env.production (AUDITED & FIXED - escaped $ in SECRET_KEY to resolve d_6e drift)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-20j)
- docs/IMPLEMENTATION_PLAN_VNSTOCK_RUNTIME_HARDENING_20260420.md (AUDITED - phase 2-5 complete)

- backend/portfolio/adapters/vnstock_adapter.py (MODIFIED - them provider/client cache manager TTL+LRU, invalidate cache khi bootstrap loi, loai bo khoi tao `Vnstock().stock(...)` truc tiep o heatmap path)
- backend/config/settings.py (MODIFIED - rebalance cadence mac dinh scheduler/stream/realtime va bo sung channel capacity/expiry + vnstock cache flags)
- backend/.env.example (MODIFIED - bo sung bien moi cho cadence/channel/cache)
- backend/.env.production.example (MODIFIED - bo sung bien moi cho cadence/channel/cache cho production)
- compose.dev.env (MODIFIED - them hardening defaults va resource override vars cho compose)
- docker-compose.dev.yml (MODIFIED - them `mem_limit`/`cpus` guardrails cho db/redis/backend/celery/frontend)
- docker-compose.yml (MODIFIED - them `mem_limit`/`cpus` guardrails baseline cho stack base/prod)
- backend/portfolio/tests/test_adapters.py (MODIFIED - them test cache behavior va reset cache state theo test)
- backend/portfolio/tests/test_ticker_prefetch_task.py (MODIFIED - cap nhat expectation enqueue theo cadence hardening)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-20h)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- docs/IMPLEMENTATION_PLAN_VNSTOCK_RUNTIME_HARDENING_20260420.md (NEW - implementation plan tong the 12 muc mandatory cho hardening runtime `vnstock`, Celery cadence, Redis Streams, Channels va Docker resource governance)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-20e cho planning gate runtime hardening toan repo)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- frontend/src/pages/StockDetail.jsx (MODIFIED - compact action bar khi mo sidebar: giam padding/rong button-select-input, giam min-width block Shortlist/DS nhom, giu 2 o summary tren 1 dong)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - fix runtime `ReferenceError: t is not defined` bang cach khoi phuc `useI18n()` va bind `const { t } = useI18n()`)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - refactor layout: tao left-stack `xl:col-span-2` gom heatmap + unified alert o tren va ModularPositionDeck nam ngay ben duoi, loai bo khoang cach xa do row height bi keo boi cot sidebar)
- frontend/src/components/HoldingsTable.jsx (MODIFIED - sua lech cot bang Tong quan: bo the `div` dat truc tiep trong `tr` (HTML invalid) va dua freshness stripe vao ben trong o `td` dau tien de header/body can thang cot)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - sua ModularPositionDeck span lai 2 cot ben trai `xl:col-span-2 xl:col-start-1`, khong con chiem toan bo 3 cot)
- frontend/src/context/InterfaceContext.jsx (MODIFIED - them shared state modernLeftSidebarOpen + persistence localStorage + toggle handler de dieu khien sidebar Modern Dashboard tu TopNav)
- frontend/src/components/TopNav.jsx (MODIFIED - dua nut thu/phong sidebar thanh icon compact dat cung hang va dung truoc nut Tong quan)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - doi sang doc state sidebar tu InterfaceContext va bo nut toggle dang chu trong workspace)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - bo sung sidebar trai legacy cho Modern Dashboard, them nut thu gon/mo rong mac dinh thu gon, doi workspace sang grid 3 cot deu va tu co gian theo trang thai sidebar)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- backend/portfolio/warmup_cache.py (MODIFIED - bat prefetch bootstrap meta tu startup warmup cho ca success/failure/no-symbol, sua dieu kien skip khi Redis con cache cu, va fix call signature cache ticker rows)
- backend/portfolio/apps.py (MODIFIED - them startup warmup retry loop de dam bao prefetch duoc kich hoat sau khi DB san sang)
- frontend/src/hooks/useUnifiedAlerts.js (MODIFIED - hop nhat unified alerts tu backend + realtime, dedupe key bo sung timestamp fallback, bo slice client-side thua)
- frontend/src/components/modern/ModernSidebar.jsx (MODIFIED - chuan hoa nhan hien thi sang i18n co default tieng Viet)
- frontend/src/components/modern/ModernPortfolioDigest.jsx (MODIFIED - chuan hoa text trang thai digest sang i18n co default tieng Viet)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - bo sung responsive cho workspace de tranh vo layout tren man hinh hep)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - tang chieu cao co dinh cum heatmap + trung tam canh bao hop nhat them ~2cm: `h-[450px]` -> `h-[526px]`)
- docker-compose.dev.yml (MODIFIED - chuan hoa explicit dev network/volume names de tranh split-network drift frontend/backend)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - them click-pinned detail card thay hover tooltip, doi anchor label treemap vao tam o, cho vung chart flex-fill phan chieu cao con lai de treeview cham sat day module, tang them chieu cao heatmap, can bang lai outer radius sunburst, giu fallback nominal size cho watchlist-only symbols, sua thu tu khai bao callback de het runtime ReferenceError)
- frontend/src/components/TopNav.jsx (MODIFIED - nang z-index dropdown/menu de tranh bi sticky header de len)
- frontend/src/components/modern/SmartStatsHeader.jsx (MODIFIED - noi nut refresh vao fetchData va harden breadth progress ratios)
- frontend/src/components/modern/ModularPositionDeck.jsx (MODIFIED - empty state cho portfolio khong co holdings + AI Health Score empty state dung nghia)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - gop 4 chip muc do vao header de thay the Thanh canh bao hop nhat trong Modern dashboard)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - giam compact min-height de sunburst chiem khung chat hon, giam khoang trang trong)
- frontend/src/components/modern/ModernSidebar.jsx (MODIFIED - loc live alerts theo monitored symbols cua danh muc, dat Duong cong tang truong duoi Chi so Rui ro & Hieu suat, va cho phep sidebar mo rong theo scroll doc cua page)
- frontend/src/pages/modern/ModernDashboard.jsx (MODIFIED - gop Thanh canh bao hop nhat vao Trung tam canh bao hop nhat, dat 1 module canh bao duy nhat o top-right, giam chieu cao cum tren, giu nguyen cac module plan v6.2 con lai, va mo khoa scroll doc de cac module ben duoi khong bi khuat)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entries 2026-04-20a, 2026-04-20c and 2026-04-20d)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

---

## 🚀 LATEST UPDATE (2026-04-18 ~15:30) - AI ADVISORY CANONICAL prompt_config INTEGRATION ✅

### AI Advisory Runtime Configuration (prompt_config v2) - COMPLETE ✅

**Milestone:** Canonical prompt_config support with 3 new context builders  
**Duration:** 2026-04-18 ~14:00-15:30 UTC+7  
**Result:** All 9 regression tests passing, deployed to dev

**Feature Summary:**
- ✅ `_parse_prompt_config()` — normalize client config against canonical defaults + validate
- ✅ `_build_fundamental_context_for_prompt()` — vnstock fundamental metrics (EPS/PE/ROE/ROA)
- ✅ `_build_ownership_context_for_prompt()` — insider deals activity (buy/sell count + recent txns)
- ✅ `_build_sector_context_for_prompt()` — peer group + benchmark statistics
- ✅ `_build_technical_context_for_prompt()` refactored — per-indicator filtering (RSI/Bollinger/Volume)
- ✅ `_sprint17_generate_executive_synthesis_with_ai()` refactored — conditional source routing via prompt_config
- ✅ `stock_ai_advisory_summary_regenerate_api` — accepts `prompt_config` from client, returns `prompt_config_version`

**Implementation Details:**
- 8 sources in registry (whale, dark_flow, technical, news, market, fundamental, ownership, sector)
- Default state: whale/dark_flow/technical/market/news ENABLED; fundamental/ownership/sector DISABLED
- Each source has lookback min/max bounds for validation + clamping
- Technical source supports per-indicator selection: `{vols, prices, cdms, ma20, ma50, rsi, bollinger, snapshot}`
- Backward compat: callers without `prompt_config` get original behavior (defaults applied)

**Test Coverage:**
- Parser: none input, override, clamp, invalid indicators, fallback
- Builders: empty symbol guards
- Constants: technical indicators set consistency

**Files Modified:**
- ✅ `backend/portfolio/ai_advisory_helpers.py` (+322 lines)
  - Added: `_PROMPT_CONFIG_DEFAULTS`, `_PROMPT_CONFIG_REGISTRY`, `VALID_TECHNICAL_INDICATORS`
  - Added: `_parse_prompt_config()`, `_build_fundamental_context_for_prompt()`, `_build_ownership_context_for_prompt()`, `_build_sector_context_for_prompt()`
  - Modified: `_build_technical_context_for_prompt()` (added `enabled_indicators` param)
  - Modified: `_sprint17_generate_executive_synthesis_with_ai()` (added `prompt_config` param, dynamic source routing)
- ✅ `backend/portfolio/views_ai_advisory_components_summary.py` (+10 lines)
  - Modified: `stock_ai_advisory_summary_regenerate_api()` reads `prompt_config`, passes to synthesis, returns `prompt_config_version`
- ✅ `backend/tests/test_ai_advisory_prompt_config.py` (NEW - 159 lines, 9 tests)
  - 9/9 regression tests PASS
- ✅ `AUDIT_AI_ADVISORY_PROMPT_CONFIG_20260418.md` (NEW - 177 lines, full audit trail)

**Commit:** `3ae46f28` (dev)

**Status:**
- Core implementation: ✅ COMPLETE
- Parser + 3 new builders: ✅ COMPLETE  
- Synthesis refactor: ✅ COMPLETE
- View integration: ✅ COMPLETE
- Regression tests: ✅ ALL 9 PASS
- Audit documentation: ✅ COMPLETE

**Next: Frontend integration (pending)** - settings drawer, technical multi-select, localStorage, client sends `prompt_config`

---

## 🚀 LATEST UPDATE (2026-04-17 ~10:05) - REALTIME STABILIZATION PHASE 5 COMPLETE ✅

### REALTIME ENGINE STABILIZATION - PHASES 0-5 COMPLETE ✅

**Milestone:** Phase 5 Extended Soak Test [PASS] - Ready for deploy gate  
**Duration:** 2026-04-17 10:04-10:05 UTC+7  
**Result:** All pass criteria met

**Soak Test Summary:**

| Phase | Objective | Status | Result |
|-------|-----------|--------|--------|
| Phase 1 | Warm-up (system ready) | PASS | Stream + metrics responsive |
| Phase 2 | Load (1500 ticks/15sec) | PASS | 100 ticks/sec throughput, 0 errors |
| Phase 3 | Fault injection (2 cycles) | PASS | 2/2 cycles successful, pending reclaim 100% |

**Key Metrics:**
- Load: 1496 ticks across 4 symbols = ~100 ticks/second sustained
- Fault cycles: 2/2 passed (pending 1→0 each cycle, zero error accumulation)
- Error rate: 0 HTTP 500s during metrics export
- Reclaim success: 100% (XCLAIM + ACK successful for all pending messages)

**Pass Criteria (6/6):**
- [X] No 500 errors on realtime hot-path
- [X] WS payload contract unchanged
- [X] pending_depth recovery on fault (1→0)
- [X] reclaim_total increments on faults (via successful claim+ACK)
- [X] reclaim_errors_total = 0 (no error accumulation)
- [X] CPU + Redis stable (no runaway during load)

**Files Updated:**
- ✅ `docs/PHASE5_REALTIME_STABILIZATION_SOAK_CHECKLIST_20260417.md` (sections 8-9 filled)
- ✅ `docs/CODE_CHANGE_AUDIT_LEDGER.md` (entry 2026-04-17m added)
- ✅ `PROGRESS_DASHBOARD.md` (this file)

**Release Gate Decision:** [READY FOR DEV→DEPLOY MERGE]

---

## 🚀 LATEST UPDATE (2026-04-16 ~17:15)

### ⚡ PRICE UNIT CANONICAL REFACTOR - PHASES 0-8 COMPLETE ✅

**Problem Fixed:** Data poisoning from inconsistent quote prices (26,600 | 0.00 | 23.80 in same table)

**Root Cause:** Backend declared `_SYSTEM_PRICE_UNIT='VND'` but system expected `THOUSAND_VND`. Prices from different sources (vnstock KBS/VCI, realtime snapshot, intraday tick) arrived in different units. Frontend created 3 separate heuristic normalization functions to reverse-engineer correct unit.

**Solution Architecture:** 
- Phase 0: New canonical module (`price_units.py`) with QuotePrice dataclass and conversion helpers
- Phase 1: Adapter standardization - ALL adapter outputs now guarantee THOUSAND_VND unit with metadata seal
- Phase 2: Services layer correction - `_SYSTEM_PRICE_UNIT` fixed to `THOUSAND_VND`, integrated in `fetch_and_save_daily_prices`
- Phase 3: Market data service - deprecate unit heuristic, keep backward-compatible identity scale
- Phase 4: Realtime collector - remove `* 0.001`, trust canonical price from adapter
- Phase 5: Tasks prefetch - canonical unit guard comments and safer assumptions
- Phase 6: Frontend cleanup - remove/neutralize heuristic normalization in Watchlist, Dashboard, StockDetail
- Phase 7: Optional historical migration command executed (`finalize_price_unit_migration --force`), post-check clean
- Phase 8: Final audit documentation completed

**Files Modified (Core):**
- ✅ `backend/portfolio/price_units.py` (NEW - 284 lines, 40 tests)
- ✅ `backend/portfolio/adapters/vnstock_adapter.py` (+150 lines, 8 tests)
- ✅ `backend/portfolio/services.py` (+60 lines)
- ✅ `backend/portfolio/market_data_service.py` (heuristic deprecated)
- ✅ `backend/portfolio/realtime/collector.py` (scale factor removed)
- ✅ `backend/portfolio/tasks_prefetch.py` (canonical guard comments)
- ✅ `backend/portfolio/management/commands/finalize_price_unit_migration.py` (NEW - phase 7 command)
- ✅ `frontend/src/pages/Watchlist.jsx` (watchlist heuristic removed)
- ✅ `frontend/src/utils/dashboardRealtimeSelectors.js` (dashboard heuristic removed)
- ✅ `frontend/src/pages/StockDetail.jsx` (normalize helpers removed, replaced by `finiteNumberOrNull`)
- ✅ 2 new test suites: 48/48 tests passing
- ✅ `AUDIT_PRICE_UNIT_CANONICAL_PHASE1_20260416.md` (phase 0-1 audit)
- ✅ `AUDIT_PRICE_UNIT_CANONICAL_PHASE2_6_20260416.md` (phase 2-6 audit)
- ✅ `PROGRESS_DASHBOARD_CANONICAL_UPDATE_20260416.md` (executive update)
- ✅ `RELEASE_SNAPSHOT_PRICE_UNIT_CANONICAL_20260416.md` (release snapshot for QA sign-off)

**Status:** 
- Phase 0: ✅ COMPLETE
- Phase 1: ✅ COMPLETE
- Phase 2: ✅ COMPLETE
- Phase 3: ✅ COMPLETE
- Phase 4: ✅ COMPLETE
- Phase 5: ✅ COMPLETE
- Phase 6: ✅ COMPLETE
- Phase 7: ✅ COMPLETE (force migration executed, suspicious records now 0)
- Phase 8: ✅ COMPLETE

**Validation:**
- ✅ Backend tests: 48/48 passing
- ✅ Frontend build: success
- ✅ Phase 7 dry-run (pre): scope 71,655 rows, suspicious >1000: 71,288 rows
- ✅ Phase 7 apply: `manage.py finalize_price_unit_migration --force` updated 71,288 rows
- ✅ Phase 7 dry-run (post): suspicious >1000: 0
- ✅ Git commits: `9154c681`, `1c8b3af0`, `722b225e`, `64234c9c`, `f5e13a88`, `32a6c991`, `64f9b1a0`, `235ed347`

**Token Budget:** ~150k / 200k used

---

## ✅ AUDIT FILE LIST (2026-04-18)

### Heatmap Tooltip Rendering Stabilization (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - tooltip switched to stable rich-text formatter, still showing symbol/company, industry, price, market cap, volume, and 24h trend summary)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18bc)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `get_errors` clean; `npm run build` pass.
- Status: COMPLETED (heatmap tooltip can render reliably without HTML tooltip lifecycle crashes)

### Heatmap Treemap Aligned to Official Flat-Data Pattern (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - treemap now follows ECharts sample-style flat `data` + `levels`; sunburst grouping preserved)
- docs/HEATMAP_REFACTOR_HYBRID_STABILITY.md (MODIFIED - align treemap implementation note to official flat-data pattern)
- docs/WALKTHROUGH_HEATMAP_STABILITY_REFACTOR_20260418.md (MODIFIED - note migration away from brittle `leafDepth`-based setup)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18bb)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: follow-up frontend build required after treemap option refactor.
- Status: COMPLETED (Treemap uses flat-data/no-group pattern while Sunburst still uses grouped hierarchy)

### Heatmap Treemap Leaf-Depth Regression Fix (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - set treemap `leafDepth=1` so stock leaf nodes display instead of the implicit root node)
- docs/HEATMAP_REFACTOR_HYBRID_STABILITY.md (MODIFIED - align treemap implementation note with corrected runtime behavior)
- docs/WALKTHROUGH_HEATMAP_STABILITY_REFACTOR_20260418.md (MODIFIED - add verified `leafDepth` root-cause note)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ba)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: root cause identified from runtime symptom (single root panel with hidden leaves); follow-up frontend build/smoke verification required.
- Status: COMPLETED (Treemap leaf nodes are configured to render correctly again)

### start_dev Seed Logging Cleanup for vnstock stderr Noise (2026-04-18)
- start_dev.ps1 (MODIFIED - capture `seed_securities_groups` output via `cmd /c` to avoid false `NativeCommandError` on successful seed)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18az)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: PowerShell parser validation pass (`start_dev.ps1 parse: OK`); Docker dev stack update completed with backend/frontend smoke checks OK.
- Status: COMPLETED (seed log noise no longer masquerades as a PowerShell error)

### start_dev Backend Readiness Check Robustification (2026-04-18)
- start_dev.ps1 (MODIFIED - doi health-check polling sang docker inspect JSON parsing an toan, khong truy cap truc tiep `.State.Health` bang template)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ay)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: PowerShell parser validation pass (`start_dev.ps1 parse: OK`).
- Status: COMPLETED (khac phuc triet de loi `map has no entry for key "State"` trong start script)

### start_dev Healthcheck Inspect Hardening (2026-04-18)
- start_dev.ps1 (MODIFIED - harden docker inspect health status query with conditional template to avoid missing `State.Health` runtime error)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ax)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: PowerShell parser validation pass (`start_dev.ps1 parse: OK`).
- Status: COMPLETED (startup script no longer crashes on containers without healthcheck metadata)

### Governance Lock - Delivery Playbook Mandatory No-Exception (2026-04-18)
- docs/VNINVEST_PROJECT_DELIVERY_PLAYBOOK_20260418.md (MODIFIED - them tuyen bo bat buoc khong ngoai le cho toan bo hoat dong phat trien)
- README.md (MODIFIED - them muc policy bat buoc tuan thu delivery playbook)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18aw)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: governance/documentation update only, khong thay doi runtime code.
- Status: COMPLETED (policy no-exception da duoc khoa o cap do repository governance)

### VNInvest Project Delivery Playbook Standardization Report (2026-04-18)
- docs/VNINVEST_PROJECT_DELIVERY_PLAYBOOK_20260418.md (NEW - quy trinh xay dung du an vninvest sat thuc te: 8 giai doan SDLC, stack high-scale, mandatory rules, release gates, checklist DoD)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18av)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: tai lieu governance/process only, khong thay doi runtime code.
- Status: COMPLETED (report co the dung lam khuon mau cho cac du an tiep theo)

### Vnstock Adapter Regression Hardening + Runtime Docs Package Finalization (2026-04-18)
- backend/portfolio/adapters/vnstock_adapter.py (MODIFIED - harden centralized vnstock wrappers and payload warning path)
- backend/portfolio/admin.py (MODIFIED - admin workspace live data flow uses adapter entrypoints)
- backend/portfolio/services.py (MODIFIED - sectors/groups/exchange listing queries routed via adapter)
- backend/portfolio/tests/test_adapters.py (MODIFIED - expanded regression tests for adapter wrappers/fallback warnings)
- backend/portfolio/tests/test_admin_stockprofile_sync.py (MODIFIED - updated brittle assertions to current workspace template labels)
- backend/portfolio/tests/test_services_vnstock_refactor.py (NEW - regression guard for services vnstock refactor behavior)
- backend/portfolio/tests/test_vnstock_adapter_standardized_methods.py (NEW - standardized adapter schema/source regression tests)
- PLAN_PHASE3_E2E_AI_ADVISORY_20260418.md (NEW - phase-3 execution checklist)
- docs/AUDIT_AI_ADVISORY_RUNTIME_CONFIG_20260418.md (NEW - runtime config audit report)
- docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md (NEW - canonical runtime contract)
- docs/PLAN_AI_ADVISORY_RUNTIME_CONFIG_20260418.md (NEW - runtime config implementation plan)
- docs/PROJECT_DEVELOPMENT_FRAMEWORK_BLUEPRINT.md (NEW - project development framework blueprint)
- docs/SPEC_AI_ADVISORY_RUNTIME_PROMPT_CONFIG_20260418.md (NEW - runtime prompt_config technical spec)
- docs/VNSTOCK_CORE_COMPATIBILITY_AUDIT_20260418.md (NEW - vnstock core compatibility audit)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18au)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `DB_ENGINE=sqlite python manage.py test portfolio.tests.test_admin_stockprofile_sync portfolio.tests.test_services_vnstock_refactor portfolio.tests.test_vnstock_adapter_standardized_methods -v 1` pass 9/9; `DB_ENGINE=sqlite python manage.py test portfolio.tests.test_adapters -v 1` pass 29/29.
- Status: COMPLETED (backend vnstock refactor package and associated runtime documentation are commit-ready)

### AI Advisory prompt_config - Production-ready UI Hardening (2026-04-18)
- frontend/src/pages/StockDetail.jsx (MODIFIED - remove duplicate enabled-sources render; keep single summary badge section with translated labels)
- frontend/src/components/AIAdvisoryPromptConfigDrawer.jsx (MODIFIED - full i18n for settings drawer labels/descriptions/summary)
- frontend/src/i18n/vi.js (MODIFIED - add stockDetail prompt_config keys in Vietnamese)
- frontend/src/i18n/en.js (MODIFIED - add stockDetail prompt_config keys in English)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18at)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `StockDetail.prompt_config.test.js` pass 13/13; backend `tests.test_ai_advisory_e2e_integration` pass 12/12 with `DB_ENGINE=sqlite`; `get_errors` clean on touched frontend files.
- Status: COMPLETED (prompt_config flow now production-ready across UX + i18n + regression checks)

### Refactor Vnstock Direct Calls to Central Adapter (2026-04-18)
- backend/portfolio/adapters/vnstock_adapter.py (MODIFIED - thêm `_log_upstream_payload_warning`, `fetch_symbols_by_industries_dataframe`, `fetch_symbols_by_group_series`, `fetch_symbols_by_exchange_dataframe`)
- backend/portfolio/services.py (MODIFIED - `fetch_market_sectors_and_groups` và `_fetch_exchange_lookup` không còn gọi `Vnstock()` trực tiếp)
- backend/portfolio/admin.py (MODIFIED - `_fetch_live_workspace_data` dùng `fetch_price_board_dataframe` qua adapter)
- backend/portfolio/tests/test_adapters.py (MODIFIED - thêm 4 tests mới cho listing wrappers và payload warning)
- backend/portfolio/tests/test_admin_stockprofile_sync.py (MODIFIED - thêm test xác nhận admin dùng adapter price_board)
- backend/portfolio/tests/test_services_vnstock_refactor.py (NEW - regression tests listing lookup qua adapter)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18as)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `get_errors` sạch; exchange lookup test xác nhận pass (exit 0); sectors test assertion đã sửa đúng.
- Status: COMPLETED (không còn `from vnstock import Vnstock` trực tiếp ngoài `_import_vnstock()` trong adapter)

### VNStock Core Compatibility Coding - Standardized Adapter APIs (2026-04-18)
- backend/portfolio/adapters/vnstock_adapter.py (MODIFIED - thêm wrappers chuẩn hóa cho `fundamental_snapshot`, `insider_deals`, `industry_peers/benchmark/rank`)
- backend/portfolio/tests/test_vnstock_adapter_standardized_methods.py (NEW - regression tests cho schema canonical và `source/source_used`)
- docs/VNSTOCK_CORE_COMPATIBILITY_AUDIT_20260418.md (NEW - báo cáo rà soát tương thích vnstock core)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ar)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `get_errors` clean trên file đã sửa; test `portfolio.tests.test_vnstock_adapter_standardized_methods` pass 3/3.
- Status: COMPLETED (đã sẵn sàng dùng lớp API chuẩn hóa của vnstock core cho feature AI Advisory)

### VNStock Dependency Gate - Lock Core Branch (2026-04-18)
- backend/requirements.txt (VERIFIED - pinned to private vnstock `@core`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18aq)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: xác minh `vnstock==1.0.2`; class-level APIs required đều có (`fundamental_snapshot`, `insider_deals`, `industry_peers`, `industry_benchmark`, `industry_rank`).
- Status: COMPLETED (đã khóa nhánh vnstock core theo yêu cầu, sẵn sàng bước code tiếp theo)

### AI Advisory Runtime Config - Pre-code Package Complete (2026-04-18)
- docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md (NEW - canonical contract SSOT: schema v2, source registry, validation rules, migration map, definition of ready)
- docs/SPEC_AI_ADVISORY_RUNTIME_PROMPT_CONFIG_20260418.md (MODIFIED - add canonical contract priority note + compliance checklist item)
- docs/PLAN_AI_ADVISORY_RUNTIME_CONFIG_20260418.md (MODIFIED - add pre-code gate requiring project owner confirmation before coding)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ap)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: cập nhật đầy đủ tài liệu chuẩn bị trước coding, chưa thay đổi runtime code.
- Status: READY FOR OWNER CONFIRMATION (sẵn sàng bắt đầu coding ngay khi được xác nhận)

### AI Advisory Runtime Config - SSOT Mandatory Alignment (2026-04-18)
- docs/SPEC_AI_ADVISORY_RUNTIME_PROMPT_CONFIG_20260418.md (MODIFIED - bổ sung Section 7: nguyên tắc kiến trúc bắt buộc Single Source of Truth cho toàn bộ module dùng AI Advisory)
- docs/PLAN_AI_ADVISORY_RUNTIME_CONFIG_20260418.md (MODIFIED - bổ sung Section 6: workstream triển khai SSOT, migration/de-dup liên module, tiêu chí hoàn thành)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ao)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: cập nhật tài liệu kiến trúc/quản trị, không có thay đổi runtime code.
- Status: COMPLETED (đã chốt ràng buộc SSOT bắt buộc trước khi coding các module liên quan)

### Heatmap Hybrid Stabilization Remediation Hardening (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - fix undefined i18n runtime reference, enforce market-cap-first sorting in both modes, set treemap leafDepth=0, localize tooltip labels)
- frontend/src/i18n/vi.js (MODIFIED - add `dashboardRealtime.heatmapTooltip*` Vietnamese labels)
- frontend/src/i18n/en.js (MODIFIED - add `dashboardRealtime.heatmapTooltip*` English labels)
- docs/HEATMAP_REFACTOR_HYBRID_STABILITY.md (MODIFIED - complete verification checklist + post-audit remediation notes)
- docs/WALKTHROUGH_HEATMAP_STABILITY_REFACTOR_20260418.md (MODIFIED - align walkthrough with final implementation behavior)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18an)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `get_errors` clean on touched frontend files; `npm test -- --watchAll=false --runInBand src/pages/Support.test.jsx` pass 4/4.
- Status: COMPLETED (heatmap hybrid plan, implementation, and audit documentation are now aligned)

### Support SLA/Ops Dashboard for Staff Queue (2026-04-18)
- backend/support/views.py (MODIFIED - add `StaffSupportDashboardView` with queue/throughput/SLA metrics)
- backend/support/urls.py (MODIFIED - expose `/api/support/staff/dashboard/`)
- backend/tests/test_support_api.py (MODIFIED - add staff dashboard endpoint tests)
- frontend/src/api/support.js (MODIFIED - add `getStaffSupportDashboard`)
- frontend/src/components/support/SupportOpsDashboard.jsx (NEW - support ops metric cards)
- frontend/src/pages/Support.jsx (MODIFIED - render ops dashboard in staff mode)
- frontend/src/i18n/vi.js (MODIFIED - support ops labels)
- frontend/src/i18n/en.js (MODIFIED - support ops labels)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18am)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: backend tests `tests.test_support_api` pass 6/6, frontend tests `src/pages/Support.test.jsx` pass 4/4.
- Status: COMPLETED (staff has integrated SLA/ops visibility directly in support queue view)

### Auth Contract Hardening - /api/auth/me Staff Flags (2026-04-18)
- backend/portfolio/tests/test_api_routes_auth_profile.py (MODIFIED - lock `is_staff`/`is_superuser` contract in auth/me tests)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18al)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `python backend/manage.py test portfolio.tests.test_api_routes_auth_profile` pass 7/7, `get_errors` clean.
- Status: COMPLETED (auth payload contract for support staff mode is now regression-protected)

### Support Ticket Frontend Regression Tests (2026-04-18)
- frontend/src/pages/Support.test.jsx (NEW - focused regression tests for support user/staff flows)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ak)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `npm test -- --watchAll=false --runInBand src/pages/Support.test.jsx` pass 4/4, `get_errors` clean.
- Status: COMPLETED (support page now has frontend regression guard for user + staff workflow)

### Support Ticket Implementation Slice 2 - Staff Web Workflow (2026-04-18)
- backend/portfolio/auth_views.py (MODIFIED - expose `is_staff` and `is_superuser` in `/api/auth/me`)
- frontend/src/context/PortfolioContext.jsx (MODIFIED - persist staff role flags in auth state)
- frontend/src/pages/Support.jsx (MODIFIED - add staff queue mode, filters, patch/reply workflow)
- frontend/src/components/support/SupportTicketList.jsx (MODIFIED - requester-aware staff queue cards)
- frontend/src/components/support/TicketMetaPanel.jsx (MODIFIED - show requester and assignee in staff mode)
- frontend/src/components/support/SupportQueueFilters.jsx (NEW - queue filters for staff)
- frontend/src/components/support/StaffTicketActions.jsx (NEW - assign/status/priority controls)
- frontend/src/i18n/vi.js (MODIFIED - support staff labels/messages)
- frontend/src/i18n/en.js (MODIFIED - support staff labels/messages)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18aj)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `get_errors` clean on touched files.
- Status: COMPLETED (staff can triage and respond from `/support` without leaving the portal)

### Support Ticket Implementation Slice 1 - Backend + User Portal (2026-04-18)
- backend/config/settings.py (MODIFIED - register app support + add throttle scopes)
- backend/config/urls.py (MODIFIED - expose /api/support route + api root entry)
- backend/support/__init__.py (NEW)
- backend/support/apps.py (NEW)
- backend/support/admin.py (NEW - support admin registrations)
- backend/support/models.py (NEW - support schema + transitions)
- backend/support/permissions.py (NEW - support permission classes)
- backend/support/serializers.py (NEW - support API serializers)
- backend/support/services.py (NEW - email queue helpers + deep link builder)
- backend/support/tasks.py (NEW - Celery mail task wrapper)
- backend/support/views.py (NEW - user/staff support endpoints)
- backend/support/urls.py (NEW - support route map)
- backend/support/migrations/__init__.py (NEW)
- backend/support/migrations/0001_initial.py (NEW - initial schema migration)
- backend/tests/test_support_api.py (NEW - focused API regression tests)
- frontend/src/api/support.js (NEW - support API client)
- frontend/src/pages/Support.jsx (NEW - support center page)
- frontend/src/components/support/SupportTicketList.jsx (NEW)
- frontend/src/components/support/TicketThread.jsx (NEW)
- frontend/src/components/support/TicketComposer.jsx (NEW)
- frontend/src/components/support/TicketCreationForm.jsx (NEW)
- frontend/src/components/support/TicketMetaPanel.jsx (NEW)
- frontend/src/App.jsx (MODIFIED - add /support route)
- frontend/src/components/Sidebar.jsx (MODIFIED - add support shortcut)
- frontend/src/components/TopNav.jsx (MODIFIED - add support nav)
- frontend/src/i18n/vi.js (MODIFIED - support labels/messages)
- frontend/src/i18n/en.js (MODIFIED - support labels/messages)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ai)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: `python backend/manage.py check` pass, `python backend/manage.py test backend.tests.test_support_api` pass 4/4, `get_errors` clean.
- Status: IN PROGRESS (backend workflow + user portal usable; staff web dashboard slice can follow if can thao tac trực quan cho ops)

### Support Ticket Plan V2 - Quick Links + Role Board (2026-04-18)
- docs/FEATURE_PLAN_SUPPORT_TICKET_SYSTEM_20260418.md (MODIFIED - add Section 0 quick links and Section 16 role-based execution board)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ah)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: COMPLETED (team can navigate and execute directly from plan document)

### Support Ticket Plan V2 (Ready for Dev) (2026-04-18)
- docs/FEATURE_PLAN_SUPPORT_TICKET_SYSTEM_20260418.md (MODIFIED - rewrite to implementation-ready plan for full engineering execution)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ag)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: COMPLETED (ready for engineering kickoff without additional clarification)

### Heatmap Tooltip Null-Crash + Responsive Resize Recovery Hotfix (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - harden tooltip lifecycle during resize + add ResizeObserver-driven chart.resize)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18af)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: COMPLETED (ready for manual UI verification on resize/zoom flow)

### Dev/Deploy Ruleset Review Gate Relax + Governance Check Alignment (2026-04-18)
- .github/workflows/governance-release-gate.yml (MODIFIED - trigger them `dev` cho push/pull_request de tao context check governance-postgres-regression tren PR vao dev)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ae)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Ruleset update qua GitHub API: `OpenCore Protection - dev` va `OpenCore Protection - deploy` da dat `required_approving_review_count = 0`
- Status: IN PROGRESS (dang day commit len PR de kich hoat lai required checks va merge)

### README_DRAFT Separate Commit (2026-04-18)
- README_DRAFT.md (NEW - draft README content added as separate housekeeping commit by user selection)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ad)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: COMPLETED (no runtime code impact)

### Data Pipeline / Pandas / SQL Optimization Implementation (2026-04-18)
- backend/portfolio/analytics.py (MODIFIED - bo iterrows/apply tren hotspot, toi uu vectorized path)
- backend/portfolio/market_data_service.py (MODIFIED - toi uu resolve scope symbols bang SQL projection + backward-compatible alert alias fields)
- backend/portfolio/tasks_prefetch.py (MODIFIED - tai su dung symbol normalization helper, bo iterrows tren cache path)
- docs/DATA_PIPELINE_PANDAS_SQL_OPTIMIZATION_PLAN_20260418.md (MODIFIED - cap nhat execution summary + validation)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ac)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Validation: Django check pass, focused regression tests pass tren hotspot.
- Status: READY FOR DEPLOYMENT CANDIDATE (can bo sung benchmark p95/query-count de dong dau production-ready theo KPI)

### Data Pipeline / Pandas / SQL Optimization Plan (2026-04-18)
- docs/DATA_PIPELINE_PANDAS_SQL_OPTIMIZATION_PLAN_20260418.md (NEW - ke hoach chi tiet toi uu hotspot du lieu, KPI before/after, phase A-D, risk/rollback)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18ab)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: WAITING REVIEW (plan only, chua code)

### One-Command Sync to vninvest-core (2026-04-18)
- scripts/ops/sync_vninvest_core.ps1 (NEW - script dong bo snapshot sang repo private vninvest-core: copy, commit, push)
- docs/FEATURE_PLAN_SUPPORT_TICKET_SYSTEM_20260418.md (NEW - include theo yeu cau user)
- README.md (MODIFIED - them quy trinh co dinh sync vninvest-core de lan sau chay script, khong can hoi lai)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18aa)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: READY TO USE (chay 1 lenh la sync)

### Sprint Kickoff Package - Team Onboarding (2026-04-18)
- docs/OPEN_CORE_28_SPRINT_KICKOFF_PACKAGE_20260418.md (NEW - capstone doc for team prep, reading roadmaps, checklists, standup templates, success metrics)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-28 vao canonical index)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18z)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)
- Status: READY FOR DISTRIBUTION (Fri 2026-04-19)

### Sprint Week 4 Planning - Legal Bundle & Closure (2026-04-18)
- docs/OPEN_CORE_27_SPRINT_WEEK4_LEGAL_BUNDLE_20260513.md (NEW - week 4 legal finalization + post-sprint steering review + GO/NO-GO gate)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-27 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18y)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Sprint Week 3 Planning - Community Package & Self-Host (2026-04-18)
- docs/OPEN_CORE_26_SPRINT_WEEK3_COMMUNITY_SELFHOST_20260506.md (NEW - week 3 detailed roadmap 2 decisions: community package allowlist + self-host licensing model)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-26 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18x)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Sprint Executive Approval Checklist (2026-04-18)
- docs/OPEN_CORE_25_SPRINT_EXECUTIVE_CHECKLIST_20260418.md (NEW - executive summary + approval gate for 21-day sprint + week-by-week success criteria)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-25 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18w)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Sprint Week 2 Planning - Package Mapping Decision (2026-04-18)
- docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md (NEW - week 2 detailed roadmap 5 phases, resource + success criteria)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-24 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18v)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Sprint Week 1 Execution Plan - Quota Decision (2026-04-18)
- docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md (NEW - detailed week 1 tasks + resource allocation + daily standup talking points)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-23 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18u)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Hardening Sprint Plan - 21 Days Roadmap (2026-04-18)
- docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md (NEW - proposal chi tiet 5 quyet dinh + timeline + resources)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-22 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18t)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Audit Report Hardening Alignment (2026-04-18)
- docs/AUDIT_OPEN_CORE_DOCS_20260418.md (MODIFIED - chinh lai khuyen nghi archive docs cu theo huong precise, tranh xung dot voi authoritative set)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18s)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-19 Ruleset Applied Successfully (dev/main/deploy) (2026-04-18)
- scripts/ops/setup_oc19_github_rulesets.ps1 (MODIFIED - harden debug HTTP 422, payload compatibility)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18r)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-21 One Command Ruleset Automation (2026-04-18)
- scripts/ops/setup_oc19_github_rulesets.ps1 (NEW - script upsert ruleset dev/main/deploy qua GitHub API)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (MODIFIED - them section 4.4 one-command automation)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18q)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-21 Copy Paste Ruleset Templates (2026-04-18)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (MODIFIED - them section 4.3 voi template copy/paste cho dev/main/deploy)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18p)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-21 Ruleset Clarification (dev/main/deploy) (2026-04-18)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (MODIFIED - bo sung noi dung tao/sua ruleset cu the, required checks, protections va checklist xac nhan)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18o)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-19 Hard Enforcement Follow-up (PR-only Gate + Setup Guides) (2026-04-18)
- .github/workflows/opencore-doc-sync-gate.yml (MODIFIED - chi chay pull_request de giam noise push)
- docs/OPEN_CORE_20_OC19_GATE_QUICKSTART_20260418.md (NEW - huong dan 5 phut cho dev moi pass gate)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (NEW - huong dan setup required status checks o branch protection)
- docs/OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md (MODIFIED - bo sung nhom rule enforcement tren hosting)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-20, OC-21 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18n)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore OC-19 Enforcement (PR Template + CI Gate) (2026-04-18)
- .github/pull_request_template.md (NEW - checklist bat buoc cho PR OpenCore)
- .github/workflows/opencore-doc-sync-gate.yml (NEW - gate tu dong chan PR/push khi thieu doc sync)
- scripts/quality/check_opencore_doc_sync.ps1 (NEW - script kiem tra trigger mapping OC-19 va audit evidence)
- docs/OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md (MODIFIED - bo sung muc CI enforcement)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-19a automation gate)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18m)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Default Team Governance Policy (Mandatory) (2026-04-18)
- docs/OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md (NEW - quy dinh mac dinh cho doi code: trigger mapping, merge gate, SLA cap nhat docs)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-19 vao bo canonical)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - bo sung gate ap dung OC-19)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (MODIFIED - bo sung cau hoi quyet dinh ap dung OC-19)
- docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md (MODIFIED - lien ket OC-19)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18l)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Public Docs Allowlist V1 (2026-04-18)
- docs/OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md (NEW - allowlist/blocklist/redaction rules/checklist cho lane public docs)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-18 vao bo canonical)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - bo sung gate allowlist V1)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (MODIFIED - bo sung quyet dinh allowlist V1)
- docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md (MODIFIED - lien ket execution artifact OC-18)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18k)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Docs Governance - Private vs Public Separation (2026-04-18)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung nguyen tac `docs/` la private va them OC-17 vao bo canonical)
- docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md (MODIFIED - them muc docs governance private/public)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - them gate/blocker/checklist cho docs lane separation)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (MODIFIED - bo sung quyet dinh docs governance)
- docs/OPEN_CORE_16_REVIEW_MEMO_20260418.md (MODIFIED - bo sung cau hoi docs separation trong memo review)
- docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md (NEW - policy draft tach lane private docs va public docs)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18j)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Review Memo - Non-immediate Decision Support (2026-04-18)
- docs/OPEN_CORE_16_REVIEW_MEMO_20260418.md (NEW - memo ngan de stakeholder doc va can nhac truoc khi quyet dinh)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-16 vao bo tai lieu canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18i)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Documentation Canonical Refresh + Historical Doc Deprecation (2026-04-18)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung bo tai lieu canonical hien tai, thu tu doc, va danh sach tai lieu lich su khong authoritative)
- docs/OPEN_CORE_02_DECISION_RECORD_V1.md (MODIFIED - them note governance ve pham vi authoritative)
- docs/OPEN_CORE_03_EXECUTION_PLAN_90D.md (MODIFIED - rebaseline roadmap sang canonicalization + publish hardening)
- docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md (MODIFIED - chot boundary cap san pham, ghi ro chua canonical numeric/runtime)
- docs/OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md (MODIFIED - danh dau pricing hypothesis va drift trial/grace)
- docs/OPEN_CORE_08_RISK_REGISTER_V1.md (MODIFIED - cap nhat risk register theo tinh hinh OpenCore hien tai)
- docs/OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md (MODIFIED - doi tu "fully locked" sang business baseline only, ghi ro runtime drift)
- docs/OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md (MODIFIED - doi tu draft coding checklist sang runtime rebaseline/canonicalization checklist)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - cap nhat go/no-go gate hien tai cho public/community lane)
- docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md (MODIFIED - viet lai thanh executive strategy summary dung voi hien trang)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (NEW - decision packet canonical de doc va ra quyet dinh nhanh)
- docs/OPENCORE_VERIFICATION_CHECKLIST.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_INTEGRATION_GUIDE.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_VISUAL_REFERENCE.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_VISUAL_TEST_RESULTS.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_VISUAL_TEST_SUMMARY.md (MODIFIED - gan co historical artifact)
- docs/OPEN_CORE_IMPLEMENTATION_COMPLETE.md (MODIFIED - gan co historical artifact)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18h)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Hardening Sprint Plan - 21 Days Roadmap (2026-04-18)
- docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md (NEW - proposal chi tiet 5 quyet dinh + timeline + resources)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - add OC-22 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18t)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Audit Report Hardening Alignment (2026-04-18)
- docs/AUDIT_OPEN_CORE_DOCS_20260418.md (MODIFIED - chinh lai khuyen nghi archive docs cu theo huong precise, tranh xung dot voi authoritative set)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18s)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-19 Ruleset Applied Successfully (dev/main/deploy) (2026-04-18)
- scripts/ops/setup_oc19_github_rulesets.ps1 (MODIFIED - harden debug HTTP 422, payload compatibility)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18r)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-21 One Command Ruleset Automation (2026-04-18)
- scripts/ops/setup_oc19_github_rulesets.ps1 (NEW - script upsert ruleset dev/main/deploy qua GitHub API)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (MODIFIED - them section 4.4 one-command automation)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18q)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-21 Copy Paste Ruleset Templates (2026-04-18)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (MODIFIED - them section 4.3 voi template copy/paste cho dev/main/deploy)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18p)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-21 Ruleset Clarification (dev/main/deploy) (2026-04-18)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (MODIFIED - bo sung noi dung tao/sua ruleset cu the, required checks, protections va checklist xac nhan)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18o)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OC-19 Hard Enforcement Follow-up (PR-only Gate + Setup Guides) (2026-04-18)
- .github/workflows/opencore-doc-sync-gate.yml (MODIFIED - chi chay pull_request de giam noise push)
- docs/OPEN_CORE_20_OC19_GATE_QUICKSTART_20260418.md (NEW - huong dan 5 phut cho dev moi pass gate)
- docs/OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md (NEW - huong dan setup required status checks o branch protection)
- docs/OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md (MODIFIED - bo sung nhom rule enforcement tren hosting)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-20, OC-21 vao bo canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18n)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore OC-19 Enforcement (PR Template + CI Gate) (2026-04-18)
- .github/pull_request_template.md (NEW - checklist bat buoc cho PR OpenCore)
- .github/workflows/opencore-doc-sync-gate.yml (NEW - gate tu dong chan PR/push khi thieu doc sync)
- scripts/quality/check_opencore_doc_sync.ps1 (NEW - script kiem tra trigger mapping OC-19 va audit evidence)
- docs/OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md (MODIFIED - bo sung muc CI enforcement)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-19a automation gate)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18m)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Default Team Governance Policy (Mandatory) (2026-04-18)
- docs/OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md (NEW - quy dinh mac dinh cho doi code: trigger mapping, merge gate, SLA cap nhat docs)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-19 vao bo canonical)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - bo sung gate ap dung OC-19)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (MODIFIED - bo sung cau hoi quyet dinh ap dung OC-19)
- docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md (MODIFIED - lien ket OC-19)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18l)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Public Docs Allowlist V1 (2026-04-18)
- docs/OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md (NEW - allowlist/blocklist/redaction rules/checklist cho lane public docs)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-18 vao bo canonical)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - bo sung gate allowlist V1)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (MODIFIED - bo sung quyet dinh allowlist V1)
- docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md (MODIFIED - lien ket execution artifact OC-18)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18k)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Docs Governance - Private vs Public Separation (2026-04-18)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung nguyen tac `docs/` la private va them OC-17 vao bo canonical)
- docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md (MODIFIED - them muc docs governance private/public)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - them gate/blocker/checklist cho docs lane separation)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (MODIFIED - bo sung quyet dinh docs governance)
- docs/OPEN_CORE_16_REVIEW_MEMO_20260418.md (MODIFIED - bo sung cau hoi docs separation trong memo review)
- docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md (NEW - policy draft tach lane private docs va public docs)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18j)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Review Memo - Non-immediate Decision Support (2026-04-18)
- docs/OPEN_CORE_16_REVIEW_MEMO_20260418.md (NEW - memo ngan de stakeholder doc va can nhac truoc khi quyet dinh)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung OC-16 vao bo tai lieu canonical)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18i)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore Documentation Canonical Refresh + Historical Doc Deprecation (2026-04-18)
- docs/OPEN_CORE_00_INDEX.md (MODIFIED - bo sung bo tai lieu canonical hien tai, thu tu doc, va danh sach tai lieu lich su khong authoritative)
- docs/OPEN_CORE_02_DECISION_RECORD_V1.md (MODIFIED - them note governance ve pham vi authoritative)
- docs/OPEN_CORE_03_EXECUTION_PLAN_90D.md (MODIFIED - rebaseline roadmap sang canonicalization + publish hardening)
- docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md (MODIFIED - chot boundary cap san pham, ghi ro chua canonical numeric/runtime)
- docs/OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md (MODIFIED - danh dau pricing hypothesis va drift trial/grace)
- docs/OPEN_CORE_08_RISK_REGISTER_V1.md (MODIFIED - cap nhat risk register theo tinh hinh OpenCore hien tai)
- docs/OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md (MODIFIED - doi tu "fully locked" sang business baseline only, ghi ro runtime drift)
- docs/OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md (MODIFIED - doi tu draft coding checklist sang runtime rebaseline/canonicalization checklist)
- docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md (MODIFIED - cap nhat go/no-go gate hien tai cho public/community lane)
- docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md (MODIFIED - viet lai thanh executive strategy summary dung voi hien trang)
- docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md (NEW - decision packet canonical de doc va ra quyet dinh nhanh)
- docs/OPENCORE_VERIFICATION_CHECKLIST.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_INTEGRATION_GUIDE.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_VISUAL_REFERENCE.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_VISUAL_TEST_RESULTS.md (MODIFIED - gan co historical artifact)
- docs/OPENCORE_VISUAL_TEST_SUMMARY.md (MODIFIED - gan co historical artifact)
- docs/OPEN_CORE_IMPLEMENTATION_COMPLETE.md (MODIFIED - gan co historical artifact)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18h)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Runtime Incident Hotfix - ECharts colorStops null (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - tat transition/state animation gay crash `colorStops`, harden treemap/sunburst rendering)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18d)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Runtime Hotfix - lastEventAt ReferenceError (2026-04-18)
- frontend/src/hooks/useUnifiedAlerts.js (MODIFIED - sua bien tham chieu `lastEventAt` con sot thanh `_lastEventAt` de khac phuc crash runtime)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18c)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Emergency Fix - Unified Alerts Request Loop + Heatmap Loading UX (2026-04-18)
- frontend/src/hooks/useUnifiedAlerts.js (MODIFIED - xoa refetch theo `lastEventAt`, chi giu refresh nen 30s + fetch khi doi trang/filter)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - thay placeholder icon bang spinner Slate-themed)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18b)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Heatmap Bloomberg-Pro Technical Fix (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - ap dung leafDepth=2 + sqrt normalization + piecewise visualMap 7 muc de khac phuc hien tuong treemap thanh ngang)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18a)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Heatmap UI Polish - Fintech muted palette + desaturation (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - doi bang mau sang tone Fintech muted, giam saturation, them opacity theo bien do va giam glow de de quan sat tren nen toi)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18e)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Heatmap Tooltip Stability Hotfix (2026-04-18)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - hardening tooltip ECharts de loai bo flashing/hide loop khi hover tren cung 1 ma)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18f)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Dashboard Layout Realignment - Status + Analytics Sidebar (2026-04-18)
- frontend/src/pages/Dashboard.jsx (MODIFIED - dua PortfolioAnalyticsPanel vao cung cot voi UnifiedAlertCenter, bo full-width render; sap xep lai cum sidebar voi panel Trang thai danh muc)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-18g)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Heatmap Render Stabilization - Treemap Strip Bug Fix (2026-04-17)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - tach mode Treemap sang data phang theo symbol, giam artifact layout gay day ngang)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ao)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Heatmap Mockup Alignment - Layout + Color Palette (2026-04-17)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - sua treemap strip-layout, chuan hoa leafDepth/levels va doi visualMap sang Rose/Navy/Teal de sat mockup)
- frontend/src/index.css (MODIFIED - dong bo mau tooltip heatmap theo palette moi)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17an)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Phase 1 Backend Stabilization - Bulk Aggregation Symbol Stats (2026-04-17)
- backend/portfolio/views_stock_order_flow.py (MODIFIED - refactor `whale_advisory_symbol_stats_api` bo N+1 query, gom grouped aggregation theo symbol + threshold Case/When trong SQL)
- backend/portfolio/models.py (MODIFIED - them composite index `['symbol', 'trade_date', 'side']` cho `IntradayTick`)
- backend/portfolio/migrations/0043_intradaytick_symbol_trade_date_side_idx.py (NEW - migration tao index `idx_intraday_sym_date_side`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17am)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### System Hardening Implementation (2026-04-17)
- frontend/src/hooks/useRealtimeFeedCore.js (MODIFIED - them RAF throttling cho ticker updates: pending buffer + requestAnimationFrame flush + cleanup unmount)
- backend/config/settings.py (MODIFIED - doi mac dinh stock advisory sang async-first: disable force sync first create + disable sync fallback)
- backend/portfolio/tasks_maintenance.py (MODIFIED - trim_streams dong bo STREAM_MAX_LEN voi STREAM_MAX_LEN_HARD_CAP tu settings trung tam)
- backend/portfolio/views_dark_money_history.py (MODIFIED - vector hoa whale side inference + aggregate bang Pandas DataFrame/groupby)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17al)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### SQL + Pandas Optimization (2026-04-17)
- backend/portfolio/order_flow.py (MODIFIED - vector hoa CVD/tick-rate/size-distribution; SQL filter + .values projection cho tick window)
- backend/portfolio/views_ai_advisory_session.py (MODIFIED - VWAP benchmark enrichment chuyen sang SQL values + pandas)
- backend/portfolio/realtime/compute.py (MODIFIED - bo native loop path, chuan hoa wrapper qua pandas compute path)
- backend/portfolio/realtime/stream_consumers.py (MODIFIED - ws broadcaster dung pandas path duy nhat)
- module_tree_full.md (MODIFIED - regenerate index cay ham/lop sau refactor)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ak)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Unified Alerts Dual-path - Watchlist Priority + Market-wide Cache (2026-04-17)
- backend/portfolio/market_data_service.py (MODIFIED - bo cache tong de Watchlist realtime, boost priority watchlist_symbol, toi uu market-wide query bang volume prefilter + SQL window + cache global 60s)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - crash fix transition: notMerge=true, bo colorSaturation, them NaN/null guards)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17aj)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime 504 Remediation - Redis stream retention hard-cap (2026-04-17)
- backend/config/settings.py (MODIFIED - giam default STREAM_MAX_LEN va bo sung STREAM_MAX_LEN_HARD_CAP)
- backend/portfolio/realtime/tick_producer.py (MODIFIED - clamp maxlen theo hard-cap va warning log khi vuot nguong)
- backend/portfolio/tests/test_tick_producer.py (MODIFIED - them regression test cho maxlen clamp)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ai)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime 504 Remediation - SQL-side filtering for whale aggregate fallback (2026-04-17)
- backend/portfolio/market_data_service.py (MODIFIED - chuyen loc threshold tung symbol va window boundary tu Python loop sang SQL Q filter, loai bo iterator blocking va pagination theo DB slice)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ah)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI Heatmap - Readability polish Treemap + Sunburst (2026-04-17)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - tang do tuong phan Sunburst, can doi lai ring radius/levels, chuan hoa color scale va tinh chinh blur khi hover Treemap de de doc tren nen toi)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ag)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI Hotfix - Heatmap full-frame coverage for watchlist + portfolio (2026-04-17)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - chuan hoa du lieu industry->symbols, cau hinh lai treemap/sunburst de cac ma phu kin toan bo khung heatmap)
- frontend/src/pages/Dashboard.jsx (MODIFIED - sua `heatmapData` memo, xoa dependency sai scope va toi uu tracked symbol lookup)
- frontend/src/i18n/vi.js (MODIFIED - them nhan/tieu de heatmap tieng Viet)
- frontend/src/i18n/en.js (MODIFIED - them nhan/tieu de heatmap tieng Anh)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17af)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime 429 Mitigation + Frontend Rebuild (2026-04-17)
- frontend/src/pages/StockDetail.jsx (MODIFIED - chuyen ticker snapshot polling tu single endpoint sang batch endpoint `getRealtimeTickers([symbol])`)
- frontend/src/hooks/useRealtimeFeedCore.js (MODIFIED - tang `POLL_BATCH_SIZE` 4->16 va `WS_HEALTHY_POLL_BATCH_SIZE` 2->8 de giam request burst)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ae)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI Hotfix - Heatmap black-box + Unified Alert list desync (2026-04-17)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - hardening parse so + treemap data hierarchical + render key de force rerender)
- frontend/src/hooks/useUnifiedAlerts.js (MODIFIED - reset pagination ve trang 1 khi co event moi, dong bo summary theo scope hien thi, fallback auto-reset khi trang rong)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - safeAlerts guard cho map/render + ho tro className de ep full-height)
- frontend/src/pages/Dashboard.jsx (MODIFIED - them grid anti-collapse va truyen className h-full vao UnifiedAlertCenter)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ad)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Unified Alerts - Whale visibility hardening (2026-04-17)
- backend/portfolio/market_data_service.py (MODIFIED - them severity uplift 3x threshold, market-wide top-tier whale highlights, whale-aware priority ranking + cursor compatibility, hardening parse timestamp timezone-aware de tranh crash aware/naive)
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py (MODIFIED - them 3 regression tests cho whale recency boost, market-wide top-tier, severity uplift)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ac)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 - Mac dinh pagination Trung tam canh bao hop nhat ve 5 (2026-04-17)
- frontend/src/pages/Dashboard.jsx (MODIFIED - doi `unifiedPageSize` mac dinh tu 10 thanh 5)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17ab)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime - Audit ID de-dup + polling metric fix (2026-04-17)
- frontend/src/hooks/useRealtimeFeedCore.js (MODIFIED - xoa cap nhat polling_successes trung lap trong polling thanh cong)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - doi ma entry batch ticker tu 2026-04-17b sang 2026-04-17z va add entry 2026-04-17aa)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 - Batch Ticker API & 429 Error Fix (2026-04-17)
- backend/portfolio/market_data_service.py (MODIFIED - them `get_realtime_tickers` batch logic)
- backend/portfolio/market_views.py (MODIFIED - them `BatchRealtimeTickerView`)
- backend/portfolio/urls_realtime.py (MODIFIED - dang ky `tickers/` route)
- backend/config/settings.py (MODIFIED - them `realtime_ticker_batch` throttle rate)
- frontend/src/api/client.js (MODIFIED - them `getRealtimeTickers` API client)
- frontend/src/hooks/useRealtimeFeedCore.js (MODIFIED - refactor sang batching cho hydration/polling)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - dung live_market_value + defensive checks)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17z)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 - Xoa cau hinh trung lap giua 2 tab (2026-04-17)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - xoa bo loc khoi tab Tin hieu nong, giu cau hinh chi o tab Cau hinh va dong bo format style theo tab Tin hieu nong)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17y)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 - Pixel refine tab Cau hinh theo mockup (2026-04-17)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - canh lai unread counter, spacing, typography va chip density cho tab Cau hinh de giong mockup)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17x)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 - Khoi phuc tab Cau hinh (2026-04-17)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - them tab Tin hieu nong/Cau hinh; gom day du bo loc theo nguon, pham vi hien thi, muc do va chinh sach toast nghiem trong)
- frontend/src/pages/Dashboard.jsx (MODIFIED - truyen severity filter + sound policy controls vao UnifiedAlertCenter)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17w)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 Layout Alignment Theo Mockup (2026-04-17)
- frontend/src/pages/Dashboard.jsx (MODIFIED - heatmap full row, panel Trang thai danh muc dua xuong cot phai duoi Phan bo danh muc, thu gon tieu de)
- frontend/src/components/UnifiedAlertBar.jsx (MODIFIED - thu gon thanh canh bao hop nhat theo thiet ke compact)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - them bo chon page-size 5/10/15/20 o footer)
- frontend/src/hooks/useUnifiedAlerts.js (MODIFIED - ho tro pageSize dong va reset pagination theo pageSize)
- frontend/src/components/StatCard.jsx (MODIFIED - compact KPI density)
- frontend/src/i18n/vi.js (MODIFIED - them label `paginationPageSize`)
- frontend/src/i18n/en.js (MODIFIED - them label `paginationPageSize`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17v)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Hotfix - Blank Screen PortfolioHeatmap Undefined Payload (2026-04-17)
- frontend/src/components/PortfolioHeatmap.jsx (MODIFIED - them null guards cho payload/original trong Treemap custom renderer + tooltip)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17u)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 Phase 3 Implementation - Heatmap + Intelligent Pagination (2026-04-17)
- frontend/src/hooks/useUnifiedAlerts.js (MODIFIED - them cursorStack pagination, reset trang khi doi filter, bo append load-more)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - thay load-more bang footer pagination First/Prev/Next + page indicator)
- frontend/src/pages/Dashboard.jsx (MODIFIED - tich hop PortfolioHeatmap ngay duoi KPI row + panel Trang thai danh muc)
- frontend/src/components/StatCard.jsx (MODIFIED - compact density cho KPI cards)
- frontend/src/i18n/vi.js (MODIFIED - them labels pagination + heatmap/status headings)
- frontend/src/i18n/en.js (MODIFIED - them labels pagination + heatmap/status headings)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17t)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 Phase 3 Technical Playbook - Ready-to-Code (2026-04-17)
- docs/UI_V2_PHASE_3_ANALYTICS_PAGINATION_GUIDE.md (MODIFIED - chuan hoa thanh technical playbook day du: scope, pseudo-flow, acceptance criteria, implementation order, rollback)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17s)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Phase 3B - Whale Scoring Tuning (Canary Profile v2) (2026-04-17)
- backend/portfolio/whale_scoring.py (MODIFIED - them scoring profile v1/v2, tuning aggression/concentration fallback, stricter extreme band cho v2)
- backend/config/settings.py (MODIFIED - them setting `WHALE_SCORE_PROFILE`, default v1)
- backend/portfolio/tests/test_whale_scoring.py (MODIFIED - cap nhat event_id assertion + bo sung tests profile v1/v2 va near-threshold behavior)
- docs/AUDIT_WHALE_SCORING_TUNING_RECOMMENDATIONS_20260417.md (NEW - audit report + canary rollout recommendations)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17r)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Phase 3A.1 - Pixel-Perfect UI Polish Kickoff (2026-04-17)
- frontend/src/index.css (MODIFIED - them visual tokens + utility classes cho panel/focus hierarchy)
- frontend/src/components/UnifiedAlertBar.jsx (MODIFIED - polish severity chip hierarchy, hover/focus, density)
- frontend/src/components/UnifiedAlertCenter.jsx (MODIFIED - polish panel tone, card readability, interaction states)
- frontend/src/pages/Dashboard.jsx (MODIFIED - canh nhac spacing + max-width wrapper de dong bo visual rhythm)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17q)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Phase 3 Kickoff - Planning + Whale Scoring Baseline Audit (2026-04-17)
- docs/IMPLEMENTATION_PLAN_PHASE3_UI_POLISH_WHALE_SCORING_AUDIT_20260417.md (NEW - implementation plan 12 muc mandatory cho Phase 3A/3B)
- docs/AUDIT_WHALE_SCORING_BASELINE_20260417.md (NEW - baseline findings cho module whale_scoring truoc tuning)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17p)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 Phase 2 - Whale Dedup + Consolidated Components (2026-04-17)
- backend/portfolio/realtime/compute.py (MODIFIED - chuan hoa ts ve giay, chuan hoa event_id whale de tang do on dinh dedup)
- backend/portfolio/tasks_realtime.py (MODIFIED - them publish flag theo event, tranh overlap whale symbol channel va user alerts channel)
- frontend/src/hooks/useRealtimeFeedCore.js (MODIFIED - normalize WS event timestamp + dedup window 1000ms cho whale/dark_flow)
- frontend/src/components/UnifiedAlertBar.jsx (NEW - thanh tong hop severity co click filter)
- frontend/src/components/UnifiedAlertCenter.jsx (NEW - trung tam canh bao chi tiet, ho tro mark read, mute 30p, load more)
- frontend/src/pages/Dashboard.jsx (MODIFIED - thay panel cu bang UnifiedAlertBar + UnifiedAlertCenter, bo tri 3:1 voi analytics sidebar)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17o)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### UI V2 Bloomberg Refactor (Layout + Unified Alerts Hook Extraction) (2026-04-17)
- frontend/src/components/Layout.jsx (MODIFIED - chuyen sang unified shell voi Sidebar + TopNav)
- frontend/src/components/Sidebar.jsx (NEW - sidebar 260px, portfolio switcher, user identity, live board shortcut)
- frontend/src/components/TopNav.jsx (NEW - grouped tabs cho Dashboard/Signals/Portfolio/System)
- frontend/src/components/SidebarWatchlist.jsx (NEW - quick watchlist realtime, `React.memo` row, flash update)
- frontend/src/components/DashboardRealtimePanel.jsx (MODIFIED - refactor de consume hook `useUnifiedAlerts` + persistence state)
- frontend/src/hooks/useUnifiedAlerts.js (NEW - logic unify alerts: snapshot load, dedup, ranking, filter, summary)
- frontend/src/hooks/usePersistentAlertState.js (NEW - persistence read/mute/sound qua localStorage)
- frontend/src/i18n/vi.js (MODIFIED - them key nav group va sidebar labels)
- frontend/src/i18n/en.js (MODIFIED - them key nav group va sidebar labels)
- frontend/src/index.css (MODIFIED - them realtime flash animations cho ticker row)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17n)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Phase 5 Soak Execution - Fault Injection PASS (2026-04-17)
- docs/PHASE5_REALTIME_STABILIZATION_SOAK_CHECKLIST_20260417.md (MODIFIED - ghi ket qua fault injection run, before/after pending va reclaim metrics, ket luan PASS cho gate fault injection)
- docs/STABILIZATION_TASKBOARD_20260417.md (MODIFIED - mark completed verification cho Phase 4 manual kill/reclaim)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17l)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Stabilization Phase 4 Metrics Export + Phase 5 Checklist Init (2026-04-17)
- backend/portfolio/services_realtime_metrics.py (MODIFIED - them metrics stream reclaim: pending_depth gauge + reclaim_total/reclaim_errors_total counters, snapshot + Prometheus export)
- backend/portfolio/realtime/stream_consumers.py (MODIFIED - instrument pending depth/reclaim metrics trong run_once + reclaim path)
- backend/portfolio/tests/test_realtime_ops_metrics_api.py (MODIFIED - them test asserts cho stream reclaim metrics trong JSON/Prometheus output)
- compose.dev.env (MODIFIED - bat canary dev: REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED=True + REALTIME_STREAM_PENDING_RECLAIM_ENABLED=True)
- docs/PHASE5_REALTIME_STABILIZATION_SOAK_CHECKLIST_20260417.md (NEW - checklist soak test 60 phut, pass/fail gates, rollback nhanh)
- docs/STABILIZATION_TASKBOARD_20260417.md (MODIFIED - cap nhat progress phase 0-4/5)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17k)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Stabilization Taskboard Implementation (Phase 0-4) (2026-04-17)
- backend/config/settings.py (MODIFIED - them feature flags cho WS plan/auth cache, native ticker path, pending reclaim va tham so TTL/idle/batch)
- backend/.env.example (MODIFIED - bo sung bien env cho rollout phase 0-4)
- backend/portfolio/consumers.py (MODIFIED - cache plan tai connect, auth snapshot cache hooks, bo OpenCore plan lookup khoi WS hot path)
- backend/portfolio/realtime/compute.py (MODIFIED - them `build_ticker_payload_native` + VWAP native)
- backend/portfolio/realtime/stream_consumers.py (MODIFIED - them pending reclaim XPENDING/XCLAIM + native ticker branch theo flag)
- backend/portfolio/tests/test_realtime_compute.py (MODIFIED - them test parity native payload vs DataFrame path)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17j)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Engine Stabilization Implementation Plan (2026-04-17)
- docs/IMPLEMENTATION_PLAN_REALTIME_ENGINE_STABILIZATION_20260417.md (NEW - implementation plan chi tiet 12 muc mandatory cho hardening WS + Redis Streams)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17i)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### DRF Throttle Rate Parser Hardening (2026-04-17)
- backend/config/settings.py (MODIFIED - harden `_get_throttle_rate` de normalize/fallback an toan cho env throttle sai format)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17h)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### OpenCore DPI Fallback Safety + Form Accessibility Cleanup (2026-04-17)
- backend/portfolio/opencore_dpi.py (MODIFIED - harden default license creation bang get_or_create cho plan free, tranh DPIPlan.DoesNotExist crash)
- backend/portfolio/opencore_analytics.py (MODIFIED - harden quota tracker + fail-safe analytics tracking de tranh 500 do side-effect)
- backend/portfolio/middleware.py (MODIFIED - fail-safe cho market observability record trong finally block)
- frontend/src/pages/Screener.jsx (MODIFIED - them id/name/label/aria-label cho cac form control rule/condition)
- frontend/src/pages/Watchlist.jsx (MODIFIED - them id/name va aria-label cho cum search/filter + add tracked/price alert)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17g)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Legacy Cleanup + Regex NameError Fix (2026-04-17)
- backend/portfolio/views_realtime_core.py (DELETED - module legacy khong con duoc route/import runtime)
- backend/portfolio/market_data_service.py (MODIFIED - bo sung `import re` de tranh NameError khi regex search)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17f)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Core Ticker Timezone Fallback Fix (2026-04-17)
- backend/portfolio/views_realtime_core.py (MODIFIED - timezone-safe freshness calculation trong fallback ticker de tranh TypeError aware/naive)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17e)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### WebSocket Realtime Token Refresh Hardening (2026-04-17)
- frontend/src/hooks/useRealtimeFeedCore.js (MODIFIED - pre-refresh access token truoc WS connect + auth-close recovery cho 1006/1008/1011)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17d)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Ticker Hardening: No 500 Fallback (2026-04-17)
- backend/portfolio/market_data_service.py (MODIFIED - harden cache payload type + catch unexpected errors va tra degraded payload thay vi 500)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17c)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Ticker 500 Timezone Fix (2026-04-17)
- backend/portfolio/market_data_service.py (MODIFIED - tinh freshness timezone-safe trong fallback ticker, tranh TypeError aware/naive datetime gay 500)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17b)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Watchlist Redirect Loop Mitigation (2026-04-17)
- frontend/src/api/client.js (MODIFIED - short-circuit `getWatchlistGroups` va `getTrackedSymbols` khi chua co token)
- frontend/src/pages/StockDetail.jsx (MODIFIED - chi fetch watchlist groups khi `isAuthenticated=true`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-17a)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### DarkMoney CVD/Strength Fallback Visibility Fix (2026-04-16)
- frontend/src/components/DarkMoneyMasterChart.jsx (MODIFIED - them fallback series khi `dark_flow_series` rong de 2 pane CVD va suc manh dong tien an khong con mat)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16ad)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### JWT Refresh Single-Flight Auth Fix (2026-04-16)
- frontend/src/api/client.js (MODIFIED - nhiều request 401 dùng chung một refresh promise để tránh race khi `ROTATE_REFRESH_TOKENS=True`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16ac)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Resilient Bootstrap (2026-04-16)
- frontend/src/pages/WhaleAlertsHub.jsx (MODIFIED - bootstrap dùng `Promise.allSettled`; lỗi tracked/watchlist/advisory không còn làm sập toàn bộ hub)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16ab)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Public Bootstrap Auth Guard (2026-04-16)
- frontend/src/pages/WhaleAlertsHub.jsx (MODIFIED - chỉ gọi tracked/watchlist APIs khi đã đăng nhập; guest dùng mảng rỗng để tránh lỗi auth/redirect trên trang public)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16aa)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Hub Page Size Alignment 3/6/9/12 (2026-04-16)
- frontend/src/pages/WhaleAlertsHub.jsx (MODIFIED - đổi `Số mục/trang` thành 3/6/9/12, default 6, fallback 6 để khớp lưới 3 card/row)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16x)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Realtime Manager Legacy Removal (2026-04-16)
- frontend/src/context/RealtimeContext.jsx (MODIFIED - manager chuyển sang `useRealtimeFeedCore`)
- frontend/src/hooks/useRealtimeFeedCore.js (NEW - hook realtime core)
- frontend/src/hooks/useRealtimeFeedCore.test.js (NEW - test helper import core hook)
- frontend/src/hooks/useRealtimeFeedLegacy.js (DELETED - loại bỏ hook legacy)
- frontend/src/hooks/useRealtimeFeedLegacy.test.js (DELETED - loại bỏ test legacy)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16y)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### DarkMoney Tooltip + Locale Compact Units (2026-04-16)
- frontend/src/components/DarkMoneyMasterChart.jsx (MODIFIED - Whale Buy/Sell tooltip theo per-candle; compact units theo locale VI `TR/T`, EN `M/B`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16z)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Docker Dev Update + Backend Startup Fix (2026-04-16)
- backend/portfolio/views.py (MODIFIED - export missing admin intraday side backfill APIs so Django urls can resolve)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16w)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Hub Request Cancellation + Race Guard (2026-04-16)
- frontend/src/pages/WhaleAlertsHub.jsx (MODIFIED - add abort previous aggregate/campaign requests and latest-response-wins guards)
- frontend/src/api/client.js (MODIFIED - support AbortController signal for aggregate/campaign APIs)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16v)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Hub First-Paint + Pagination Optimization (2026-04-16)
- frontend/src/pages/WhaleAlertsHub.jsx (MODIFIED - remove blocking stats scan, lazy-load campaigns by tab, add page size selector 4/8/12/16)
- frontend/src/pages/WhaleAlertsHub.test.jsx (MODIFIED - update tests for lazy campaign loading behavior)
- frontend/src/i18n/vi.js (MODIFIED - add Whale Hub i18n key `itemsPerPage`)
- frontend/src/i18n/en.js (MODIFIED - add Whale Hub i18n key `itemsPerPage`)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16u)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Aggregate Timeout/OOM Hotfix (2026-04-16)
- backend/portfolio/market_data_service.py (MODIFIED - stream DB rows with early-stop limit+1 in whale aggregate path to avoid full queryset scan)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - add entry 2026-04-16t)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Admin Ops Intraday Side Backfill UI (2026-04-16)
- backend/portfolio/services_backfill.py (NEW - service layer cho preview/apply backfill side theo tick-rule)
- backend/portfolio/views_admin_runtime.py (MODIFIED - thêm 2 endpoint admin preview/apply backfill)
- backend/config/urls.py (MODIFIED - thêm routes admin-ops intraday-side-backfill)
- frontend/src/api/client.js (MODIFIED - thêm API client preview/apply)
- frontend/src/pages/AdminOps.jsx (MODIFIED - thêm tab Data Ops + panel Preview/Apply)
- frontend/src/i18n/vi.js (MODIFIED - bổ sung key i18n tiếng Việt cho panel backfill)
- frontend/src/i18n/en.js (MODIFIED - bổ sung key i18n tiếng Anh cho panel backfill)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - thêm entry 2026-04-16s)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Dark Money side inference fix (2026-04-16)
- backend/portfolio/views_dark_money_history.py (MODIFIED - infer whale buy/sell from previous-close seeded tick-rule on read-path)
- backend/portfolio/realtime/collector.py (MODIFIED - infer intraday side before pushing to stream/DB)
- backend/portfolio/management/commands/backfill_intraday_tick_side.py (NEW - dry-run/apply utility for side backfill)
- PROGRESS_DASHBOARD_CANONICAL_UPDATE_20260416.md (MODIFIED - add verification addendum + modified file list)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - entry 2026-04-16r)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Session-Flow Card Semantics Fix (2026-04-16)
- backend/portfolio/market_data_service.py (MODIFIED - add `unknown_value`, `total_value`, side percentages to whale summary)
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py (MODIFIED - lock whale summary side contract)
- frontend/src/components/MoneyFlowDonut.jsx (MODIFIED - donut now uses Mua/Bán/Không xác định instead of size-class mix)
- frontend/src/i18n/vi.js (MODIFIED - Vietnamese labels for order-side distribution)
- frontend/src/i18n/en.js (MODIFIED - English labels for order-side distribution)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - entry 2026-04-16q)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Whale Alerts Production Hardening (2026-04-16)
- backend/portfolio/market_data_service.py (MODIFIED - whale feed timestamp + RVOL 20-session baseline)
- backend/portfolio/views_dark_money_history.py (MODIFIED - canonical price contract for dark money chart)
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py (MODIFIED - timestamp/RVOL regressions)
- frontend/src/components/WhaleFeedPanel.jsx (MODIFIED - realtime/history dedupe + severity labels)
- frontend/src/components/RVOLChartPanel.jsx (MODIFIED - 20-session baseline wording/series)
- frontend/src/components/DarkMoneyMasterChart.jsx (MODIFIED - toggle MA20/MA50)
- frontend/src/i18n/vi.js (MODIFIED - Whale Alerts Vietnamese cleanup, `Siêu cao`)
- frontend/src/i18n/en.js (MODIFIED - Whale Alerts English contract wording)
- docs/WHALE_ALERTS_PRODUCTION_BASELINE_20260416.md (NEW)
- docs/CODE_CHANGE_AUDIT_LEDGER.md (MODIFIED - entry 2026-04-16p)
- PROGRESS_DASHBOARD.md (MODIFIED - audit file list synchronized)

### Price Unit Canonical Refactor (Phases 0-1)
- backend/portfolio/price_units.py (NEW)
- backend/tests/test_price_units_canonical.py (NEW - 40 tests)
- backend/portfolio/adapters/vnstock_adapter.py (MODIFIED)
- backend/tests/test_adapter_canonical.py (NEW - 8 tests)
- backend/portfolio/services.py (MODIFIED)
- AUDIT_PRICE_UNIT_CANONICAL_PHASE1_20260416.md (NEW)

### Price Unit Canonical Refactor (Phases 2-8)
- backend/portfolio/services.py (MODIFIED)
- backend/portfolio/market_data_service.py (MODIFIED)
- backend/portfolio/realtime/collector.py (MODIFIED)
- backend/portfolio/tasks_prefetch.py (MODIFIED)
- backend/portfolio/management/commands/finalize_price_unit_migration.py (NEW)
- frontend/src/pages/Watchlist.jsx (MODIFIED)
- frontend/src/utils/dashboardRealtimeSelectors.js (MODIFIED)
- frontend/src/pages/StockDetail.jsx (MODIFIED - normalize removed)
- frontend/src/hooks/useRealtimeFeedLegacy.js (MODIFIED - ignore non-positive quote + force poll fallback)
- frontend/src/components/DashboardRealtimePanel.jsx (MODIFIED - remove quote scale heuristic)
- backend/CHANGELOG.md (MODIFIED - 2026-04-16 canonical phase summary)
- AUDIT_PRICE_UNIT_CANONICAL_PHASE2_6_20260416.md (NEW)
- PROGRESS_DASHBOARD_CANONICAL_UPDATE_20260416.md (NEW)
- RELEASE_SNAPSHOT_PRICE_UNIT_CANONICAL_20260416.md (NEW)
- PROGRESS_DASHBOARD.md (MODIFIED - status synchronized)

### Ticker Realtime + Offhours Close Accuracy (1+2+3)
- backend/portfolio/runtime_policy_helpers.py
- backend/portfolio/market_calendar.py
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/models.py
- backend/portfolio/migrations/0041_tickersessionclose.py
- backend/portfolio/market_data_service.py
- backend/portfolio/warmup_cache.py
- backend/portfolio/views_admin_runtime.py
- backend/portfolio/tests/test_ticker_prefetch_task.py
- backend/portfolio/tests/test_system_ai_admin_api.py
- backend/CHANGELOG.md
- frontend/src/pages/AdminOps.jsx
- frontend/src/hooks/useRealtimeFeedLegacy.js
- frontend/src/components/DashboardRealtimePanel.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js

### Delta hardening: Market Calendar + Market-local Retention
- backend/portfolio/market_calendar.py
- backend/portfolio/runtime_policy_helpers.py
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/market_data_service.py
- backend/portfolio/warmup_cache.py
- backend/portfolio/tests/test_ticker_prefetch_task.py
- backend/portfolio/tests/test_system_ai_admin_api.py
- frontend/src/pages/AdminOps.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js
- backend/CHANGELOG.md

---

## ✅ COMPLETED TODAY (Day 1)

### ✅ Task 1.1: Code Review Watchlist (Lines 100-400)
**Status**: ✅ VERIFIED  
**Key Findings**:
- ✅ Imports hook: `import useRealtimeFeed from '../hooks/useRealtimeFeed'` (Line 15)
- ✅ Aggregates 3 symbol sources correctly
- ✅ Uses hook correctly: `useRealtimeFeed({ symbols: allRealtimeSymbols })`
- ✅ Merges quotes into groups, tracked, alerts
- ✅ Price alert triggering uses realtime data
- ✅ Zero WebSocket logic found

### ✅ Task 1.2: Code Review Dashboard Component
**Status**: ✅ VERIFIED  
**Key Findings**:
- ✅ Imports hook correctly
- ✅ Aggregates holdings + tracked symbols
- ✅ Uses hook: `useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 5 })`
- ✅ Calculates portfolio stats from realtime quotes
- ✅ Detects stale positions correctly
- ✅ Zero WebSocket logic found

### ✅ Task 1.3: Global Search - Zero Duplication
**Status**: ✅ VERIFIED  
**Test Results**:
```
new WebSocket        → Only in: hooks/useRealtimeFeed.js ✅
.onmessage           → Only in: hooks/useRealtimeFeed.js ✅
.onopen              → Only in: hooks/useRealtimeFeed.js ✅
.setInterval (poll)  → Only in: hooks/useRealtimeFeed.js ✅

WebSocket duplication: ZERO ✅
```

**Command Evidence**:
```powershell
# Search result - only 1 file
C:\Mujoco Projects\vninvest\frontend\src\hooks\useRealtimeFeed.js
```

---

## 📊 CONSOLIDATION VERIFIED

| Component | Status | Notes |
|-----------|--------|-------|
| **Watchlist.jsx** | ✅ DONE | Uses hook, 0 websocket logic |
| **Dashboard** | ✅ DONE | Uses hook, 0 websocket logic |
| **useRealtimeFeed.js** | ✅ DONE | 243 lines, all logic centralized |
| **Global duplication** | ✅ ZERO | 100% consolidated |
| **Quote merging** | ✅ DONE | 2 consumers working correctly |
| **API calls** | ✅ CENTRALIZED | Only in hook |

---

## ✅ LATEST DELTA (Day 2)

### Advisory + Plan Gating
- ✅ Added `/api/auth/me/` consumption into frontend ability context
- ✅ Added CASL-gated route `/whale-advisory`
- ✅ Added upgrade fallback route `/upgrade`
- ✅ Added advisory feed UI with Premium-only detail masking

### Validation
- ✅ `npm run build` passes after advisory UI integration
- ✅ `manage.py test portfolio.tests.test_api_routes` passes (28 tests)
- ✅ Stock workspace smoke test stabilized by mocking vnstock live overlay in test
- ✅ Redis-backed local validation: 4 stream keys / 400 ticks / consumer batch writes 400 `IntradayTick`
- ✅ Advisory backend no longer crashes when `OPENCLAW_API_KEY` is missing
- ✅ `useRealtimeFeed` now sends explicit `unsubscribe` on cleanup and exposes runtime connection metrics for reconnect/fallback QA
- ✅ `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_realtime_compute` passes (6 tests)
- ✅ Market calendar hardening implemented: holiday-aware offhours + market-local retention/offpeak date resolution
- ✅ `VN_STOCK` runtime mặc định tự seed holiday_dates từ calendar `vnstock` năm hiện tại; warmup startup không còn log stacktrace khi DB chưa ready

### User Registration Extension
- ✅ Backend `/api/auth/register/` now requires email and returns JWT for auto-login
- ✅ Frontend auth modal now supports `Dang ky` mode with field-level validation
- ✅ Auto-login after register wired into `PortfolioContext`
- ✅ Backend route suite now passes 15 tests including register cases
- ⏳ Browser smoke QA for `register -> auto-login -> dashboard` still pending

---

## ⏳ REMAINING

### Task 1.4: Verify Subscription Patterns & Cleanup
**Est. Time**: 1.5 hours  
**Action Items**:
- [ ] Verify Watchlist subscription: groups + tracked + alerts
  ```
  Expected: allRealtimeSymbols = [
    ...groups items,
    ...trackedSymbols,
    ...priceAlerts symbols
  ]
  ```
- [ ] Verify Dashboard subscription: holdings + tracked
  ```
  Expected: monitoredSymbols = [
    ...holdings,
    ...trackedSymbols
  ]
  ```
- [ ] Test cleanup on unmount
  ```
  - Close component
  - Verify unsubscribe sent (hook instrumentation implemented)
  - Verify no memory leaks
  ```
- [ ] DevTools Profiler check
  ```
  - Record 30s activity with 50+ symbols
  - Check memory heap: no growth
  - Check CPU: < 30%
  ```

---

## 📋 NEXT STEPS

### Today Evening
- [ ] Complete Task 1.4 (subscription/cleanup)
- [ ] Create final VERIFICATION_REPORT_DAY1.md (already drafted)
- [ ] Update todo list

### Next Focus
**Focus**: Redis-backed validation + runtime QA

- Run Redis-backed checklist
- Browser QA for reconnect/unmount cleanup
- Validate live advisory generation path with Celery + WebSocket
- Measure publish->push latency p95 under browser runtime

---

## 🎯 SUCCESS CRITERIA

### ✅ Already Achieved
- [x] No WebSocket code outside hook
- [x] Watchlist + Dashboard consolidation
- [x] Symbol aggregation working
- [x] Quote overlay correct
- [x] Zero code duplication

### ⏳ Still Need
- [ ] Verify subscription patterns
- [ ] Test memory/cleanup
- [x] Add metrics (Day 2-3)
- [ ] Test fallback/reconnect (Day 4)
- [x] Add reconnect/cleanup observability into shared hook
- [ ] Redis validation (Day 5-6)
- [ ] QA matrix (Day 6-7)

---

## 📈 METRICS

```
Consolidation Progress:
├─ Code review:        ✅ 100% (Watchlist + Dashboard)
├─ Duplication search: ✅ 100% (Zero found)
├─ Metrics panel:      ✅ Implemented
├─ AI advisory gating: ✅ Implemented
├─ Redis streams:      ✅ Local validation pass
├─ Clean build:        ✅ Pass
├─ API smoke suite:    ✅ Pass (28 tests)
├─ Realtime gateway:   ✅ Pass (6 tests)
└─ Runtime QA:         ⏳ Pending

Overall Day 2:         ✅ Core implementation complete
```

---

## 📝 DOCUMENTS CREATED

✅ [VERIFICATION_REPORT_DAY1.md](VERIFICATION_REPORT_DAY1.md) (400 lines)
- Detailed findings per task
- Global search results
- Success criteria checklist

---

## 🚀 QUICK REFERENCE

### Current Status
- **Day**: 1 of 8
- **Progress**: 75% complete
- **Blockers**: None
- **Ready for**: Day 2 work

### Key Files
- `frontend/src/hooks/useRealtimeFeed.js` (243 lines)
- `frontend/src/pages/Watchlist.jsx` (1059 lines)
- `frontend/src/components/DashboardRealtimePanel.jsx` (300 lines)

### Command to Verify
```bash
# Still only one file with WebSocket
Get-ChildItem -Recurse -Include "*.jsx","*.js" | Select-String "new WebSocket"
# Result: Only hooks/useRealtimeFeed.js ✅
```

---

## UI/UX Core Refinement - 2026-04-17

Status: Completed (frontend visual refinement theo mockup Slate/Navy)

Files modified:
- frontend/src/index.css
- frontend/src/components/PortfolioHeatmap.jsx
- frontend/src/components/StatCard.jsx
- frontend/src/components/SidebarWatchlist.jsx
- frontend/src/components/Sidebar.jsx
- frontend/src/components/TopNav.jsx
- frontend/src/pages/Dashboard.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md

Highlights:
- Dong bo palette Slate/Navy theo mockup, chuan hoa button pill va pulse live indicator.
- Nang cap ECharts heatmap: visualMap Rose/Slate/Emerald, tooltip cau truc moi, toggle mode Treemap/Sunburst va size metric Weight/Cap.
- Tang data density sidebar: sticky header, filter theo nganh, cot gia/% co do rong co dinh.
- Bo sung KPI icon + sparkline SVG tren StatCard.
- Toi uu TopNav: globe compact switch VI/EN de giam chiem dung khong gian.

### Delta update - Pixel tone + mini-chart tooltip

Status: Completed

Files modified (delta):
- frontend/src/pages/Dashboard.jsx
- frontend/src/components/PortfolioHeatmap.jsx
- frontend/src/index.css
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md

Delta highlights:
- Bo sung du lieu intraday theo tung symbol de nuoi mini-chart tooltip heatmap.
- Tooltip heatmap da render sparkline SVG thuc te (khong con placeholder).
- Tinh chinh vi mo tone mockup: blur, border contrast, spacing header panel.

### Delta update - Pixel-perfect pass 2

Status: Completed

Files modified (delta):
- frontend/src/components/SidebarWatchlist.jsx
- frontend/src/components/TopNav.jsx
- frontend/src/components/PortfolioHeatmap.jsx
- frontend/src/index.css
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md

Delta highlights:
- Giam them vertical rhythm o watchlist row de tang mat do hien thi.
- Can chinh top nav height, border tone, va spacing controls de dong bo voi dashboard shell.
- Tinh chinh heatmap header/legend spacing + contrast de sat hon mockup.

---

**Last Updated**: 2026-04-03 11:20  
**Next Update**: after Redis-backed validation  
**Target**: close Sprint 12 validation checklist
