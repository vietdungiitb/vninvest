# Audit Settings/AI — Chuyển đổi sang SaaS Native Giao diện (v2)

**Ngày audit:** 2026-07-11
**Phiên bản:** v2 — incorporates critical review feedback
**Phạm vi:** Settings ecosystem sau migration sang SaaS-native (packages/web/)
**Phiên bản:** v2.1 — incorporates critical review + execution plan alignment
**Phạm vi:** Settings ecosystem sau migration sang SaaS-native (packages/web/)
**Phương pháp:** Đọc code white-box, so sánh legacy ↔ SaaS, đối chiếu với Seeking Alpha, TrendSpider, Kensho, TradingView
**Effort adjustment:** +25-30% từ review feedback
**Execution plan:** `docs/EXECUTION_PLAN_SETTINGS_AI.md`

---

## PHẦN 1: PHÂN TÍCH HIỆN TRẠNG

### 1.1 Kiến trúc hiện tại

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETTINGS ECOSYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│ CẶP 1 — AI-SPECIFIC SETTINGS                                   │
│ /settings/ai       → AICommandCenterPage.tsx (557 dòng)         │
│                       Provider, model, API key, tokens, refresh, │
│                       test connection, prompt config drawer,     │
│                       audit logs, fallback quota card            │
│                                                                  │
│ /settings/ai/agents → AIAgentFederationPanel.tsx (273 dòng)    │
│                       CRUD agents, 6 loại, table + form         │
│                                                                  │
│ /settings/ai/usage → AIUsageDashboard.tsx (160 dòng)           │
│                       Summary cards, records table               │
│                                                                  │
│ CẶP 2 — AI DATA PIPELINE SETTINGS                              │
│ DNSE credentials (legacy only) → Backend API vẫn sống            │
│ Event gate toggle (legacy + AI Command Center read-only)         │
│                                                                  │
│ CẶP 3 — GENERAL APP SETTINGS                                   │
│ /settings          → UserSettingsPage.tsx (136 dòng)            │
│                       Tên, ngôn ngữ, theme, whale threshold      │
│ Shell variant      → ShellAiCommandCenterPage.tsx (494 dòng)    │
│                       Duplicate logic + shell chrome wrapper     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 So sánh Legacy → SaaS (theo phạm vi)

**AI-Specific Settings:**

| Feature | Legacy | SaaS Native | Status |
|---|---|---|---|
| Provider/model config | ✅ (trong UserConfig) | ✅ AICommandCenterPage | Parity |
| API key management | ✅ | ✅ BYOK SSOT | Parity |
| Test connection | ✅ | ✅ Active probe | Parity |
| Audit logs | ❌ | ✅ AIAuditLogsPanel | **Mới** |
| Prompt config | Basic | ✅ Drawer + presets | **Nâng cấp** |
| Fallback quota | ❌ | ✅ Visual card | **Mới** |
| Temperature control | ❌ | ❌ Backend có, UI thiếu | Gap |
| System prompt viewer | ❌ | ❌ Backend có, UI thiếu | Gap |

**AI Data Pipeline Settings:**

| Feature | Legacy | SaaS Native | Status |
|---|---|---|---|
| DNSE credentials | ✅ Full CRUD | ❌ Mất hoàn toàn | **GAP Critical** |
| Event gate toggle | ✅ Read-write | ⚠️ Read-only | **Gap** |

**General App Settings:**

| Feature | Legacy | SaaS Native | Status |
|---|---|---|---|
| Hiển thị tên | ✅ | ✅ | Parity |
| Ngôn ngữ | ✅ | ✅ | Parity |
| Theme | ✅ | ✅ | Parity |
| Whale threshold | ✅ | ✅ | Parity |
| UI Mode selector | ✅ | ❌ Thiếu | Gap (app-level) |
| Link → AI CC | ✅ prominent CTA | ❌ Không có | Gap (UX) |

---

## PHẦN 2: LỖI (BUGS)

### 2.1 Runtime Bugs (cần fix)

#### BUG-01: `loadSettings` stale closure trên `refreshInterval`
**File:** `AICommandCenterPage.tsx:153`
**Mức độ:** Medium
```tsx
const loadSettings = useCallback(async (showNoticeFlag = false) => {
  setRefreshIntervalDisplay((data as any).advisory_refresh_interval_hours ?? refreshInterval);
}, [refreshInterval]); // ← dependency tạo stale closure
```
`loadSettings` được gọi trong `useEffect` line 155-157. Dependency `[refreshInterval]` khiến effect chạy lại mỗi khi user thay đổi refresh interval TRƯỚC KHI save — gây reload không cần thiết.

**Fix:** Tách `refreshIntervalDisplay` logic ra khỏi `loadSettings`, hoặc dùng `useRef` cho refreshInterval.

---

#### BUG-02: Thiếu validation cho `maxTokens` và `refreshInterval`
**File:** `AICommandCenterPage.tsx:209-210`
**Mức độ:** Medium
```tsx
payload.advisory_max_tokens_per_day = parseInt(String(maxTokens));
payload.advisory_refresh_interval_hours = parseInt(String(refreshInterval));
```
Không có validation: `maxTokens` có thể = 0 hoặc âm, `refreshInterval` có thể = 0. Backend sẽ nhận giá trị bất hợp lý.

**Fix:** Thêm `Math.max(1, ...)` hoặc client-side validation trước khi submit.

---

#### BUG-03: AIUsageDashboard thiếu pagination controls
**File:** `AIUsageDashboard.tsx:154`
**Mức độ:** Medium
```tsx
total > 20 && e("p", ... `Hiển thị 20 / ${total} bản ghi.`)
```
Hiển thị "20 / X bản ghi" nhưng KHÔNG CÓ nút Previous/Next. User bị giới hạn ở 20 records đầu tiên.

**Fix:** Thêm pagination buttons + page size selector.

---

#### BUG-04: Prompt Config Drawer "Đóng & Lưu" misleading
**File:** `AIAdvisoryPromptConfigDrawer.js:349`
**Mức độ:** Medium
```tsx
e("button", { onClick: onClose, ... }, "Đóng & Lưu")
```
Label nói "Đóng & Lưu" nhưng drawer chỉ gọi `onClose()` — config chỉ được lưu khi user bấm "Lưu cấu hình" ở form cha. Nếu user đóng drawer mà quên save → mất config.

**Fix:** Đổi label thành "Đóng", hoặc auto-save prompt config on drawer close.

---

#### BUG-05: Gemini endpoint hardcoded sai URL
**File:** `portfolio_analytics_views.py:749`
**Mức độ:** High
```python
endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
```
Đây là OpenAI-compatible endpoint của Gemini. Nếu user cấu hình Gemini native API key (không phải OpenAI-compatible), endpoint sẽ sai.

**Fix:** Phân biệt key format hoặc validate trước khi route. Cần thêm field `api_key_format` hoặc detect key prefix.

---

#### BUG-06: PROVIDER_MODELS duplicate giữa hai files
**File:** `AICommandCenterPage.tsx:9-42` vs `ShellAiCommandCenterPage.tsx:24-49`
**Mức độ:** Medium (maintainability)
Shell variant thiếu `local` provider model list (chỉ có openai, gemini, claude, openclaw, copilot). Thêm model mới phải edit 2 chỗ.

**Fix:** Tách `PROVIDER_MODELS` thành shared constant trong `shared/providerModels.ts`.

---

#### BUG-07: API Key không hiển thị masked khi load
**File:** `AICommandCenterPage.tsx:122`
**Mức độ:** Low UX
```tsx
setAiApiKey(""); // Luôn clear API key khi load
```
User không thấy API key hiện tại (kể cả masked `sk-...xxxx`). Placeholder text nói "Đã có API Key" nhưng không có visual indicator.

**Fix:** Backend trả về `ai_api_key_masked` field, frontend hiển thị `sk-...xxxx`.

---

### 2.2 Code Style Issues (không phải runtime bugs)

#### STYLE-01: ShellAiCommandCenterPage dùng JSX
**File:** `ShellAiCommandCenterPage.tsx:349`
Toàn bộ SaaS pages dùng `const e = createElement;` nhưng Shell variant dùng JSX. Vi phạm convention nhưng không phải bug runtime.

---

#### STYLE-02: `window.confirm()` trong AIAgentFederationPanel
**File:** `AIAgentFederationPanel.tsx:98`
Dùng browser native `confirm()` — không consistent với glassmorphism design. Low priority UX inconsistency.

---

#### STYLE-03: Missing useEffect dependency
**File:** `ShellAiCommandCenterPage.tsx:180-182`
ESLint exhaustive-deps warning. `loadSettings` ref-based nên an toàn nhưng code không clean.

---

## PHẦN 3: GAP DỮ LIỆU & TÍNH NĂNG

### A. AI-Specific Gaps

#### GAP-A1: Temperature control — Backend có, UI thiếu
**Mức độ:** Medium
Backend `SystemAISettings.temperature` (default 0.3) nhưng frontend không có slider. User không thể điều chỉnh creative vs deterministic.

**Benchmark:** Seeking Alpha có model tuning options. TrendSpider cho phép temperature adjustment cho AI signals.

---

#### GAP-A2: System Prompt Template — Backend có, UI thiếu
**Mức độ:** Medium
`SystemAISettings.prompt_template` có field nhưng frontend không render. User không thể xem/sửa system prompt.

**Benchmark:** TrendSpider, Kensho đều cho phép custom prompt engineering.

---

#### GAP-A3: Prompt Config Drawer — Thiếu version history
**Mức độ:** Low-Medium
Không lưu version snapshots. User thay đổi nhầm → không rollback được.

---

#### GAP-A4: Fallback Quota Card — Thiếu nút action
**Mức độ:** Low
Card hiển thị quota bar nhưng không có CTA "Nâng cấp plan" khi quota hết.

---

### B. AI Data Pipeline Gaps

#### GAP-B1: DNSE Credentials — Mất hoàn toàn sau migration
**Mức độ:** Critical

Legacy `UserConfig.jsx` có DNSE credential section đầy đủ (lines 257-323):
- Status badges (active, verified)
- Form nhập API key + API secret
- Nút xoá credential

SaaS `UserSettingsPage.tsx` **KHÔNG CÓ** section này. Backend API `/broker/dnse/config/` vẫn sống (workspace.js:291-305).

**Tác động trực tiếp đến AI:** DNSE data feed là nguồn cho whale signal, dark flow detection. Thiếu DNSE → AI advisory thiếu data → output kém chất lượng.

---

#### GAP-B2: Event Gate Toggle — ReadOnly trong AI Command Center
**Mức độ:** High

Legacy có checkbox `advisory_whale_signal_enabled` read-write. AICommandCenterPage đọc status (line 141) nhưng chỉ hiển thị read-only — KHÔNG CHO PHÉP BẬT/TẮT từ UI AI.

---

### C. General App Gaps (outside AI scope)

> **Lưu ý:** Các gap này thuộc phạm vi app settings, không phải AI settings. Được liệt kê ở đây để reference nhưng KHÔNG được dùng để đánh giá AI feature completeness.

#### GAP-C1: Interface Mode Selector — Mất sau migration
**Mức độ:** Low (app-level)

Legacy có selector: Legacy / Modern / Decision Hub. SaaS không có equivalent.

---

#### GAP-C2: Security Settings — Thiếu basic features
**Mức độ:** High (app-level)

Không có: đổi mật khẩu, 2FA, active sessions, personal API tokens, notification preferences, GDPR.

**Lưu ý:** Đây là infra-level work (2FA TOTP cần backend + recovery codes + session management), không thuộc phạm vi AI settings audit.

---

## PHẦN 4: MISSING ANALYSIS

### 4.1 Performance

**Không có analysis về:**
- `AICommandCenterPage` (557 dòng) và `ShellAiCommandCenterPage` (494 dòng) — cả hai có thể load đồng thời không?
- Không có lazy loading cho các sub-components (AIAuditLogsPanel, AIAdvisoryPromptConfigDrawer)
- Không có React.memo hoặc useMemo optimization
- Prompt config drawer render 8 source cards × 3 controls mỗi card = 24 DOM nodes per render

**Đánh giá:** Cần thêm code splitting và lazy loading nếu cả hai page có thể mount đồng thời.

---

### 4.2 Error Handling

**Không có analysis về:**
- Nếu AI API call fail, user thấy gì? → Hiện tại: error banner text, không có retry button
- Nếu backend down, graceful degradation? → Hiện tại: blank loading state
- Error boundary không tồn tại cho AI settings pages
- Network timeout handling: test connection có timeout nhưng settings load không có

**Đánh giá:** Error handling ở mức cơ bản. Cần thêm retry mechanism, error boundaries, và offline fallback.

---

### 4.3 Testing Coverage

**Không có test cho:**
- `AICommandCenterPage.tsx` — không có test file riêng
- `AIAgentFederationPanel.tsx` — không có test file riêng
- `AIUsageDashboard.tsx` — không có test file riêng
- `AIAuditLogsPanel.tsx` — không có test file riêng

**Có test:**
- `AIAdvisoryPromptConfig` API + E2E tests (frontend/src/__tests__/)
- `coreApiAdapter.test.js` (transport level)
- Backend: `test_ai_management_center.py` (469 dòng), `test_ai_audit_logs.py` (298 dòng)

**Đánh giá:** Frontend AI settings pages có ZERO unit tests. Backend coverage tốt. Gap lớn ở frontend testing.

---

### 4.4 i18n Gaps

**Không có analysis về:**
- Prompt config drawer labels: dùng `useI18n()` nhưng labels trong drawer hardcoded tiếng Việt (`"⚙️ Cài đặt Cố vấn AI"`, `"Mẫu cấu hình nhanh:"`, `"phiên"`)
- AICommandCenterPage: summary cards labels hardcoded tiếng Việt (`"Nhà cung cấp hiệu lực"`, `"Mô hình hiệu lực"`)
- AIAgentFederationPanel: table headers hardcoded (`"Tên"`, `"Loại"`, `"Provider"`)

**Đánh giá:** Hầu hết UI text không qua `t()` translation function. i18n chỉ hoạt động cho page-level titles, không cho component-level labels.

---

## PHẦN 5: SO SÁNH VỚI COMPETITOR HỢP LÝ

> **Lưu ý:** Chỉ so sánh với products cùng category (AI-powered investment/analysis tools). Không so với IDE (Cursor), note-taking (Notion), hay project management (Linear).

### 5.1 Seeking Alpha (AI-powered stock analysis)
- **AI Model selection:** GPT-4o cho premium, restricted dropdown ✅
- **Usage dashboard:** Premium usage tracking, but limited public docs
- **Custom AI:** AI-powered quant ratings, factor models
- **Audit trail:** Subscription-level access logging
- **Điểm mạnh:** Deep financial data integration, provenance tracking

### 5.2 TrendSpider (AI technical analysis)
- **AI Model selection:** Configurable for pattern recognition
- **Custom prompts:** Custom AI criteria cho multi-timeframe analysis
- **Backtesting:** AI signal backtesting với historical accuracy
- **Alert integration:** AI alerts as first-class citizens
- **Điểm mạnh:** Visual AI config, backtesting pipeline

### 5.3 Kensho/Kavout (Institutional AI)
- **Model transparency:** Show which model scored, confidence level
- **API access:** Programmatic access cho custom integrations
- **Cost tracking:** Per-query cost attribution
- **Compliance:** Full audit trail cho regulatory requirements
- **Điểm mạnh:** Enterprise-grade, compliance-ready

### 5.4 TradingView (Retail + Pro)
- **AI screening:** Custom AI criteria với Pine Script integration
- **Alert system:** Multi-channel alerts (email, push, webhook)
- **Community scripts:** Open-source AI indicators
- **Điểm mạnh:** Community ecosystem, script marketplace

### 5.5 Benchmark Gap Summary

| Feature | Seeking Alpha | TrendSpider | Kensho | TradingView | VNInvest |
|---|---|---|---|---|---|
| AI provider/model config | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom prompts/criteria | ✅ | ✅ | ✅ | ✅ | ✅ |
| Usage dashboard | ⚠️ Limited | ❌ | ✅ | ❌ | ✅ Basic |
| Audit trail | ✅ | ❌ | ✅ | ❌ | ✅ |
| Backtesting AI signals | ❌ | ✅ | ✅ | ✅ | ❌ |
| Multi-source data config | ❌ | ✅ | ✅ | ❌ | ✅ Presets |
| BYOK (bring your own key) | ❌ | ❌ | ❌ | ❌ | ✅ Unique |
| Fallback quota system | ❌ | ❌ | ❌ | ❌ | ✅ Unique |

**Nhận xét:** VNInvest có 2 features độc đáo (BYOK + fallback quota) mà competitor không có. AI settings parity với Seeking Alpha ở basic level. Gap lớn nhất: backtesting AI signals (TrendSpider, Kensho).

---

## PHẦN 6: ĐỀ XUẤT NÂNG CẤP (VERTICAL SLICES)

> Mỗi slice deliverable testable independently. Prioritized theo business value.

### Slice 1 — Khôi phục DNSE Credentials (AI data pipeline)
**Business value:** Cao — thiếu DNSE → AI advisory thiếu data
**Effort:** 1.25 ngày (adjusted +25%)
- Thêm `DNSECredentialsSection` vào `UserSettingsPage.tsx`
- Gọi API `/broker/dnse/config/` hiện có
- Render form + status badges + error handling
- Thêm loading state, retry logic

### Slice 2 — Event Gate Toggle + Validation fixes
**Business value:** Cao — user cần control event-based AI triggers
**Effort:** 0.65 ngày (adjusted +30%)
- Thêm checkbox `advisory_whale_signal_enabled` vào AICommandCenterPage policy section
- Fix maxTokens/refreshInterval validation (Math.max, min bounds)

### Slice 3 — Usage Dashboard pagination + Export
**Business value:** Medium — hiện tại bị giới hạn 20 records
**Effort:** 1.25 ngày (adjusted +25%)
- Thêm Previous/Next buttons + page size selector (20/50/100)
- Thêm Export CSV button
- Backend đã hỗ trợ pagination (limit/offset params)

### Slice 4 — Prompt Config fixes + Temperature
**Business value:** Medium — cải thiện UX prompt config
**Effort:** 1.25 ngày (adjusted +25%)
- Fix "Đóng & Lưu" misleading label
- Thêm temperature slider (0.0-1.0, default 0.3)
- Lưu vào SystemAISettings.temperature (field đã có)

### Slice 5 — Provider/Model shared constants + Agent UX
**Business value:** Medium — maintainability + UX
**Effort:** 1.25 ngày (adjusted +25%)
- Tách `PROVIDER_MODELS` thành `shared/providerModels.ts`
- Agent form: text input → dropdown cho provider/model
- Agent capabilities: comma-separated → chips/pills

### Slice 6 — i18n localization cho AI components
**Business value:** Medium — multi-language support
**Effort:** 1.25 ngày (adjusted +25%)
- Prompt config drawer: wrap labels với `t()`
- AICommandCenterPage: wrap summary card labels với `t()`
- AIAgentFederationPanel: wrap table headers với `t()`
- Thêm i18n keys cho component-level text

### Slice 7 — Testing: AI settings pages
**Business value:** Medium — prevent regressions
**Effort:** 2.5 ngày (adjusted +25%)
- Unit tests cho AICommandCenterPage (mock adapter, test save/load/test-connection flows)
- Unit tests cho AIAgentFederationPanel (CRUD flows)
- Unit tests cho AIUsageDashboard (load, pagination)
- Unit tests cho AIAuditLogsPanel (filter, expand)

### Slice 8 — Error handling + Performance
**Business value:** Medium — robustness
**Effort:** 1.75 ngày (adjusted +17%)
- Thêm React Error Boundary cho AI settings pages
- Thêm retry mechanism cho failed API calls
- Lazy load AIAuditLogsPanel và AIAdvisoryPromptConfigDrawer
- React.memo cho summary cards

### ~~Slice 9 — Security Settings~~ (LOẠI BỎ khỏi AI roadmap)
> Security settings (2FA, PAT, sessions, GDPR) là **app-level infra work**, không thuộc AI settings scope.
> Được track riêng trong roadmap khác, không blocking AI feature delivery.

### Slice 10 — Advanced AI features (enhancement, deprioritize)
**Business value:** Low-Medium cho MVP
**Effort:** 3-4 ngày (đã adjust +25%)
- Agent execution history
- Agent templates (pre-built: "Sector Analyst", "Whale Watcher")
- Prompt config version history + rollback
- Budget alerts + spending caps
- **Lưu ý:** Enhancement, deprioritize cho đến khi Slices 1-8 stable

---

## PHẦN 7: ĐÁNH GIÁ TỔNG THỂ

### Revised Scores

| Dimension | Score | Ghi chú |
|---|---|---|
| AI Command Center features | 7/10 | Đầy đủ basic, thiếu temperature + prompt template UI |
| Agent Federation | 5/10 | CRUD cơ bản, thiếu polish (dropdowns, chips) |
| Usage Analytics | 4/10 | Thiếu charts, pagination, export |
| AI Data Pipeline integration | 3/10 | DNSE missing, event gate readonly |
| Code quality | 7/10 | createElement pattern đúng, thiếu shared constants |
| Testing coverage | 2/10 | Backend tốt, frontend ZERO unit tests |
| i18n | 3/10 | Page titles có, component labels hardcoded |
| Error handling | 4/10 | Basic error banners, thiếu retry/error boundaries |
| Performance | 5/10 | No lazy loading, no code splitting |

**AI-Specific Score: 5.5/10** — Đủ dùng cho MVP, thiếu polish và robustness.
**Overall Settings Score: 5/10** — AI feature khá, nhưng overall settings thiếu DNSE + security.

---

## PHẦN 8: ROADMAP (VERTICAL SLICES)

> **Đã loại bỏ Slice 9 (Security) khỏi AI roadmap.** Security settings là app-level infra, được track riêng.
> **Effort estimates đã adjust +25-30%** từ audit review feedback.

```
Tuần 1:  Slice 1 (DNSE creds) + Slice 2 (Event gate + validation)     ~2 ngày
Tuần 2:  Slice 3 (Usage pagination) + Slice 4 (Prompt fixes)          ~2.5 ngày
Tuần 3:  Slice 5 (Shared constants) + Slice 6 (i18n)                  ~2.5 ngày
Tuần 4:  Slice 7 (Testing) + Slice 8 (Error handling)                 ~4.25 ngày
Tháng 2: Slice 10 (Advanced AI — enhancement, deprioritize)            ~3.75 ngày

Tổng estimate: ~13 ngày dev time (đã adjust +25-30%)
Team 1 người: ~1 tháng
Team 2 người: ~2 tuần (với parallelization)
```

### Milestone Checks

| Milestone | Target | Criteria |
|---|---|---|
| M1: DNSE + Event gate restored | Tuần 1 end | DNSE CRUD works, event gate toggle functional |
| M2: Usage + Prompt polished | Tuần 2 end | Pagination works, export works, prompt config UX fixed |
| M3: Code quality + i18n | Tuần 3 end | Shared constants, i18n keys resolved |
| M4: Testing + Robustness | Tuần 4 end | Frontend tests pass, error boundaries active |
| M5: Enhancement (deprioritize) | Tháng 2 end | Advanced AI features shipped (nếu business cần) |

---

## PHẦN 9: RISK REGISTER

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | DNSE API break during migration | High | Integration test trước khi ship. Verify API contract |
| R2 | Gemini endpoint bug affecting users | High | Fix Slice 2, add key format validation |
| R3 | **Shell variant drift** — ShellAiCommandCenterPage diverges từ AICommandCenterPage | Medium | Slice 5 shared constants. Nếu shell cần feature riêng → shell-specific wrapper, KHÔNG duplicate |
| R4 | **Backend contract risk** — `updateUserConfig` endpoint thiếu cho event gate toggle | Medium | Verify endpoint tồn tại trước khi S2. Nếu thiếu → tạo backend endpoint trước |
| R5 | Frontend test gaps causing regressions | Medium | Slice 7 prioritized |
| R6 | i18n incomplete for non-Vietnamese users | Medium | Slice 6, accept partial for MVP |
| R7 | Lazy loading side effects | Low | Test Suspense fallback, verify unmount cleanup |
| R8 | Security settings scope creep | Low | Đã loại khỏi AI roadmap. Track riêng |
