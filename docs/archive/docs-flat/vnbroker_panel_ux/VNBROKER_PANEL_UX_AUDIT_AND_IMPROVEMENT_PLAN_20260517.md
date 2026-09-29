# VNBroker Panel — UX/UI Audit & Improvement Plan
**Date**: May 17, 2026  
**Status**: ⚠️ AUDIT COMPLETE, IMPROVEMENT PLAN READY FOR IMPLEMENTATION

---

## 📸 Current State Analysis (from Screenshots)

### Issues Identified

#### 🔴 CRITICAL ISSUE #1: Raw i18n Keys Displayed
**Problem**: The UI shows raw i18n keys instead of Vietnamese translations:
- `soc.vnbroker.per_provider_config_title` (should show: "Cấu hình riêng từng nhà cung cấp")
- `soc.vnbroker.per_provider_config_hint` (should show: "Tùy chỉnh timeout, số lần thử, và rate limit...")

**Root Cause**: The `t()` function is not being called on these strings in the component. The backend returns these as literal keys instead of translating them.

**Impact**: Users see raw technical keys; UI looks broken and unprofessional.

**Fix**: Ensure `t()` function is called in the render path for section titles and hints.

---

#### 🔴 CRITICAL ISSUE #2: Massive Field Redundancy & Cognitive Overload
**Current Structure**:
```
┌─ GLOBAL CONFIG SECTION ──────────────────────────────┐
│  Provider ưu tiên: [VCI    ▼]                       │
│  Số lần retry tối đa: [3]                           │
│  Thời gian chờ retry: [2]                           │
│  Yêu cầu/phút: [60]  Giới hạn burst: [10]          │
│  Ngưỡng circuit breaker: [5]                        │
│                                                       │
│  ┌─ TIMEOUT SECTION (same fields repeated) ────┐    │
│  │ Connect (s): [__]  Read (s): [__]            │    │
│  │ Write (s): [__]    Pool (s): [__]            │    │
│  └────────────────────────────────────────────┘    │
│                                                       │
│  Cấu hình riêng từng nhà cung cấp                  │
│  [Hint text here]                                   │
│                                                       │
│  ┌─ VCI ─────────────────────────────────────────┐ │
│  │ TIMEOUT                                        │ │
│  │   Connect: [__] Read: [__] Write: [__] Pool: [__] │
│  │ RETRY SECTION                                  │ │
│  │   Max Retries: [__]  Delay (s): [__]         │ │
│  │ RATE LIMIT SECTION                             │ │
│  │   Requests/min: [__]  Burst: [__]             │ │
│  │ [Clear Override]                               │ │
│  └────────────────────────────────────────────────┘ │
│  (Same structure for KBS and DNSE...)               │
└───────────────────────────────────────────────────────┘
```

**Problems**:
1. **3-4 levels of hierarchy** are confusing:
   - Core fields (provider, retries, delay)
   - Separate "Timeout" section
   - Then "Per-Provider Config" sections
   - Then timeout/retry/rate-limit subsections inside each provider

2. **Same fields appear 4+ times**:
   - `requests_per_minute`: global + per-provider
   - `retry_delay_seconds`: global + per-provider
   - `timeout.*`: global + per-provider
   - Users don't understand what global means vs per-provider override

3. **No clear visual distinction** between:
   - What's global default
   - What's provider-specific override
   - What overrides what

4. **Scrolling fatigue**: Page requires excessive scrolling to see all 3 providers

**Impact**: Users are confused about configuration hierarchy; many skip per-provider config because UI is overwhelming.

---

#### 🟡 MAJOR ISSUE #3: Poor Visual Hierarchy & Information Architecture

**Current problems**:
- All sections use same styling (dark gray boxes)
- No visual weight difference between global and per-provider settings
- "Per-Provider Config" title appears after all global fields, creating mental model: "is this additional/optional?"
- Timeout fields are separated from retry/rate-limit by large white space
- Each provider is a collapsed box that looks identical when closed (no preview of what's overridden)

**Impact**: Users need to read labels carefully; can't scan visually.

---

#### 🟡 MAJOR ISSUE #4: Confusing "Clear Override" Button

**Problems**:
- Button is small and at bottom of expanded section
- Users might not notice it exists
- Unclear that clicking it clears ALL settings for that provider (not just one field)
- No confirmation dialog

**Impact**: Users accidentally click and lose their per-provider config.

---

#### 🟡 MAJOR ISSUE #5: Missing Provider Status Integration

**Current state**:
- "Provider Status" section is separate at bottom
- Shows "Đã cấu hình" / "Chưa cấu hình" status
- Disconnect from actual configuration UI
- Users can't see provider status while editing its config

**Impact**: Users edit in blind; can't verify provider is actually working before/after changes.

---

## 🎯 Proposed Improved Layout

### Three-Tab Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│ [Cấu hình toàn cục] [Cấu hình từng nhà cung cấp] [Sức khỏe] │
└─────────────────────────────────────────────────────────────┘

TAB 1: GLOBAL CONFIGURATION (Global Defaults)
────────────────────────────────────────────────
┌──────────────────────────────────────────────────┐
│ Cấu hình Mặc Định (Áp dụng cho tất cả NCCPs)    │
│ (These are fallback values when provider doesn't │
│  have specific override)                         │
│                                                  │
│ Nhà cung cấp ưu tiên: [VCI ▼]  ← Primary        │
│ Nhà cung cấp fallback: [KBS, DNSE] ← Fallback  │
│                                                  │
│ Cấu hình Mặc Định:                              │
│ ┌──────────────────────────────────────────┐    │
│ │ Timeout          │ Retry      │ Rate Limit    │
│ │─────────────────┼────────────┼────────────   │
│ │ Connect: [10]s  │ Max: [3]   │ /phút: [60]  │
│ │ Read:    [30]s  │ Delay:[2]s │ Burst: [10]  │
│ │ Write:   [10]s  │            │ CB: [5]      │
│ │ Pool:    [5]s   │            │              │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ [Xem trước] [Đặt lại] [Áp dụng]                │
└──────────────────────────────────────────────────┘

TAB 2: PER-PROVIDER OVERRIDES
────────────────────────────────────
┌──────────────────────────────────────────────────┐
│ Ghi đè Nhà Cung Cấp                              │
│ Để trống = sử dụng mặc định toàn cục             │
│                                                  │
│ ┌─ VCI (Được tùy chỉnh) ──────────────────────┐ │
│ │ Status: ● Đã cấu hình                       │ │
│ │                                              │ │
│ │ Timeout:                                    │ │
│ │ [Connect] [Read] [Write] [Pool]             │ │
│ │                                              │ │
│ │ Retry:  [Max Retries] [Delay]               │ │
│ │ Rate:   [Requests/min] [Burst]              │ │
│ │                                              │ │
│ │ [Xóa tùy chỉnh]                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ KBS ────────────────────────────────────────┐ │
│ │ Status: ● Đã cấu hình                       │ │
│ │ (Collapsed - showing placeholder)           │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ DNSE ───────────────────────────────────────┐ │
│ │ Status: ○ Chưa cấu hình                     │ │
│ │ (Collapsed)                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Xem trước] [Đặt lại] [Áp dụng]                │
└──────────────────────────────────────────────────┘

TAB 3: HEALTH & STATUS
────────────────────────────────────
┌──────────────────────────────────────────────────┐
│ Trạng Thái Nhà Cung Cấp                          │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ VCI                                        │  │
│ │ Status: ● Đã cấu hình / Hoạt động         │  │
│ │ Latency: 124ms (avg)                       │  │
│ │ Errors (24h): 0                            │  │
│ │ Rate limit: 45/60 req/min used             │  │
│ └────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────┐  │
│ │ KBS                                        │  │
│ │ Status: ● Đã cấu hình / Hoạt động         │  │
│ │ Latency: 89ms (avg)                        │  │
│ │ Errors (24h): 0                            │  │
│ │ Rate limit: 85/100 req/min used            │  │
│ └────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────┐  │
│ │ DNSE                                       │  │
│ │ Status: ○ Chưa cấu hình                    │  │
│ │ (Configure credentials in portfolio)       │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ [Chạy kiểm tra kết nối]                         │
└──────────────────────────────────────────────────┘
```

---

### Design Principles for Improved Layout

1. **Separate Global from Per-Provider**
   - Use tabs, not stacked sections
   - Clear visual boundary
   - Different intent: "I want to set defaults for all" vs "I want to override for one"

2. **Show Status Inline**
   - Each provider shows its current health status next to name
   - Users know if provider is working while editing
   - Visual cue: green dot = working, red dot = issue, gray = not configured

3. **Reduce Information Density**
   - Per-provider section shows only fields that are overridden
   - When collapsed: show summary (e.g., "Timeout, Retry customized")
   - When expanded: show full form with placeholders for global defaults

4. **Improve "Clear Override" Discoverability**
   - Move to header of provider section
   - Show as icon button (trash icon)
   - Add tooltip: "Xóa tất cả tùy chỉnh cho NCCP này"
   - Add confirmation dialog before deleting

5. **Better Visual Distinction**
   - Global config: clean, primary color accent
   - Per-provider override: secondary color accent, slightly dimmed
   - Status indicator: colored dot + text label

6. **Hierarchy Clarity**
   - Global tab: "Cấu hình Mặc Định"
   - Per-provider tab: "Ghi đè Nhà Cung Cấp"
   - Health tab: "Trạng Thái & Sức Khỏe"
   - Each has one clear purpose

---

## 🔧 Implementation Steps

### Phase 1: Fix Critical i18n Bug (1 commit)
**Objective**: Fix raw i18n keys showing in UI

**Changes**:
- Ensure all section titles use `t()` function
- Test that Vietnamese text renders correctly
- Verify translations in vi.json are complete

**Files**:
- `frontend/src/components/soc/VnbrokerPanel.jsx` - Fix t() calls

---

### Phase 2: Refactor to Tab-Based Layout (2-3 commits)
**Objective**: Implement three-tab architecture

**Commit 1 - Extract Global Config Tab**:
- Create separate component for global config section
- Move timeout/retry/rate-limit from current scattered layout into organized tab
- Clean up grid layout to avoid redundancy

**Commit 2 - Extract Per-Provider Config Tab**:
- Move per-provider sections to dedicated tab
- Redesign collapsed preview (show which fields are overridden)
- Add inline provider status indicator
- Improve "Clear Override" button

**Commit 3 - Create Health Status Tab**:
- Move "Providers Status" to third tab
- Enhance with latency/error metrics if available
- Add connection test button

---

### Phase 3: Improve Form Organization (1-2 commits)
**Objective**: Better field grouping and visual hierarchy

**Commit 4 - Form Component Extraction**:
- Create `<TimeoutForm>` component (reusable for global + per-provider)
- Create `<RetryForm>` component
- Create `<RateLimitForm>` component
- This reduces code duplication and maintains consistency

**Commit 5 - Polish UI Details**:
- Add clear section separators in each tab
- Improve spacing and alignment
- Add helper text for complex fields
- Better placeholder text (e.g., "Sử dụng mặc định toàn cục" instead of "không ghi đè")

---

### Phase 4: Enhanced UX Features (1-2 commits)
**Objective**: Make provider management easier

**Commit 6 - Inline Provider Status**:
- Show green/red/gray dot next to provider name
- Show tooltip with last health check time
- Update status in real-time (if available)

**Commit 7 - Confirmation Dialog for Clear Override**:
- Add modal confirmation before clearing provider settings
- Show what will be deleted
- Prevent accidental loss of configuration

---

## 📋 Detailed Specification: Phase 2 (Tab Refactoring)

### Tab 1: Global Configuration
**Scope**: Default settings that apply to all providers

**Layout**:
```
┌─────────────────────────────────────────┐
│ Cấu hình Mặc Định cho Tất Cả NCCPs     │
│                                         │
│ Nhà cung cấp ưu tiên: [VCI ▼]          │
│ Nhà cung cấp fallback: [KBS, DNSE]     │
│ (+ button to reorder)                   │
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ Timeout (Hết Thời Gian Chờ)         ││
│ │                                     ││
│ │ Connect (s): [10]   Read (s): [30] ││
│ │ Write (s):   [10]   Pool (s): [5]  ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ Retry (Thử Lại)                     ││
│ │                                     ││
│ │ Max Retries: [3]                    ││
│ │ Delay (s):   [2]                    ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ Rate Limit (Giới Hạn Tốc Độ)        ││
│ │                                     ││
│ │ Requests/min: [60]                  ││
│ │ Burst limit:  [10]                  ││
│ │ Circuit breaker threshold: [5]      ││
│ └─────────────────────────────────────┘│
│                                         │
│ [Xem trước] [Đặt lại] [Áp dụng]        │
└─────────────────────────────────────────┘
```

**Styling**:
- Each subsection (Timeout, Retry, Rate Limit) in its own box
- Light blue accent border on left side
- Consistent 2-column grid for timeout fields
- Single column for simple fields

---

### Tab 2: Per-Provider Overrides
**Scope**: Provider-specific settings that override global

**Layout for collapsed provider**:
```
┌────────────────────────────────────────────────────────┐
│ VCI                         ● Đã cấu hình         ▲     │
│ Customizations: Timeout, Retry, Rate Limit           │
└────────────────────────────────────────────────────────┘
```

**Layout for expanded provider**:
```
┌────────────────────────────────────────────────────────┐
│ VCI                         ● Đã cấu hình    [x]   ▼   │
│                                                         │
│ Hướng dẫn: Để trống = sử dụng mặc định toàn cục       │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Timeout (Hết Thời Gian Chờ)                     │   │
│ │                                                 │   │
│ │ Connect (s): [____] (mặc định: 10s)             │   │
│ │ Read (s):    [____] (mặc định: 30s)             │   │
│ │ Write (s):   [____] (mặc định: 10s)             │   │
│ │ Pool (s):    [____] (mặc định: 5s)              │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Retry (Thử Lại)                                 │   │
│ │                                                 │   │
│ │ Max Retries: [____] (mặc định: 3)               │   │
│ │ Delay (s):   [____] (mặc định: 2)               │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Rate Limit (Giới Hạn Tốc Độ)                    │   │
│ │                                                 │   │
│ │ Requests/min: [____] (mặc định: 60)             │   │
│ │ Burst limit:  [____] (mặc định: 10)             │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ [Xóa tùy chỉnh]                                       │
└────────────────────────────────────────────────────────┘
```

**Details**:
- `[x]` button in header for "Clear Override" (more discoverable than button at bottom)
- Show default value in helper text under each input
- All input fields aligned vertically for scannability
- Status dot shows provider health
- "Được tùy chỉnh" badge unnecessary (already shown by expanded state + customization summary)

---

### Tab 3: Health & Status
**Scope**: Real-time health monitoring, no configuration

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ VCI                              ● Hoạt động         │
│ ────────────────────────────────────────────────────── │
│ Last checked: 2m ago                                  │
│ Latency (avg):  124ms (acceptable)                    │
│ Errors (24h):   0 (healthy)                           │
│ Rate limit:     45/60 requests/min used (75%)         │
│ Status:         ✓ Cấu hình hoàn chỉnh                │
└────────────────────────────────────────────────────────┘
```

---

## 🎨 CSS/Styling Guidelines

### Color Coding
- **Global Config**: Blue accent (`border-l-4 border-blue-500`)
- **Per-Provider Override**: Amber accent (`border-l-4 border-amber-500`)
- **Health Status**: Green accent (`border-l-4 border-green-500`)

### Spacing
- Section margin: `mb-6` between major sections
- Field gap: `gap-4` between form fields
- Subsection padding: `p-4` inside boxes

### Typography
- Tab headers: `font-bold text-lg text-white`
- Section titles: `font-semibold text-sm text-slate-300 uppercase`
- Labels: `text-xs text-slate-400`
- Helper text: `text-xs text-slate-500 italic`

---

## 📊 Estimated Effort

| Phase | Commits | Time Estimate | Priority |
|-------|---------|---------------|----------|
| Phase 1: Fix i18n | 1 | 15 mins | 🔴 Critical |
| Phase 2: Tabs | 3 | 2-3 hours | 🔴 Critical |
| Phase 3: Forms | 2 | 1-2 hours | 🟡 High |
| Phase 4: UX | 2 | 1-2 hours | 🟡 High |
| **Total** | **8** | **4-7 hours** | |

---

## ✅ Success Criteria

1. **i18n**: All Vietnamese text renders correctly (no raw keys)
2. **Clarity**: Users can understand difference between global vs per-provider config at a glance
3. **Efficiency**: No field redundancy; each setting appears once in its appropriate context
4. **Discoverability**: All features (Clear Override, Status, Help) are clearly visible
5. **Usability**: Form can be filled in <2 minutes for typical configuration
6. **Mobile**: Responsive layout works on small screens (tabs, single-column fields)

---

## 🚀 Next Steps

1. **Approve Architecture**: Confirm 3-tab layout is acceptable
2. **Start Phase 1**: Fix i18n bug immediately
3. **Begin Phase 2**: Start tab refactoring commit 1
4. **Validate Design**: Show intermediate progress before full rollout

