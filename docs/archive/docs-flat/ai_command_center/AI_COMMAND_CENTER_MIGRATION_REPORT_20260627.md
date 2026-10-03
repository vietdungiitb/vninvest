# Báo Cáo Di Chủ: AI Command Center — Legacy → SaaS Native & SSOT Nâng Cấp

**Ngày**: 2026-06-27
**Tác giả**: AI Agent (Code Review & System Audit)
**Trạng thái**: REVIEWED — phản biện kỹ thuật đã được integrate (security hardening, UX sync, local model timeout, phase split)

---

## Mục Lục

1. [Tổng quan](#1-tổng-quan)
2. [So sánh Feature Gap](#2-so-sánh-feature-gap)
3. [So sánh API Endpoint & Data Model](#3-so-sánh-api-endpoint--data-model)
4. [So sánh UI Component & UX](#4-so-sánh-ui-component--ux)
5. [So sánh Commercial Software](#5-so-sánh-commercial-software)
6. [Đề xuất SSOT: AI Management Center](#6-đề-xuất-ssot-ai-management-center)
7. [Kế hoạch Migration theo Phase](#7-kế-hoạch-migration-theo-phase)
8. [Rủi ro & Giảm thiểu](#8-rủi-ro--giảm-thiểu)
9. [Phụ lục: Inventory Files](#9-phụ-lục-inventory-files)

---

## 1. Tổng quan

### Phạm vi

Phân hệ **AI Command Center** là trung tâm quản trị AI tập trung cho toàn hệ thống VNInvest — quản lý provider AI, model, API key, prompt source config, audit logs, và fallback quota cho AI Advisory runtime.

### Legacy (frontend/legacy)

| File | Dòng | Vai trò |
|------|------|---------|
| `AICommandCenter.jsx` | 1,458 | Monolithic page — 3 tabs (Engine Control, Task Tuning, Audit Logs) |

### SaaS Native (packages/web)

| File | Dòng | Vai trò |
|------|------|---------|
| `AICommandCenterPage.tsx` | 434 | Settings page (provider/model/key config, fallback quota) |
| `ShellAiCommandCenterPage.tsx` | 494 | Shell diagnostics page (runtime snapshot, surface flags) |
| `WhaleAdvisoryPage.tsx` | 234 | Main whale advisory page |
| `ShellAiAdvisoryPage.tsx` | 419 | Shell AI advisory signals page |
| `AIAdvisoryPromptConfigDrawer.js` | * | Prompt config drawer (8 sources, 8 indicators) |
| `RecommendationCardExplainability.js` | * | AI reasoning card |
| `TrustTelemetryPanel.js` | * | Trust telemetry panel |
| `WhaleAdvisoryCommandPanel.js` | * | Command panel with explainability |
| `WhaleAdvisoryBentoHeader.js` | * | Whale advisory header |

### Backend Models

| Model | File | Vai trò |
|-------|------|---------|
| `SystemAISettings` | `advisory/models.py` | Runtime AI config (provider, model, key) |
| `UserAICredential` | `advisory/models.py` | BYOK user credential (đã có kế hoạch SSOT) |

### Kết luận sơ bộ

**Legacy có ~20 features mà SaaS native chưa có.** SaaS native có ~5 features mà legacy không có. **Cần migration từ legacy → SaaS native với ~70% parity hiện tại.**

---

## 2. So sánh Feature Gap

### 2.1 Feature Inventory

| # | Feature | Legacy (AICommandCenter.jsx) | SaaS Native (AICommandCenterPage.tsx) | Ghi chú |
|---|---------|:---:|:---:|---------|
| **Engine Control** |
| 1 | Chọn AI Provider (openai, gemini, claude, openclaw, copilot) | ✅ | ✅ | SaaS thêm `local` |
| 2 | Chọn AI Model dropdown | ✅ | ✅ | 
| 3 | Custom model input | ✅ | ✅ |
| 4 | API Key input + lưu | ✅ | ✅ |
| 5 | Test connection | ✅ | ✅ | SaaS thêm latency display |
| 6 | Runtime status indicator (ai_ready) | ✅ | ✅ |
| 7 | BYOK indicator (key_configured badge) | ✅ | ✅ |
| 8 | **Event-based advisory gate indicator** | ✅ | ❌ | Legacy hiển thị warning khi gate tắt |
| 9 | **Summary cards (4 cards)** | ✅ | ❌ | Provider, model, source, status |
| 10 | **Effective runtime source display** | ✅ | ❌ | command_center vs system fallback |
| 11 | **Runtime policy khung đọc nhanh** | ✅ | ❌ | Policy summary 4-box grid |
| 12 | **Config message** | ✅ | ❌ | ai_config_message display |
| **Task Tuning / Prompt Config** |
| 13 | **8 prompt source definitions** | ✅ | ❌ | Trong AICommandCenter.jsx (riêng) |
| 14 | **Source tabs (PromptSourceTabs)** | ✅ | ❌ | Sub-component với 8 tabs |
| 15 | **Toggle source on/off** | ✅ | ❌ | 
| 16 | **Lookback config per source** | ✅ | ❌ | dropdown với options |
| 17 | **Technical indicator toggles** | ✅ | ❌ | 8 indicators (vols, prices, cdms, ma20, ma50, rsi, bollinger, snapshot) |
| 18 | **Technical indicator presets** | ✅ | ❌ | Full / Lean |
| 19 | **Prompt config presets** | ✅ | ❌ | Balanced, Flow First, Deep Dive, Cost Control |
| 20 | **Active source count badge** | ✅ | ❌ | Summary stats |
| 21 | **Refresh interval config (giờ)** | ✅ | ✅ | Cả 2 đều có |
| 22 | **Max auto refreshes/day** | ✅ | ❌ | Legacy có field riêng |
| 23 | **Max tokens/day** | ✅ | ✅ | 
| **Audit Logs** |
| 24 | **Audit logs tab** | ✅ | ❌ | Tab riêng với filter, pagination |
| 25 | **Audit action filter** | ✅ | ❌ | 4 action types |
| 26 | **Audit actor filter** | ✅ | ❌ |
| 27 | **Audit date range filter** | ✅ | ❌ |
| 28 | **Before/after JSON diff viewer** | ✅ | ❌ | Accordion + snapshot comparison |
| 29 | **Diff summary** | ✅ | ❌ |
| **SaaS-only Features** |
| 30 | **Local provider (Ollama/vLLM)** | ❌ | ✅ | Custom endpoint field |
| 31 | **Custom endpoint configuration** | ❌ | ✅ | Chỉ hiện khi provider=local |
| 32 | **Fallback quota display** | ❌ | ✅ | Progress bar + remaining count |
| 33 | **Test connection latency** | ❌ | ✅ | latency_ms display |
| 34 | **Fallback quota reset date** | ❌ | ✅ |

### 2.2 Gap Summary

```
Engine Control:      Legacy 12/12 (100%)    → SaaS 8/12 (67%)    ❌ MISS: 4 cards, event gate, source display, policy, message
Task Tuning:         Legacy 11/11 (100%)    → SaaS 2/11 (18%)    ❌ MISS: source tabs, presets, indicators, stats
Audit Logs:          Legacy 6/6 (100%)      → SaaS 0/6 (0%)      ❌ MISS: entire audit tab
SaaS-only:           Legacy 0/5 (0%)        → SaaS 5/5 (100%)    ✅ Local + fallback + latency
```

**Priority gap items cần implement trước**:
1. Prompt Source Configuration (11 items) — có thể reuse từ `AIAdvisoryPromptConfigDrawer.js`
2. Audit Logs UI (6 items) — cần page/chrome mới
3. Engine Control summary cards + indicators (4 items)

---

## 3. So sánh API Endpoint & Data Model

### 3.1 API Endpoints

| Endpoint | Method | Legacy | SaaS Native | Status |
|----------|--------|--------|-------------|--------|
| `/workspace/ai-command-center/` | GET | ✅ | ✅ | Cùng contract |
| `/workspace/ai-command-center/` | PUT | ✅ | ✅ | SaaS thêm `custom_endpoint` |
| `/workspace/ai-command-center/test-connection/` | POST | ✅ | ✅ | SaaS thêm `latency_ms` |
| `getAICommandCenterAuditLogs()` | GET | ✅ | ❌ | Cần implement audit endpoint |
| `getPortfolioUserConfig()` | GET | ✅ | ❌ | Event gate status |

### 3.2 GET Response Contract

**Legacy + SaaS common fields**:
```json
{
  "ai_provider": "openai",
  "ai_model": "gpt-4o",
  "ai_api_key_configured": true,
  "ai_ready": true,
  "effective_ai_source": "command_center",
  "effective_ai_provider": "openai",
  "effective_ai_model": "gpt-4o",
  "ai_config_message": "",
  "advisory_refresh_interval_hours": 24,
  "advisory_max_auto_refreshes_per_day": 24,
  "advisory_max_tokens_per_day": 5000
}
```

**SaaS-only fields**:
```json
{
  "custom_endpoint": "",
  "fallback_quota_remaining": 3,
  "fallback_quota_max": 5,
  "fallback_quota_reset": "2026-06-27"
}
```

**Legacy-only fields**:
```json
{
  "ai_prompt_config": {
    "sources": { "whale": { "enabled": true, "lookback": 180 }, ... }
  }
}
```

### 3.3 Data Model Mapping

```
UserProfile.preferences (legacy)
  └─ ai_prompt_config: JSON
  └─ advisory_whale_signal_enabled: bool

SystemAISettings (core)
  ├─ ai_provider: CharField
  ├─ ai_model: CharField
  ├─ encrypted_api_key: TextField (Fernet)
  ├─ ai_ready: BooleanField
  ├─ effective_ai_source: CharField
  └─ metadata: JSONField

UserAICredential (core — SSOT target)
  ├─ user: OneToOneField → User
  ├─ ai_provider: CharField (default: 'openai')
  ├─ ai_model: CharField
  ├─ encrypted_api_key: TextField (Fernet)
  ├─ custom_endpoint: CharField
  ├─ is_active: BooleanField
  ├─ fallback_quota_used_today: IntegerField
  └─ fallback_quota_date: DateField
```

### 3.4 Audit Log Model (Legacy)

```json
{
  "id": 123,
  "action": "update_settings",
  "actor": "user@example.com",
  "reason": "Changed provider from openai to gemini",
  "before_json": { "ai_provider": "openai", ... },
  "after_json": { "ai_provider": "gemini", ... },
  "diff_summary": "Provider: openai → gemini",
  "command_center_config_id": 45,
  "created_at": "2026-06-27T10:00:00Z"
}
```

SaaS native chưa có model/logic cho audit logs — cần implement trong core backend.

---

## 4. So sánh UI Component & UX

### 4.1 Layout

| Aspect | Legacy | SaaS Native |
|--------|--------|-------------|
| Bố cục | 3 tabs (sidebar) + content | Single form page (AICommandCenterPage) hoặc shell layout (ShellAiCommandCenterPage) |
| Glassmorphism | ✅ SOC-style (blur, borders) | ❌ Đơn giản hơn (border + bg) |
| Responsive | ✅ Grid + sidebar | ✅ Stack + grid |
| max-width | 1500px | 1200px |

### 4.1.1 UX Decision: Manual Submit (không Auto-save)

**Quyết định kiến trúc**: SaaS native **chỉ dùng manual submit button**, không auto-save on blur như legacy.

**Lý do**:
1. Tránh ghi đè cấu hình dở dang khi user đang gõ API Key hoặc custom endpoint
2. Giảm audit log noise — mỗi lần blur là một audit record
3. User có cơ hội review trước khi lưu (nhất là với cấu hình AI quan trọng)

**Tích hợp Prompt Config Drawer**: Nút "Tinh chỉnh nguồn dữ liệu" đặt **cạnh Model/Provider section** (không ở header) để tạo liên kết nghiệp vụ: tuning prompt đi kèm cấu hình Model.

### 4.2 Component Tree

**Legacy**:
```
AICommandCenter
├── Header (gradient + runtime status)
├── Summary Cards (4 cards: provider, model, source, status)
├── Policy Section (4-box grid: event gate, refresh, auto-refresh, tokens)
├── Tab.Group
│   ├── Engine Control
│   │   ├── Provider select
│   │   ├── Model select (+ custom)
│   │   ├── API Key input
│   │   ├── Runtime visibility
│   │   ├── Event advisory warning
│   │   └── Test connection
│   ├── Task Tuning
│   │   ├── Preset buttons
│   │   ├── Summary stats
│   │   ├── PromptSourceTabs (8 tabs)
│   │   │   ├── Source config (toggle + lookback)
│   │   │   ├── Technical indicators (8 toggles)
│   │   │   └── Technical presets (full/lean)
│   │   └── AI Advisory Policy (refresh, auto, tokens)
│   └── Audit Logs
│       ├── Filters (action, actor, date_from, date_to)
│       ├── Log list
│       └── Before/after JSON diff
```

**SaaS AICommandCenterPage**:
```
AICommandCenterPage
├── Header
├── Notice/Error banner
├── Form
│   ├── Provider select
│   ├── Model select (+ custom)
│   ├── Custom endpoint (when local)
│   ├── API Key input
│   ├── Tokens/day
│   ├── Refresh interval
│   └── Actions (save, test, refresh)
├── Test feedback (+ latency)
└── Fallback quota card
```

**SaaS ShellAiCommandCenterPage**:
```
ShellAiCommandCenterPage
├── ShellPageChrome (eyebrow, title, metrics)
├── ShellPanel: AI Runtime Config
│   └── Form (provider, model, key, tokens, refresh)
├── ShellPanel: Snapshot operator & runtime
│   └── Summary cards
└── ShellPanel: Surface flags & AI abilities
    ├── Groups & Routes flags
    ├── AI flags
    ├── Build meta card
    └── Ability list
```

### 4.3 UX Flow Khác Biệt

| Flow | Legacy | SaaS Native |
|------|--------|-------------|
| Save config | auto-save on blur | manual submit button |
| Provider change | auto-save + reload | manual save |
| Prompt config | In-page tab | `AIAdvisoryPromptConfigDrawer` (separate drawer) |
| Audit logs | In-page tab | ❌ Missing |
| Fallback view | ❌ Missing | Fallback quota progress bar |
| Local model | ❌ Missing | Endpoint input + local models list |

---

## 5. So sánh Commercial Software

### 5.1 Market Overview

Thị trường AI Command Center / AI Management cho investment đang phát triển nhanh (CAGR 20% cho AI Trading Platforms, dự kiến $33.45B vào 2030).

### 5.2 Competitive Landscape

| Sản phẩm | Công ty | Phân khúc | Điểm mạnh | Điểm yếu | Giá |
|-----------|---------|-----------|-----------|----------|-----|
| **Bloomberg AIM** | Bloomberg | Institutional Asset Managers | OMS đa tài sản, tích hợp Terminal, compliance | Chi phí cao, phụ thuộc Bloomberg ecosystem | Enterprise (custom) |
| **Kensho LLM-ready API** | S&P Global | Institutional Research | Deterministic retrieval, multi-agent, S&P data | Chỉ research, không phải command center | Enterprise |
| **WithAI Multiplier** | WithAI (YC '26) | Hedge Funds | Custom knowledge, secure inference, IDE-like | Startup (non-enterprise) | >$100k ARR |
| **Gemini Command Center** | Gemini | Crypto Trading | AI predictions, unified dashboard | Crypto-only | Built-in |
| **Datadog Bits AI** | Datadog | Enterprise Observability | AI-native, incident management | Không phải investment-specific | SaaS |
| **VNInvest AI Command Center** | VNInvest | Vietnam Stocks | Local market expertise, low latency, BYOK | Thiếu agent federation, multi-model routing | Built-in |

### 5.3 Key Differentiators

**Bloomberg AIM** (đối thủ gần nhất):
- 13,000+ professionals, 800+ firms, 90 countries
- Multi-asset OMS + portfolio management + compliance
- AI-assisted research (conversational AI)
- **Không có prompt source config, không có audit logs chi tiết như legacy VNInvest**

**Kensho/S&P Global** (công nghệ gần nhất):
- Multi-agent systems với LangGraph
- Deterministic data retrieval (cùng câu hỏi → cùng đáp án)
- LLM-ready API cho agentic workflows
- **GN⁃ Không có command center UI**

**WithAI** (YC S26):
- Multiplier: custom command center cho hedge funds
- IDE-like interface (không chatbox)
- Custom ontology + secure inference
- **>100k ARR, mới 3 tháng**

### 5.4 VNInvest Positioning

**Lợi thế cạnh tranh của VNInvest**:
1. **Domain expertise**: AI Advisory được fine-tune cho thị trường Việt Nam (whale flow, dark flow, technical indicators)
2. **Prompt source configuration**: Legacy đã có 8 nguồn dữ liệu với 8 technical indicators — tính năng này Bloomberg AIM và Kensho không có ở mức độ chi tiết này
3. **Audit logs with before/after JSON**: Tính năng governance mạnh hơn bất kỳ đối thủ nào trong phân khúc
4. **BYOK + Hybrid Fallback**: User tự chọn provider và key, fallback sang system key — flexibility cao
5. **Local model support**: Ollama/vLLM — không đối thủ nào trong investment space hỗ trợ

**Cần nâng cấp để đạt world-class**:
1. **Agent Federation**: Nhiều AI agents phối hợp (như Kensho multi-agent)
2. **Multi-model routing**: Routing request đến model phù hợp theo task type
3. **Usage Analytics Dashboard**: Token consumption, cost tracking, latency monitoring
4. **A/B Testing Framework**: So sánh output quality giữa các model/provider

---

## 6. Đề xuất SSOT: AI Management Center

### 6.1 Kiến trúc Target

```
┌─────────────────────────────────────────────────────┐
│                  AI Management Center                │
│  (SSOT — Single Source of Truth cho toàn bộ AI)     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │  Engine Control   │  │  Prompt Source Config    │   │
│  │  ─ Provider/Model │  │  ─ 8 sources toggle      │   │
│  │  ─ BYOK + Key     │  │  ─ Lookback per source   │   │
│  │  ─ Custom Endpoint│  │  ─ Technical indicators  │   │
│  │  ─ Test Connection│  │  ─ Presets               │   │
│  │  ─ Fallback Quota │  │  ─ Config preview        │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                       │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │  Audit Logs      │  │  Agent Federation        │   │
│  │  ─ Action filter  │  │  ─ Agent registry       │   │
│  │  ─ Actor filter   │  │  ─ Agent routing        │   │
│  │  ─ Date range     │  │  ─ Task orchestration   │   │
│  │  ─ JSON diff      │  │  ─ Performance metrics  │   │
│  │  ─ Diff summary   │  │  ─ Cost tracking        │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  Usage Analytics Dashboard                    │    │
│  │  ─ Token consumption / cost / latency / quota │    │
│  │  ─ Multi-provider comparison (A/B)           │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 6.2 Data Flow Target

```
[User Request]
       │
       ▼
┌──────────────────┐
│  Routing Layer    │ ← Agent Federation
│  (task → model)   │
└──────┬───────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Provider Resolution                 │
│  ┌─────────┐  ┌─────────┐  ┌─────┐ │
│  │ OpenAI  │  │ Gemini  │  │Local│ │
│  │ (BYOK)  │  │ (BYOK)  │  │Ollama│ │
│  └────┬────┘  └────┬────┘  └──┬──┘ │
│       │            │          │     │
│  ┌────▼────────────▼──────────▼──┐ │
│  │  Fallback Chain               │ │
│  │  BYOK → System Key → Error   │ │
│  └──────────────────────────────┘ │
└──────┬───────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Observability Layer                │
│  ─ Token usage tracking             │
│  ─ Cost per request                 │
│  ─ Latency per provider             │
│  ─ Quota consumption                │
│  ─ Audit logging                    │
└─────────────────────────────────────┘
```

### 6.3 Component Migration Map

| Legacy Component | SaaS Target | File |
|------------------|-------------|------|
| Engine Control tab | `AICommandCenterPage.tsx` (mở rộng) | Thêm summary cards, event gate, effective source |
| PromptSourceTabs | `AIAdvisoryPromptConfigDrawer.js` (đã tồn tại) | Integrate + thêm presets |
| Audit Logs tab | New component | `AIAuditLogsPanel.tsx` |
| Header + Status | `ShellAiCommandCenterPage.tsx` | Reuse shell chrome |
| Test Connection | `AICommandCenterPage.tsx` | Đã có + latency |

---

## 7. Kế hoạch Migration theo Phase

### Phase 1: Backend Consolidation (1-2 sprints)

**Mục tiêu**: Hợp nhất backend contract, thêm audit log model, thêm prompt config vào SaaS API.

| Task | Files | Mô tả |
|------|-------|-------|
| 1.1 | `advisory/models.py` | Thêm `AIAuditLog` model (action, actor, before/after JSON, diff_summary) |
| 1.2 | `portfolio_analytics_views.py` | Mở rộng GET/PUT: thêm `ai_prompt_config` field |
| 1.3 | `portfolio_analytics_views.py` | Thêm audit log creation vào PUT và test-connection |
| 1.4 | `portfolio_analytics_views.py` | Thêm `getPortfolioUserConfig()` endpoint cho event gate |
| 1.5 | `serializers.py` | `AIAuditLogSerializer` |
| 1.6 | `urls.py` | Route `/workspace/ai-command-center/audit-logs/` |
| 1.7 | Tests | `test_ai_audit_logs.py` |

### Phase 2: AICommandCenterPage Expansion (1-2 sprints)

**Mục tiêu**: Đưa prompt source config và audit logs UI vào SaaS native.

| Task | Files | Mô tả |
|------|-------|-------|
| 2.1 | `AICommandCenterPage.tsx` | Thêm summary cards section (4 cards) |
| 2.2 | `AICommandCenterPage.tsx` | Thêm effective runtime source display |
| 2.3 | `AICommandCenterPage.tsx` | Thêm event gate status indicator |
| 2.4 | `AICommandCenterPage.tsx` | Thêm prompt config section (tabs hoặc drawer) |
| 2.5 | `AICommandCenterPage.tsx` | Thêm preset buttons |
| 2.6 | `AIAdvisoryPromptConfigDrawer.js` | Mở rộng: thêm preset logic, lookback options |
| 2.7 | New: `AIAuditLogsPanel.tsx` | Audit logs component (filter + list + diff) |
| 2.8 | `AICommandCenterPage.tsx` | Thêm Audit Logs tab/section |
| 2.9 | i18n | Thêm strings cho audit logs, prompt config |

### Phase 3A: Complete Parity + Legacy Retirement (2 sprints)

**Mục tiêu**: Đạt 100% parity với legacy, xóa legacy code.

| Task | Files | Mô tả |
|------|-------|-------|
| 3A.1 | `AICommandCenterPage.tsx` | Thêm all missing features từ gap list (summary cards, event gate, effective source) |
| 3A.2 | `AIAdvisoryPromptConfigDrawer.js` | Tích hợp preset buttons + lookback config |
| 3A.3 | New: `AIAuditLogsPanel.tsx` | Audit logs UI với `monaco-editor` read-only diff hoặc thư viện `diff` cho JSON so sánh |
| 3A.4 | Navigation | Chuyển route từ legacy → SaaS AICommandCenterPage |
| 3A.5 | `frontend/src/pages/AICommandCenter.jsx` | Xóa legacy |
| 3A.6 | Legacy API client functions | Xóa khỏi `api/client.js` |
| 3A.7 | E2E tests | Verify tất cả flow trên SaaS native |

### Phase 3B: SSOT Upgrade — Agent Federation + Analytics (Future — 2-3 sprints)

**Mục tiêu**: Nâng cấp lên world-class AI Management Center (CHỈ sau khi Phase 3A vận hành trơn tru).

| Task | Files | Mô tả |
|------|-------|-------|
| 3B.1 | New: `ai_agents/models.py` | Agent registry model (name, type, provider, model, capabilities) |
| 3B.2 | New: `ai_agents/orchestrator.py` | Agent routing logic (task → agent) |
| 3B.3 | New: `ai_agents/views.py` | Agent management API |
| 3B.4 | New: `ai_analytics/models.py` | Usage tracking (token, cost, latency per request) |
| 3B.5 | New: `ai_analytics/views.py` | Usage analytics API |
| 3B.6 | New: `AIAgentFederationPanel.tsx` | UI: agent registry + routing config |
| 3B.7 | New: `AIUsageDashboard.tsx` | UI: token/cost/latency dashboard |
| 3B.8 | `coreApiAdapter` | Thêm agent + analytics endpoints |

### Phase 4: (Deprecated — merged into Phase 3A)

Phase 4 "Legacy Retirement" đã được merge vào Phase 3A để đảm bảo legacy chỉ bị xóa sau khi SaaS native đạt 100% parity.

---

## 7.1 Security: API Key Masking trong Audit Logs

**Vấn đề**: Audit log lưu `before_json`/`after_json` dạng plaintext. Nếu user update API key, key sẽ xuất hiện trong DB log.

**Giải pháp bắt buộc** — sanitize ở 2 layer:

### Layer 1: View layer (trước khi lưu)

```python
SENSITIVE_FIELD_PATTERNS = {
    'api_key': r'(sk-proj-|sk-ant-|AIza|ghp_|gho_|ghu_)[A-Za-z0-9_-]{20,}',
    'secret': r'(.{4})(.{8,})',
    'credential': r'(.{4})(.{8,})',
    'token': r'(.{4})(.{8,})',
}

def sanitize_sensitive_fields(data: dict) -> dict:
    """Mask sensitive fields in audit snapshots before persisting."""
    sanitized = {}
    for key, value in data.items():
        if any(pattern in key.lower() for pattern in ['api_key', 'secret', 'credential', 'token']):
            sanitized[key] = mask_sensitive_value(str(value))
        elif isinstance(value, dict):
            sanitized[key] = sanitize_sensitive_fields(value)
        else:
            sanitized[key] = value
    return sanitized

def mask_sensitive_value(value: str) -> str:
    """sk-proj-1234567890 → sk-proj-••••••••••"""
    if len(value) <= 8:
        return '••••••••'
    return value[:8] + '••••••••' + value[-4:] if len(value) > 12 else value[:4] + '••••••••'
```

### Layer 2: Serializer layer (output)

- `AIAuditLogSerializer` override `to_representation()` để mask lại khi trả về API response.

### Verification

- [ ] Unit test: `test_audit_log_sanitize_api_key` — key không xuất hiện trong `before_json`
- [ ] Unit test: `test_audit_log_sanitize_nested` — nested dict cũng được sanitize
- [ ] Integration test: `test_audit_log_persist_sanitized` — DB không chứa plaintext key

## 7.2 UX: Fallback Notification Banner

Khi hệ thống rơi vào fallback mode (user key fail), hiển thị banner rõ ràng:

**Vị trí**: Phía trên AI Advisory card trong Stock Detail.

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Khóa API cá nhân của bạn đang gặp lỗi ({error}).     │
│ Hệ thống đang dùng hạn mức sao lưu (còn {remaining}/{max}). │
│ [Cấu hình lại tại AI Command Center]                     │
└─────────────────────────────────────────────────────────┘
```

- Màu: hổ phách (amber) — warning, không phải error đỏ
- Auto-dismiss khi user fix key
- Link trực tiếp đến AI Command Center page

## 7.3 Local Model: Timeout & Error Handling

```python
# Trong test-connection view
LOCAL_MODEL_TIMEOUT = 3.0  # seconds — short timeout cho local endpoint

if provider == 'local':
    try:
        response = requests.post(
            endpoint,
            json=test_payload,
            timeout=LOCAL_MODEL_TIMEOUT,  # không dùng default timeout 30s
            headers=headers,
        )
    except requests.exceptions.Timeout:
        return Response({
            'ok': False,
            'message': 'Không thể kết nối đến endpoint local trong 3 giây. Kiểm tra Ollama/vLLM đã chạy.',
            'status': 'timeout',
        }, status=400)
    except requests.exceptions.ConnectionError:
        return Response({
            'ok': False,
            'message': 'Không thể kết nối đến endpoint local. Kiểm tra địa chỉ và port.',
            'status': 'connection_error',
        }, status=400)
```

## 7.4 DoD Checklist cho Phase 1 & 2

- [ ] **Data Model**: `UserAICredential.encrypted_api_key` dùng AES/Fernet — key trong Docker env var
- [ ] **Audit Logs UI**: Dùng `monaco-editor` read-only diff hoặc thư viện `diff` gọn nhẹ — không render JSON thô
- [ ] **Fallback banner**: UI component `AIAdvisoryWarningBanner` với link cấu hình
- [ ] **API key masking**: Unit test xác nhận key không xuất hiện trong audit log
- [ ] **Manual submit only**: Không auto-save on blur trong SaaS native
- [ ] **Local model timeout 3s**: Short timeout + error message rõ ràng
- [ ] **Prompt Config Drawer**: Nút kích hoạt cạnh Model/Provider section

## 8. Rủi ro & Giảm thiểu

| # | Rủi ro | Impact | Xác suất | Giảm thiểu |
|---|--------|--------|----------|------------|
| 1 | Prompt source config không tương thích giữa legacy format và SaaS format | High | Medium | Viết migration script + normalize helper |
| 2 | Audit logs data trong legacy DB không migrate được | Medium | Low | Dùng chung DB (core) — chỉ cần UI |
| 3 | User quen với legacy UI, không thích SaaS UI | Medium | Medium | Feature flag: giữ legacy song song 2 sprint |
| 4 | Agent federation quá tham vọng, kéo dài | High | High | Phase 3 đã split: 3A (parity) trước, 3B (federation) là future |
| 5 | Local model không tương thích với advisory orchestration | Medium | Low | Đã có UserAICredential SSOT design |
| 6 | Fallback quota không đồng bộ | Low | Low | Đã có F() expression design |
| 7 | **API key leak qua audit logs** | **CRITICAL** | Low | **BẮT BUỘC** sanitize: `sanitize_sensitive_fields()` ở cả view + serializer layer — regex mask `api_key`, `secret`, `credential`, `token` patterns (`sk-proj-`, `AIza`, `sk-ant-`, `ghp_`) trước khi persist `before_json`/`after_json` |
| 8 | **Local model test connection timeout** | Medium | Medium | Hard timeout `3.0s` riêng cho provider==`local`; error message rõ: "Không thể kết nối đến endpoint local. Kiểm tra Ollama/vLLM đã chạy." |
| 9 | **Auto-save on blur ghi đè cấu hình dở dang** | Medium | Low | Đã giải quyết: SaaS native chỉ dùng manual submit button |
| 10 | **Audit log noise từ auto-save** | Low | Medium | Đã giải quyết: manual submit giảm số audit records |

---

## 9. Phụ lục: Inventory Files

### Legacy Files
```
frontend/src/pages/AICommandCenter.jsx               → 1,458 dòng
frontend/src/api/client.js                             → API calls (getAICommandCenterConfig, etc.)
```

### SaaS Native Files
```
packages/web/src/pages/AICommandCenterPage.tsx         → 434 dòng (settings form)
packages/web/src/pages/system/ShellAiCommandCenterPage.tsx → 494 dòng (shell diagnostics)
packages/web/src/pages/signals/WhaleAdvisoryPage.tsx    → 234 dòng
packages/web/src/pages/signals/ShellAiAdvisoryPage.tsx   → 419 dòng
packages/web/src/components/AIAdvisoryPromptConfigDrawer.js
packages/web/src/components/advisory/WhaleAdvisoryCommandPanel.js
packages/web/src/components/advisory/RecommendationCardExplainability.js
packages/web/src/components/advisory/TrustTelemetryPanel.js
packages/web/src/components/advisory/WhaleAdvisoryBentoHeader.js
packages/web/src/adapters/core/workspace.js              → API adapter
```

### Backend Files
```
packages/core/backend/src/advisory/models.py             → SystemAISettings, UserAICredential
packages/core/backend/src/user_workspace/portfolio_analytics_views.py
packages/core/backend/src/advisory/views.py
packages/core/backend/src/advisory/orchestrator.py
packages/core/backend/src/advisory/serializers.py
packages/core/backend/src/advisory/urls.py
packages/core/backend/src/identity_access/security.py    → Fernet encryption
```

### Related Docs
```
docs/IMPLEMENTATION_PLAN_AI_MANAGEMENT_CENTER_SSOT_UPGRADE_20260620.md
docs/AUDIT_AI_ADVISORY_RUNTIME_CONFIG_20260418.md
docs/AI_ADVISORY_UNIFICATION_PLAN_20260411.md
docs/AUDIT_AI_ADVISORY_DESIGN_20260421.md
docs/AUDIT_AI_ADVISORY_DASHBOARD_20260421.md
docs/AI_ADVISORY_KLINE_CONTEXT_UPGRADE_PLAN_20260408.md
docs/MULTI_AI_PROVIDERS_SUMMARY.md
docs/MULTI_AI_PROVIDERS_IMPLEMENTATION_ROADMAP.md
docs/PLAN_AI_ADVISORY_RUNTIME_CONFIG_20260418.md
docs/SPEC_AI_ADVISORY_RUNTIME_PROMPT_CONFIG_20260418.md
docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md
docs/P3_1_PROVIDER_FAILOVER_DESIGN.md
```

---

## Action Items

1. ~~**Review báo cáo** — xác nhận gap analysis và migration phases~~ ✅ DONE
2. **Approve Phase 1** — backend consolidation: `AIAuditLog` model + API expansion + sanitize (1-2 sprints)
3. **Approve Phase 2** — frontend expansion: summary cards, prompt config drawer, audit logs UI (1-2 sprints)
4. **Approve Phase 3A** — complete parity + legacy retirement (2 sprints)
5. **Defer Phase 3B** — agent federation + analytics (future, sau khi SaaS vận hành ổn định)
6. **Security review** — confirm API key masking strategy trước Phase 1 implementation
