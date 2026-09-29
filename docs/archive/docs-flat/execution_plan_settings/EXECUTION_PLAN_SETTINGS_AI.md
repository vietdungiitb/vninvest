# Kế Hoạch Thực Thi — Settings/AI SaaS Native Upgrade

**Phiên bản:** Execution Plan v1.0
**Nguồn:** `docs/AUDIT_SETTINGS_AI_SAAS_NATIVE.md` (v2)
**Ngày tạo:** 2026-07-11
**Đối tượng:** Đội code (frontend + backend)
**Phạm vi:** 8 slices — AI-specific + AI data pipeline settings

---

## BẢNG TỔNG QUAN

| Slice | Tên | Effort (điều chỉnh) | Files chính | Dependencies |
|---|---|---|---|---|
| S1 | Khôi phục DNSE Credentials | **1.25 ngày** | `UserSettingsPage.tsx`, `workspace.js` | — |
| S2 | Event Gate Toggle + Validation | **0.65 ngày** | `AICommandCenterPage.tsx` | — |
| S3 | Usage Dashboard Pagination | **1.25 ngày** | `AIUsageDashboard.tsx` | — |
| S4 | Prompt Config + Temperature | **1.25 ngày** | `AIAdvisoryPromptConfigDrawer.js`, `AICommandCenterPage.tsx` | — |
| S5 | Shared Constants + Agent UX | **1.25 ngày** | `shared/providerModels.ts`, `AIAgentFederationPanel.tsx` | — |
| S6 | i18n Localization | **1.25 ngày** | `vi.js`, `en.js`, 3 component files | — |
| S7 | Frontend Testing | **2.5 ngày** | 4 test files mới | S1-S6 done |
| S8 | Error Handling + Performance | **1.75 ngày** | 4 component files | S1-S6 done |
| ~~S9~~ | ~~Security Settings~~ | ~~Loại bỏ~~ | — | — |
| S10 | Advanced AI (deprioritize) | **3.75 ngày** | Nhiều files | S1-S8 done |

**Tổng effort thực thi: ~13 ngày dev time** (đã adjust +25-30% từ v2 estimates)

```
Tuần 1:  S1 + S2                ~2 ngày
Tuần 2:  S3 + S4                ~2.5 ngày
Tuần 3:  S5 + S6                ~2.5 ngày
Tuần 4:  S7 + S8                ~4.25 ngày
Tháng 2: S10 (deprioritize)     ~3.75 ngày
```

---

## PHỤ LỤC A: ĐIỀU CHỈNH EFFORT ESTIMATES

> Audit v2 underestimate ~25-30%. Bảng dưới đã adjust.

| Slice | v2 Estimate | Adjusted (+25-30%) | Lý do điều chỉnh |
|---|---|---|---|
| S1 | 1 ngày | 1.25 ngày | Form + validation + badges + error states + loading + retry + edge cases (credential expired, API down) |
| S2 | 0.5 ngày | 0.65 ngày | Toggle + validation + test both flows (enable/disable) |
| S3 | 1 ngày | 1.25 ngày | Pagination buttons + page size selector + CSV export encoding + edge cases |
| S4 | 1 ngày | 1.25 ngày | Drawer label fix + temperature slider + backend wiring + validation |
| S5 | 1 ngày | 1.25 ngày | Extract shared constant + refactor 2 files + agent dropdown + chips component |
| S6 | 1 ngày | 1.25 ngày | Audit i18n keys + wrap labels + add new keys to vi.js + en.js + verify resolve |
| S7 | 2 ngày | 2.5 ngày | 4 test files + mock adapters + edge cases + coverage threshold |
| S8 | 1.5 ngày | 1.75 ngày | Error boundary component + retry hook + lazy loading + React.memo |
| S10 | 3-4 ngày | 3.75 ngày | Agent history + templates + version history + budget alerts |

---

## PHỤ LỤC B: SLICE DETAIL — TỪNG BƯỚC THỰC THI

---

### SLICE 1: Khôi phục DNSE Credentials

**Mục tiêu:** User có thể quản lý DNSE LightSpeed credentials từ SaaS settings, không cần quay legacy.

**Effort:** 1.25 ngày
**Files 수정:**
- `packages/web/src/pages/UserSettingsPage.tsx` (136 dòng hiện tại → ~250 dòng)
- `packages/web/src/adapters/core/workspace.js` (verify `getDNSEConfig`, `updateDNSEConfig`)

**Backend đã sẵn sàng:**
- API `GET /broker/dnse/config/` → `{ is_configured: boolean, data?: object }`
- API `POST /broker/dnse/config/` → `{ ok: boolean }`
- Method đã có trong `workspace.js` lines 291-305

#### Task 1.1: Tạo DNSECredentialsSection component
```
File: packages/web/src/components/DNSECredentialsSection.tsx (mới)
Pattern: createElement (const e = createElement)
State:
  - credential: { has_credential, is_verified, is_system_provider } | null
  - form: { api_key: string, api_secret: string }
  - saving, deleting, msg, error
Effects:
  - useEffect load credential khi mount → coreApiAdapter.getDNSEConfig()
Handlers:
  - handleSave: call coreApiAdapter.updateDNSEConfig(form)
  - handleDelete: confirm → call backend delete endpoint
Render:
  - If credential.has_credential: badge "Active" + optional "Verified" + delete button
  - If no credential: form with api_key + api_secret inputs + save button
  - Loading/error states
```

#### Task 1.2: Integrate vào UserSettingsPage
```
File: packages/web/src/pages/UserSettingsPage.tsx
- Import DNSECredentialsSection
- Thêm section sau Whale threshold section
- Style: border-orange-700/30 bg-orange-950/10 (consistent với legacy)
```

#### Task 1.3: Verify adapter methods
```
File: packages/web/src/adapters/core/workspace.js
- Verify getDNSEConfig() tại line 291
- Verify updateDNSEConfig(data) tại line 300
- Nếu thiếu delete method: thêm deleteDNSEConfig() → DELETE /broker/dnse/config/
```

#### Task 1.4: Thêm i18n keys
```
Files: packages/web/src/i18n/vi.js, en.js
Keys cần thêm:
  settings.dnse_cred_title: 'DNSE LightSpeed Credentials'
  settings.dnse_cred_desc: 'Quản lý API credentials cho DNSE LightSpeed API.'
  settings.dnse_cred_active: 'Đang kích hoạt'
  settings.dnse_cred_verified: 'Đã xác minh'
  settings.dnse_cred_api_key: 'Client ID'
  settings.dnse_cred_api_secret: 'Client Secret'
  settings.dnse_cred_save_btn: 'Lưu credentials'
  settings.dnse_cred_delete_btn: 'Xoá credentials'
  settings.dnse_cred_saved: 'Đã lưu credentials thành công.'
  settings.dnse_cred_deleted: 'Đã xoá credentials.'
  settings.dnse_cred_saving: 'Đang lưu...'
  settings.dnse_cred_deleting: 'Đang xoá...'
```

#### Self-Audit Checklist — Slice 1
- [ ] DNSE credentials form hiển thị đúng khi chưa có credential
- [ ] DNSE credentials form hiển thị đúng khi đã có credential (badge active/verified)
- [ ] Save flow hoạt động: nhập key+secret → save → reload → hiển thị active
- [ ] Delete flow hoạt động: confirm → delete → reload → hiển thị form nhập
- [ ] Error states: API fail → hiển thị error message
- [ ] Loading states: đang load → hiển thị spinner
- [ ] i18n keys resolve đúng cho cả vi + en
- [ ] Style consistent với SOC glassmorphism (border-orange accent)
- [ ] Pre-commit hook pass (no JSX literals)
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass

---

### SLICE 2: Event Gate Toggle + Validation Fixes

**Mục tiêu:** User có thể bật/tắt event gate từ AI Command Center. Form validation ngăn giá trị bất hợp lý.

**Effort:** 0.65 ngày
**Files sửa:**
- `packages/web/src/pages/AICommandCenterPage.tsx`

#### Task 2.1: Thêm event gate toggle vào Policy Section
```
File: packages/web/src/pages/AICommandCenterPage.tsx
Vị trí: Policy Section (line 328-355), sau "Gate sự kiện" read-only display

Thêm checkbox:
  - state: eventGateEnabled (đã có, line 90)
  - Handler: async toggle → call coreApiAdapter.updateUserConfig({ advisory_whale_signal_enabled: !current })
  - UI: Toggle switch hoặc checkbox với label "Bật/Tắt"
  - After toggle: reload userConfig để confirm state

Lưu ý: Backend API endpoint
  - GET /workspace/userconfig/ → trả về preferences.advisory_whale_signal_enabled
  - Cần verify: có PATCH endpoint cho userconfig không?
  - Nếu không có: cần thêm API PUT/PATCH /workspace/userconfig/
```

#### Task 2.2: Fix validation maxTokens và refreshInterval
```
File: packages/web/src/pages/AICommandCenterPage.tsx
Vị trí: handleSaveSettings (line 192-241)

Thêm validation:
  - maxTokens: Math.max(1, parseInt(String(maxTokens)) || 5000)
  - refreshInterval: Math.max(1, parseInt(String(refreshInterval)) || 24)
  - Nếu giá trị < 1: setError("Giá trị phải lớn hơn 0")

Thêm min/max attributes vào input fields:
  - maxTokens input (line 429-435): min="1" max="100000"
  - refreshInterval input (line 442-448): min="1" max="720"
```

#### Self-Audit Checklist — Slice 2
- [ ] Event gate toggle hiển thị trong Policy Section
- [ ] Toggle on → save → reload → confirm enabled
- [ ] Toggle off → save → reload → confirm disabled
- [ ] maxTokens = 0 → error message hiển thị
- [ ] maxTokens = -5 → error message hiển thị
- [ ] refreshInterval = 0 → error message hiển thị
- [ ] Normal values save thành công
- [ ] Pre-commit hook pass
- [ ] `npx tsc --noEmit` pass

---

### SLICE 3: Usage Dashboard Pagination + Export

**Mục tiêu:** User có thể paginate qua usage records và export data.

**Effort:** 1.25 ngày
**Files sửa:**
- `packages/web/src/components/AIAgentFederationPanel.tsx` (reference pattern)
- `packages/web/src/components/AIAuditLogsPanel.tsx` (reference pagination pattern)
- `packages/web/src/components/AIUsageDashboard.tsx` (chính)

#### Task 3.1: Thêm pagination controls
```
File: packages/web/src/components/AIUsageDashboard.tsx

Pagination pattern (copy từ AIAuditLogsPanel.tsx lines 43-97):
  - const PAGE_SIZE = 20;
  - State: page (default 1)
  - Params: { days, limit: PAGE_SIZE, offset: (page-1)*PAGE_SIZE }
  - Total pages: Math.ceil(total / PAGE_SIZE)
  - Render: "Trang X/Y" + Previous/Next buttons

Backend đã hỗ trợ (ai_analytics/views.py lines 35-42):
  - limit param, default 20, max 100
  - offset param, default 0
  - Response: { results, total, limit, offset }
```

#### Task 3.2: Thêm page size selector
```
Thêm dropdown: 20 / 50 / 100 records per page
State: pageSize (default 20)
Reset page = 1 khi thay đổi pageSize
```

#### Task 3.3: Thêm Export CSV
```
Thêm nút "Xuất CSV" bên cạnh "Làm mới"

Implementation:
  - Fetch ALL records (loop offset=0, 100, 200... until total)
  - Convert to CSV: headers = ["Thời gian","Hành động","Provider","Model","Token vào","Token ra","Chi phí","Độ trễ","Trạng thái"]
  - Download: create Blob → URL.createObjectURL → click download
  - Filename: `ai-usage-${days}days-${Date.now()}.csv`

Lưu ý: Encoding UTF-8 BOM cho tiếng Việt
```

#### Self-Audit Checklist — Slice 3
- [ ] Pagination buttons hiển thị khi total > PAGE_SIZE
- [ ] Previous button disabled ở trang 1
- [ ] Next button disabled ở trang cuối
- [ ] Page size selector hoạt động (20/50/100)
- [ ] Thay đổi page size → reset về trang 1
- [ ] Export CSV download file đúng
- [ ] CSV content đúng encoding (UTF-8 BOM)
- [ ] Empty state: "Chưa có bản ghi" khi không có data
- [ ] Pre-commit hook pass
- [ ] `npx tsc --noEmit` pass

---

### SLICE 4: Prompt Config Fixes + Temperature

**Mục tiêu:** Fix UX misleading, thêm temperature control.

**Effort:** 1.25 ngày
**Files sửa:**
- `packages/web/src/components/AIAdvisoryPromptConfigDrawer.js`
- `packages/web/src/pages/AICommandCenterPage.tsx`
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` (verify temperature save)

#### Task 4.1: Fix "Đóng & Lưu" label
```
File: packages/web/src/components/AIAdvisoryPromptConfigDrawer.js
Vị trí: Footer button (line 348-351)

Thay đổi:
  Old: "Đóng & Lưu"
  New: "Đóng"

Lý do: Drawer không auto-save. Config chỉ save khi user bấm "Lưu cấu hình" ở form cha.
Label "Đóng & Lưu" tạo ấn tượng sai rằng config đã được lưu.
```

#### Task 4.2: Thêm temperature slider
```
File: packages/web/src/pages/AICommandCenterPage.tsx

Thêm state:
  const [temperature, setTemperature] = useState(0.3);

Thêm vào loadSettings:
  setTemperature((data as any).temperature ?? 0.3);

Thêm vào payload khi save:
  if (temperature !== undefined) {
    payload.temperature = temperature;
  }

Thêm UI — sau refresh interval row:
  e("div", { key: "temp-block" }, [
    e("label", ..., "Temperature (0.0 - 1.0)"),
    e("input", { type: "range", min: 0, max: 1, step: 0.1, value: temperature, ... }),
    e("span", null, temperature.toFixed(1))
  ])

Backend verify:
  portfolio_analytics_views.py PUT method (line 494+)
  - Cần thêm: if 'temperature' in payload: config.temperature = float(payload['temperature'])
  - SystemAISettings.temperature field đã có (models.py line 39)
```

#### Task 4.3: Backend — save temperature
```
File: packages/core/backend/src/user_workspace/portfolio_analytics_views.py
Vị trí: PortfolioAICommandCenterView.put() method

Thêm sau line 577 (advisory_max_tokens_per_day handling):
  if 'temperature' in payload:
      try:
          config.temperature = float(payload.get('temperature'))
      except (TypeError, ValueError):
          pass

  Thêm vào before_snapshot và after_snapshot:
    'temperature': float(config.temperature),
  ```

  #### Task 4.4: Fix BUG-05 — Gemini endpoint hardening (High)
  ```
  File: packages/core/backend/src/user_workspace/portfolio_analytics_views.py
  Vị trí: test connection routing (line ~747-751) + advisory generation routing

  Hiện tại Gemini luôn route tới OpenAI-compatible endpoint:
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

  OpenAI-compatible endpoint NÀY là đúng cho Gemini API key chuẩn. Rủi ro thực tế:
  - Nếu user dùng Vertex AI key (không phải OpenAI-compat) → endpoint sai
  - Không có khả năng override endpoint cho gemini

  Fix:
  1. Đưa endpoint thành constant: GEMINI_OPENAI_COMPAT_ENDPOINT
  2. Cho phép override qua custom_endpoint khi provider = gemini
     (hiện tại custom_endpoint chỉ áp dụng cho provider = local)
  3. Thêm validate: nếu provider = gemini và key không bắt đầu "AIza" → warning
  ```

  #### Self-Audit Checklist — Slice 4
- [ ] Drawer footer button đọc "Đóng" (không phải "Đóng & Lưu")
- [ ] Temperature slider hiển thị, range 0.0-1.0
- [ ] Temperature value persist khi reload
- [ ] Temperature save thành công (verify backend field)
- [ ] Temperature step = 0.1 (không phải 0.01)
- [ ] Default temperature = 0.3
- [ ] Pre-commit hook pass
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass

---

### SLICE 5: Shared Constants + Agent UX

**Mục tiêu:** Loại bỏ code duplication, cải thiện UX form.

**Effort:** 1.25 ngày
**Files tạo/sửa:**
- `packages/web/src/shared/providerModels.ts` (mới)
- `packages/web/src/pages/AICommandCenterPage.tsx` (sửa import)
- `packages/web/src/pages/system/ShellAiCommandCenterPage.tsx` (sửa import)
- `packages/web/src/components/AIAgentFederationPanel.tsx` (sửa form)

#### Task 5.1: Tạo shared providerModels.ts
```
File: packages/web/src/shared/providerModels.ts (mới)

Content:
  export const PROVIDER_MODELS: Record<string, { key: string; label: string }[]> = {
    openai: [
      { key: "gpt-4o-mini", label: "gpt-4o-mini" },
      { key: "gpt-4o", label: "gpt-4o" },
      { key: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
      { key: "custom", label: "Mô hình tùy chỉnh..." }
    ],
    gemini: [
      { key: "gemini-1.5-flash", label: "gemini-1.5-flash" },
      { key: "gemini-1.5-pro", label: "gemini-1.5-pro" },
      { key: "gemini-pro", label: "gemini-pro" },
      { key: "custom", label: "Mô hình tùy chỉnh..." }
    ],
    claude: [
      { key: "claude-3-5-sonnet", label: "claude-3-5-sonnet" },
      { key: "claude-3-haiku", label: "claude-3-haiku" },
      { key: "custom", label: "Mô hình tùy chỉnh..." }
    ],
    openclaw: [
      { key: "gpt-4o-mini", label: "gpt-4o-mini" },
      { key: "custom", label: "Mô hình tùy chỉnh..." }
    ],
    local: [
      { key: "llama3.2", label: "llama3.2" },
      { key: "llama3.1", label: "llama3.1" },
      { key: "mistral", label: "mistral" },
      { key: "phi4", label: "phi-4" },
      { key: "qwen2.5", label: "qwen2.5" },
      { key: "custom", label: "Mô hình tùy chỉnh..." }
    ],
    copilot: [
      { key: "custom", label: "Mô hình tùy chỉnh..." }
    ]
  };

  export const PROVIDER_OPTIONS = [
    { key: "openclaw", label: "OpenClaw (System Default)" },
    { key: "openai", label: "OpenAI (ChatGPT)" },
    { key: "gemini", label: "Google Gemini" },
    { key: "claude", label: "Anthropic (Claude)" },
    { key: "local", label: "Local Model (Ollama/vLLM)" },
    { key: "copilot", label: "GitHub Copilot" }
  ];
```

#### Task 5.2: Refactor AICommandCenterPage imports
```
File: packages/web/src/pages/AICommandCenterPage.tsx
- Xóa lines 9-42 (PROVIDER_MODELS definition)
- Thêm: import { PROVIDER_MODELS, PROVIDER_OPTIONS } from "../shared/providerModels.js";
- Thêm import ở line 1-6
- Verify: providerOptions array (line 286-293) dùng PROVIDER_OPTIONS
```

#### Task 5.3: Refactor ShellAiCommandCenterPage imports
```
File: packages/web/src/pages/system/ShellAiCommandCenterPage.tsx
- Xóa lines 24-49 (PROVIDER_MODELS definition)
- Thêm: import { PROVIDER_MODELS, PROVIDER_OPTIONS } from "../../shared/providerModels.js";
- Thêm import local provider (hiện tại thiếu)
- Verify: providerOptions array (line 339-345) dùng PROVIDER_OPTIONS
```

#### Task 5.4: Agent form — Provider/Model dropdown
```
File: packages/web/src/components/AIAgentFederationPanel.tsx

Provider input (line 173-179):
  Old: e("input", { value: formData.provider, onChange: handleFieldChange("provider") })
  New: e("select", { value: formData.provider, onChange: handleFieldChange("provider") },
         PROVIDER_OPTIONS.map(p => e("option", { key: p.key, value: p.key }, p.label))
       )

Model input (line 181-187):
  Old: e("input", { value: formData.model, onChange: handleFieldChange("model") })
  New: e("select", { value: formData.model, onChange: handleFieldChange("model") },
         (PROVIDER_MODELS[formData.provider] || []).map(m =>
           e("option", { key: m.key, value: m.key }, m.label)
         )
       )

Capabilities input (line 189-196):
  Giữ comma-separated text input (chips component cần thêm dependency → deprioritize)
  Thêm placeholder rõ ràng hơn
```

#### Task 5.5: Provider change → auto-reset model
```
File: packages/web/src/components/AIAgentFederationPanel.tsx

Thêm handler:
  const handleProviderChange = (newProvider) => {
    setFormData(prev => ({
      ...prev,
      provider: newProvider,
      model: PROVIDER_MODELS[newProvider]?.[0]?.key || "gpt-4o-mini"
    }));
  };

Thay handleFieldChange("provider") bằng handleProviderChange
```

#### Self-Audit Checklist — Slice 5
- [ ] shared/providerModels.ts tồn tại và export PROVIDER_MODELS + PROVIDER_OPTIONS
- [ ] AICommandCenterPage import từ shared, không define local
- [ ] ShellAiCommandCenterPage import từ shared, KHÔNG còn local copy
- [ ] ShellAiCommandCenterPage có "local" provider (llama3.2, mistral, etc.)
- [ ] Agent form provider field là dropdown (không phải text input)
- [ ] Agent form model field là dropdown, cập nhật khi đổi provider
- [ ] Agent form provider change → auto-select first model
- [ ] Không còn PROVIDER_MODELS definition nào ở file-level (chỉ trong shared)
- [ ] Pre-commit hook pass
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass

---

### SLICE 6: i18n Localization

**Mục tiêu:** Component-level labels được localize, không còn hardcoded tiếng Việt.

**Effort:** 1.25 ngày
**Files sửa:**
- `packages/web/src/i18n/vi.js`
- `packages/web/src/i18n/en.js`
- `packages/web/src/components/AIAdvisoryPromptConfigDrawer.js`
- `packages/web/src/pages/AICommandCenterPage.tsx`
- `packages/web/src/components/AIAgentFederationPanel.tsx`
- `packages/web/src/components/AIUsageDashboard.tsx`

#### Task 6.1: Audit i18n keys hiện có
```
File: packages/web/src/i18n/vi.js
Đã có 47 keys trong aiCommandCenter.* (line 4046-4092)

Kiểm tra: các keys đã cover UI text chưa?
  - aiCommandCenter.effectiveProvider → ✅ cover "Nhà cung cấp hiệu lực"
  - aiCommandCenter.effectiveModel → ✅ cover "Mô hình hiệu lực"
  - etc.

Xác định keys MỚI cần thêm cho component-level text
```

#### Task 6.2: Thêm i18n keys mới
```
Files: vi.js, en.js

Keys mới cần thêm (ước tính ~30-40 keys):

Prompt Config Drawer:
  promptConfig.title: '⚙️ Cài đặt Cố vấn AI (Prompt Config)'
  promptConfig.subtitle: 'Đang bật {sources} nguồn dữ liệu & {indicators} chỉ báo kỹ thuật'
  promptConfig.presetLabel: 'Mẫu cấu hình nhanh:'
  promptConfig.presets.balanced: 'Cân bằng'
  promptConfig.presets.flowFirst: 'Ưu tiên dòng tiền'
  promptConfig.presets.deepDive: 'Chuyên sâu'
  promptConfig.presets.costControl: 'Tiết kiệm token'
  promptConfig.lookbackUnit: 'phiên'
  promptConfig.close: 'Đóng'
  promptConfig.footerText: 'Cấu hình được đồng bộ tự động...'
  promptConfig.enableAll: 'Bật toàn bộ'
  promptConfig.leanSet: 'Bộ gọn'

Agent Federation:
  agentFederation.title: 'Quản lý Agent AI'
  agentFederation.description: 'Đăng ký và quản lý các agent AI...'
  agentFederation.addAgent: 'Thêm agent'
  agentFederation.name: 'Tên agent'
  agentFederation.type: 'Loại agent'
  agentFederation.provider: 'Nhà cung cấp'
  agentFederation.model: 'Mô hình'
  agentFederation.capabilities: 'Năng lực (phân cách bằng dấu phẩy)'
  agentFederation.systemPrompt: 'System prompt'
  agentFederation.active: 'Đang kích hoạt'
  agentFederation.save: 'Lưu agent'
  agentFederation.cancel: 'Huỷ'
  agentFederation.edit: 'Sửa'
  agentFederation.delete: 'Xoá'
  agentFederation.confirmDelete: 'Xác nhận xoá agent này?'
  agentFederation.empty: 'Chưa có agent nào.'
  agentFederation.loading: 'Đang tải agent AI...'

Usage Dashboard:
  usage.title: 'Usage AI Analytics'
  usage.description: 'Theo dõi mức sử dụng, chi phí và hiệu năng...'
  usage.requests: 'Tổng yêu cầu'
  usage.tokens: 'Tổng token'
  usage.cost: 'Tổng chi phí'
  usage.latency: 'Độ trễ TB'
  usage.records: 'Bản ghi usage'
  usage.empty: 'Chưa có bản ghi usage nào.'
  usage.loading: 'Đang tải usage data...'
  usage.showing: 'Hiển thị {shown} / {total} bản ghi.'
  usage.exportCsv: 'Xuất CSV'

General:
  settings.dnse_cred_*: (12 keys từ Slice 1)
  settings.eventGate: 'Gate sự kiện'
  settings.eventGateEnabled: 'Bật'
  settings.eventGateDisabled: 'Tắt'
  settings.temperature: 'Temperature (0.0 - 1.0)'
```

#### Task 6.3: Wrap component labels với t()
```
Files cần sửa: 4 component files

Pattern:
  Old: e("h2", null, "Quản lý Agent AI")
  New: e("h2", null, t("agentFederation.title"))

  Old: e("th", null, "Tên")
  New: e("th", null, t("agentFederation.name"))

Lưu ý: useI18n() đã được gọi trong mỗi component
  - AICommandCenterPage: line 62
  - AIAgentFederationPanel: line 35
  - AIUsageDashboard: line 40
  - AIAdvisoryPromptConfigDrawer: line 1 (cần thêm useI18n import)
```

#### Self-Audit Checklist — Slice 6
- [ ] Tất cả component-level labels dùng t() function
- [ ] Không còn hardcoded tiếng Việt trong JSX/createElement
- [ ] vi.js có đủ keys mới
- [ ] en.js có đủ keys mới (dịch nghĩa đúng)
- [ ] Switch language vi → en → tất cả labels đổi
- [ ] Switch language en → vi → tất cả labels đổi
- [ ] Placeholder text cũng được localize
- [ ] Error messages cũng được localize
- [ ] Pre-commit hook pass
- [ ] `npx tsc --noEmit` pass

---

### SLICE 7: Frontend Testing

**Mục tiêu:** AI settings pages có unit tests, prevent regressions.

**Effort:** 2.5 ngày
**Files tạo:**
- `packages/web/src/pages/__tests__/AICommandCenterPage.test.tsx` (mới)
- `packages/web/src/components/__tests__/AIAgentFederationPanel.test.tsx` (mới)
- `packages/web/src/components/__tests__/AIUsageDashboard.test.tsx` (mới)
- `packages/web/src/components/__tests__/AIAuditLogsPanel.test.tsx` (mới)

#### Task 7.1: Test infrastructure setup
```
Verify:
  - Test framework (Vitest hoặc Jest) đã config trong packages/web
  - Mock pattern cho coreApiAdapter
  - render helper cho createElement components

Reference: coreApiAdapter.test.js (packages/web/src/adapters/)
```

#### Task 7.2: AICommandCenterPage tests
```
File: packages/web/src/pages/__tests__/AICommandCenterPage.test.tsx

Test cases (~10-12 tests):
  1. Renders loading state initially
  2. Loads settings and renders form fields
  3. Provider dropdown shows all 6 providers
  4. Model dropdown updates when provider changes
  5. Custom model input appears when "custom" selected
  6. Custom endpoint input appears when provider = "local"
  7. Save button calls updateAICommandCenterConfig with correct payload
  8. Validation: maxTokens < 1 shows error
  9. Validation: refreshInterval < 1 shows error
  10. Test connection button calls testAICommandCenterConnection
  11. Fallback quota card renders when quota available
  12. Audit logs panel renders

Mock: coreApiAdapter.getAICommandCenterConfig, updateAICommandCenterConfig, testAICommandCenterConnection
```

#### Task 7.3: AIAgentFederationPanel tests
```
File: packages/web/src/components/__tests__/AIAgentFederationPanel.test.tsx

Test cases (~8-10 tests):
  1. Renders loading state
  2. Loads and displays agents in table
  3. Empty state shows "Chưa có agent"
  4. "Thêm agent" button opens form
  5. Form submit calls createAIAgent
  6. Edit button populates form with agent data
  7. Edit submit calls updateAIAgent
  8. Delete button confirms and calls deleteAIAgent
  9. Cancel button closes form
  10. Error state shows error message

Mock: coreApiAdapter.getAIAgents, createAIAgent, updateAIAgent, deleteAIAgent
```

#### Task 7.4: AIUsageDashboard tests
```
File: packages/web/src/components/__tests__/AIUsageDashboard.test.tsx

Test cases (~6-8 tests):
  1. Renders loading state
  2. Loads and displays summary cards
  3. Loads and displays usage records
  4. Empty state shows "Chưa có bản ghi"
  5. Period selector changes trigger reload
  6. Pagination: Previous/Next buttons work
  7. Page size selector changes limit
  8. Export CSV downloads file

Mock: coreApiAdapter.getAIUsageAggregate, getAIUsageRecords
```

#### Task 7.5: AIAuditLogsPanel tests
```
File: packages/web/src/components/__tests__/AIAuditLogsPanel.test.tsx

Test cases (~6-8 tests):
  1. Renders loading state
  2. Loads and displays audit logs
  3. Empty state shows "Chưa có bản ghi audit"
  4. Filter by action triggers reload
  5. Filter by actor triggers reload
  6. Pagination works
  7. Expand/collapse shows JSON diff
  8. Reset filters clears all fields

Mock: coreApiAdapter.getAIAuditLogs
```

#### Self-Audit Checklist — Slice 7
- [ ] 4 test files tồn tại
- [ ] Tất cả tests pass (`npm test` hoặc `npx vitest`)
- [ ] Coverage >= 80% cho 4 files
- [ ] Mock adapters properly isolated
- [ ] No test pollution (cleanup between tests)
- [ ] Edge cases covered (empty data, error states, loading)

---

### SLICE 8: Error Handling + Performance

**Mục tiêu:** Robustness, prevent crashes, improve loading performance.

**Effort:** 1.75 ngày
**Files sửa:**
- `packages/web/src/components/AISettingsErrorBoundary.tsx` (mới)
- `packages/web/src/pages/AICommandCenterPage.tsx`
- `packages/web/src/pages/AIAgentFederationPage.tsx`
- `packages/web/src/pages/AIUsageAnalyticsPage.tsx`
- `packages/web/src/components/AIUsageDashboard.tsx`
- `packages/web/src/components/AIAuditLogsPanel.tsx`
- `packages/web/src/components/AIAdvisoryPromptConfigDrawer.js`

#### Task 8.1: Tạo Error Boundary component
```
File: packages/web/src/components/AISettingsErrorBoundary.tsx (mới)

Pattern: React class component với getDerivedStateFromError + componentDidCatch
Props: { children, fallbackTitle? }
State: { hasError: boolean, error: Error | null }

Render:
  - If hasError: glassmorphism error card với error message + retry button
  - If no error: children

Retry: reset state → re-render children
```

#### Task 8.2: Wrap AI pages với Error Boundary
```
Files: 3 page files

AICommandCenterPage.tsx:
  Wrap return value với:
    e(AISettingsErrorBoundary, { fallbackTitle: "Lỗi Trung tâm điều hành AI" }, ...)

AIAgentFederationPage.tsx (hoặc equivalent wrapper):
  Wrap với: e(AISettingsErrorBoundary, { fallbackTitle: "Lỗi Quản lý Agent" }, ...)

AIUsageAnalyticsPage.tsx (hoặc equivalent wrapper):
  Wrap với: e(AISettingsErrorBoundary, { fallbackTitle: "Lỗi Usage Analytics" }, ...)
```

#### Task 8.3: Thêm retry mechanism
```
Tạo hook: packages/web/src/hooks/useRetryableAsync.ts

Pattern:
  function useRetryableAsync(asyncFn, maxRetries = 2) {
    // State: data, loading, error, retryCount
    // execute(): try asyncFn, on error → auto-retry up to maxRetries
    // retry(): manual retry
    // reset(): clear error, reset retryCount
  }

Áp dụng cho:
  - AICommandCenterPage.loadSettings
  - AIUsageDashboard.loadData
  - AIAgentFederationPanel.loadAgents
```

#### Task 8.4: Lazy loading cho sub-components
```
File: packages/web/src/pages/AICommandCenterPage.tsx

Thêm React.lazy cho heavy components:
  const LazyAuditLogsPanel = React.lazy(() =>
    import("../components/AIAuditLogsPanel.js").then(m => ({ default: m.AIAuditLogsPanel }))
  );

  const LazyPromptConfigDrawer = React.lazy(() =>
    import("../components/AIAdvisoryPromptConfigDrawer.js").then(m => ({ default: m.AIAdvisoryPromptConfigDrawer }))
  );

Wrap với Suspense:
  e(React.Suspense, { fallback: e("div", { className: "loading" }, "Đang tải...") },
    e(LazyAuditLogsPanel, ...)
  )

Lưu ý: Chỉ lazy load khi component thực sự render (conditional rendering)
```

#### Task 8.5: React.memo cho summary cards
```
File: packages/web/src/pages/AICommandCenterPage.tsx

Wrap summary card rendering với React.memo:
  const SummaryCard = React.memo(function SummaryCard({ title, value, subtitle }) {
    return e("div", { className: "..." },
      e("p", { className: "..." }, title),
      e("p", { className: "..." }, value),
      e("p", { className: "..." }, subtitle)
    );
  });

Áp dụng cho 4 summary cards (lines 304-325)
```

#### Self-Audit Checklist — Slice 8
- [ ] AISettingsErrorBoundary component tồn tại
- [ ] AI pages wrapped với Error Boundary
- [ ] Trigger error → error UI hiển thị (không crash)
- [ ] Retry button hoạt động (re-fetch data)
- [ ] useRetryableAsync hook tồn tại và hoạt động
- [ ] AI Audit Logs lazy load (không load khi drawer đóng)
- [ ] Prompt Config Drawer lazy load
- [ ] Summary cards memoized (không re-render khi无关 state thay đổi)
- [ ] Pre-commit hook pass
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass

---

### SLICE 10: Advanced AI Features (Deprioritize)

**Mục tiêu:** Enhancement — chỉ làm sau khi S1-S8 stable.

**Effort:** 3.75 ngày
**Dependency:** S1-S8 hoàn thành

Các tính năng trong slice này là **enhancement**, không phải critical. Deprioritize cho đến khi:
- Tất cả slices S1-S8 đã shipped
- No regressions trong 2 tuần production usage
- Business requirement confirmed từ user feedback

#### Task 10.1: Agent execution history
```
- Hiển thị AIUsageRecord filtered theo agent name
- Thêm tab "History" trong agent detail view
```

#### Task 10.2: Agent templates
```
- Pre-built templates: "Sector Analyst", "Whale Watcher", "News Scanner"
- Clone template → create new agent với pre-filled fields
```

#### Task 10.3: Prompt config version history
```
- Lưu version snapshots khi save
- Diff viewer cho 2 versions
- Rollback button
```

#### Task 10.4: Budget alerts
```
- Monthly spending cap per user
- Warning at 80% threshold
- Auto-disable AI at 100% (optional)
```

---

## PHỤ LỤC C: DEPENDENCY GRAPH

```
S1 (DNSE) ─────────────────────┐
S2 (Event gate) ───────────────┤
S3 (Usage pagination) ─────────┤
S4 (Prompt config) ────────────┼──→ S7 (Testing)
S5 (Shared constants) ─────────┤    S8 (Error handling)
S6 (i18n) ─────────────────────┘         │
                                          ↓
                                    S10 (Advanced — deprioritize)
```

**Parallelization opportunities:**
- S1 + S2 + S3 + S4 song song (không depend nhau)
- S5 + S6 song song (không depend nhau, nhưng S5 nên làm trước S6 để avoid merge conflicts)
- S7 + S8 song song (sau khi S1-S6 done)

---

## PHỤ LỤC D: RISK REGISTER (UPDATED)

| # | Risk | Impact | Probability | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | DNSE API break during integration | High | Medium | Integration test trước khi ship. Verify API contract với `workspace.js` lines 291-305 | Frontend |
| R2 | Gemini endpoint sai URL (BUG-05) | High | Medium | Fix trong S2. Validate key format trước khi route. Backend patch trong S4 | Backend |
| R3 | Shell variant drift — ShellAiCommandCenterPage diverges từ AICommandCenterPage | Medium | High | S5 shared constants. Nếu shell cần feature riêng → tạo shell-specific wrapper, KHÔNG duplicate logic | Frontend |
| R4 | Backend contract risk — `updateUserConfig` endpoint thiếu cho event gate toggle | Medium | Medium | Verify endpoint tồn tại trước khi S2. Nếu thiếu: tạo endpoint trước | Backend |
| R5 | Frontend test coverage gap | Medium | High | S7 prioritized. Nếu schedule紧张: test critical paths trước (save/load flows) | Frontend |
| R6 | i18n keys conflict với existing keys | Low | Medium | Audit keys trước khi thêm. Dùng namespace riêng (aiCommandCenter.*, agentFederation.*) | Frontend |
| R7 | Lazy loading side effects | Low | Low | Test Suspense fallback. Verify component unmount không leak state | Frontend |
| R8 | Prompt config drawer auto-save race condition | Low | Low | S4 fix label, KHÔNG auto-save. User must explicitly save form | Frontend |
| R9 | Frontend test framework chưa setup | Medium | Medium | S7 Task 7.1 verify Vitest/Jest config. Nếu chưa có runner → +1.5 ngày cho infra setup (mock adapter + render helper) | Frontend |
| R10 | Backend usage pagination chưa verify | Medium | Medium | Slice 3 claim backend hỗ trợ limit/offset. Verify `ai_analytics/views.py` trước S3. Nếu thiếu → backend task +0.5 ngày | Backend |

---

## PHỤ LỤC G: BACKLOG / OUT-OF-SCOPE (từ critical review)

> Các items này được liệt kê trong audit nhưng **không được assign vào slice nào**.
> Được track riêng để tránh bỏ sót, nhưng KHÔNG blocking AI feature delivery.

| Item | Severity | Lý do chưa assign | Đề xuất |
|---|---|---|---|
| BUG-01 stale closure `refreshInterval` | Medium | Đã được fix ngầm trong S2 (đổi `loadSettings` dep thành `[]` + `refreshIntervalRef`) | ✅ Done trong S2 |
| BUG-07 masked API key | Low UX | Cần backend trả `ai_api_key_masked`; nằm ngoài S1-S8 | Backlog — S11 |
| STYLE-01 Shell dùng JSX | Low | Shell variant riêng; S5 chỉ refactor import, không đổi JSX→createElement | Backlog — S11 |
| STYLE-02 `window.confirm` trong Agent panel | Low UX | Cần custom modal; UX polish | Backlog — S11 |
| STYLE-03 missing useEffect dep (Shell) | Low | Lint warning, không runtime bug | Backlog — S11 |
| GAP-A2 System Prompt viewer | Medium | Backend có field, UI thiếu; tính năng nâng cao | Backlog — S11 |
| GAP-A3 Prompt version history | Low-Med | Enhancement | S10 |
| GAP-A4 Quota CTA | Low | Enhancement UX | S10 |

> **Lưu ý effort:** S8 adjust +17% (1.5→1.75) thay vì +25% vì lazy-load chỉ áp dụng cho 2 components.
> Nếu làm full perf pass (code-splitting toàn bộ AI pages) → adjust +25% (1.875 ngày).
> Team 2 người: roadmap ~3 tuần (không phải 2 tuần) do backend/frontend dependency.

---

## PHỤ LỤC E: ACCEPTANCE CRITERIA TỔNG THỂ

### Definition of Done (mỗi Slice)
1. Code written following createElement pattern (no JSX literals)
2. Pre-commit hook pass (`react/jsx-no-literals`)
3. `npx tsc --noEmit` pass
4. `npm run build` pass
5. Self-audit checklist items all checked
6. No regressions cho existing features

### Definition of Done (toàn bộ project)
1. Tất cả S1-S8 shipped
2. Frontend test coverage >= 80% cho AI settings pages
3. i18n: tất cả labels localized (vi + en)
4. No hardcoded tiếng Việt trong components
5. Error boundaries active trên tất cả AI pages
6. Lazy loading active cho heavy sub-components
7. Shared constants eliminates all PROVIDER_MODELS duplication
8. Production usage 2 tuần không có regressions

### Ship Criteria
```
Phase 1 (S1+S2):  DNSE credentials functional + Event gate toggle functional
Phase 2 (S3+S4):  Usage pagination + export working, Prompt config UX fixed, Temperature saved
Phase 3 (S5+S6):  No duplicated PROVIDER_MODELS, all labels localized
Phase 4 (S7+S8):  Tests pass, error boundaries active, lazy loading working
```

---

## PHỤ LỤC F: COMMUNICATION PROTOCOL

### Daily Standup (khi thực thi)
- Report: slice nào đang làm, blockers, ETA
- Nếu blocked > 2 giờ: escalate ngay

### Code Review Checklist
- [ ]遵循 createElement pattern
- [ ] Không có hardcoded tiếng Việt (đã qua t())
- [ ] Error handling đầy đủ
- [ ] Loading states
- [ ] Tests pass
- [ ] Build pass

### Deployment Strategy
- Feature flags cho từng slice (nếu dùng feature flag system)
- Deploy từng slice, verify production, rồi proceed slice tiếp
- Rollback plan: revert commit nếu có issue
