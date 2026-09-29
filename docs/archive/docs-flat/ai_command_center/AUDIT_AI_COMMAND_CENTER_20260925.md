# AUDIT — Cài đặt / Trung tâm điều hành AI (`/settings/ai`)

**Ngày:** 2026-09-25 · **Phạm vi:** FE hub + 2 sub-route + Agents/Usage, BE `advisory` + `ai_agents` + `ai_analytics` + `user_workspace`
**Phương pháp:** đọc toàn bộ FE↔BE contract, trace 5 use-case, chạy gate, đối chiếu tài liệu.
**Kết luận ngắn:** **5 bug P0 chặn production** (config AI lưu vào không dùng, config prompt bị ghi sai shape, audit log lộ cross-tenant, SSRF qua `custom_endpoint`, Usage tab vĩnh viễn rỗng) + **1 lỗi trung thực trạng thái** (trạng thái "Sẵn sàng" là giả) + **toàn bộ UI mất design token** trên trang hub. Tính năng hiện ở mức *"form cấu hình 1 màn hình"*, chưa đạt ngưỡng AI-gateway thương mại ở bất kỳ điểm nào: không routing, không failover, không budget theo cost, không observability, không guardrail.

---

## 0. TÓM TẮT 5 PHÁT HIỆN NGHIÊM TRỌNG NHẤT

1. **Mô hình AI người dùng chọn không bao giờ được dùng.** `advisory/views.py:431` gán `ai_model` từ `SystemAISettings` (cấp hệ thống), không phải từ `UserAICredential.ai_model`. Dropdown "Mô hình AI" là đồ trang trí — và chính nó tạo ra cặp provider/model mâu thuẫn gây 404 ở production (Entry 215 ROOT CAUSE #1).
2. **`ai_prompt_config` bị ghi sai shape khi bấm "Lưu cấu hình".** BE dựng default phẳng `{whale:…}`, nhưng runtime chỉ chấp nhận `{version, sources:{…}}` và **âm thầm fallback về default** khi shape sai. User mở trang rồi lưu là mất sạch prompt config của họ, không lỗi, không log.
3. **Nhật ký AI lộ cross-tenant.** `portfolio_analytics_views.py:1007` `AIAuditLog.objects.all()` — bảng này **không có** user FK. `/settings/ai` lại là menu item không staff-gated, trong khi BE nav chỉ expose route cho staff. Mọi user đăng nhập đọc được nhật ký AI của mọi user/tenant khác.
4. **SSRF.** `custom_endpoint` do user kiểm soát, `test-connection` gọi thẳng `httpx.get(f"{endpoint}/models")` không validate scheme/host, không throttle. User thường dùng được server làm probe vào metadata nội bộ.
5. **Tab "Usage AI" vĩnh viễn rỗng.** Không một dòng code nào ngoài chính app `ai_analytics` tạo `AIUsageRecord`. Không có cost tracking, không có SLO LLM. Đồng thời `POST /ai/usage/` là write-endpoint mở cho mọi user để bịa số liệu.

---

## A. BẢN ĐỒ KIẾN TRÚC

### A.1 Frontend

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `src/main.tsx` | 118-121 | 3 route: `settings/ai`, `settings/ai/agents`, `settings/ai/usage` | Không route nào dùng `shell-ai-command-center` |
| `src/pages/pageRegistry.js` | 183-188 | Map `ai-command-center`→`AICommandCenterPage`, `ai-agent-federation`, `ai-usage-analytics` | 201: `shell-ai-command-center` đăng ký nhưng **không route** |
| `src/pages/AICommandCenterPage.tsx` | 401 | Hub: header + 5 tab + 4 summary card + policy + form + quota + system prompt + prompt history + audit | Dùng `createElement` 100%; không `.page` → mất token |
| `src/components/AICommandCenterForm.tsx` | 701 | Form runtime config dùng chung (F8), 8 field testid | Không `isDirty`, không skeleton |
| `src/components/AIAdvisoryPromptConfigDrawer.js` | 360 | Drawer 8 nguồn dữ liệu + 4 preset + slider lookback | **Shape mismatch với BE** |
| `src/components/AIAuditLogsPanel.tsx` | 273 | Audit log + filter + phân trang | Tailwind cứng, dark-only, không a11y |
| `src/pages/AIUsageAnalyticsPage.tsx` | 21 | Wrapper, chỉ có back-link | Không hub nav |
| `src/pages/AIAgentFederationPage.tsx` | 21 | Wrapper, chỉ có back-link | Không hub nav |
| `src/components/AIUsageDashboard.tsx` | 378 | Metrics + chart + bảng + filter + export CSV | Hardcode màu, filter không nhất quán |
| `src/components/AIAgentFederationPanel.tsx` | 304 | CRUD agent registry | Registry không có hiệu lực |
| `src/pages/system/ShellAiCommandCenterPage.tsx` | 234 | Trang "shell" song song | **Trang chết**, 3 metric `"…"` |
| `src/components/aiSettings.module.css` | 998 | Token `--ai-*` (trong `.page`) + `--ais-*` (`:root`) | 13 token chỉ trong `.page` |
| `src/shared/providerModels.ts` | 57 | 6 provider × danh sách model hardcode | Nhãn VI hardcode; không model mới nào dùng được |
| `src/adapters/core/workspace.js` | 650-687 | 5 endpoint AI CC + userconfig | `updateUserConfig` dùng PATCH |

### A.2 Backend

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `user_workspace/portfolio_analytics_views.py` | 389-771 | `GET/PUT /workspace/ai-command-center/` | ~380 dòng trong 1 view, 2 lần lặp nguyên văn khối response |
| ″ | 774-826 | `POST …/prompt-config/rollback/` | |
| ″ | 829-993 | `POST …/test-connection/` | **SSRF**, endpoint map sai |
| ″ | 996-1043 | `GET …/audit-logs/` | **`.objects.all()` — cross-tenant** |
| `advisory/models.py` | 194-300 | `UserAICredential` (BYOK SSOT) | 5 field per-user nullable + `prompt_config_history` cap 20 |
| ″ | 303-338 | `AIAuditLog` | **Không user FK** — chỉ `actor: str` |
| `advisory/advisory_helpers.py` | 38-52 | `_get_default_prompt_config()` — canonical | Shape `{version, sources}` |
| ″ | 85-145 | `_parse_prompt_config()` | Reject shape phẳng → `return defaults` |
| `advisory/views.py` | 228-580 | `AdvisoryRefreshView` | Dựng `effective_context` |
| ″ | 430-444 | **Nguồn config runtime** | `ai_model` lấy từ system, không từ user |
| `advisory/orchestrator.py` | 116-311 | Gọi 3 sub-agent + synthesis | Endpoint map chỉ local/gemini/else |
| `advisory/tasks.py` | 26-80 | `generate_advisory_task` | **Không ghi `AIUsageRecord`** |
| `ai_analytics/views.py` | 11-123 | 3 view usage | Filter không nhất quán; POST mở |
| `ai_agents/views.py` | 19-80 | CRUD `AgentRegistry` | Đúng ownership, nhưng không ai đọc |
| `vninvest_core/settings.py` | 186-189, 283-289 | `ADVISORY_TOKEN_BUDGET=2000`, `AI_FALLBACK_DAILY_QUOTA=5`, throttle `advisory_refresh=10/hour` | Không có env cho provider endpoint/giá model |

---

## B. LUỒNG DỮ LIỆU ĐÃ TRACE

### B.1 Load trang (5 request song song)

```
main.tsx:118 → AICommandCenterPage
 ├─ useEffect(AICommandCenterPage.tsx:77-92)  GET /workspace/userconfig/            → event gate
 └─ AICommandCenterForm useEffect(:222-225)
      GET /workspace/ai-command-center/  → workspace.js:652
      → PortfolioAICommandCenterView.get  (portfolio_analytics_views.py:401)
        ├─ SystemAISettings.filter(is_active).order_by(-updated_at).first()   :404
        ├─ build prompt_config PHẲNG (whale/dark_flow/...)                   :425-439  ⚠
        ├─ UserAICredential.objects.get(user)  → user_cred = None lần đầu      :443
        ├─ fallback sang UserProfile.preferences                               :463-488
        ├─ ai_ready = api_key_configured or provider in (openclaw, local)     :490  ⚠
        └─ response_data (20 keys)                                            :525-547
      → applySettings(:166-201) setAiProvider/setAiModel/setMaxTokens/…
      → onSettingsChange → handleFormSettingsChange(AICommandCenterPage:94-100)
           setPromptConfig(data.ai_prompt_config)   ⚠ shape phẳng vào state
 └─ useEffect(promptHistory) render list
 └─ LazyAuditLogsPanel → getAIAuditLogs(limit=10, offset=0) → view:1003
                           AIAuditLog.objects.all()  ⚠ cross-tenant
```

### B.2 Bấm "Lưu cấu hình" — **nơi bug P0 #2 xảy ra**

```
AICommandCenterForm.handleSaveSettings(:258-312)
 payload = { ai_provider, ai_model, advisory_max_tokens_per_day,
             advisory_refresh_interval_hours, temperature }
 + custom_endpoint (nếu local)
 + ai_api_key (nếu nhập)
 + Object.assign(payload, getExtraPayload())            :296-298
       getExtraPayload = () => promptConfig ? { ai_prompt_config: promptConfig } : {}
       ↑ promptConfig = shape PHẲNG từ B.1                            ⚠⚠
 → PUT /workspace/ai-command-center/
   → view.put:630-636  new_pc != old_pc → user_cred.prompt_config = new_pc (phẳng)
   → _append_prompt_config_history(source='save')                       :674-677
 → runtime: advisory_helpers._parse_prompt_config(phẳng)
       raw_config.get("sources") is None  → :100-101  return defaults   ⚠ config bị bỏ
```

### B.3 Sinh advisory — **nơi bug P0 #1 xảy ra**

```
POST /advisory/<symbol>/refresh/
 views.py:241  prompt_config = request.data.get('prompt_config')   ← chỉ từ body, KHÔNG đọc user_cred.prompt_config
 views.py:354  ai_settings = _get_or_create_active_ai_settings()   (SystemAISettings)
 views.py:372  provider = user_cred.ai_provider                   ✓ đúng ý user
 views.py:430  effective_context = {
                 'ai_model': ai_settings.ai_model,        ⚠ SYSTEM, user_cred.ai_model bị bỏ
                 'prompt_template': ai_settings.prompt_template,
                 'temperature': ai_settings.temperature → :457 override bằng user_cred.temperature ✓
                 'ai_provider': provider ✓
                 'custom_endpoint': custom_endpoint ✓
               }
 views.py:572  generate_advisory_task.delay(...)
   tasks.py:35  orchestrator.run(effective_context, symbol)
     orchestrator.py:118  ai_model = effective_context['ai_model']   ⚠ = system model
     orchestrator.py:196-204 endpoint: local | gemini | else=api.openai.com
                          ⚠ claude/copilot → OpenAI endpoint + Anthropic key = 401
     tasks.py:65-80  cập nhật AdvisoryRecord  (KHÔNG tạo AIUsageRecord)  ⚠
```

### B.4 "Kiểm tra kết nối"

```
POST …/test-connection/  { ai_provider, ai_model, ai_api_key?, custom_endpoint? }
 view:867  openclaw  → luôn 200 success, latency 0                ⚠ giả
 view:876  local     → httpx.get(f"{custom_endpoint}/models")       ⚠ SSRF
 view:940  gemini    → generativelanguage…/openai/chat/completions
 view:943  else      → api.openai.com/v1/chat/completions          ⚠ claude/copilot sai
 view:862  after_json status = 'success' if 'SUCCESS' in audit_action else 'failed'
           audit_action = 'test_connection_success' (chữ thường) → luôn 'failed'  ⚠ cosmetic
```

---

## C. CONTRADICTIONS (tài liệu/khai báo vs code thực tế)

| # | Khai báo | Thực tế | Tác động |
|---|---|---|---|
| C-01 | `ai-model` là field người dùng cấu hình (`UserAICredential.ai_model`, `models.py:225`) | `advisory/views.py:431` dùng `ai_settings.ai_model`; không nơi nào truyền `user_cred.ai_model` vào `effective_context` | Cấu hình model vô hiệu |
| C-02 | CC GET dựng `ai_prompt_config` phẳng (`portfolio_analytics_views.py:425-439`) | `_parse_prompt_config` (`advisory_helpers.py:99-101`) yêu cầu `{version, sources}` | Default của hệ thống không bao giờ được áp dụng |
| C-03 | FE drawer's `DEFAULT_CONFIG` = `{version, sources}` (`AIAdvisoryPromptConfigDrawer.js:22-34`) | BE GET trả phẳng → `mergedConfig` (`:38`) giữ `sources` = default của FE, **bỏ qua** giá trị thật | UI hiện sai giá trị so với thực thi |
| C-04 | `useAIAdvisor` (`hooks/useAIAdvisor.js:38-46`) giả định `{sources}` | BE trả phẳng | Mọi consumer thứ 3 cũng lệch |
| C-05 | `identity_access/views/helpers.py:188-193` — route `ai-command-center` chỉ staff | `sidebaritems.ts:36` — item thường, không `staffOnly`; `view:391` chỉ `IsAuthenticated` | Menu và API lệch nhau; ability `system.ai_command_center.manage` cấp cho staff nhưng **không ai enforce** |
| C-06 | `pageRegistry.js:201` đăng ký `shell-ai-command-center` | `main.tsx` không có route nào dùng | Trang chết 234 dòng + 3 metric `"…"` |
| C-07 | `check-shell.mjs:150` assert `getPageComponent("ai-command-center") === ShellAiCommandCenterPage` | `pageRegistry.js:183-184` map sang `AICommandCenterPage`; `getPageComponent` trả deferred wrapper | Assert sai **và** script không chạy được (xem E.4) |
| C-08 | `ops_audit/tasks.py:139` map `/core/v1/ai-agents/` | `ai_agents/urls.py:6` khai báo `ai/agents/` | Audit trail ghi sai service label |
| C-09 | `aiCommandCenter.auditDescription` = "Mỗi trang hiển thị {count} bản ghi." | UI dùng `auditLogsDesc` (string cứng "10 bản ghi") | Key chết |
| C-10 | `aiCommandCenter.presets/presetBalanced/...` (4 key) | Drawer dùng `promptConfig.presets.*` | 8 key preset chết |
| C-11 | `i18n:scan` + `check:shell` = gate | `check-shell.mjs` chứa toàn bộ assert AI CC nhưng **không nằm trong `check:shell`** và **crash** khi chạy | Gate không kiểm tra gì cho AI CC |

---

## D. FINDINGS

> Mức: `P0` = chặn production / rò rỉ dữ liệu / mất cấu hình · `P1` = sai lệch chức năng hoặc UX nghiêm trọng · `P2` = vệ sinh/consistency · `P3` = polish

### P0 — Chặn production

<details><summary><b>F-01 · <code>ai_model</code> người dùng chọn không bao giờ được dùng khi sinh advisory</b> <code>ERROR</code></summary>

- **File:** `packages/core/backend/src/advisory/views.py:431` · `orchestrator.py:118` · `advisory/models.py:225`
- **Thực tế:** `effective_context['ai_model'] = ai_settings.ai_model` (SystemAISettings). `UserAICredential.ai_model` chỉ được đọc ở `portfolio_analytics_views.py:450, 598, 722` — tức chỉ để **hiển thị** lại cho UI. Không có đường nào đưa nó xuống runtime.
- **Tác động:** dropdown "Mô hình AI" là write-only. Người dùng đổi model, UI báo "Lưu thành công", audit log ghi `ai_model: cũ → mới`, nhưng request vẫn dùng model cũ của hệ thống. Kết hợp với `ai_provider` (đọc đúng từ user) ⇒ **cặp provider/model mâu thuẫn**. Đây chính là nguyên nhân gốc 404 đã ghi ở Entry 215.
- **Fix:** `effective_context['ai_model'] = (user_cred.ai_model or ai_settings.ai_model)`; trả `effective_ai_model` từ cùng nguồn để UI phản ánh đúng; thêm `_validate_provider_model_pair()` whitelist trước khi lưu.
- **AC:** test BE khẳng định `user_cred.ai_model` được truyền vào `generate_advisory_task`; test FE khẳng định `effective_ai_model` khớp giá trị vừa lưu.
</details>

<details><summary><b>F-02 · <code>ai_prompt_config</code> bị ghi sai shape ⇒ toàn bộ prompt config của user bị bỏ qua im lặng</b> <code>ERROR</code></summary>

- **File:** `portfolio_analytics_views.py:425-439` (default phẳng) · `advisory_helpers.py:99-101` (`return defaults` khi thiếu `sources`) · `AICommandCenterPage.tsx:97, 269-270` · `AICommandCenterForm.tsx:296-298`
- **Thực tế:** user mở `/settings/ai` → `handleFormSettingsChange` set `promptConfig = <shape phẳng>` → bấm "Lưu cấu hình" mà **không mở drawer** → `getExtraPayload()` trả shape phẳng → PUT ghi vào `UserAICredential.prompt_config` → runtime `_parse_prompt_config` thấy `raw.get("sources")` không phải dict → **`return defaults`**. Không exception, không log, không cảnh báo.
- **Tác động:** mất cấu hình nguồn dữ liệu của user. Thêm 1 bản ghi "phiên bản" trong `prompt_config_history` → lịch sử ghi lại những phiên bản rỗng.
- **Fix:** (1) default BE dùng `_get_default_prompt_config()` thay vì dict phẳng; (2) validate shape trước `user_cred.prompt_config = new_pc` — reject sớm bằng 400 nếu thiếu `sources`; (3) FE chỉ gửi `ai_prompt_config` khi drawer thực sự thay đổi (dirty flag thay vì set ngay từ GET).
- **AC:** BE test — PUT shape phẳng → 400; GET không có user_cred trả `{version:2, sources:{...}}`; FE test — Save không thay đổi drawer không được gửi `ai_prompt_config`.
</details>

<details><summary><b>F-03 · 4 nguồn định nghĩa default prompt config, mỗi nơi một giá trị (vi phạm SSOT)</b> <code>ERROR</code></summary>

| Nguồn | Shape | whale | dark_flow | technical | news | market | fundamental | ownership | sector | enabled |
|---|---|---|---|---|---|---|---|---|---|---|
| **BE canonical** `advisory_helpers.py:15-24` | `{v, sources}` | 30 | 30 | 20 | 14 | 7 | 90 | 365 | 20 | tất cả **true** |
| **BE CC GET** `portfolio_analytics_views.py:425-439` | **phẳng** | 180 | 90 | 30 | 14 | 7 | 1 | 365 | 60 | fund/own/sect **false** |
| **FE drawer** `AIAdvisoryPromptConfigDrawer.js:22-34` | `{v, sources}` | 30 | 30 | 20 | 14 | 7 | 1 | 365 | 60 | fund/own/sect **false** |
| **FE hook** `useAIAdvisor.js:38-46` | `{sources}` (4) | 180 | 90 | 30 (3 ind.) | 14 | — | — | — | — | tất cả true |

- Ngoài ra `lookback_unit: 'ngày'/'phiên'` trong default BE là **key chết** — không FE lẫn `_parse_prompt_config` đọc.
- **Tác động:** không thể trả lời "prompt config mặc định của hệ thống là gì". Mọi tài liệu mô tả giá trị nào là sai.
- **Fix:** 1 nguồn duy nhất ở BE (`_get_default_prompt_config()`), expose qua endpoint read-only cho FE; FE lấy về làm fallback thay vì khai báo lại.
- **AC:** grep repo không còn dict literal chứa `whale`/`dark_flow` ngoài `advisory_helpers.py`.
</details>

<details><summary><b>F-04 · Nhật ký AI lộ cross-tenant + cross-user</b> <code>ERROR</code> · security</summary>

- **File:** `portfolio_analytics_views.py:1007` (`AIAuditLog.objects.all()`) · `advisory/models.py:303-338` (không có user FK) · `sidebaritems.ts:36` (không staff-gated) · `helpers.py:188-193` (BE nav chỉ staff)
- **Thực tế:** bảng `AIAuditLog` chỉ có `actor` là **chuỗi username**. View đọc toàn bảng cho mọi user đã xác thực. Filter actor dùng `actor__icontains` (`:1015`) nên user `admin` khớp cả `administrator`, `admin2`.
- **Tác động:** user thường đọc được: username của người dùng khác, provider/model, before/after snapshot cấu hình, lý do thay đổi, `diff_summary`. Trong bản SaaS multi-tenant đây là rò rỉ dữ liệu chéo khách hàng.
- **Fix:** thêm `user = FK(User, null=True, db_index=True)` + `tenant = FK(CoreTenant, null=True, db_index=True)` (migration), ghi ở mọi `AIAuditLog.objects.create`, scope `filter(user=request.user)` cho non-staff và `filter(tenant=request.tenant)` cho cả staff; `actor__icontains` → `actor__iexact` hoặc bỏ (đã có `user_id`); cân nhắc append-only.
- **AC:** test 2 user A/B — A không thấy log của B; test 2 tenant — staff tenant A không thấy log tenant B.
</details>

<details><summary><b>F-05 · SSRF qua <code>custom_endpoint</code> + thiếu throttle + lộ endpoint nội bộ</b> <code>ERROR</code> · security</summary>

- **File:** `portfolio_analytics_views.py:876-908` (`httpx.Client(timeout=5).get(f"{endpoint}/models")`) · `orchestrator.py:196-200` (`custom_endpoint + '/chat/completions'`) · `providerModels.ts:44` (UI expose `local`)
- **Thực tế:** không validate scheme (`file://`?), host, port; không chặn private/loopback/link-local; không chống DNS-rebind; không throttle (`throttle_classes` rỗng). `detail` trả về echo nguyên endpoint. `except Exception as e: … str(e)` phát tán raw exception.
- **Tác động:** user thường dùng backend làm SSRF probe vào `169.254.169.254` (cloud metadata), Redis/Postgres admin nội bộ, dịch vụ khác của cùng host. Amplification: mỗi click = 1 outbound request 5-10s, không giới hạn.
- **Fix:** validator dùng chung `validate_outbound_endpoint(url)` — chỉ `https` (cho cloud) hoặc `http` khi `local`; chặn dải RFC1918/169.254/::1 nếu không bật cờ `ALLOW_PRIVATE_AI_ENDPOINT`; resolve DNS và kiểm tra IP sau resolve; `ScopedRateThrottle` scope `ai_test_connection` (ví dụ 20/hour/user); message lỗi không echo endpoint; bỏ `str(e)` raw.
- **AC:** test SSRF — `http://169.254.169.254/` và `http://127.0.0.1:6379/` bị chặn 400 với message không chứa endpoint.
</details>

<details><summary><b>F-06 · Trạng thái "Sẵn sàng" là giả; <code>claude</code>/<code>copilot</code>/<code>openclaw</code> không dùng được</b> <code>ERROR</code> · trust</summary>

- **File:** `portfolio_analytics_views.py:490, 725` (`ai_ready`) · `:867-872` (openclaw luôn success) · `orchestrator.py:154-157, 196-204` · `advisory/views.py:383-393` · `providerModels.ts:26-32, 45-57`
- **Thực tế:**
  - `ai_ready = api_key_configured or provider in ('openclaw','local')` — **không** kiểm tra cặp provider/model, không probe. Screenshot hiện "gemini / gemini-3.8-flash / Sẵn sàng" trong khi model đó có thể không tồn tại.
  - `claude` + `copilot` không có nhánh riêng → rơi vào `else` = `api.openai.com` với Anthropic key → **401 chắc chắn**, thông báo lại là "từ chối API Key" gây hiểu nhầm.
  - `openclaw`: không lấy key (`views.py:383-393`) → `orchestrator.py:154` `is_mock` → `raise ValueError` khi `DEBUG=False`. **Chọn OpenClaw = hỏng advisory ở production**, trong khi UI và test-connection đều báo xanh.
- **Tác động:** ba provider trên 6 trong UI không dùng được; trạng thái runtime không đáng tin → người dùng debug sai chỗ.
- **Fix (chọn 1):** (a) triển khai adapter thật cho claude (`api.anthropic.com/v1/messages`) + copilot, `openclaw` phải resolve được một provider thật hoặc gỡ khỏi UI; **hoặc** (b) gỡ claude/copilot/openclaw khỏi `PROVIDER_OPTIONS` ngay lập tức. Đồng thời thay `ai_ready` bằng probe thật: `ai_ready = last_probe_ok and age < N`.
- **AC:** test-connection cho từng provider trong UI đều trả 200 với endpoint đúng provider; `ai_ready=false` khi probe cuối thất bại.
</details>

<details><summary><b>F-07 · Usage tab vĩnh viễn rỗng + write-endpoint để bịa số liệu</b> <code>ERROR</code></summary>

- **File:** `ai_analytics/views.py:68-73` (POST) · `advisory/tasks.py:26-80` (không ghi) · `advisory/orchestrator.py` (không ghi)
- **Bằng chứng:** grep `ai_analytics|AIUsageRecord|AIUsageSummary` toàn `packages/core/backend/src` chỉ khớp trong chính app `ai_analytics`, `db_router.py:35`, `settings.py:91`, `urls.py`. `advisory/tasks.py` **không** tạo bản ghi nào.
- **Tác động:** (1) tab "Usage AI" luôn rỗng — không cost tracking, không latency, không per-model spend, không SLO LLM. Đây là khoảng trống lớn nhất so với sản phẩm thương mại. (2) `POST /core/v1/ai/usage/` cho phép mọi user xác thực tự chèn bản ghi tùy ý (`serializer.save(user=request.user)`), không throttle → dữ liệu bịa được, và là bề mặt spam.
- **Fix:** instrument `generate_advisory_task` + `call_agent_async` (token usage từ response, latency, status, provider, model, cost theo bảng giá); `AIUsageSummary` qua task nightly theo `(date, user, action)` upsert; **xoá `POST` khỏi `AIUsageRecordListView`** hoặc chuyển sang permission `ai_analytics.write` nội bộ.
- **AC:** 1 lần refresh advisory → tab Usage có ≥ 1 bản ghi với `provider/model/tokens_in/tokens_out/cost/latency_ms/status`; `POST /ai/usage/` trả 403 cho user thường.
</details>

### P1

<details><summary><b>F-08 · Toàn bộ form mất design token trên trang hub (13 biến CSS không resolve)</b> <code>ERROR</code> · visual</summary>

- **File:** `aiSettings.module.css:51-64` (khai báo trong `.page`) · `AICommandCenterPage.tsx:167` (`className: "shellPage"`, **không** có `styles.page`) · `AIUsageAnalyticsPage.tsx:15` / `AIAgentFederationPage.tsx:15` (**có** `styles.page`)
- **Thực tế:** 13 token `--ai-ink/muted/secondary/accent/accent-soft/border/border-strong/surface/surface-translucent/shadow/success/danger/warning` chỉ tồn tại trong scope `.page`. Trang hub không áp `.page` ⇒ mọi `border: 1px solid var(--ai-border)`, `background: var(--ai-surface)`, `color: var(--ai-ink)`, `box-shadow: 0 0 0 2px var(--ai-accent-soft)` trong module **bị drop declaration** (invalid at computed-value time).
- **Hệ quả nhìn thấy được:** input/select mất viền, mất focus ring, mất màu muted/secondary; panel con mất nền. Các token `--ais-*` (khai báo ở `:root`, dòng 7-28) vẫn chạy nên button gradient / btnDanger **vẫn màu** → **giao diện lệch tông giữa hub và 2 sub-route**. Đúng thứ Entry 213 (Wave 1) ghi nhưng chưa ai sửa.
- **Fix:** chuyển block `--ai-*` ra `:root` ngay sau block `:root` sẵn có (đã có `:root[data-theme="light"]` override ở `:31-49` sẵn sàng); **không** thêm `styles.page` vào hub vì nó kéo theo `min-height:100vh` + padding + gradient lệch với AppShell.
- **AC:** test CSS assert `--ai-border` được khai báo ngoài `.page`; visual QA light+dark ở cả 3 route.
</details>

<details><summary><b>F-09 · Key i18n thiếu ⇒ UI hiện raw key; 18 key chết</b> <code>ERROR</code></summary>

- `AIAuditLogsPanel.tsx:57` dùng `t('aiCommandCenter.loadError')` — **không có** trong `vi.js` lẫn `en.js`. `i18n/index.js:41-42` fallback = `String(key)` ⇒ banner lỗi hiện đúng chuỗi `aiCommandCenter.loadError`.
- 18 key chết trong ns `aiCommandCenter`: `configMessage, presets, presetBalanced, presetFlowFirst, presetDeepDive, presetCostControl, sourcesEnabled, technicalIndicators, whaleLookback, enableAll, leanSet, auditLogs, auditDescription, auditFilters, viewJson, page, of, refresh`.
- **Fix:** thêm `loadError` cả 2 locale; xoá 18 key chết (hoặc dùng lại); thêm gate `t()`-key-missing vào `check:shell` (hiện `i18n:scan` chỉ quét literal, không verify key tồn tại).
</details>

<details><summary><b>F-10 · Chuỗi VI hardcode trong component dùng chung VI/EN</b> <code>ERROR</code></summary>

| Vị trí | Chuỗi | Hệ quả |
|---|---|---|
| `AICommandCenterPage.tsx:237` | `` `${refreshIntervalDisplay} giờ/lần` `` | EN → "24 giờ/lần" (đúng ảnh 2) |
| `providerModels.ts:15,24,31,35,43,46` | `"Mô hình tùy chỉnh..."` | EN hiện tiếng Việt trong dropdown |
| `AISettingsErrorBoundary.tsx:41,42,48` | 3 fallback VI | EN hiện VI khi lỗi |
| `AIAgentFederationPanel.tsx:10-17` | `AGENT_TYPES` label EN | không i18n, không theo ngôn ngữ |
| `AIAdvisoryPromptConfigDrawer.js:216,217,228,279,280,328,339,355` | `t(...) \|\| "…VI…"` | **dead code** (translator trả key) + VI hardcode |
| ″:216, 222 | emoji `⚙️`, `✕` | không a11y, không token |
| `AIUsageDashboard.tsx:279` | `STATUS_OPTIONS = ["success","error"]` | không i18n, có thể lệch `ModelChoices` BE |
- **Fix:** đưa qua `t()`, bỏ toàn bộ `|| "fallback"`; provider labels lấy từ `t('aiProviders.*')`.
</details>

<details><summary><b>F-11 · Bảng tổng quan bị lọc một nửa (tổng + biểu đồ không theo filter)</b> <code>ERROR</code></summary>

- `ai_analytics/views.py:76-97` (`SummaryView`) và `:100-123` (`AggregateView`) **không** áp `model`/`status`; chỉ `AIUsageRecordListView:27-34` có.
- `AIUsageDashboard.tsx:128-132` gửi filter cho cả 3; `:131` `getAIUsageSummary({ days })` bỏ filter hẳn.
- **Tác động:** lọc `model=gemini-3.8-flash` → bảng chỉ dòng gemini nhưng 4 metric tổng và biểu đồ vẫn là toàn bộ. Người dùng không thể tin số liệu.
- **Fix:** dựng một helper filter chung cho cả 3 view; thêm `?action=` cho aggregate.
- **AC:** test — với `?model=X`, `aggregate.total_requests == len(results đã lọc)`.
</details>

<details><summary><b>F-12 · Đổi filter giữa chừng lúc đang fetch ⇒ request mới bị bỏ qua im lặng</b> <code>ERROR</code></summary>

- `hooks/useRetryableAsync.ts:38` `if (inFlightRef.current) return;` — không `AbortController`, không reset theo `asyncFn` change.
- `AIUsageDashboard.tsx:144` `useEffect([loadData])` ⇒ đổi `days/model/status/page` khi request cũ đang bay → lần mới bị return → **UI hiện dữ liệu của filter cũ**, không có tín hiệu, chỉ thoát bằng cách bấm Refresh.
- Thêm: `mountedRef` khởi tạo `true` và **không bao giờ set `false`** khi unmount (`:34`) ⇒ setState sau unmount.
- Thêm: `AIUsageDashboard.tsx:226` `onClick: () => { loadData(); retryLoadData(); }` — 2 lệnh, một là no-op do guard.
- **Fix:** `AbortController` + `requestId` guard (chỉ apply response mới nhất); `useEffect` cleanup set `mountedRef.current = false`; bỏ `retryLoadData` khỏi nút refresh.
- **AC:** test với mock resolver trễ — đổi filter 2 lần trong 100ms ⇒ kết quả cuối khớp filter cuối.
</details>

<details><summary><b>F-13 · Panel nhật ký: không token, dark-only, không a11y, không export</b> <code>ERROR</code></summary>

- **Token:** toàn bộ dùng class Tailwind cứng (`bg-slate-900/40`, `text-cyan-300`, `border-slate-800`, `text-[10px]`) thay vì `aiSettings.module.css` ⇒ lệch hệ thiết kế với phần còn lại của trang (đúng finding B của Entry 213). `check-tokens.mjs:collectFiles` chỉ quét `.css` ⇒ hex trong TSX **không bao giờ** bị gate bắt.
- **Light mode:** `index.css:13` gắn `@custom-variant dark` theo `data-theme` ⇒ các class không có `dark:` vẫn **luôn dark** ⇒ light mode hiện panel tối trên nền sáng.
- **A11y:** header row là `div onClick` (`:200-216`) — không `role="button"`, không `tabIndex`, không `aria-expanded`, không phím Enter/Space. Mũi tên `'▲'/'▼'` hardcode. Filter `<label>` không `htmlFor`.
- **Logic:** `params._r = refreshKey` (`:51`) gửi param rác; `applyFilters` gọi `loadLogs()` **và** setState ⇒ 2 request trùng; `formatDate` không guard ngày hỏng; không nút refresh riêng, không export CSV, không preset ngày.
- **Fix:** migrate sang class của `aiSettings.module.css`; dùng `<button aria-expanded>`; thêm nút Refresh + Xuất CSV (copy pattern `advisoryExport.js`); bỏ `_r`, debounce filter 300ms.
</details>

<details><summary><b>F-14 · 3 hệ thống design token cạnh tranh trên cùng 1 trang</b> <code>RISK</code></summary>

1. Tailwind v4 `@theme` (`index.css:15`) — `--text-primary`, `--bg-panel-soft`, `--accent-cyan`, `--border-default`, `--fs-*`. **Đây là SSOT của app.**
2. `aiSettings.module.css` — `--ai-*` (bridge sang #1 qua `var(--text-primary, fallback)`) + `--ais-*` (raw hex riêng trong `:root`).
3. `ShellPageTemplate.module.css` — `--st-*`/hardcoded + block `:root[data-theme="light"]` riêng ở `:24`.

- `AICommandCenterPage.tsx:167` dùng `shellPage` + **inline style** `gap: "20px"`, `maxWidth: 1200` (lệch 8pt grid) thay vì token → phần layout không thuộc hệ thống nào.
- **Tác động:** thứ tự cascade quyết định kết quả, không xác định được trước; mọi sửa token đều có nguy cơ regression ở 1 trong 3 lớp.
- **Fix:** chọn #1 làm SSOT; `--ai-*` chỉ còn là alias → xoá dần khi migrate; gộp hoặc gỡ `ShellAiCommandCenterPage`; bỏ inline style, dùng class.
</details>

<details><summary><b>F-15 · Biểu đồ hardcode màu, không light-mode, không accessibility</b> <code>RISK</code></summary>

`AIUsageDashboard.tsx:292-305`: `stroke: "rgba(148,163,184,0.15)"`, `tick.fill: "#94a3b8"`, tooltip `background: "rgba(15,23,42,0.95)"` + `color: "#f1f5f9"`, bar `fill: "#12c7e8"`. Không đọc token ⇒ light mode giữ nền tối. Thiếu `<title>`/desc, thiếu bảng số thay thế, `ResponsiveContainer` không có `aria-hidden`.
</details>

<details><summary><b>F-16 · Không skeleton, số giả lúc load, mất thay đổi khi điều hướng</b> <code>RISK</code> · UX</summary>

- `AICommandCenterPage` không có state `loading` ⇒ 4 summary card + 4 metric hiện `—`/số default (24/24/5000) **trước khi dữ liệu về** rồi nhảy số (ảnh 1-2).
- `AICommandCenterForm.tsx:364-370` chỉ 1 dòng text, không skeleton.
- Không `isDirty` ⇒ điều hướng đi mất thay đổi; nút Save không disable khi không đổi.
- `setTimeout` tại `AICommandCenterPage.tsx:113, 149` không cleanup ⇒ setState sau unmount.
- `refreshAuditKey` bump (`:105, 147`) remount `LazyAuditLogsPanel` (key đổi) ⇒ **mất filter và page của user** sau mỗi lần Save.
- **Fix:** skeleton theo shape thật; `isDirty` + `beforeunload`; `useRef` + `clearTimeout`; thay remount bằng `refresh()` bên trong panel.
</details>

<details><summary><b>F-17 · Không validate input ở PUT; <code>temperature</code> lỗi bị nuốt im lặng</b> <code>RISK</code></summary>

- `portfolio_analytics_views.py:608-609`: `ai_provider` ghi thẳng vào field `choices` **không validate** ⇒ lưu được `"foobar"`, rồi runtime rơi vào nhánh `else` (OpenAI).
- `:665-669` `temperature`: `except (TypeError, ValueError): pass` ⇒ nuốt lỗi, hành vi khác hẳn 3 field kia (đều `raise ValidationError`).
- `ai_model` `max_length=64` không kiểm tra ⇒ payload dài gây 500 DB error.
- **Fix:** validate `ai_provider in UserAICredential.ProviderChoices`, `len(ai_model) <= 64`, `temperature` raise ValidationError thay vì `pass`.
</details>

<details><summary><b>F-18 · Không optimistic lock ⇒ 2 phiên sửa đè nhau</b> <code>RISK</code></summary>

PUT ghi đè không kiểm tra phiên bản. Đã có pattern chuẩn trong repo: `SocDataOpsConfigSection` + `expected_updated_at` → 409 `CONFIG_CONFLICT` (Entry 121 C5). AI Command Center chưa dùng.
</details>

<details><summary><b>F-19 · Agent registry không có hiệu lực; tab Agents là CRUD chết</b> <code>RISK</code></summary>

`grep AgentRegistry` toàn backend: chỉ khớp trong `ai_agents` (models/views/serializers/urls/tests) + `settings.py:90` + `db_router.py:34`. **Không runtime nào đọc.** Đăng ký agent không ảnh hưởng gì. Ngoài ra `ops_audit/tasks.py:139` map `/core/v1/ai-agents/` — sai path thật là `/core/v1/ai/agents/`.
</details>

<details><summary><b>F-20 · Không có capability gating thật dù ability đã cấp</b> <code>RISK</code> · security</summary>

`helpers.py:155` cấp `{'action':'manage','subject':'system.ai_command_center.manage'}` cho staff/INTERNAL, nhưng `PortfolioAICommandCenterView/TestView/RollbackView/AuditLogView` đều chỉ `permission_classes = [IsAuthenticated]`. Ability không bao giờ được kiểm tra. Kết hợp F-04/F-05: user thường đọc được log toàn hệ thống và probe SSRF.
</details>

<details><summary><b>F-21 · Hai trang con mất hub nav và tiêu đề trang</b> <code>RISK</code> · UX</summary>

`AIUsageAnalyticsPage.tsx` và `AIAgentFederationPage.tsx` chỉ có 1 back-link, không có `<h1>`, không có tab bar 5 tab. Người dùng phải quay lại hub để đổi tab. Hub có 5 tab nhưng chỉ 1 trang hiện tab bar.
</details>

<details><summary><b>F-22 · Bộ kiểm thử "contract" là tautology — không thể phát hiện drift thật</b> <code>RISK</code></summary>

- `__tests__/ai-cc-contract-smoke.component.test.ts` so 6 assertion giữa **các fixture hardcode trong chính file test** (`BE_CC_GET_KEYS` vs `FE_CC_PUT_KEYS`). Không đọc code BE, không đọc adapter, không gọi API ⇒ **luôn pass**, kể cả khi F-01/F-02 đang hỏng.
- `ai-cc-form-parity.component.test.ts` chỉ grep source (đúng phần field drift, nhưng không cover contract).
- `ai-cc-i18n-parity.component.test.ts` so key-set vi vs en cho 3 namespace — phần này **thật**, nhưng không cover `promptConfig` và không phát hiện key thiếu hoàn toàn.
- **Fix:** sinh fixture từ OpenAPI/schema BE, hoặc 1 integration test đọc response thật; thêm gate "mọi `t()` literal phải tồn tại trong cả 2 locale".
</details>

### P2

<details><summary><b>F-23 · Nhãn quota ngược nghĩa: bar là "còn lại", chữ là "đã dùng"</b></summary>

`AICommandCenterPage.tsx:288-297`: `width = remaining/max` nhưng nhãn `${remaining} ${t('quotaUsed')} / ${max} ${t('quotaUsed')}` với `quotaUsed = 'lượt'`. Ảnh 3 hiện "5 lượt / 5 lượt" — không đọc được là còn hay đã dùng. Thiếu đếm ngược tới giờ reset, nguồn quota, lịch sử tiêu thụ.
</details>

<details><summary><b>F-24 · <code>_log_test</code> ghi sai trạng thái vào audit</b></summary>

`portfolio_analytics_views.py:862`: `'success' if 'SUCCESS' in audit_action else 'failed'` — `audit_action` là `'test_connection_success'` (chữ thường) ⇒ luôn `'failed'`. Dùng `audit_action == AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS`.
</details>

<details><summary><b>F-25 · <code>ai_config_message</code> không bền vững</b></summary>

GET trả "…đang phản ánh cấu hình hiệu lực của hệ thống." (`:537`), PUT trả "…đã được cập nhật thành công." (`:749`) nhưng **không ghi vào `metadata`** ⇒ reload là mất. Message thành trạng thái ảo.
</details>

<details><summary><b>F-26 · Chi phí hiển thị USD trong sản phẩm VND, làm tròn không nhất quán</b></summary>

`AIUsageDashboard.tsx:206` `toFixed(4)` cho tổng vs `:334, 87` `toFixed(6)` cho dòng; `:204-205, 328, 332-333` dùng `.toLocaleString()` không locale (nên dùng `formatNumber(n, localeTag)`). Không có `formatCurrency` của app trong khi `i18n/index.js:62` đã có sẵn.
</details>

<details><summary><b>F-27 · Export CSV không chặn trên, thiếu mũ tên BOM kiểm chứng</b></summary>

`AIUsageDashboard.tsx:175-185` vòng `for(;;)` batch 100 không giới hạn ⇒ total lớn sẽ bắn hàng chục request tuần tự. Pattern SOC đã có cap 5000 + cờ `truncated` (`advisoryExport.js`, Entry 88/Entry 215 S13).
</details>

<details><summary><b>F-28 · Filter "Mô hình" chỉ lấy option từ trang hiện tại</b></summary>

`AIUsageDashboard.tsx:263` `[...new Set(records.map(r => r.model))]` ⇒ không chọn được model không nằm ở trang hiện tại. Cần endpoint distinct-values hoặc dùng danh sách model từ CC config.
</details>

<details><summary><b>F-29 · Trang shell song song là dead code + 3 metric placeholder</b></summary>

`ShellAiCommandCenterPage.tsx:131-133` `renderShellMetric("AI Provider","…")`, `("AI Model","…")`, `("Runtime Ready","…")`. Không route (`main.tsx`), không link, chỉ `index.js:21` re-export + `check-shell.mjs:454` (script không chạy được). 20 eslint warning `jsx-no-literals` trong file này.
</details>

<details><summary><b>F-30 · Panel agent: nhãn sai, notice không tự tắt, kiểu dữ liệu nói dối</b></summary>

- `AIAgentFederationPanel.tsx:253` hiện `t('aiAgentFederation.loading')` ("Đang tải…") khi đang **lưu**, trong khi `aiAgentFederation.saving` đã tồn tại.
- `:155-159` notice dùng `onClick` + `cursor:pointer` để đóng thay vì nút close, và không có timeout tự tắt (khác `AICommandCenterPage` dùng 3s).
- `capabilities` khai báo `string[]` nhưng input là string → union `[key:string]: unknown` che lỗi; `handleSubmit` phải split thủ công.
- Default `provider:"openai", model:"gpt-4o-mini"` hardcode, lệch `PROVIDER_MODELS` (đã đổi thứ tự, `gpt-4.1` đứng đầu).
</details>

<details><summary><b>F-31 · Drawer: preset làm mất <code>version</code>, không reset khi mở lại</b></summary>

`AIAdvisoryPromptConfigDrawer.js:175` `setLocalConfig(presetConfig)` — `PRESET_CONFIGS` không có `version: 2`. `useEffect:41-49` chỉ sync khi `config` truthy ⇒ mở lại drawer sau khi preset đã chọn có thể hiện config server cũ.
</details>

<details><summary><b>F-32 · Drawer & usage: thiếu a11y cơ bản</b></summary>

Drawer: overlay là `div onClick` (`:204`), không `role="dialog"`, không `aria-modal`, không đóng bằng Esc, không focus trap, không khoá scroll body. Usage: `<label>` không `htmlFor`, `<table>` không `caption`/`scope`.
</details>

### P3

<details><summary><b>F-33 · Bảng model hardcode, không lấy danh mục thật</b></summary>

`providerModels.ts` liệt kê 6 provider × danh sách model cố định. Không có `GET /v1/models` cho provider cloud (chỉ `local` có ở `view:876-889`).

**Về `gemini-3.8-flash` — mức độ chắc chắn (đính chính 2 lần, bản audit đầu diễn đạt quá):**
- **Đây là model của Google**, GA, có thật. Nó xuất hiện trong catalog Copilot vì Copilot là **gateway đa nhà cung cấp** (cũng phục vụ model của OpenAI, Anthropic, xAI, Moonshot) — **không có nghĩa Copilot sở hữu model này**.
- **Chưa xác minh:** endpoint Google trực tiếp `generativelanguage.googleapis.com/v1beta/openai/chat/completions` có nhận đúng ID `gemini-3.8-flash` không. Entry 204 F6b ghi *"blocked proxy test"* ⇒ **chưa từng ai probe**.
- **Mỗi gateway có bộ model ID riêng.** Bằng chứng: `api.githubcopilot.com` đã từng **không** phục vụ các ID cũ (`claude-sonnet-4.5`, `claude-opus-4`, `gpt-5`, `o3-mini`); kiến trúc alias `openai/gpt-4.1-mini` có sẵn ở `ADVISORY_OBSERVABILITY_ARCHITECTURE.md:154`.
- ⇒ Bản audit đầu viết *"có thể không tồn tại"*. **Kết luận đúng là "chưa ai probe"** — không phải sai, cũng không phải đúng. Sửa thành tiêu chuẩn nghiệm thu: probe **cả hai** endpoint, dán kết quả thật. Nếu Google trực tiếp không có mà Copilot có thì **giữ model**, gắn nhãn "chỉ dùng qua provider Copilot".

**Với Copilot thì hardcode là sai tuyệt đối**, không phải chỉ "nên cải thiện": tài liệu GitHub nêu rõ danh mục phụ thuộc *"subscription, org membership, and feature flags"* theo tài khoản, có bảng riêng "Supported AI models per Copilot plan". Hardcode 30+ model ⇒ user thấy model họ **không có quyền dùng**, chọn xong mới nhận lỗi.

Thiếu capability matrix (context window, giá, streaming, vision) ⇒ user không biết model nào phù hợp cho context dài.
</details>

<details><summary><b>F-34 · Không có model failover / retry / circuit breaker ở tầng provider</b></summary>

`orchestrator.py:235-250` `asyncio.gather` 3 sub-agent, một fail là fail cả. Không retry backoff, không timeout riêng theo sub-agent (đều 30s), không circuit breaker. Provider lỗi 1 lần ⇒ cả advisory fail. Với provider có **session token ngắn hạn** (Copilot ~25 phút) cần xử lý riêng: token hết hạn **không được tính là lỗi để retry 3 lần** — phải refresh 1 lần rồi retry, nếu không mỗi 401 sẽ nhân 3.
</details>

<details><summary><b>F-35 · Không lưu prompt/response, không trace, không eval, không feedback loop</b></summary>

`AdvisoryRecord` lưu `structured_output` + text, nhưng không có `trace_id`, không lưu prompt gốc, không lưu token usage per-call, không có cơ chế user đánh giá (thumbs up/down) để cải thiện prompt về sau. Không có PII redaction.
</details>

<details><summary><b>F-36 · System prompt template chỉ đọc, nền hardcode tối</b></summary>

`AICommandCenterPage.tsx:313-340` hiển thị `SystemAISettings.prompt_template` read-only, không sửa được (không có API); `:334` `background: "rgba(4, 11, 35, 0.45)"` hardcode tối ⇒ light mode vẫn tối. Đây là prompt **hệ thống** (`ai_settings.prompt_template`), còn `metadata['technical_agent_prompt']` / `flow` / `sentiment` / `synthesis` (`orchestrator.py:140-143`) — 4 prompt thật sự dùng — **không hiển thị ở đâu cả**.
</details>

<details><summary><b>F-37 · Không có kiểm soát phiên bản cho SystemAISettings</b></summary>

`GET` tự tạo `SystemAISettings` nếu chưa có (`:404-418`, lặp lại y hệt ở PUT `:552-566`) — 2 lần lặp 15 dòng. Không có admin UI quản lý system config, không có diff/rollback cho system settings.
</details>

<details><summary><b>F-38 · <code>/settings</code> không liên kết tới <code>/settings/ai</code></b></summary>

`UserSettingsPage.tsx` render `BrokerSettingsSection` / `DNSECredentialsSection` nhưng không có link tới AI Command Center. Người dùng phải tự tìm trong sidebar. IA không nhất quán với kỳ vọng "Cài đặt" là một trung tâm.
</details>

---

## E. QUALITY GATES AUDIT

| Gate | Lệnh | Kết quả | Nhận xét |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` | ✅ **exit 0** | Sạch |
| Lint (9 file AI CC) | `npx eslint src/pages/AICommandCenterPage.tsx …` | ⚠ **0 errors, 20 warnings** | Toàn bộ warning ở `ShellAiCommandCenterPage.tsx` (trang chết) + 1 `no-unused-vars` (`SOURCE_KEYS` trong drawer) |
| Unit test AI CC | `npx vitest run …4 file` | ✅ **4 files / 21 tests PASS** | Nhưng xem F-22: contract test là tautology |
| `check:shell` (thật) | `npm run check:shell` | ✅ **exit 0** | = dom-landmarks + tokens + stock-detail-shell + admin-spa-routes + contrast + i18n:scan. **0 dòng nào chạm AI CC** (grep xác nhận) |
| `check:tokens` | | ✅ 72 hex allowlist, 0 vi phạm | Chỉ quét `.css`. Hex trong TSX inline-style **không bao giờ** bị bắt |
| `check:contrast` | | ✅ 7 cặp tone × 2 mode ≥ 4.5:1 | Chỉ đo 7 token tone, không đo text thực tế của trang |
| `check:shell:legacy` | `npm run check:shell:legacy` | ❌ **exit 1 — CRASH** | `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"` — script import thẳng `.tsx`/`.css` trong node thuần. **1341 dòng assert AI CC không bao giờ chạy** |
| `i18n:scan` | | ✅ exit 0, idempotent | Chỉ quét literal `t('x')`; **không** verify key tồn tại → F-09 lọt |
| i18n parity | script riêng | ✅ vi=en cho 4 namespace (128/128, 19/19, 30/30, 36/36) | Nhưng `aiCommandCenter.loadError` thiếu ở **cả hai** → parity vẫn xanh |
| Test BE | `pytest tests/test_ai_*.py` | ⚠ **không chạy được** | `ImproperlyConfigured: DJANGO_ALLOWED_HOSTS` → set env → `71 errors` (không kết nối được Postgres). **Trạng thái gate BE = CHƯA XÁC MINH**, không phải PASS |

**Kết luận gates:** tsc + unit test sạch, nhưng **gate không kiểm tra được phần lớn rủi ro đã tìm ra**. Không có gate nào bắt được: config không dùng, shape mismatch, cross-tenant, SSRF, thiếu i18n key, hex trong TSX. Đây là "khoảng trống assurance" cần đóng cùng Wave 1.

---

## F. SO SÁNH VỚI SẢN PHẨM THƯƠNG MẠI

Nguồn: tài liệu chính thức LiteLLM (routing-load-balancing, router settings, auto router), OpenRouter + Portkey (so sánh budget/limit), LiteStar Gateway (mô hình admin console tham chiếu).

| Năng lực | LiteLLM | Portkey | OpenRouter | **VNInvest `/settings/ai`** |
|---|---|---|---|---|
| Nhiều deployment / model alias | ✅ virtual model | ✅ integration alias | ✅ model slug | ❌ 1 provider + 1 model |
| **Fallback chain khi provider fail** | ✅ theo key/team | ✅ | ⚠ không tài liệu | ❌ không có |
| **Health check định kỳ + auto-evict** | ✅ | ✅ | — | ❌ |
| Chiến lược routing (latency/cost/least-busy) | ✅ + **decision observability** | ✅ | ✅ `provider.max_price` | ❌ |
| **Budget theo cost (USD)** + soft/hard | ✅ `max_budget`, `soft_budget`, reservation | ✅ cost hoặc token | ✅ `limit` + `limit_reset` | ❌ **chỉ budget theo token** |
| Phân tầng budget (org/team/key/model) | ✅ | ✅ | ✅ | ❌ chỉ 1 mức env |
| Fallback về model rẻ khi hết budget | ✅ `budget_fallbacks` | ❌ | ❌ | ❌ |
| **Retry / timeout / cooldown theo key** | ✅ | ✅ | — | ❌ không retry |
| **Observability: token/cost/latency theo model** | ✅ dashboard | ✅ | ✅ | ❌ **bảng rỗng** (F-07) |
| **Trace / eval / feedback loop** | ✅ (MLflow, datasets) | ✅ logs+traces | — | ❌ |
| **Test connection kiểm chứng thật** | ✅ per model group + "Test Routing" | ✅ | — | ⚠ có, nhưng endpoint sai cho claude/copilot + SSRF |
| **Danh mục model động** | ✅ đọc từ proxy | ✅ | ✅ | ❌ hardcode |
| **Key rotation + scope tách** | ✅ rotation + scope | ✅ | — | ❌ chỉ Fernet, không lịch xoay, không scope |
| **Audit append-only theo tenant** | ✅ | ✅ | ✅ | ❌ **không tenant, đọc `.objects.all()`** |
| **SSRF guard trên endpoint người dùng nhập** | ✅ | ✅ ("SSRF-guarded webhooks") | — | ❌ |
| **Phân quyền theo vai trò/plan** | ✅ key/team | ✅ workspace policy | ✅ member budget | ❌ ability cấp nhưng không enforce |
| **Diff preview + optimistic lock khi lưu** | ✅ | — | — | ❌ (SOC có, AI CC không) |
| **Export CSV** | ✅ | ✅ | ✅ | ⚠ usage có, audit log không |
| **Alert khi vượt ngưỡng (email/webhook)** | ✅ 85%/95% + webhook | ⚠ email, "in progress" cho policy | ⚠ email-only | ❌ chỉ banner trong trang advisory |
| **A/B / canary / shadow routing** | ✅ shadow mode | — | — | ❌ |
| **Data residency / region pinning** | ✅ | ⚠ | ✅ | ❌ |
| Hạ tầng/ops: dashboard role-aware, org/team tree | ✅ | ✅ | ✅ | ❌ phẳng, per-user |

**Điểm mạnh thực sự của VNInvest** (nên giữ và mở rộng):
- BYOK per-user + Fernet encryption + mask `••••••••last4` + nút xoá key — đúng hướng, tốt hơn nhiều so với key dùng chung.
- 4 preset prompt config có tên dễ hiểu (Cân bằng / Ưu tiên dòng tiền / Chuyên sâu / Tiết kiệm token).
- Lịch sử prompt config có version + rollback + audit — có bằng chồng cho backward compat.
- Kiểm tra kết nối **probe thật** thay vì chỉ validate form.
- Fallback quota theo ngày với thông báo hết hạn mức rõ ràng.

**Khoảng cách cần đóng theo thứ tự ưu tiên:** (1) contract & an toàn → (2) instrument dữ liệu → (3) routing/failover/budget → (4) observability & eval → (5) governance đa tenant.

---

## G. ĐỀ XUẤT NÂNG CẤP

### R0 — Sửa sai lệch & an toàn (P0, ~2.5 ngày) — **tuần tự tuyệt đối**

| Mã | Nội dung | File chính | AC |
|---|---|---|---|
| R0.1 | `effective_context['ai_model']` lấy từ `user_cred.ai_model`; `effective_ai_model` cùng nguồn | `advisory/views.py:431` | test: model user lưu được truyền xuống task |
| R0.2 | Default `ai_prompt_config` dùng `_get_default_prompt_config()`; validate shape trước khi persist (400 nếu sai) | `portfolio_analytics_views.py:425-439`, `:630-636` | test: PUT shape phẳng → 400; GET trả `{version, sources}` |
| R0.3 | FE chỉ gửi `ai_prompt_config` khi drawer dirty | `AICommandCenterPage.tsx:97,269`, `AICommandCenterForm.tsx:296` | test: Save không mở drawer không gửi field |
| R0.4 | Gộp 4 default về 1 nguồn BE; xoá `lookback_unit` chết; endpoint read-only cho FE | `advisory_helpers.py`, `AIAdvisoryPromptConfigDrawer.js:22`, `useAIAdvisor.js:38` | grep: không còn literal `dark_flow` ngoài SSOT |
| R0.5 | `AIAuditLog` + `user`/`tenant` FK, scope mọi view; `actor` exact | `advisory/models.py:303`, `portfolio_analytics_views.py:1007` | test 2 user + 2 tenant isolation |
| R0.6 | `validate_outbound_endpoint()` (scheme/host/IP/DNS-rebind) + throttle `ai_test_connection` + bỏ echo endpoint + bỏ raw `str(e)` | `portfolio_analytics_views.py:876-908`, `orchestrator.py:196` | test SSRF 169.254/127.0.0.1/::1/file:// bị chặn |
| R0.7 | Bỏ `claude`/`copilot`/`openclaw` khỏi UI **hoặc** implement adapter thật; `ai_ready` = probe thật có TTL | `providerModels.ts:26-57`, `portfolio_analytics_views.py:490,725,867` | test: mỗi provider trong UI probe đúng endpoint |
| R0.8 | Instrument `AIUsageRecord` trong `tasks.py`/`orchestrator`; gỡ `POST /ai/usage/` | `ai_analytics/views.py:68`, `advisory/tasks.py:65-80` | test: 1 refresh → 1 usage record; POST → 403 |
| R0.9 | Enforce `system.ai_command_center.manage` hoặc thống nhất chính sách staff-only giữa menu/BE nav/API | `sidebaritems.ts:36`, `helpers.py:188`, view `permission_classes` | test: user thường → 403 trên cả 4 endpoint |

### R1 — Nền tảng thiết kế & trung thực trạng thái (P1, ~3 ngày)

| Mã | Nội dung | AC |
|---|---|---|
| R1.1 | Chuyển `--ai-*` ra `:root`; giữ override `:root[data-theme="light"]` | test CSS + visual QA light/dark 3 route |
| R1.2 | Bỏ `ShellAiCommandCenterPage` + entry `shell-ai-command-center`; sửa assert `check-shell.mjs:150`; `check:shell` thật sự chạm AI CC | `check:shell` không còn "0 coverage" |
| R1.3 | Bổ sung gate mới `check:ai-cc`: tồn tại mọi `t()` literal ở cả 2 locale + 0 key chết + FE↔BE schema sinh từ fixture thật | fail khi xoá 1 key i18n |
| R1.4 | Skeleton theo shape thật; `isDirty` + `beforeunload`; `clearTimeout`; audit panel dùng `refresh()` thay vì remount | test: click Save không mất filter audit |
| R1.5 | Filter `model`/`status` áp đồng nhất cho records/summary/aggregate | test: `aggregate.total_requests == tổng bảng đã lọc` |
| R1.6 | `useRetryableAsync`: `AbortController` + `requestId` + cleanup `mountedRef` | test: đổi filter 2 lần trong 100ms → khớp filter cuối |
| R1.7 | Migrate `AIAuditLogsPanel` sang token; `<button aria-expanded>`; thêm Refresh + Xuất CSV (cap 5000) | visual QA light mode; a11y smoke pass |
| R1.8 | Validate PUT: `ai_provider ∈ choices`, `len(ai_model) ≤ 64`, `temperature` raise thay vì `pass` | 4 test 400 |
| R1.9 | `expected_updated_at` → 409 `AI_CONFIG_CONFLICT` (copy pattern SOC C5) | test 2 phiên sửa |
| R1.10 | Chart + system-prompt viewer dùng token, có light mode + bảng số thay thế | visual QA light mode |
| R1.11 | i18n: thêm `aiCommandCenter.loadError`, xoá 18 key chết, bỏ mọi `\|\| "fallback"`, i18n hoá provider/agent labels | gate R1.3 xanh |

### R2 — Đa deployment, failover, budget theo cost (P1.5, ~5 ngày)

| Mã | Nội dung | AC |
|---|---|---|
| R2.1 | Model `AIDeployment` (provider, model, credential ref, weight, enabled) + `AIFallbackChain` | migration + CRUD |
| R2.2 | `get_ai_client(provider)` factory thật (C3 đã đề xuất ở Entry 203) — adapter OpenAI/Gemini/Anthropic/Local/Bedrock | unit test từng adapter với response fixture |
| R2.3 | `AIHealthCheck` + task định kỳ, auto-evict deployment lỗi khỏi pool, cooldown | task test |
| R2.4 | `AICostRate` (model → USD/1K token) + snapshot hằng ngày | migration |
| R2.5 | Budget 3 mức: org / user / model, theo **cost** và **token**; soft 80% (cảnh báo) + hard 100% (429) — giống Portkey 412-vs-429 | test biên 79/80/99/100% |
| R2.6 | Retry exponential backoff + circuit breaker per deployment trong `orchestrator` | test 3 lần 503 rồi thành công |
| R2.7 | Danh mục model động: `GET /ai/providers/<p>/models` proxy provider; cache 24h; UI dropdown "Tải lại danh mục" | test contract |
| R2.8 | Diff preview + optimistic lock UI (copy `SocConfigPreviewModal`) | visual QA |

### R3 — Observability & eval (P1.5, ~5 ngày)

| Mã | Nội dung | AC |
|---|---|---|
| R3.1 | `AITrace` (trace_id, user, symbol, provider, model, sub-agent, prompt/response hash, tokens, latency, status, error_code) | 1 advisory = 4 trace (3 sub + 1 synthesis) |
| R3.2 | Trang "Traces" cạnh Usage: waterfall sub-agent, diff prompt theo version, filter theo symbol/model/status | visual QA |
| R3.3 | Dashboard LLM SLO: p50/p95/p99 latency, success rate, tokens/ngày, $/ngày, cost/mã | chart dùng token |
| R3.4 | Feedback loop: thumbs up/down + lý do trên advisory → `AIFeedback` → báo cáo tỉ lệ theo prompt version | test ghi/nhận |
| R3.5 | Alert: email/webhook khi budget 80%/100%, provider fail ≥ N lần, p95 vượt ngưỡng (nối `ops_audit`/SOC alert sẵn có) | test dispatch |
| R3.6 | PII redaction + prompt-injection guard ở tầng orchestrator trước khi gửi prompt | test regex + heuristic |

### R4 — Governance đa tenant (P2, ~3 ngày)

| Mã | Nội dung | AC |
|---|---|---|
| R4.1 | Trang **Tenant Admin → AI Policy**: admin đặt policy/giới hạn cấp tenant, user chỉ override trong trần | test 2 tenant không chạm |
| R4.2 | Key scope: `inference` vs `management`; lịch xoay key (Fernet key version) | test key rotation |
| R4.3 | `AIAuditLog` append-only + retention + export CSV theo tenant | test export |
| R4.4 | `/settings/ai` vào `UserSettingsPage` dưới dạng mục con (IA nhất quán) | visual QA |
| R4.5 | 5 tab hub nav dùng chung cho cả 3 route (thêm `AiHubNav` component) | test active state |

### R5 — Đóng tab chết / dọn nợ (P2, ~1.5 ngày)

| Mã | Nội dung |
|---|---|
| R5.1 | Nối `AgentRegistry` vào orchestrator **hoặc** gỡ tab Agents + model + migration khỏi settings INSTALLED_APPS. Hiện đang CRUD chết. |
| R5.2 | Sửa `ops_audit/tasks.py:139` path `/core/v1/ai/agents/` |
| R5.3 | Hiển thị + sửa 4 system sub-agent prompt (`orchestrator.py:140-143`) — hiện vô hình nhưng quyết định chất lượng |
| R5.4 | Tách `PortfolioAICommandCenterView` 380 dòng thành service + serializer, loại 2 khối response lặp |
| R5.5 | Bỏ `metadata['ai_config_message']` khỏi contract; trả `ai_ready` + `ai_readiness_reason` có cấu trúc thay vì chuỗi tự do |

### Ưu tiên thực thi

```
R0 (P0, tuần tự)  →  R1 (nền tảng design/i18n/gate)  →  R2 (failover+budget)
   →  R3 (observability)  →  R4 (governance)  →  R5 (dọn nợ)
```

R0.1-R0.3 nên đi cùng nhau vì cùng chạm `effective_context`/prompt contract. R0.9 cần quyết định sản phẩm trước: **AI CC là user self-service (ai-advisory đã là paid-plan) hay staff-only?** Hiện menu nói user, BE nav nói staff, API nói user — phải chọn một và cả 3 khớp.

---

## H. CÂU HỎI CẦN LÀM RÕ

1. **AI Command Center là self-service hay admin-only?** Quyết định này thay đổi R0.5, R0.9 và toàn bộ R4. Bằng chứng hiện tại mâu thuẫn 3 chiều.
2. **`gemini-3.8-flash` có thật không?** Nếu không, cả dropdown FE (`providerModels.ts:18`), migration `0008`, và DB hiện tại đều sai; Entry 204 đã ghi F6b "blocked proxy test".
3. **Có dự định dùng OpenClaw làm provider thật không?** Nếu không, gỡ khỏi UI ngay (hiện nó làm hỏng advisory production).
4. **Ai là người vận hành `SystemAISettings`?** Không có admin UI; sửa bằng Django admin + DB?
5. **`AI_FALLBACK_DAILY_QUOTA=5` là chính sách cố ý hay placeholder?** 5 lượt/ngày là rất thấp cho sản phẩm thương mại.
6. **Có sẵn bảng giá model để tính cost không?** R2.4 cần nguồn giá (OpenRouter API, LiteLLM `model_prices.json`, hay hardcode).
7. **Bao giờ chạy được test BE?** 4 file test AI CC hiện không verify được do thiếu DB — cần chạy trên container `core-api` hoặc host `.venv` như các entry trước.

---

## I. ĐÁNH GIÁ TỔNG THỂ

| Tiêu chí | Điểm (thang 10) | Căn cứ |
|---|---|---|
| Chức năng đúng (contract end-to-end) | **3** | F-01, F-02, F-03 |
| An toàn & multi-tenant | **2** | F-04, F-05, F-07, F-20 |
| UI/UX & information density | **4** | F-08, F-11, F-16, F-21; nhưng layout sạch, panel rõ ràng |
| Nhất quán design system & light mode | **3** | F-08, F-13, F-14, F-15, F-36 |
| i18n | **4** | 18 key chết, 1 key thiếu, ~15 chuỗi VI hardcode |
| Khả năng mở rộng (failover/budget/obs) | **2** | Không routing, không cost budget, không trace |
| Chất lượng test & gate | **4** | 21 test xanh nhưng contract test là tautology; `check:shell` không chạm AI CC; `check:shell:legacy` crash; test BE chưa verify được |
| **Tổng** | **3.1** | |

**Kết luận:** `/settings/ai` **chưa đạt chuẩn thương mại** và hiện **nguy hiểm ở production** (rò rỉ cross-tenant + SSRF + mất cấu hình âm thầm). Ưu tiên tuyệt đối là R0 — không có ý nghĩa đầu tư UI/UX trước khi F-01…F-05 đóng, vì mọi thứ đang hiển thị có thể không phản ánh cấu hình thật. Sau R0 + R1, mức hiện tại (~3/10) có thể lên 6/10; đạt ngưỡng "AI gateway thương mại" cần đủ R2 + R3.

---

## PHỤ LỤC — BẰNG CHỨNG

### P.1 Lệnh gate đã chạy

```
npx tsc --noEmit                                     → exit 0
npx eslint <9 file AI CC>                            → 0 errors, 20 warnings
npx vitest run <4 file AI CC>                        → 4 files / 21 tests PASS
npm run check:shell                                  → exit 0
npm run check:tokens                                 → PASS (72 allowlisted hex)
npm run check:contrast                               → PASS (7 tone × 2 mode)
npm run check:shell:legacy                           → exit 1 (ERR_UNKNOWN_FILE_EXTENSION ".css")
npm run i18n:scan                                    → exit 0, idempotent (hash không đổi)
pytest tests/test_ai_{management_center,cc_config_isolation,cc_prompt_history,audit_logs}.py
                                                     → 71 errors (không kết nối được DB) — CHƯA XÁC MINH
```

### P.2 Grep chứng minh (không suy đoán)

| Khẳng định | Lệnh | Kết quả |
|---|---|---|
| Không ai ghi `AIUsageRecord` | `grep -r "ai_analytics\|AIUsage" packages/core/backend/src` | chỉ khớp trong `ai_analytics/*`, `settings.py:91`, `db_router.py:35`, `urls.py` |
| Không ai đọc `AgentRegistry` | `grep -r "AgentRegistry\|ai_agents" packages/core/backend/src` | chỉ trong `ai_agents/*`, `settings.py:90`, `db_router.py:34`, `ops_audit/tasks.py:139` |
| `--ai-*` chỉ khai báo trong `.page` | `grep -n -- "--ai-ink\s*:" src/**/*.css` | đúng 1 kết quả: `aiSettings.module.css:52` (trong `.page` mở ở `:51`) |
| `AICommandCenterPage` không dùng `.page` | đọc `AICommandCenterPage.tsx:167` | `className: "shellPage " + className` |
| `check:shell` không chạm AI CC | `grep "aiSettings\|AICommandCenter\|ai-command" scripts/check-{tokens,dom-landmarks,contrast,stock-detail-shell,admin-spa-routes}.mjs` | 0 kết quả |
| `check-shell.mjs` assert sai | `pageRegistry.js:183-184` vs `check-shell.mjs:150` | registry → `AICommandCenterPage`; assert đòi `ShellAiCommandCenterPage` |
| `aiCommandCenter.loadError` thiếu | script so key dùng vs key khai báo trong `vi.js`/`en.js` | `MISSING_VI(1): aiCommandCenter.loadError` / `MISSING_EN(1)` |
| 18 key chết | script so toàn repo vs khai báo | `UNUSED_aiCommandCenter_KEYS(18)` |
| `check-tokens` không quét TSX | `scripts/check-tokens.mjs` `collectFiles` | `else if (p.endsWith(".css") || p.endsWith(".module.css"))` |
