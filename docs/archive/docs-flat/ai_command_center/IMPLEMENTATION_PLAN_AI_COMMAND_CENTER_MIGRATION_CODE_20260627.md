# Kế Hoạch Implementation: AI Command Center Migration — Phase 1 & 2

**Ngày**: 2026-06-27
**Tác giả**: AI Agent (Code Analysis)
**Base Report**: `docs/AI_COMMAND_CENTER_MIGRATION_REPORT_20260627.md`

---

## Mục Lục

1. [Tổng quan & Phạm vi](#1-tổng-quan--phạm-vi)
2. [Phase 1: Backend Consolidation](#2-phase-1-backend-consolidation)
   - 2.1 AIAuditLog Model
   - 2.2 AIAuditLog Serializer + Sanitize
   - 2.3 Audit Log Creation trong PUT
   - 2.4 Audit Log Creation trong Test-Connection
   - 2.5 Audit Log Read Endpoint
   - 2.6 URL Routing
   - 2.7 Event Gate Endpoint (getPortfolioUserConfig)
3. [Phase 2: Frontend SaaS Native Expansion](#3-phase-2-frontend-saas-native-expansion)
   - 3.1 API Adapter (workspace.js)
   - 3.2 AICommandCenterPage.tsx — Summary Cards
   - 3.3 AICommandCenterPage.tsx — Effective Source + Event Gate
   - 3.4 AICommandCenterPage.tsx — Prompt Config Section
   - 3.5 AIAdvisoryPromptConfigDrawer.js — Presets + Lookback
   - 3.6 AIAuditLogsPanel.tsx — New Component
   - 3.7 AICommandCenterPage.tsx — Audit Logs Tab
   - 3.8 i18n Keys
4. [Verification](#4-verification)
5. [File-by-File Change Summary](#5-file-by-file-change-summary)

---

## 1. Tổng quan & Phạm vi

### Mục tiêu

Đưa AI Command Center SaaS native (`AICommandCenterPage.tsx`) từ ~70% parity lên ~100% parity với legacy (`AICommandCenter.jsx`) bằng cách:

**Phase 1 (Backend)**: Thêm `AIAuditLog` model, serializer với key masking, audit log creation trong PUT & test-connection, audit log read endpoint, event gate endpoint.

**Phase 2 (Frontend)**: Mở rộng `AICommandCenterPage.tsx` — thêm summary cards (4), effective source display, event gate indicator, prompt config section (tích hợp `AIAdvisoryPromptConfigDrawer.js` với presets), audit logs panel mới, i18n keys.

### Legacy Reference

- `frontend/src/pages/AICommandCenter.jsx` (1,458 dòng) — mẫu cho tất cả UI cần migrate
- `frontend/src/api/client.js` — API client legacy (dòng 790-801)

### SaaS Native Target

- `packages/web/src/pages/AICommandCenterPage.tsx` (434 dòng) — mở rộng
- `packages/web/src/components/AIAdvisoryPromptConfigDrawer.js` (211 dòng) — nâng cấp
- `packages/web/src/adapters/core/workspace.js` (578 dòng) — thêm adapter

---

## 2. Phase 1: Backend Consolidation

### 2.1 AIAuditLog Model

**File**: `packages/core/backend/src/advisory/models.py`

Thêm model mới ở cuối file (sau `UserAICredential`):

```python
class AIAuditLog(models.Model):
    """
    Audit log cho AI Command Center actions.

    Ghi lại mọi thay đổi cấu hình và test-connection để traceability.
    before_json/after_json được sanitize trước khi persist (API key masking).
    """

    class ActionChoices(models.TextChoices):
        UPDATE_SETTINGS = 'update_settings', 'Cập nhật cấu hình'
        TEST_CONNECTION_SUCCESS = 'test_connection_success', 'Test kết nối thành công'
        TEST_CONNECTION_FAILED = 'test_connection_failed', 'Test kết nối thất bại'

    action = models.CharField(
        max_length=32,
        choices=ActionChoices.choices,
        db_index=True,
        verbose_name='Hành động',
    )
    actor = models.CharField(
        max_length=128,
        blank=True, default='',
        verbose_name='Người thực hiện',
    )
    reason = models.TextField(blank=True, default='', verbose_name='Lý do')
    before_json = models.JSONField(default=dict, blank=True, verbose_name='Trạng thái trước')
    after_json = models.JSONField(default=dict, blank=True, verbose_name='Trạng thái sau')
    diff_summary = models.TextField(blank=True, default='', verbose_name='Tóm tắt thay đổi')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'AI Audit Log'
        verbose_name_plural = 'AI Audit Logs'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.action} by {self.actor or "system"} @ {self.created_at}'
```

**Migration**: `python manage.py makemigrations advisory && python manage.py migrate advisory`

### 2.2 AIAuditLog Serializer + Sanitize

**File**: `packages/core/backend/src/advisory/serializers.py`

Thêm sanitize helper functions và `AIAuditLogSerializer`:

```python
import re

# ── API Key Masking ────────────────────────────────────────────────────────

SENSITIVE_KEY_PATTERNS = re.compile(
    r'(sk-proj-|sk-ant-|AIza|ghp_|gho_|ghu_|sk-)[A-Za-z0-9_-]{20,}'
)

def sanitize_sensitive_fields(data: dict) -> dict:
    """Mask sensitive fields in audit snapshots before persisting."""
    sanitized = {}
    for key, value in data.items():
        if any(pattern in key.lower() for pattern in ['api_key', 'secret', 'credential', 'token']):
            sanitized[key] = mask_sensitive_value(str(value))
        elif isinstance(value, dict):
            sanitized[key] = sanitize_sensitive_fields(value)
        else:
            if isinstance(value, str):
                sanitized[key] = SENSITIVE_KEY_PATTERNS.sub(
                    lambda m: m.group(0)[:8] + '••••••••' + m.group(0)[-4:],
                    value
                )
            else:
                sanitized[key] = value
    return sanitized

def mask_sensitive_value(value: str) -> str:
    """sk-proj-1234567890abcdef1234 → sk-proj-••••••••1234"""
    if len(value) <= 8:
        return '••••••••'
    if len(value) > 12:
        return value[:8] + '••••••••' + value[-4:]
    return value[:4] + '••••••••'


class AIAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAuditLog
        fields = [
            'id',
            'action',
            'actor',
            'reason',
            'before_json',
            'after_json',
            'diff_summary',
            'created_at',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Double-mask on output (defense in depth)
        if isinstance(data.get('before_json'), dict):
            data['before_json'] = sanitize_sensitive_fields(data['before_json'])
        if isinstance(data.get('after_json'), dict):
            data['after_json'] = sanitize_sensitive_fields(data['after_json'])
        return data
```

### 2.3 Audit Log Creation trong PUT

**File**: `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`

Trong method `put()` của `PortfolioAICommandCenterView`, cần:

1. Capture `before` snapshot trước khi cập nhật
2. Tạo `AIAuditLog` record sau khi cập nhật thành công
3. Build `diff_summary` từ các field thay đổi

**Điểm thay đổi**: Trong method `put()`, trước `payload = request.data...` (dòng 512), capture before snapshot. Sau khi lưu (dòng 567, sau `config.save()`), tạo audit log.

```python
# Trước dòng 512: capture before snapshot
from advisory.serializers import sanitize_sensitive_fields
before_snapshot = {
    'ai_provider': user_cred.ai_provider if user_cred.pk else '',
    'ai_model': config.ai_model,
    'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
    'ai_ready': ai_ready,
    'advisory_refresh_interval_hours': int(metadata.get('advisory_refresh_interval_hours', 24)),
    'advisory_max_auto_refreshes_per_day': int(metadata.get('advisory_max_auto_refreshes_per_day', 24)),
    'advisory_max_tokens_per_day': config.max_tokens,
}
before_snapshot = sanitize_sensitive_fields(before_snapshot)
```

Sau dòng 567 (`config.save()`), thêm:

```python
# Tạo audit log
from advisory.models import AIAuditLog
after_snapshot = sanitize_sensitive_fields({
    'ai_provider': user_cred.ai_provider or '',
    'ai_model': config.ai_model,
    'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
    'ai_ready': ai_ready,
    'advisory_refresh_interval_hours': int(metadata.get('advisory_refresh_interval_hours', 24)),
    'advisory_max_auto_refreshes_per_day': int(metadata.get('advisory_max_auto_refreshes_per_day', 24)),
    'advisory_max_tokens_per_day': config.max_tokens,
})

# Build diff summary
diff_parts = []
for field in ['ai_provider', 'ai_model', 'effective_ai_source']:
    before_val = before_snapshot.get(field, '')
    after_val = after_snapshot.get(field, '')
    if str(before_val) != str(after_val):
        diff_parts.append(f'{field}: {before_val} → {after_val}')

AIAuditLog.objects.create(
    action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
    actor=request.user.username,
    reason=f'Cập nhật cấu hình AI: {"; ".join(diff_parts) if diff_parts else "không có thay đổi"}.',
    before_json=before_snapshot,
    after_json=after_snapshot,
    diff_summary='; '.join(diff_parts) if diff_parts else 'Không có thay đổi',
)
```

### 2.4 Audit Log Creation trong Test-Connection

**File**: `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`

Trong method `post()` của `PortfolioAICommandCenterTestView`, thêm audit log ở mỗi response path (thành công và thất bại).

**Điểm thay đổi**: Sau mỗi `return Response(...)`, cần log trước khi return. Vì view dùng `ValidationErrorException` cho lỗi, cần dùng try/except hoặc hook vào exception handler. Cách đơn giản nhất: tạo helper method để log và dùng `try/finally` hoặc wrapper.

Giải pháp practical: thêm audit log ở 2 nơi:
1. **Success path** (dòng 714-717 của openai/gemini/claude, dòng 639-644 của local): trước mỗi `return Response`
2. **Exception path**: Bao các exception handlers để log thất bại

```python
# Helper để tạo audit log cho test-connection
def _log_test_connection(request, provider, model, status, message):
    from advisory.models import AIAuditLog
    AIAuditLog.objects.create(
        action=(
            AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS
            if status == 'success' else
            AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED
        ),
        actor=request.user.username,
        reason=message,
        before_json={},
        after_json={'ai_provider': provider, 'ai_model': model, 'status': status},
        diff_summary=f'Test connection {provider}/{model}: {status}',
    )
```

**openclaw success** (dòng 623-627):
```python
if provider == 'openclaw':
    _log_test_connection(request, provider, model, 'success', 'OpenClaw mặc định luôn sẵn sàng.')
    return Response({...})
```

**local probe** (dòng 639-644): thêm `_log_test_connection(...)` trước return,
và trong mỗi exception catch block (dòng 646-658): thêm `_log_test_connection(request, provider, model, 'failed', str(e))` trước raise.

**remote probe** (dòng 714-717): thêm `_log_test_connection(...)` trước return,
và trong mỗi exception catch block (dòng 719-738): thêm `_log_test_connection(...)` trước raise.

### 2.5 Audit Log Read Endpoint

**File**: `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`

Thêm view mới:

```python
class PortfolioAICommandCenterAuditLogView(APIView):
    """GET /workspace/ai-command-center/audit-logs/
    
    Trả về audit logs với pagination, filter theo action/actor/date range.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from advisory.models import AIAuditLog
        from advisory.serializers import AIAuditLogSerializer

        queryset = AIAuditLog.objects.all()

        # Filters
        action = request.query_params.get('action', '').strip()
        if action:
            queryset = queryset.filter(action=action)

        actor = request.query_params.get('actor', '').strip()
        if actor:
            queryset = queryset.filter(actor__icontains=actor)

        date_from = request.query_params.get('date_from', '').strip()
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)

        date_to = request.query_params.get('date_to', '').strip()
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        # Pagination
        try:
            limit = min(int(request.query_params.get('limit', 10)), 100)
        except (TypeError, ValueError):
            limit = 10
        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (TypeError, ValueError):
            offset = 0

        total = queryset.count()
        logs = queryset[offset:offset + limit]
        serializer = AIAuditLogSerializer(logs, many=True)

        return Response({
            'results': serializer.data,
            'total': total,
            'limit': limit,
            'offset': offset,
        })
```

### 2.6 URL Routing

**File**: `packages/core/backend/src/user_workspace/urls.py`

Thêm route mới sau dòng 46:

```python
path('workspace/ai-command-center/audit-logs/', PortfolioAICommandCenterAuditLogView.as_view(), name='workspace-ai-cc-audit-logs'),
```

Và import view mới ở đầu file (thêm vào import hiện có):
```python
from .portfolio_analytics_views import (
    ...
    PortfolioAICommandCenterAuditLogView,
)
```

### 2.7 Event Gate Endpoint (getPortfolioUserConfig)

Legacy `getPortfolioUserConfig()` gọi `/portfolio/userconfig/` — endpoint này đã tồn tại trong `legacy_views.py` như `PortfolioUserConfigView`. Response trả về `preferences.advisory_whale_signal_enabled`.

Giải pháp: **Không cần thêm endpoint mới** — SaaS native có thể gọi thẳng đến `/workspace/userconfig/` hoặc tái sử dụng `PortfolioUserConfigView`.

Nếu muốn tạo endpoint core-native, thêm vào `portfolio_analytics_views.py`:

```python
class PortfolioUserConfigLegacyView(APIView):
    """GET /workspace/userconfig/ — proxy đến identity_access.UserProfile"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response({
            'id': profile.pk,
            'language': profile.language,
            'theme': profile.theme,
            'preferences': profile.preferences,
            'advisory_whale_signal_enabled': (
                profile.preferences or {}
            ).get('advisory_whale_signal_enabled', True),
        })
```

URL: `path('workspace/userconfig/', PortfolioUserConfigLegacyView.as_view(), name='workspace-userconfig')`

---

## 3. Phase 2: Frontend SaaS Native Expansion

### 3.1 API Adapter — workspace.js

**File**: `packages/web/src/adapters/core/workspace.js`

Thêm 2 method mới vào object return của `createWorkspaceClient()` (sau dòng 576):

```javascript
    getAIAuditLogs(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return coreGet(`/workspace/ai-command-center/audit-logs/${query ? `?${query}` : ''}`);
    },

    getUserConfig() {
      return coreGet('/workspace/userconfig/');
    },
```

### 3.2 AICommandCenterPage.tsx — Summary Cards

**File**: `packages/web/src/pages/AICommandCenterPage.tsx`

Thêm 4 summary cards giữa header và form, pattern theo legacy (dòng 571-596).

```typescript
// State mới
const [effectiveSource, setEffectiveSource] = useState("command_center");
const [effectiveProvider, setEffectiveProvider] = useState("");
const [effectiveModel, setEffectiveModel] = useState("");
const [aiReady, setAiReady] = useState(false);
const [aiConfigMessage, setAiConfigMessage] = useState("");
const [refreshIntervalDisplay, setRefreshIntervalDisplay] = useState(24);
const [maxAutoRefreshes, setMaxAutoRefreshes] = useState(24);

// Trong loadSettings(), set thêm:
setEffectiveSource(data.effective_ai_source || "command_center");
setEffectiveProvider(data.effective_ai_provider || data.ai_provider || "openclaw");
setEffectiveModel(data.effective_ai_model || data.ai_model || "");
setAiReady(data.ai_ready ?? false);
setAiConfigMessage(data.ai_config_message || "");
setRefreshIntervalDisplay(data.advisory_refresh_interval_hours ?? 24);
setMaxAutoRefreshes(data.advisory_max_auto_refreshes_per_day ?? 24);

// Trong handleSaveSettings(), update sau khi save thành công:
setEffectiveSource(nextData.effective_ai_source || "command_center");
setEffectiveProvider(nextData.effective_ai_provider || aiProvider);
setEffectiveModel(nextData.effective_ai_model || finalModel);
setAiReady(nextData.ai_ready ?? false);
```

```typescript
// Summary Cards section — giữa header và form (sau error banner, trước form)
renderSummaryCards(): [
  { label: "Nhà cung cấp hiệu lực", value: effectiveProvider, caption: "Nguồn đọc từ AI Command Center." },
  { label: "Mô hình hiệu lực", value: effectiveModel || "Chưa cấu hình", caption: "Mô hình đang dùng cho advisory runtime." },
  { label: "Nguồn hiệu lực", value: effectiveSource, caption: "command_center hoặc system fallback." },
  { label: "Trạng thái runtime", value: aiReady ? "Sẵn sàng" : "Cần cấu hình", 
    valueClass: aiReady ? "text-emerald-400" : "text-red-400",
    caption: aiReady ? "Runtime có thể sinh advisory." : "Thiếu key, model hoặc source hợp lệ." },
]
```

**Pattern**: Dùng `createElement` factory với grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`.

### 3.3 AICommandCenterPage.tsx — Effective Source + Event Gate

Thêm policy section (4-box grid) sau summary cards, trước form:

**Pattern**:
```
Chính sách vận hành — Khung đọc nhanh policy
├── Gate sự kiện: {eventGateEnabled ? "Bật" : "Tắt" | "Chưa đọc"}
├── Khoảng làm mới: {refreshIntervalDisplay} giờ/lần
├── Auto refresh/ngày: {maxAutoRefreshes}
└── Token/ngày: {maxTokens}
└── Config message: {aiConfigMessage}
```

State mới:
```typescript
const [eventGateEnabled, setEventGateEnabled] = useState<boolean | null>(null);
```

Trong `loadSettings()`:
```typescript
// Load event gate status từ /workspace/userconfig/
try {
  const userConfig = await (coreApiAdapter as any).getUserConfig();
  const prefs = userConfig?.preferences || {};
  setEventGateEnabled(prefs.advisory_whale_signal_enabled !== false);
} catch { /* silent fail */ }
```

### 3.4 AICommandCenterPage.tsx — Prompt Config Section

Thêm section "Tinh chỉnh nguồn dữ liệu" (Task Tuning) — có thể là:
- **Option A**: Inline section với `AIAdvisoryPromptConfigDrawer`
- **Option B**: Nút mở drawer bên cạnh Model/Provider

**Quyết định**: Dùng drawer (Option B) — đã có `AIAdvisoryPromptConfigDrawer.js`, cần mở rộng thêm presets.

Add button trong form actions:
```typescript
e("button", {
  key: "prompt-config-btn",
  type: "button",
  onClick: () => setPromptConfigOpen(true),
  className: "rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
}, "Tinh chỉnh nguồn dữ liệu")
```

State:
```typescript
const [promptConfigOpen, setPromptConfigOpen] = useState(false);
const [promptConfig, setPromptConfig] = useState<Record<string, unknown> | null>(null);
```

Trong `loadSettings()`:
```typescript
if (data.ai_prompt_config) {
  setPromptConfig(data.ai_prompt_config);
}
```

Trong `handleSaveSettings()`, include `ai_prompt_config` trong payload nếu đã thay đổi.

Drawer rendering ở cuối component:
```typescript
// Render drawer inline
createElement(AIAdvisoryPromptConfigDrawer, {
  isOpen: promptConfigOpen,
  onClose: () => setPromptConfigOpen(false),
  config: promptConfig,
  onConfigChange: (nextConfig) => {
    setPromptConfig(nextConfig);
    // Auto-save hoặc manual save
  },
})
```

### 3.5 AIAdvisoryPromptConfigDrawer.js — Presets + Lookback

**File**: `packages/web/src/components/AIAdvisoryPromptConfigDrawer.js`

**Thêm Preset Buttons** (giữa header và body):
```javascript
const PRESET_CONFIGS = {
  balanced: {
    whale: { enabled: true, lookback: 180 },
    dark_flow: { enabled: true, lookback: 90 },
    technical: { enabled: true, lookback: 30, indicators: ['vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot'] },
    news: { enabled: true, lookback: 14 },
    market: { enabled: true, lookback: 7 },
    fundamental: { enabled: false, lookback: 1 },
    ownership: { enabled: false, lookback: 365 },
    sector: { enabled: false, lookback: 60 },
  },
  flow_first: {
    ... // copy từ legacy buildPromptConfigPreset('flow_first')
  },
  deep_dive: {
    ... // copy từ legacy buildPromptConfigPreset('deep_dive')
  },
  cost_control: {
    ... // copy từ legacy buildPromptConfigPreset('cost_control')
  },
};
```

Thêm preset buttons vào header area:
```javascript
e("div", { className: "sdp-preset-bar" },
  Object.entries(PRESET_CONFIGS).map(([id, presetConfig]) =>
    e("button", {
      key: id,
      type: "button",
      onClick: () => { setLocalConfig(presetConfig); onConfigChange(presetConfig); },
      className: "sdp-preset-btn",
    }, PRESET_LABELS[id])
  )
)
```

**Thêm Technical Indicator Presets** (Full/Learn) trong technical source section:
```javascript
// Trong technical source card (sourceId === "technical" && isEnabled)
e("div", { className: "sdp-indicator-presets" }, [
  e("button", { ..., onClick: () => handleTechnicalPreset('full') }, "Bật toàn bộ"),
  e("button", { ..., onClick: () => handleTechnicalPreset('lean') }, "Bộ gọn"),
])
```

**Thêm Lookback Dropdown Options** (thay thế slider range hoặc thêm bên cạnh):
Giữ nguyên slider + number input như hiện tại, thêm dropdown select cho các giá trị phổ biến (theo `lookbackOptions` từ legacy).

### 3.6 AIAuditLogsPanel.tsx — New Component

**File**: `packages/web/src/components/AIAuditLogsPanel.tsx`

Component mới hoàn chỉnh với:

1. **Filters**: action dropdown, actor input, date_from, date_to
2. **Log List**: card-based layout với action badge, actor, created_at
3. **Before/After diff**: accordion style JSON snapshot viewer
4. **Pagination**: page navigation với total count

```typescript
import { useState, useEffect, createElement } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";

const e = createElement;

const AUDIT_PAGE_SIZE = 10;

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'update_settings', label: 'Cập nhật cấu hình' },
  { value: 'test_connection_success', label: 'Test kết nối thành công' },
  { value: 'test_connection_failed', label: 'Test kết nối thất bại' },
];

interface AuditLogEntry {
  id: number;
  action: string;
  actor: string;
  reason: string;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  diff_summary: string;
  created_at: string;
}

interface AIAuditLogsPanelProps {
  refreshKey?: number;  // increment để trigger reload
}

export function AIAuditLogsPanel({ refreshKey = 0 }: AIAuditLogsPanelProps) {
  // State: logs, loading, error
  // State: filters (action, actor, date_from, date_to)
  // State: pagination (page, total)
  
  // loadLogs: call getAIAuditLogs() với params
  // applyFilters: reset page=1, load
  // renderFilters: 4 filter controls
  // renderLogList: card-based với accordion JSON diff
  // renderPagination: prev/next
}
```

**Design pattern**: Tương tự legacy (dòng 1355-1447) nhưng dùng `createElement` thay vì JSX. Glassmorphism SOC-style border + backdrop.

### 3.7 AICommandCenterPage.tsx — Audit Logs Tab

**File**: `packages/web/src/pages/AICommandCenterPage.tsx`

**Không dùng tab sidebar như legacy** — thay bằng section riêng ở cuối page với `<details>` accordion hoặc section divider.

Thêm sau form và fallback quota card:

```typescript
// Audit Logs Section
e("div", { key: "audit-section", className: "space-y-4" }, [
  e("h2", { ... }, "Nhật ký audit Command Center"),
  e(AIAuditLogsPanel, { key: `audit-panel-${refreshAuditKey}` }),
])
```

**State**: `refreshAuditKey` increment để trigger reload sau mỗi lần save.

### 3.8 i18n Keys

**File**: `packages/web/src/i18n/vi.js` và `packages/web/src/i18n/en.js`

Thêm keys mới:

```javascript
// Trong nav section (line ~70)
aiCommandCenter: 'Trung tâm điều hành AI',

// Thêm section mới 'aiCommandCenter' vào cuối file (hoặc gần advisory section)
aiCommandCenter: {
  // Summary cards
  effectiveProvider: 'Nhà cung cấp hiệu lực',
  effectiveModel: 'Mô hình hiệu lực',
  effectiveSource: 'Nguồn hiệu lực',
  runtimeStatus: 'Trạng thái runtime',
  ready: 'Sẵn sàng',
  needsConfig: 'Cần cấu hình',
  
  // Policy section
  operationPolicy: 'Chính sách vận hành',
  eventGate: 'Gate sự kiện',
  gateEnabled: 'Bật',
  gateDisabled: 'Tắt',
  gateUnknown: 'Chưa đọc',
  refreshInterval: 'Khoảng làm mới',
  autoRefreshPerDay: 'Auto refresh/ngày',
  tokensPerDay: 'Token/ngày',
  configMessage: 'Thông điệp cấu hình',
  
  // Prompt config
  promptConfig: 'Tinh chỉnh nguồn dữ liệu',
  presets: 'Mẫu cấu hình nhanh',
  presetBalanced: 'Cân bằng',
  presetFlowFirst: 'Ưu tiên dòng tiền',
  presetDeepDive: 'Chuyên sâu',
  presetCostControl: 'Tiết kiệm token',
  sourcesEnabled: 'Nguồn đang bật',
  technicalIndicators: 'Chỉ báo kỹ thuật',
  whaleLookback: 'Khoảng whale',
  enableAll: 'Bật toàn bộ',
  leanSet: 'Bộ gọn',
  
  // Audit logs
  auditLogs: 'Nhật ký audit',
  auditDescription: 'Mỗi trang hiển thị {count} bản ghi.',
  auditFilters: 'Bộ lọc audit',
  action: 'Hành động',
  actor: 'Người thực hiện',
  fromDate: 'Từ ngày',
  toDate: 'Đến ngày',
  applyFilter: 'Áp dụng bộ lọc',
  resetFilter: 'Xóa bộ lọc',
  noLogs: 'Chưa có bản ghi audit nào.',
  before: 'Trước',
  after: 'Sau',
  viewJson: 'Xem JSON snapshot',
  page: 'Trang',
  of: '/',
  previous: 'Trước',
  next: 'Sau',
  refresh: 'Làm mới',
  loading: 'Đang tải audit logs...',
}
```

---

## 4. Verification

### Backend

```bash
# 1. Migration
cd packages/core/backend
python manage.py makemigrations advisory
python manage.py migrate advisory

# 2. Tests
python -m pytest tests/test_ai_management_center.py -v
python -m pytest tests/test_ai_audit_logs.py -v  (new)

# 3. Manual API test
curl -X PUT /core/v1/workspace/ai-command-center/ \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"ai_provider": "gemini", "ai_model": "gemini-1.5-pro"}'

curl /core/v1/workspace/ai-command-center/audit-logs/?limit=5

# 4. Verify API key masking
# Confirm before_json/after_json doesn't contain plaintext key
```

### Frontend

```bash
cd packages/web
npx tsc --noEmit
npm run build

# Verify:
# - Summary cards render
# - Event gate status loads
# - Prompt config drawer opens with presets
# - Audit logs load and filter
# - JSON diff accordion works
```

### Test Checklist

- [ ] `test_audit_log_created_on_put`: Xác nhận audit log được tạo khi PUT config
- [ ] `test_audit_log_created_on_test_success`: Audit log khi test connection thành công
- [ ] `test_audit_log_created_on_test_failure`: Audit log khi test connection thất bại
- [ ] `test_audit_log_sanitize_api_key`: API key không xuất hiện trong before_json/after_json
- [ ] `test_audit_log_sanitize_nested`: Nested dict cũng được sanitize
- [ ] `test_audit_log_filter_by_action`: Filter audit logs theo action
- [ ] `test_audit_log_filter_by_actor`: Filter audit logs theo actor
- [ ] `test_audit_log_filter_by_date`: Filter theo date range
- [ ] `test_audit_log_pagination`: Pagination hoạt động đúng
- [ ] `test_audit_log_persist_sanitized`: DB không chứa plaintext API key

---

## 5. File-by-File Change Summary

| # | File | Action | Dòng thêm/xóa |
|---|------|--------|---------------|
| **Phase 1 — Backend** |
| 1 | `advisory/models.py` | Thêm `AIAuditLog` model | +45 dòng |
| 2 | `advisory/serializers.py` | Thêm `sanitize_sensitive_fields()`, `AIAuditLogSerializer` | +60 dòng |
| 3 | `user_workspace/portfolio_analytics_views.py` | Audit log trong PUT | ~+30 dòng |
| 4 | `user_workspace/portfolio_analytics_views.py` | Audit log trong test-connection | ~+25 dòng |
| 5 | `user_workspace/portfolio_analytics_views.py` | Thêm `PortfolioAICommandCenterAuditLogView` | +50 dòng |
| 6 | `user_workspace/portfolio_analytics_views.py` | Thêm `PortfolioUserConfigLegacyView` | +20 dòng |
| 7 | `user_workspace/urls.py` | Thêm 2 routes mới | +4 dòng |
| 8 | `tests/test_ai_management_center.py` | Thêm audit log tests | ~+100 dòng |
| **Phase 2 — Frontend** |
| 9 | `adapters/core/workspace.js` | Thêm `getAIAuditLogs()`, `getUserConfig()` | +15 dòng |
| 10 | `pages/AICommandCenterPage.tsx` | Summary cards, policy section, event gate | +120 dòng |
| 11 | `pages/AICommandCenterPage.tsx` | Prompt config toggle + drawer | +30 dòng |
| 12 | `pages/AICommandCenterPage.tsx` | Audit logs section | +20 dòng |
| 13 | `components/AIAdvisoryPromptConfigDrawer.js` | Presets, technical presets, lookback options | +80 dòng |
| 14 | `components/AIAuditLogsPanel.tsx` | **NEW** component | +250 dòng |
| 15 | `i18n/vi.js` | ~40 new keys | +50 dòng |
| 16 | `i18n/en.js` | ~40 new keys | +50 dòng |

**Tổng Phase 1**: ~330 dòng backend + tests
**Tổng Phase 2**: ~615 dòng frontend

---

## Phụ Lục: Legacy → SaaS Mapping

| Legacy Feature | Legacy File/Lines | SaaS Target |
|---------------|-------------------|-------------|
| Summary 4 cards | AICommandCenter.jsx:571-596 | AICommandCenterPage.tsx §3.2 |
| Policy 4-box grid | AICommandCenter.jsx:838-887 | AICommandCenterPage.tsx §3.3 |
| Event gate indicator | AICommandCenter.jsx:856-861 | AICommandCenterPage.tsx §3.3 |
| Effective source display | AICommandCenter.jsx:1026-1039 | AICommandCenterPage.tsx §3.2 |
| Prompt source tabs | AICommandCenter.jsx:305-477 | AIAdvisoryPromptConfigDrawer.js §3.5 |
| Preset buttons | AICommandCenter.jsx:1119-1136 | AIAdvisoryPromptConfigDrawer.js §3.5 |
| Technical presets | AICommandCenter.jsx:766-774 | AIAdvisoryPromptConfigDrawer.js §3.5 |
| Audit tab + filters | AICommandCenter.jsx:1216-1449 | AIAuditLogsPanel.tsx §3.6 |
| Audit JSON diff | AICommandCenter.jsx:1382-1442 | AIAuditLogsPanel.tsx §3.6 |
| Test connection | AICommandCenter.jsx:1062-1095 | AICommandCenterPage.tsx (đã có) |
| Fallback quota | N/A (SaaS-only) | AICommandCenterPage.tsx (đã có) |
