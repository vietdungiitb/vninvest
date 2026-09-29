# AUDIT ĐỘC LẬP — F6 Proposal (Gemini 3.8 Flash + google-genai SDK)

**Ngày**: 2026-09-24  
**Phạm vi**: 5 kết luận + đề xuất F6a (catalog) + F6b (service layer)  
**Phương pháp**: Đối chiếu từng kết luận → code thực tế `file:line`.

---

## 0. TÓM TẮT

**5/5 conclusions verified CORRECT.** Proposed F6a+F6b is sound but has 2 architectural concerns that need resolution before implementation.

**Verdict**: Proposal implementable. 2 concerns (service-layer necessity, parameter mapping) need team decision.

---

## 1. ĐỐI CHIẾN 5 KẾT LUẬN

| # | Kết luận | Thực tế | File:line | Status |
|---|----------|---------|-----------|--------|
| 1 | `google-genai` chưa trong requirements | **Đúng** — chỉ có `google-auth`, `google-api-python-client` (Gmail) | `requirements.txt:26-27` | ✅ CORRECT |
| 2 | PROVIDER_MODELS.gemini chỉ có 1.5 | **Đúng** — `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-pro`, `custom` | `providerModels.ts:13-18` | ✅ CORRECT |
| 3 | SystemAISettings.ModelChoices chỉ có 1.5 | **Đúng** — `GEMINI_PRO='gemini-pro'`, `GEMINI_FLASH='gemini-1.5-flash'` | `models.py:26-27` | ✅ CORRECT |
| 4 | Không có service layer — Gemini đi proxy OpenAI-compat | **Đúng** — `orchestrator.py:194-195` + `portfolio_analytics_views.py:830-831` dùng `v1beta/openai/chat/completions` | Cả 2 file | ✅ CORRECT |
| 5 | UserAICredential.encrypted_api_key có Fernet encrypt | **Đúng** — `models.py:225` + `portfolio_analytics_views.py:451` | Cả 2 file | ✅ CORRECT |

**Score: 5/5 claims verified.**

---

## 2. PHẢN BIỆN ĐỘC LẬP

### C1 — `UserAICredential.ai_model` không có choices → F6a migration nhẹ hơn dự kiến

- **Mức**: LOW (informational)
- **file:line**: `models.py:224`
- **Thực tế**: `UserAICredential.ai_model = models.CharField(max_length=64, blank=True, default='')` — **không có `choices`**. Trong khi `SystemAISettings.ai_model` có `choices=ModelChoices.choices`.
- **Tác động**: Thêm `gemini-3.8-flash` vào `SystemAISettings.ModelChoices` chỉ cần `makemigrations` cho `SystemAISettings`. `UserAICredential.ai_model` tự động accept mọi string — không cần migration.
- **Fix**: Cập nhật plan F6a: migration chỉ cho `SystemAISettings` model, không cho `UserAICredential`.

### C2 — Proxy endpoint `v1beta/openai/chat/completions` có thể đã hỗ trợ Gemini 3.8 → F6b có thể unnecessary

- **Mức**: MEDIUM (architectural concern)
- **file:line**: `orchestrator.py:194-195`, `portfolio_analytics_views.py:830-831`
- **Thực tế**: Google đã thêm Gemini model support vào OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai/chat/completions`) từ ~2025 Q4. Endpoint này nhận `{"model": "gemini-3.8-flash", "messages": [...]}` — cùng format với OpenAI.
- **Câu hỏi**: F6b (thêm `google-genai` SDK service layer) có thực sự cần thiết không? Nếu proxy endpoint đã hỗ trợ Gemini 3.8:
  - ✅ Thêm `gemini-3.8-flash` vào catalog là đủ (F6a only)
  - ❌ F6b service layer = extra complexity + maintenance burden
  - ⚠️ F6b chỉ cần thiết nếu cần: streaming, function calling, tool use, structured output, Gemini-specific features
- **Đề xuất**: Chạy test: `curl -X POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions -H "Authorization: Bearer AIza..." -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Hello"}]}'` → nếu 200 OK, F6b có thể deferred.

### C3 — `gemini_client.py` lazy import + graceful fallback = OK nhưng cần clarify error handling

- **Mức**: LOW
- **file:line**: proposed `advisory/gemini_client.py`
- **Thực tế**: Lazy import `google.genai` + clear error if package missing = good pattern. But proposal says "fallback: nếu SDK fail → OpenAI-compat path cũ" — **ai chịu trách nhiệm fallback?** Orchestrator? View? Service factory?
- **Tác động**: Nếu không có centralized decision point, fallback logic sẽ phân tán → hard to maintain.
- **Đề xuất**: Thêm `GeminiClientFactory` hoặc `get_ai_client(provider)` trong orchestrator/view để quyết định path dựa trên provider.

### C4 — Parameter mapping Gemini 3.8 ↔ OpenAI format cần explicit

- **Mức**: MEDIUM
- **Thực tế**: 
  - OpenAI format: `temperature`, `top_p`, `max_tokens`, `frequency_penalty`, `presence_penalty`
  - Gemini `generateContent` format: `temperature`, `topP`, `maxOutputTokens`, `candidateCount`
  - Gemini OpenAI-compat endpoint có thể map hoặc không map tất cả parameters
  - User claim: "Gemini 3.8 không hỗ trợ temperature/top_p/frequency_penalty trên một số surface Enterprise" — cần verify với Google docs chính thức
- **Tác động**: Nếu service layer nhận `temperature` từ request nhưng Gemini API không support → 400 error hoặc silent wrong behavior.
- **Đề xuất**: Trong `gemini_client.py`, explicit parameter mapping:
  ```python
  def _map_to_gemini_params(openai_params: dict) -> dict:
      return {
          'temperature': openai_params.get('temperature', 0.7),
          'topP': openai_params.get('top_p', 1.0),
          'maxOutputTokens': openai_params.get('max_tokens', 1024),
          # frequency_penalty, presence_penalty → NOT SUPPORTED in Gemini native API
      }
  ```

### C5 — `requirements.txt` thêm `google-genai` cho F6a-only = premature dependency

- **Mức**: LOW
- **file:line**: `requirements.txt`
- **Thực tế**: User proposal F6a thêm `google-genai>=1.0` vào requirements — nhưng F6a (catalog-only) không import SDK. Thêm dependency mà không dùng = bloat.
- **Đề xuất**: F6a-only: KHÔNG thêm `google-genai` vào requirements. Chỉ thêm khi F6b implemented. Hoặc thêm comment: `# google-genai>=1.0  # F6b: Gemini native SDK (pending)`.

---

## 3. ĐỐI CHIẾN PROPOSAL vs CODE

| Proposal claim | Code hiện tại | Phát hiện |
|----------------|---------------|-----------|
| F6a: `PROVIDER_MODELS.gemini += gemini-3.8-flash` | `providerModels.ts:13-18` chỉ có 1.5 | Safe, just add |
| F6a: `ModelChoices += GEMINI_38_FLASH` | `models.py:26-27` only `gemini-pro`, `gemini-1.5-flash` | Safe migration (choices expansion) |
| F6b: `advisory/gemini_client.py` mới | Không tồn tại | Cần viết |
| F6b: `lazy import google.genai` | Không có | Cần viết |
| F6b: `fallback → OpenAI-compat` | Đang dùng proxy at `orchestrator.py:195` | Fallback path exists |
| F6a: `migration: AlterField choices` | `SystemAISettings.ai_model` có choices | Need migration |
| F6a: `UserAICredential.ai_model` no choices | `models.py:224` CharField | No migration needed |

---

## 4. QUALITY GATES AUDIT

| Gate | Trạng thái | Ghi chú |
|------|-----------|---------|
| `npx tsc --noEmit` | **Chưa chạy** | Phải chạy sau F6a (FE changes) |
| `npm run build` | **Chưa chạy** | Phải chạy |
| `npm run lint` | **Chưa chạy** | Phải chạy |
| `manage.py check` | **Chưa chạy** | Phải chạy sau F6a migration |
| `makemigrations --check` | **Chưa chạy** | Phải chạy — expect new migration for SystemAISettings |
| `pip install google-genai` | **Chưa test** | Package availability cần verify |

---

## 5. CÂU HỎI CẦN CHỊN

1. **F6b cần thiết không?** → Proxy endpoint `v1beta/openai/chat/completions` có thể đã hỗ trợ Gemini 3.8. Test trước khi commit thêm SDK dependency.
2. **Parameter mapping** → `gemini_client.py` cần explicit mapping table (C4).
3. **Fallback ownership** → Ai quyết định "SDK fail → proxy"? Centralized or distributed?
4. **`google-genai` vào requirements ngay?** → F6a-only không cần, thêm comment marker.
5. **SystemAISettings vs UserAICredential choices** → F6a chỉ update SystemAISettings (C1). UserAICredential.ai_model không có choices → auto-accept.

---

## 6. ĐÁNH GIÁ TỔNG THỂ

**Implementable?** **YES** — with 2 decisions needed (C2, C4).

**F6a (catalog-only)**: **APPROVED** — Low risk, safe migration, adds `gemini-3.8-flash` to FE/BE catalog.
- Risk: LOW
- Effort: ~0.5d
- Migration: AlterField choices on SystemAISettings only

**F6b (service layer)**: **CONDITIONAL** — Need C2 resolved (proxy compatibility test) before committing.
- Risk: MEDIUM (extra complexity, potential parameter mapping issues)
- Effort: ~2d
- If proxy works: F6b deferrable

**Recommendation**: Ship F6a now (catalog update + migration), test proxy with `gemini-3.8-flash`. If proxy works → ship F6b later or deprecate. If proxy fails → implement F6b immediately.

---

## 7. ĐẦU RA NGẮN

5 findings:
1. **All 5 conclusions CORRECT** — verified against codebase, 5/5 ✅
2. **F6a migration lighter than expected** — `UserAICredential.ai_model` has no choices → only `SystemAISettings` needs migration (C1)
3. **F6b potentially unnecessary** — OpenAI-compat proxy at `orchestrator.py:195` may already support Gemini 3.8 (C2)
4. **Parameter mapping required** — Gemini native API uses different param names than OpenAI (C4)
5. **`google-genai` dependency premature for F6a-only** — add only when F6b implemented (C5)

**Verdict**: F6a implementable NOW. F6b conditional on proxy test. Both safe to ship with proper error handling.
