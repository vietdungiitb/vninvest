# VNInvest Roadmap Status (2026-04-03)

## Terminology Normalization

- Canonical naming: `User Management Core` belongs to `Sprint 12`.
- `Sprint 1-2` is an internal planning bucket for plan/tier/CASL design, not the official sprint label for delivered user management.
- `Sprint 13` extends admin operations and user statistics, not the core user management milestone.
- User registration is now implemented as a `Sprint 12 extension`; broader browser QA and sign-off remain open.

## Sprint Completion Overview

### 🚀 Sprint 15 - STARTED (Multi-AI Providers)
**Focus**: Mở rộng AI Advisory từ OpenClaw-only sang đa provider/model  
**Status**: IN PROGRESS

**Scope đã chốt Sprint 15:**
- ✅ UserConfig bổ sung `ai_provider`, `ai_model`, `ai_api_key` (encrypted)
- ✅ API endpoint `GET /api/ai-options/`
- ✅ API endpoint `POST /api/ai-config/test-connection/`
- ✅ Dispatcher task advisory theo provider/model thay vì hard-code OpenClaw
- ✅ UI WhaleAdvisory có form Provider -> Model, API key, Test Connection
- ✅ Chính sách tiết kiệm token: chỉ auto-generate khi chưa có advisory cho symbol
- ✅ Nếu đã có advisory, chỉ refresh khi user bấm nút Refresh thủ công
- ✅ API refresh thủ công `POST /api/portfolio/whale-advisory/<symbol>/refresh/`
- ✅ Pipeline chuẩn bị dữ liệu cho AI advisory (profile + daily/intraday + alerts + advisory history)
- ✅ Prompt grounding theo data context để tăng độ chính xác và giảm hallucination

**Mục tiêu cuối Sprint 15:**
- Hoàn tất migration và rollout an toàn
- Xác nhận chuyển model on-the-fly từ UI hoạt động end-to-end
- Theo dõi token/provider trong log vận hành
- Đảm bảo AI call giảm nhờ cơ chế skip_existing + manual refresh cooldown

---

### 🔧 Sprint 26 - IN PROGRESS (OpenCore License & Billing)
**Focus**: Tích hợp OpenCore multi-tier licensing system vào codebase  
**Status**: Day 1 started (2026-04-07) - integration execution underway

**Scope:**
- ✅ **DONE (Session 2)**: OpenCore implementation (7 files, 2,600 lines)
  - `opencore_dpi.py` - License management (15 models, 35 indexes)
  - `opencore_analytics.py` - Usage tracking & quota enforcement
  - `opencore_premium.py` - Feature gating (12 premium indicators)
  - `opencore_revenue.py` - Billing & invoicing
  - `opencore_celery_tasks.py` - 6 background automation tasks
  - `opencore_api.py` - REST API (13+ endpoints)
  - `opencore_admin.py` - Django admin interface
  
- ✅ **DONE**: Database integration
  - Migration 0020: 15 new models
  - Signal handlers: Auto-license on user signup
  - Celery Beat schedule: Configured (6 tasks)
  - Default data: 3 tiers seeded (Community/Pro/Enterprise)
  
- ✅ **DONE**: Testing
  - Unit tests: 5/5 passed ✓
  - API integration tests: Verified ✓
  - Django check: 0 issues ✓
  
- ✅ **DONE (Day 1)**: Baseline integration audit
  - Xác nhận OpenCore router `/api/opencore/*` đã mount trong `portfolio/urls.py`
  - Xác nhận stock workspace endpoints trọng yếu tại `urls_stock.py` đã sẵn sàng để hook gating
  - Xác nhận command seed plan `initialize_dpi_plans` đang dùng feature keys theo indicator
  - Chốt Sprint26 execution log + tracker cho vận hành hằng ngày

- ⏳ **IN SPRINT 26 (Day 2 onward)**: Feature gating integration
  - Hook `@require_feature()` vào indicator/flow endpoints ưu tiên
  - Test free/pro/enterprise tier access gating theo từng endpoint
  - API call tracking & quota enforcement cho endpoint có tải cao
  - Admin UI testing + demo data
  
**Deliverables:**
- Feature gating working cho tất cả indicators
- Integration tests (10+ scenarios)
- Runbook + demo data seeding  
- Postman collection + frontend checklist
- Docs: SPRINT26_OPENCORE_DETAILED_PLAN.md

**Timeline**: 5-7 ngày làm việc
- Phase 1 (Day 1 done + Days 2-3): Baseline audit + Feature gating integration
- Phase 2 (Days 4-5): Testing & QA
- Phase 3 (Days 6-7): Demo & documentation

**Dependencies**: 
- From: None (independent work)
- To: Sprint 27 (Payment gateway), Sprint 28 (Subscription UI)

---

### ✅ Sprint 27 - COMPLETED (Onboarding Trial Plan Admin Policy)
**Focus**: Chuẩn hóa cơ chế gói trải nghiệm cho user mới qua cấu hình admin  
**Status**: DONE (M1-M6 completed in Sprint execution)

**Business decisions đã chốt:**
- ✅ Danh sách plan áp dụng: `free/basic/pro/premium/admin`
- ✅ Chỉ bỏ qua `superuser`
- ✅ Áp dụng mọi kiểu đăng ký mới (email/password + OAuth)
- ✅ Chỉ cho phép một policy active tại một thời điểm
- ✅ Admin UI đầy đủ ngay phase 1 (policy + user override + audit filter)

**Scope Sprint 27:**
- Tạo model `OnboardingPlanPolicy` + ràng buộc chỉ 1 policy active
- Mở rộng `UserConfig` với metadata nguồn plan và cờ khóa downgrade
- Tạo `PlanAssignmentLog` để audit mọi lần đổi plan
- Hook auto-assign trial plan vào luồng đăng ký user mới
- Job định kỳ auto-downgrade khi hết hạn trial về fallback plan
- Admin UI đầy đủ cho policy, override và audit filter

**Deliverables:**
- Migration + service layer + Celery expiry task
- Admin pages hoàn chỉnh cho policy và audit
- Test matrix pass (unit + integration + admin)
- Runbook rollout 4 pha + rollback bằng feature flags

**Timeline ước lượng:** 3.5 - 4.5 ngày làm việc
- M1: Schema + migration
- M2: Service core
- M3: Registration integration
- M4: Expiry task
- M5: Full admin UI + audit
- M6: Observability + docs finalize

**Dependencies:**
- From: Sprint 26 không chặn trực tiếp
- To: Sprint 28 (Subscription UX/billing orchestration có thể tận dụng plan audit trail)

**Canonical references:**
- `docs/ONBOARDING_TRIAL_PLAN_ADMIN_POLICY_20260408.md`
- `docs/ONBOARDING_TRIAL_PLAN_IMPLEMENTATION_CHECKLIST_20260408.md`
- `docs/ONBOARDING_TRIAL_PLAN_PRECODE_DECISION_PACK_20260408.md`

### ✅ Sprint 7 - COMPLETED
**Focus**: Backlog setup & API migration  
**Status**: DONE  
- Chot backlog Sprint 7 P0/P1
- Hoan tat migration namespace API
- Chuan hoa route backend/frontend

---

### 🏃 Sprint 11 - NEARLY DONE (95%)
**Focus**: Event-Driven Realtime Pipeline  
**Status**: READY FOR REDIS-BACKED VALIDATION  

**Hoàn thành:**
- ✅ Celery collector polling 5s + proxy rotation + retry/backoff
- ✅ Pandas intraday compute (VWAP + whale detection)
- ✅ Redis Pub/Sub publisher với versioned contract
- ✅ Django Channels consumer + WebSocket auth
- ✅ Feature flags (`REALTIME_ENABLED`, `REALTIME_DEFAULT_WHALE_THRESHOLD`)
- ✅ Frontend Watchlist realtime websocket + polling fallback
- ✅ Frontend Dashboard panel realtime (market breadth + whale alerts)
- ✅ Fallback API `GET /api/realtime/ticker/{symbol}/`
- ✅ Heartbeat + subscription routing
- ✅ Local dev mode `REALTIME_CHANNEL_LAYER=inmemory` (no Redis needed)
- ✅ Demo data seed (holdings, snapshots, watchlist, tracked symbols)
- ✅ `manage.py realtime_tick --sync` chạy thành công tại local
- ✅ All tests pass: test_realtime_compute, test_realtime_gateway

**Validation Results**:
- `manage.py check` ✅ PASS
- `manage.py test portfolio.tests.test_realtime_*` ✅ PASS (9 tests)
- `npm run build` ✅ PASS (202.14 kB)
- `manage.py seed_demo_data --reset` ✅ PASS

**Còn lại (Minor):**
- ⏳ Xác nhận luồng Redis-backed thực tế (`REALTIME_CHANNEL_LAYER=redis`)
- ⏳ Validation p95 publish->push < 1.5s
- ⏳ Correlation ID / sequence logging
- ⏳ Sprint 11 acceptance checklist final sign-off

---

### 📋 Bước Admin UI + Stock Workspace (Bước 1-30)
**Focus**: Admin Dashboard & Stock Detail Workspace  
**Status**: Bước 1-29 hoàn thành, Bước 30 vừa xong hôm nay (2026-04-01)

**Bước 1-6 - Admin Dashboard Refactor** ✅
- Audit + refactor admin.py theo nhóm chức năng
- Tạo dashboard card navigation
- Quick stats (portfolio, transactions, prices)
- Pandas data aggregation

**Bước 7-15 - Admin Menu Restructuring** ✅
- Phân cấp menu theo module (Portfolio Tracker, Market Watch, Data Hub)
- Chuan hóa naming convention (Vietnamese labels)
- Chỉnh quan hệ Watchlist (Nhóm theo dõi → Mã trong danh sách)
- Menu cha-con, hành động hang loạt

**Bước 16-21 - Realtime & Stock Detail Foundation** (Kế hoạch cho Sprint 11-12)
- Bước 16: `useRealtimeFeed` hook dùng chung
- Bước 17: P/L realtime trên Dashboard
- Bước 18: Price alerts domain
- Bước 19: Auto-sync watch assets
- Bước 20: Stock detail workspace foundation
- Bước 21: Tracked actions tại stock workspace

**Bước 22-29 - Stock Workspace UI** ✅
- Bước 22-24: SecuritiesGroup taxonomy dùng chung + Admin sync
- Bước 25-27: Stock detail page + Vietnamese labels
- Bước 28-29: Trading terminal layout (compact header, action bar, chart-focused)

**Bước 30 - Candlestick + Breadth + Terminal CSS** ✅ **COMPLETED TODAY**
- ✅ Area chart → Candlestick OHLC (CandleShape SVG component)
- ✅ Mini breadth panel cho peer stocks (BreadthMiniPanel)
- ✅ Trading terminal CSS utilities (text-label, card-section, breadth-strong/weak/flat)
- ✅ Typography & color scheme (slate/cyan/emerald/rose)
- ✅ Compilation success: 202.14 kB (+6.7 kB), 6.35 kB CSS (+600 B)

**File Changes:**
- `frontend/src/pages/StockDetail.jsx` - Completely rewritten (764 lines full component)
- `frontend/src/index.css` - Updated trading terminal utilities
- `docs/ADMIN_UI_IMPLEMENTATION_STEPS.md` - Bước 30 marked complete

**Status**: Both servers running (Backend: 8000, Frontend: 3000)

---

### 📌 Sprint 12 - IN PROGRESS
**Focus**: User Management Core + Frontend Realtime Consolidation & Observability  
**Status**: Day 2 underway  

**Đã hoàn thành thêm:**
- ✅ `useRealtimeFeed` dùng chung cho Watchlist + Dashboard
- ✅ Metrics/latency panel cho realtime debug
- ✅ Canonical sprint cho `User Management Core`: plan/CASL/auth-me/protected-route được quy chiếu về Sprint 12
- ✅ Plan/CASL gating cho tính năng AI Advisory
- ✅ Route `/api/auth/me/` + `/api/portfolio/whale-advisory/` được nối end-to-end với frontend
- ✅ Frontend build pass sau khi thêm `WhaleAdvisory`, `Upgrade`, `ProtectedRoute`
- ✅ `manage.py test portfolio.tests.test_api_routes` PASS (28 tests)
- ✅ `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_realtime_compute` PASS (6 tests)
- ✅ Local Redis-backed validation: health endpoint pass, 4 stream keys / 400 ticks, consumer batch ghi DB thành công
- ✅ Advisory backend hardening: thêm `httpx`, sửa lazy import để path placeholder không crash khi chưa có API key

**Implemented extension awaiting QA/sign-off:**
- ✅ User registration flow đã được đưa vào Sprint 12 như một phần mở rộng của `User Management Core`.
- ✅ Backend `POST /api/auth/register/` hiện yêu cầu email và trả JWT cho auto-login.
- ✅ Frontend auth modal đã có flow đăng ký và auto-login end-to-end ở mức code + build/test route.
- ⏳ Browser QA và sign-off cuối vẫn chưa hoàn tất.
- 📄 Chi tiết tại `docs/SPRINT12_USER_REGISTRATION_PLAN.md`.

**Kế hoạch (10 ngày):**

Day 1: Tạo `useRealtimeFeed` hook dùng chung
Day 2-3: Refactor Watchlist sang dùng hook
Day 4: Refactor Dashboard sang dùng chung + anti-duplicate whale alerts
Day 5: Fallback polling + stale indicator
Day 6: Whale alert UX + history + severity
Day 7: Metrics panel + observability
Day 8: Test Redis-backed environment checklist
Day 9: Bugfix P0/P1
Day 10: RC signoff

**DoD:**
- Watchlist + Dashboard dùng chung layer realtime
- Frontend auto-reconnect websocket với backoff
- Fallback polling + stale indicator
- Whale alert history + anti-duplicate
- Redis-backed staging validated

---

## 🎯 Immediate Action Items

### Priority 1: Hoàn thành Sprint 11 Validation (Today - Tomorrow)
Target: Xác nhận Redis-backed environment hoạt động thực tế
- [x] Setup Redis queue trên local/staging
- [x] Test `REALTIME_CHANNEL_LAYER=redis` mode
- [ ] Validate p95 latency publish→push < 1.5s
- [ ] Run QA matrix (disconnect/reconnect, load test)
- [ ] Final acceptance checklist sign-off

### Priority 2: Sprint 12 Kickoff (Tomorrow morning)
**Bước 16 - Tách layer realtime frontend dùng chung (Ngày 1-2 của Sprint 12)**

Target: Consolidate `Watchlist` + `Dashboard` websocket logic vào một shared hook

**Implementation Plan:**
1. Tạo `frontend/src/hooks/useRealtimeFeed.ts`:
   - WebSocket lifecycle (connect/disconnect/reconnect)
   - Polling fallback logic
   - Event parsing (ticker_update, whale_alert, heartbeat)
   - State management (quotesBySymbol, realtimeStatus, lastEventAt, whaleAlerts)
   - Backoff strategy

2. Refactor `Watchlist.jsx`:
   - Thay thế websocket logic trực tiếp bằng hook
   - Loại bỏ duplicate state management
   - Maintain tất cả current behaviors

3. Refactor `DashboardRealtimePanel.jsx`:
   - Dùng hook thay vì logic cũ
   - Overlay quote realtime lên holdings
   - Synchronize subscription theo current holdings

**Kết quả mong đợi:**
- Giảm code lap từ ~400 lines → ~200 lines (40% reduction)
- Dễ mở rộng cho bước 17-19 (P/L, alerts, sync)
- Chuẩn bị cho observability metrics ở bước tiếp

### Priority 3: Sprint 27 Go/No-Go (Completed)
Target: Chốt quyết định và hoàn tất coding execution cho onboarding trial policy
- [x] Hoàn tất policy doc + implementation checklist + pre-code decision pack
- [x] Product Owner xác nhận GO cho M1-M2
- [x] Hoàn tất coding phase M1-M6
- [x] Đóng QA gates với test evidence + rollback runbook

---

## 📊 Current Infrastructure Status

### Servers Running
- ✅ Backend: `python manage.py runserver 0.0.0.0:8000`
- ✅ Frontend: `npm start (port 3000)`
- ✅ Local Celery: Ready (collectbeat ticks every 5s)
- ⏳ Redis: Configured for local `inmemory` mode, needs Redis setup for real Redis testing

### Code Quality
- ✅ No compilation errors
- ✅ No ESLint/TypeScript errors
- ✅ API smoke tests pass (`portfolio.tests.test_api_routes`)
- ✅ Build size optimal (202 kB gzipped)

### Browser Testing
- Ready to test at http://localhost:3000

---

## Priority Update (2026-04-05)

### Quyet dinh uu tien thuc thi

1. **Uu tien so 1:** Dong Sprint 20 i18n truoc.
- Hoan tat backend `UserConfig.language`.
- Hoan tat frontend React i18n cho scope Sprint 20.
- Hoan tat sync cross-platform va smoke/sign-off.

2. **Uu tien so 2:** Sau khi Sprint 20 dong, mo Phase 0 cua lo trinh Fat Views refactor.
- Feature flags.
- Shared exceptions.
- Baseline dashboard, alerting, measurement contract.

3. **Uu tien so 3:** Sau Phase 0 moi bat dau Sprint 21 Market Data refactor.

### Ghi chu dieu phoi

- Cac tai lieu Sprint 21-22 da san sang cho planning, nhung chua duoc phep khoi dong code execution truoc khi Sprint 20 dong.
- Muc tieu la tranh tranh chap giua i18n web/backend cua Sprint 20 va refactor runtime/API layer cua Sprint 21.
- Candlestick chart visible (via StockDetail route)
- Realtime panels functional (Watchlist, Dashboard)

---

## 🚀 Timeline Projection

| Phase | Current Sprint | Target Completion | Next Phase |
|-------|---|---|---|
| **Sprint 11 Validation** | In progress | 2026-04-02 EOD | Redis-backed validation |
| **Sprint 12 Start (Bước 16)** | Ready | 2026-04-03 | Consolidate useRealtimeFeed |
| **Sprint 12 Mid (Bước 17-19)** | Planned | 2026-04-07 | P/L + Alerts + Sync |
| **Sprint 12 End (Bước 17-19 finish)** | Planned | 2026-04-10 | QA + sign-off |
| **Sprint 13 (Next)** | Backlog | 2026-04-14 | Backtest engine / Intraday |
| **Sprint 19** | In Progress | 2026-04-12 | Mobile App MVP (Android + iOS) |
| **Sprint 20** | Planned | 2026-04-26 | i18n: Cấu hình ngôn ngữ VI/EN |
| **Sprint 21** | Planned | 2026-05-10 | Next-Gen Phase 1A: Baseline + Repository Refactor |
| **Sprint 22** | Planned | 2026-05-24 | Next-Gen Phase 1B: ADV Dynamic Thresholds + WS Provider |

---

## 🌐 Sprint 20 — i18n: Cấu hình ngôn ngữ (PLANNED)

**Mục tiêu**: Cho phép người dùng chuyển đổi toàn bộ giao diện giữa **Tiếng Việt** và **English** trên Frontend (React) và Mobile App (React Native).

**Phạm vi**:
- Backend: Thêm `UserConfig.language` field + migration + serializer
- Frontend: Custom i18n context (`LangContext`) + translation dictionaries + toggle button trong sidebar
- Mobile: Zustand `localeStore` + AsyncStorage persist + toggle UI trong DashboardScreen
- Migrate strings toàn bộ: Layout, Auth, Dashboard, Transactions, Watchlist, WhaleAlerts

**Kiến trúc**: Lightweight custom dictionary (không dùng react-i18next giai đoạn này), sync preference qua `/api/ai-config/` PUT.

**Thời gian**: 2 tuần — 10 ngày làm việc

**Chi tiết kỹ thuật**: Xem `docs/SPRINT20_I18N_DETAILED_PLAN.md`

**Acceptance Criteria chính**:
- [ ] Toggle ngôn ngữ hoạt động instant (không reload page/app)
- [ ] Preference persist cross-device qua `UserConfig.language`
- [ ] 100% strings trong 4 màn hình mobile đã migrate
- [ ] 100% strings trong 8 pages frontend đã migrate
- [ ] Intl.NumberFormat format tiền theo locale đúng

---

## ⚙️ Sprint 21 — Next-Gen Phase 1A (PLANNED)

**Mục tiêu**: Chuẩn bị hạ tầng an toàn rollout và xử lý technical debt theo hướng không đổi nghiệp vụ.

**Phạm vi**:
- Tuần 1: Baseline metrics + Feature Flags + Kill-switch
- Tuần 2: Refactor Repository tách Data Access khỏi Order Flow

**Acceptance Criteria chính**:
- [ ] Có baseline report đầy đủ (CPU worker, WS/user, reconnect, latency p95)
- [ ] Feature flags bật/tắt được trên staging
- [ ] Refactor repository không đổi output nghiệp vụ
- [ ] Regression pass và runtime p95 không xấu hơn baseline quá 10%

**Chi tiết kỹ thuật**: Xem `docs/NEXT_GEN_IMPLEMENTATION_PLAN.md` và `docs/NEXT_GEN_TASKBOARD_4_WEEKS.md`

---

## ⚙️ Sprint 22 — Next-Gen Phase 1B (PLANNED)

**Mục tiêu**: Nâng chất lượng cảnh báo theo ADV và giảm áp lực kết nối realtime trên web.

**Phạm vi**:
- Tuần 3: ADV pipeline + Shadow Mode dynamic thresholds
- Tuần 4A: Canary 10% dynamic thresholds
- Tuần 4B: Global WS Provider phase 1 cho Watchlist (web)

**Acceptance Criteria chính**:
- [ ] ADV freshness < 24h và fallback static hoạt động khi stale
- [ ] Canary 10% ổn định, không spam alert, rollback drill đạt SLA < 3 phút
- [ ] WS connections giảm >= 40% trong context mục tiêu
- [ ] Reconnect rate < 3% trên web

**Chi tiết kỹ thuật**: Xem `docs/NEXT_GEN_IMPLEMENTATION_PLAN.md` và `docs/NEXT_GEN_TASKBOARD_4_WEEKS.md`

---

## 📝 Notes

- **Bước 1-30**: Admin UI + Stock workspace implementation roadmap (completed Bước 1-30 today)
- **Sprint 11**: Vertical slice realtime pipeline hoàn thành locally, đang chờ Redis validation
- **Sprint 12**: Consolidation sprint để gom code + thêm observability
- **Sprint 13+**: Backtest engine, intraday workspace, notification center
- **Sprint 19**: Mobile App MVP — đang triển khai (Auth ✅, Dashboard ✅, Transactions ✅, Watchlist ✅)
- **Sprint 20**: i18n VI/EN — kế hoạch chi tiết tại `docs/SPRINT20_I18N_DETAILED_PLAN.md`
- **Sprint 21-22**: Next-Gen 4 tuần được tách thành 2 sprint mới để không phá vỡ roadmap hiện tại

---

*Last Updated: 2026-04-05*  
*Compiled by: GitHub Copilot*
