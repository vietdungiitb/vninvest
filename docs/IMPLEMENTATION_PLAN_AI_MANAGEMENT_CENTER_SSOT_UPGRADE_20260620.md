# KẾ HOẠCH THỰC HIỆN: NÂNG CẤP AI MANAGEMENT CENTER LÊN SSOT QUỐC TẾ

## 1. Tổng quan

Nâng cấp phân hệ **AI Command Center** thành **AI Management Center** — trung tâm quản trị AI tập trung duy nhất (SSOT) cho toàn hệ thống VNInvest, tuân thủ kiến trúc SaaS native, loại bỏ hoàn toàn phụ thuộc legacy.

### Mục tiêu chiến lược

| # | Mục tiêu | Mô tả |
|---|----------|-------|
| 1 | BYOK (Bring Your Own Key) | Người dùng tự cấu hình API key riêng cho provider AI bên thứ ba |
| 2 | Local Model Support | Hỗ trợ Ollama/vLLM/LM Studio qua endpoint tuỳ chỉnh |
| 3 | Hybrid Fallback | User key → System key với quota sao lưu minh bạch |
| 4 | Active Probe | Kiểm tra kết nối thực tế đến provider (không mock, không giả lập) |
| 5 | Usage Observability | Giám sát token consumption, quota, và chi phí |
| 6 | SaaS Native | Chỉ chạm vào `packages/core` và `packages/web` — không legacy |

---

## 2. Phạm vi ảnh hưởng — chỉ SaaS Native

### Backend — `packages/core/backend/`

| File | Action | Mô tả |
|------|--------|-------|
| `src/advisory/models.py` | **THÊM** model `UserAICredential` | Lưu cấu hình AI riêng của user (BYOK) |
| `src/user_workspace/portfolio_analytics_views.py` | **MODIFY** | `PortfolioAICommandCenterView` + `PortfolioAICommandCenterTestView` |
| `src/advisory/views.py` | **MODIFY** | Tích hợp fallback logic + quota vào `AdvisoryRefreshView` |
| `src/advisory/orchestrator.py` | **MODIFY** | Mở rộng routing cho local model, BYOK, fallback flags |
| `src/identity_access/security.py` | **VERIFY** | Đã có Fernet encryption — chỉ verify env var convention |
| `src/advisory/urls.py` | **VERIFY** | Route hiện tại OK, không cần thay đổi |
| `src/advisory/serializers.py` | **THÊM** | `UserAICredentialSerializer` |
| `src/vninvest_core/settings.py` | **THÊM** | `AI_FALLBACK_DAILY_QUOTA` setting |
| `tests/test_advisory_ssot.py` | **THÊM** | Test fallback + BYOK + local model routing |
| `tests/test_advisory_api_routes.py` | **THÊM** | Test quota fallback |

### Frontend — `packages/web/` (KHÔNG chạm `frontend/` legacy)

| File | Action | Mô tả |
|------|--------|-------|
| `src/pages/AICommandCenterPage.js` | **MODIFY** | Thêm `local` provider, `custom_endpoint` field, quota banner |
| `src/adapters/core/workspace.js` | **MODIFY** | Thêm `getFallbackQuota()` endpoint |
| `src/features/stock-detail/components/StockDetailTabs.js` | **MODIFY** | Thêm `AIAdvisoryWarningBanner` vào khu vực advisory |
| `src/components/AIAdvisoryWarningBanner.js` | **THÊM** | Component warning banner tái sử dụng được |
| `src/i18n/vi.js` | **THÊM** | i18n strings mới |
| `src/i18n/en.js` | **THÊM** | i18n strings mới |

---

## 3. Kiến trúc giải pháp

### 3.1 Data Model — `UserAICredential`

```python
class UserAICredential(models.Model):
    """SSOT cho cấu hình AI cá nhân của user. Tuân thủ BYOK."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='ai_credential')
    ai_provider = models.CharField(max_length=32, default='openai')  # openai, gemini, claude, local, openclaw
    ai_model = models.CharField(max_length=64, blank=True, default='')
    encrypted_api_key = models.TextField(blank=True, default='')  # Fernet-encrypted via identity_access.security
    custom_endpoint = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    fallback_quota_used_today = models.IntegerField(default=0)
    fallback_quota_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'AI Credential'
        verbose_name_plural = 'AI Credentials'
```

**Luật**:
- `encrypted_api_key` = rỗng khi provider là `openclaw` (system default)
- `encrypted_api_key` = rỗng khi provider là `local` (không cần key) — dùng `custom_endpoint` để reach Ollama/vLLM
- **Không gửi `Authorization: Bearer ""`** khi gọi local model — Ollama/proxy sẽ trả 401
- `ai_provider` default là `openai` (không phải `openclaw`) vì openclaw là system proxy, không phải user-level
- `fallback_quota_used_today` + `fallback_quota_date` dùng để tracking quota fallback hàng ngày

**Atomic Quota Update**: Dùng `F()` expression để tránh race condition khi user nhấn refresh liên tiếp:
```python
from django.db.models import F
UserAICredential.objects.filter(pk=cred.pk).update(
    fallback_quota_used_today=F('fallback_quota_used_today') + 1,
    fallback_quota_date=today,
)
```

**Migration path từ `UserProfile.preferences` hiện tại**:
- Script `001_add_user_ai_credential.py` + data migration
- Đọc `UserProfile.preferences` → tạo `UserAICredential` nếu chưa tồn tại
- Bọc try-catch với fallback default dict để xử lý preferences rỗng/cấu trúc cũ không hợp lệ
- Giữ nguyên backward compat: `PortfolioAICommandCenterView` ưu tiên đọc `UserAICredential`, fallback sang `UserProfile.preferences`

### 3.2 Hybrid Fallback Flow

```
[ AdvisoryRefreshView ]
        │
    Kiểm tra UserAICredential
        │
    ┌─── Có credential không? ────┐
    │         │                    │
    │        Có                  Không
    │         │                    │
    │   ┌─────▼──────┐      ┌─────▼──────────┐
    │   │ Giải mã key │      │ Dùng System Key │
    │   │ (Fernet)    │      │ (SystemAISettings.metadata)
    │   └─────┬──────┘      └─────┬──────────┘
    │         │                    │
    │   ┌─────▼──────┐            │
    │   │ Gọi API    │            │
    │   │ provider   │            │
    │   └─────┬──────┘            │
    │         │                    │
    │   Thành công? ──Có──► Trả kết quả OK
    │         │
    │       Không (lỗi key)
    │         │
    │   ┌─────▼─────────────────────────────┐
    │   │ Kiểm tra fallback_quota_used_today │
    │   │ < AI_FALLBACK_DAILY_QUOTA (mặc định 5)
    │   └─────┬─────────────────────────────┘
    │         │
    │     ┌───Còn quota?───┐
    │     │                │
    │    Có               Không
    │     │                │
    │  ┌──▼────────┐  ┌───▼──────────────┐
    │  │ Dùng key  │  │ Trả lỗi 429      │
    │  │ hệ thống  │  │ "Hết quota       │
    │  │ + trừ 1   │  │  fallback" +     │
    │  │ quota     │  │ personal_key_error│
    │  └──┬────────┘  └──────────────────┘
    │     │
    │  ┌──▼──────────────────────────────┐
    │  │ Trả kết quả + flags:             │
    │  │ personal_key_failed: true        │
    │  │ using_system_fallback: true       │
    │  │ fallback_quota_remaining: N       │
    │  │ personal_key_error: "..."         │
    │  └─────────────────────────────────┘
```

**Tích hợp với existing quota system**:
- Fallback quota là bổ sung, không thay thế existing plan-based quota (`QuotaRecord`)
- Fallback quota chỉ đếm số lần fallback, không reset `QuotaRecord.api_calls_used`
- `AI_FALLBACK_DAILY_QUOTA` = env var, default 5, có thể cấu hình
- Reset hàng ngày dựa trên `fallback_quota_date != today`
- **Atomic update**: Dùng `F()` expression khi increment counter — tránh race condition trong luồng song song

### 3.3 Local Model Routing

Mở rộng `orchestrator.py` — endpoint resolution:

```python
# Orchestrator endpoint resolution (logic mới)
provider = effective_context.get('ai_provider', 'openai')
custom_endpoint = effective_context.get('custom_endpoint', '')
api_key = effective_context.get('api_key', '')

if provider == 'local':
    if custom_endpoint:
        endpoint = custom_endpoint.rstrip('/') + '/chat/completions'
    else:
        endpoint = "http://localhost:11434/v1/chat/completions"  # Ollama default
elif ai_model.lower().startswith('gemini'):
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
else:
    endpoint = "https://api.openai.com/v1/chat/completions"

# Header logic: chỉ gửi Authorization khi có key thực tế
# Ollama/local trả 401 nếu nhận Bearer ""
headers = {"Content-Type": "application/json"}
if api_key:
    headers["Authorization"] = f"Bearer {api_key}"

# Payload: bỏ response_format cho local model (không hỗ trợ JSON mode)
payload = {
    "model": model,
    "messages": messages,
    "max_tokens": max_tokens,
    "temperature": temperature,
}
if provider != 'local':
    payload["response_format"] = {"type": "json_object"}
```

Khi provider = `local`:
- Cho phép `api_key` rỗng (Ollama không yêu cầu key)
- **Không gửi header `Authorization` khi key rỗng** — Ollama và một số proxy trả 401 nếu nhận `Bearer ""`
- Gửi request đến `custom_endpoint` hoặc fallback localhost
- Nếu kết nối thất bại → fallback sang system key (nếu còn quota)
- Test connection thực tế: gọi `GET {endpoint}/models` verify reachability
- **Không gửi `response_format={"type": "json_object"}`** cho local model — mô hình nhỏ (phi3, tinylama) không hỗ trợ JSON mode, gây lỗi

### 3.4 API Contract — `/workspace/ai-command-center/`

**GET**: Trả về cấu hình hiện tại (giữ nguyên contract hiện tại + thêm):
```json
{
  "ai_provider": "openai",
  "ai_model": "gpt-4o",
  "ai_api_key_configured": true,
  "custom_endpoint": "",
  "ai_ready": true,
  "fallback_quota_remaining": 3,
  "fallback_quota_max": 5,
  "fallback_quota_reset": "2026-06-21",
  "local_providers_available": ["ollama", "vllm", "lm_studio"]
}
```

**PUT**: Như hiện tại + thêm `custom_endpoint` và `fallback_quota_reset`.

**POST `/test-connection/`**: Active probe thực tế:
- `local`: gọi `GET {endpoint}/models` hoặc `POST {endpoint}/chat/completions` với tin nhắn test tối thiểu
- `openai`/`gemini`/`claude`: gọi API thực tế với 1 tin nhắn test, đo latency
- `openclaw`: system default, probe kiểm tra hệ thống còn sống

---

## 4. Kế hoạch thực hiện chi tiết theo Slice

### Slice 1: Backend Model + Data Migration

**Files**: `packages/core/backend/src/advisory/models.py`, `tests/test_advisory_ssot.py`

**Nội dung**:
- Tạo `UserAICredential` model
- Tạo migration `0003_add_user_ai_credential.py` + data migration từ `UserProfile.preferences`
- Tạo `UserAICredentialSerializer` trong `serializers.py`
- Thêm `AI_FALLBACK_DAILY_QUOTA` vào settings (default=5)

**Validation**:
- `python manage.py makemigrations advisory && python manage.py migrate`
- `python manage.py test tests.test_advisory_ssot --keepdb`

### Slice 2: Backend Views — BYOK + Fallback + Active Probe

**Files**: `portfolio_analytics_views.py`, `advisory/views.py`, `advisory/orchestrator.py`

**Nội dung**:
- `PortfolioAICommandCenterView.get()`: ưu tiên đọc `UserAICredential`, fallback sang `UserProfile.preferences`, trả về `fallback_quota_remaining`
- `PortfolioAICommandCenterView.put()`: lưu vào `UserAICredential`, encrypt key qua `identity_access/security.py` (dùng `AI_CREDENTIAL_FERNET_KEY`)
- `PortfolioAICommandCenterTestView.post()`: active probe thực tế cho `openai`, `gemini`, `claude`, `local`; mock probe cho `openclaw`
- `AdvisoryRefreshView`: tích hợp fallback flow (user key → system key → quota check)
- `orchestrator.py`: mở rộng endpoint resolution cho `local` provider, thêm flag `personal_key_failed`, `using_system_fallback`
- Env var convention: dùng `AI_CREDENTIAL_FERNET_KEY` (đã tồn tại trong codebase)

**Validation**:
- `python manage.py test tests.test_advisory_ssot tests.test_advisory_api_routes --keepdb`

### Slice 3: Frontend — AICommandCenterPage

**Files**: `packages/web/src/pages/AICommandCenterPage.js`

**Nội dung**:
- Thêm `local` vào `PROVIDER_MODELS` (mặc định model `custom`):
  ```js
  local: [
    { key: "custom", label: "Mô hình local (Ollama/vLLM/LM Studio)..." }
  ]
  ```
- Thêm `custom_endpoint` input (chỉ hiển thị khi `local` hoặc khi có custom endpoint)
- Khi chọn `local`:
  - Ẩn API Key field (hoặc chuyển thành endpoint URL field)
  - Mặc định endpoint: `http://localhost:11434/v1`
- Thêm `local` vào `providerOptions`:
  ```js
  { key: "local", label: "Local Model (Ollama/vLLM)" }
  ```
- Thêm fallback quota display trong form

**Validation**:
- `cd packages/web && npm run build` (không lỗi)
- Verify UI render đúng trên Chrome

### Slice 4: Frontend — Warning Banner Component

**Files**: `src/components/AIAdvisoryWarningBanner.js`, `src/features/stock-detail/components/StockDetailTabs.js`

**Nội dung**:
- Component `AIAdvisoryWarningBanner`:
  ```jsx
  // personal_key_failed=true → màu hổ phách
  // Message: "⚠️ Khóa API cá nhân đang lỗi. Hệ thống dùng key dự phòng. Còn X lượt."
  // Link: "Cấu hình lại tại AI Command Center"
  ```
- Tích hợp vào `StockDetailTabs.renderGiaoDich()` — render phía trên advisory card
- i18n strings mới:
  ```js
  // vi.js
  aiFallbackBannerTitle: '⚠️ Cảnh báo kết nối AI',
  aiFallbackBannerMessage: 'Khóa API cá nhân của bạn đang gặp lỗi ({error}). Hệ thống đang dùng hạn mức sao lưu. Bạn còn {remaining} lượt trong ngày hôm nay.',
  aiFallbackBannerAction: 'Cấu hình lại tại AI Command Center',
  aiLocalProviderLabel: 'Local Model (Ollama/vLLM)',
  aiCustomEndpointLabel: 'Custom Endpoint URL',
  aiLocalEndpointPlaceholder: 'http://localhost:11434/v1',
  aiFallbackQuotaLabel: 'Lượt fallback còn lại',
  aiFallbackQuotaMax: 'Tối đa',
  aiFallbackQuotaReset: 'Sẽ reset vào',
  ```

**Validation**:
- `cd packages/web && npm run build` (không lỗi)
- Kiểm tra i18n cả tiếng Việt và tiếng Anh

### Slice 5: Tests + Audit + Documentation

**Files**: `tests/test_advisory_ssot.py`, `tests/test_advisory_api_routes.py`, `tests/test_advisory_tasks.py`

**Nội dung**:
- `test_fallback_quota_exhausted`: user key sai → fallback 5 lần → lần 6 bị 429
- `test_fallback_quota_reset`: sau midnight, quota reset về 5
- `test_local_model_routing`: provider=local → endpoint = custom_endpoint hoặc localhost mặc định
- `test_local_model_skips_api_key`: provider=local → cho phép api_key rỗng
- `test_byok_encryption_roundtrip`: key → encrypt → decrypt → match
- `test_active_probe_openai`: giả lập probe đến OpenAI-compatible endpoint
- `test_user_credential_migration`: verify data migration từ UserProfile.preferences
- `test_personal_key_failed_flag`: advisory trả về flag đúng khi fallback
- Update `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- Update `PROGRESS_DASHBOARD.md`

**Validation**:
```powershell
Push-Location packages/core/backend
python manage.py test tests.test_advisory_ssot tests.test_advisory_api_routes tests.test_advisory_tasks --keepdb
Pop-Location
```

---

## 5. Hard Constraints

| # | Constraint | Lý do |
|---|------------|-------|
| 1 | **KHÔNG chạm legacy `frontend/`** | AGENTS.md §3 hard constraint |
| 2 | **KHÔNG chạm legacy `backend/`** | AGENTS.md §3 hard constraint |
| 3 | **Dùng `AI_CREDENTIAL_FERNET_KEY`** — không `VNBROKER_CRYPTO_KEY` | Codebase convention |
| 4 | **`openclaw` không phải default cho UserAICredential** | openclaw là system proxy, user không tự config |
| 5 | **Fallback quota 5/ngày là configurable** | `AI_FALLBACK_DAILY_QUOTA` env var |
| 6 | **Test path: `packages/core/backend/tests/`** — không `advisory/tests/` | Codebase convention |
| 7 | **`coreApiAdapter` là SSOT cho mọi API calls từ packages/web** | AGENTS.md §8 |
| 8 | **Frontend text mới phải có i18n cả tiếng Việt + Anh** | AGENTS.md §8 |
| 9 | **Active probe gọi API thật — không mock** | Yêu cầu production |
| 10 | **KHÔNG viết `except: pass` trong API path** | CORE_API function design constitution |
| 11 | **Không gửi `Authorization: Bearer ""` cho local model** | Ollama/proxy trả 401 |
| 12 | **Atomic quota update với `F()` expression** | Tránh race condition khi refresh nhanh |
| 13 | **Bỏ `response_format=json_object` cho local model** | Model nhỏ không hỗ trợ JSON mode |
| 14 | **Migration script bắt buộc try-catch + default dict** | Preferences rỗng/cấu trúc cũ không làm hỏng migration |

---

## 6. Verification Plan

### Unit Tests

| Test | File | Coverage |
|------|------|----------|
| Hybrid fallback quota | `test_advisory_ssot.py` | User key fail → fallback → quota hết → block |
| Local model routing | `test_advisory_ssot.py` | provider=local → endpoint resolution |
| BYOK encryption | `test_advisory_ssot.py` | Fernet roundtrip, env var convention |
| Active probe | `test_advisory_api_routes.py` | TestConnection thực tế |
| Quota reset | `test_advisory_tasks.py` | Daily reset fallback_quota_used_today |
| Migration | `test_advisory_ssot.py` | Legacy → UserAICredential |

### Manual Smoke Test

1. Mở `https://vninvest.local/settings/ai`
2. Chọn provider `local` — thấy endpoint field mặc định `http://localhost:11434/v1`
3. Chọn provider `openai` — thấy API Key field + có thể test connection
4. Vào Stock Detail → AI Advisory — verify warning banner hiển thị đúng
5. Cấu hình key sai → trigger advisory 6 lần → lần thứ 6 bị chặn

### Production Gates

- [ ] All unit tests PASS
- [ ] `packages/web` build không lỗi
- [ ] i18n strings đầy đủ cả tiếng Việt và Anh
- [ ] Legacy code không bị chạm
- [ ] Fernet key dùng đúng env var `AI_CREDENTIAL_FERNET_KEY`
- [ ] Migration path từ UserProfile.preferences → UserAICredential được verify

---

## 7. Residual Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| User có cả credential trong UserProfile.preferences lẫn UserAICredential mới | Medium | Ưu tiên đọc UserAICredential, fallback → UserProfile.preferences |
| Migration script thiếu edge case (user không có profile) | Low | Script kiểm tra tồn tại trước khi đọc |
| Local model không reachable (Ollama chưa chạy) | Medium | Test connection thực tế + error message rõ ràng |
| Fallback quota không đồng bộ giữa DB và Redis | Low | Quota dùng DB-based (UserAICredential.fallback_quota_used_today) |
| API Key leak qua log | High | `_sanitize_effective_context_for_session` đã redact key |
| Race condition khi refresh nhanh | Medium | Dùng `F()` expression cho atomic increment |
| Local model nhận `Authorization: Bearer ""` → 401 | Low | Không gửi header khi key rỗng |
| Local model không support JSON mode → API error | Medium | Bỏ `response_format` khỏi payload khi provider=local |
| Migration gặp preferences rỗng/cấu trúc cũ | Low | Bọc try-catch + safe defaults trong data migration |
