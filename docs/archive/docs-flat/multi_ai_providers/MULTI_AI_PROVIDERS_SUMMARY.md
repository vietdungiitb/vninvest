# Multi-AI Providers Integration v2 - Executive Summary

## Vision
**Từ "OpenClaw Only" → "Choose Your AI"**

Mở rộng khả năng tư vấn Whale Advisory: cho phép người dùng chọn từ nhiều AI providers (OpenAI, Claude, Gemini, Copilot, OpenClaw) với linh hoạt chọn model và quản lý API key cá nhân.

---

## 🎯 Quick Facts

| Aspect | Details |
|--------|---------|
| **Scope** | 5 implementation phases (Phases 1-5) |
| **Effort** | Sprint 15 (2 weeks) + Sprint 16 (1 week) |
| **Test Coverage** | 95%+ for new code |
| **Breaking Changes** | None (backward compatible with OpenClaw) |
| **Database Changes** | 1 migration: Add 4 columns to UserConfig |
| **New Files** | ~15 Python files + 5 React components |
| **API Endpoints** | +3 new (GET /ai-options/, PUT /ai-config/, POST /test-connection/) |

---

## 📋 What Changes

### For **System Admin** (Backend)
```python
# Before: Hardcoded OpenClaw
generate_whale_advisory_task()
├── Calls OpenClaw API directly
└── Ai_provider always = 'openclaw'

# After: Pluggable AI Service
generate_whale_advisory_task()
├── Uses AIServiceFactory.create_client()
├── Reads from user/admin config (provider + model)
└── Dispatches to OpenAI | Claude | Gemini | Copilot | OpenClaw
```

### For **End User** (UI)
**Before**: No AI provider selection  
**After**: New AdminOps panel with:
- 🔘 Provider dropdown: `OpenAI | Claude | Gemini | Copilot | OpenClaw`
- 🔘 Model dropdown: Dynamic (changes based on provider)
  - E.g., OpenAI: `gpt-4o, gpt-4-turbo, gpt-3.5-turbo`
  - E.g., Claude: `claude-3-5-sonnet, claude-3-opus, claude-3-haiku`
- 🔐 API Key input: Encrypted storage
- ✓ Test button: Validate connection before saving

---

## 🏗️ Architecture: Before vs After

```
BEFORE (OpenClaw-only):
┌─────────────────────────────────────┐
│ WhaleAlert Detected                 │
│ (symbol, value, side)               │
└────────────────┬────────────────────┘
                 │
         ┌───────▼──────────┐
         │  generate_whale_ │
         │  advisory_task() │
         └───────┬──────────┘
                 │
         ┌───────▼──────────┐
         │  OpenClaw Client │
         │  (hardcoded)     │
         └───────┬──────────┘
                 │
         ┌───────▼──────────┐
         │ WhaleAdvisory    │
         │ (ai_provider=    │
         │  'openclaw')     │
         └──────────────────┘

AFTER (Multi-provider):
┌─────────────────────────────────────┐
│ WhaleAlert Detected                 │
│ (symbol, value, side)               │
└────────────────┬────────────────────┘
                 │
         ┌───────▼──────────────┐
         │  generate_whale_     │
         │  advisory_task()     │
         └───────┬──────────────┘
                 │
         ┌───────▼──────────────┐
         │  AIServiceFactory    │
         │  .create_client()    │
         └───────┬──────────────┘
                 │
    ┌────────────┼────────────┬─────────┬────────────┐
    │            │            │         │            │
┌───▼──┐ ┌───▼──┐ ┌───▼──┐ ┌──▼──┐ ┌──▼──┐
│OpenAI│ │Claude│ │Gemini│ │Copilot  │ │OpenClaw│
│      │ │      │ │      │ │         │ │        │
└───┬──┘ └───┬──┘ └───┬──┘ └──┬────┘ └──┬────┘
    │        │        │       │         │
    └────────┼────────┼───────┼─────────┘
             │        │       │
         ┌───▼────────▼───────▼────┐
         │  WhaleAdvisory           │
         │  (ai_provider=<chosen>)  │
         │  (ai_model=<choice>)     │
         └──────────────────────────┘
```

---

## 🔑 Key Components

### 1️⃣ **Data Model** (Phase 1)
```python
UserConfig:
  - ai_provider: CharField (choices: openclaw, openai, claude, gemini, copilot)
  - ai_model: CharField (e.g., 'gpt-4o', 'claude-3-5-sonnet')
  - ai_api_key: TextField (encrypted with Fernet)
  - ai_api_key_encrypted: BooleanField
```

### 2️⃣ **AI Client Factory** (Phase 2)
```
AIClientBase (abstract)
├── OpenAIClient
├── ClaudeClient
├── GeminiClient
├── CopilotClient
└── OpenClawClient

>>> client = AIServiceFactory.create_client('openai', api_key='sk-...', model='gpt-4o')
>>> summary, meta = client.generate_summary(symbol, side, value, context)
```

### 3️⃣ **API Endpoints** (Phase 3)
| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/ai-options/` | Fetch provider/model list | `{ providers: {...} }` |
| `PUT /api/ai-config/` | Save user AI settings | `{ status: 'success' }` |
| `POST /api/ai-config/test-connection/` | Validate API key | `{ status: 'success'\|'failed' }` |

### 4️⃣ **Frontend UI** (Phase 4)
```jsx
<AIConfigForm>
  ├── Provider Select Dropdown
  │   └── onChange → update model options
  ├── Model Select (Dynamic)
  │   └── Shows cost, capabilities
  ├── API Key Input
  │   └── [Show/Hide Toggle] [Status Badge]
  ├── Test Connection Button
  │   └── Validates key + model before save
  └── Save Configuration Button
```

---

## 📊 File Change Summary

### New Files (~15)
```
backend/portfolio/
├── ai_config.py                    # Constants: AVAILABLE_AI_MODELS, PROVIDER_CONFIGS
├── encryption_utils.py             # APIKeyManager: encrypt/decrypt
├── ai_client.py                    # AIClientBase abstract class
├── ai_service.py                   # AIServiceFactory dispatcher
└── ai_clients/
    ├── __init__.py
    ├── openai_client.py
    ├── claude_client.py
    ├── gemini_client.py
    ├── copilot_client.py
    └── openclaw_client.py

frontend/src/
├── constants/aiModels.js           # AVAILABLE_AI_MODELS mapping
├── components/AIConfigForm.jsx     # Provider/model/key form
└── api/client.js                   # updateAIConfig, testAIConnection functions
```

### Modified Files (~8)
```
backend/
├── portfolio/models.py             # UserConfig: +ai_provider, ai_model, ai_api_key
├── portfolio/tasks.py              # generate_whale_advisory_task(): use AIServiceFactory
├── portfolio/views.py              # +AIOptionsView, +AIConfigUpdateView
├── portfolio/serializers.py        # +UserConfigAISerializer, validation
├── config/urls.py                  # +3 new API routes
├── portfolio/migrations/           # 0038_auto_userconfig_ai_provider.py

frontend/
└── src/pages/AdminOps.jsx          # Integrate AIConfigForm in new panel
```

---

## 🗓️ Timeline

### Sprint 15 (Week 1-2)
| Week | Task | Files | Est. Days |
|------|------|-------|-----------|
| **1** | Phase 1: DB Migration + Encryption | models.py, encryption_utils.py, migration | 2-3 |
| **1** | Phase 2: AI Clients (OpenAI + Claude) | ai_client.py, openai_client.py, claude_client.py, ai_service.py | 3-4 |
| **2** | Phase 3: API Endpoints | views.py, serializers.py, urls.py | 2-3 |
| **2** | Phase 4: Frontend UI (v1) | AIConfigForm.jsx, AdminOps.jsx, client.js | 3-4 |

### Sprint 16 (Week 3: 1 week)
- Phase 4: Complete all 5 provider clients (Gemini, Copilot, OpenClaw wrapper)
- Phase 5: Full test coverage + documentation
- Deploy to production

---

## ✅ Success Criteria Checklist

- [ ] Users can select provider from dropdown
- [ ] Model list updates dynamically when provider changes
- [ ] API keys are encrypted & stored securely
- [ ] WhaleAdvisory AI summary/detail generated via selected provider
- [ ] Test Connection validates provider + model + key
- [ ] No errors in migration (backward compatible)
- [ ] All 5 provider clients functional (OpenAI, Claude, Gemini, Copilot, OpenClaw)
- [ ] Test coverage ≥ 95% for new code
- [ ] WhaleAdvisory page shows which provider/model generated each advisory
- [ ] Admin can switch providers on-the-fly (no app restart needed)
- [ ] Documentation updated with setup guide per provider
- [ ] Performance: avg response time ≤ current (no degradation)

---

## 🚀 Deployment Checklist

```bash
# Phase 1: Preparation
[ ] Create feature branch: git checkout -b multi-ai-providers-v2
[ ] Install dependencies: pip install openai anthropic google-generativeai

# Phase 2: Backend (Sprint 15 Week 1-2)
[ ] Run: python manage.py makemigrations
[ ] Run: python manage.py migrate
[ ] Test encrypt/decrypt roundtrip
[ ] Test AIServiceFactory with mock clients

# Phase 3: Frontend (Sprint 15 Week 2)
[ ] Test AIConfigForm component
[ ] Test dynamic model dropdown
[ ] Verify API key encryption in storage

# Phase 4: Integration Testing (Sprint 16)
[ ] E2E: User changes provider, system uses new provider
[ ] E2E: WhaleAdvisory generated via new provider
[ ] Load testing: 100+ concurrent users
[ ] Security testing: API key not logged, not exposed

# Phase 5: Deployment
[ ] Code review & approval
[ ] Deploy to staging
[ ] Smoke test each provider
[ ] Monitor API errors for 24 hours
[ ] Deploy to production
[ ] Update runbook: "How to configure AI providers"
```

---

## 🔐 Security Considerations

| Risk | Mitigation |
|------|-----------|
| API key exposure | Fernet symmetric encryption + never log keys |
| MITM attack | HTTPS + validate SSL certificates |
| User API key misuse | Rate limit per user, audit logging |
| Prompt injection | Sanitize user inputs, use templates |
| Unauthorized access | IsAuthenticated permission class on all endpoints |
| Key leaks in errors | Custom exception handling, mask keys in logs |

---

## 💡 Advanced Features (Future)

### Not in v2, but can be added in v3+:
- **Cost Tracking**: Monitor token usage & calculate cost per provider
- **A/B Testing**: Generate advisory from 2 providers, compare outputs
- **Model Switching**: Change model on-the-fly (cache key by provider+model)
- **Streaming**: Real-time advisory generation (for OpenAI/Claude)
- **Fallback**: If provider fails, automatically retry with backup provider
- **Caching**: Cache similar prompts to reduce API costs
- **Webhook**: Notify user when provider status changes

---

## 📚 References

- **Full Implementation Guide**: [MULTI_AI_PROVIDERS_IMPLEMENTATION_ROADMAP.md](MULTI_AI_PROVIDERS_IMPLEMENTATION_ROADMAP.md)
- **OpenAI API Docs**: https://platform.openai.com/docs/api-reference/chat
- **Anthropic Claude Docs**: https://docs.anthropic.com/claude
- **Google Gemini Docs**: https://ai.google.dev/docs
- **Django Fernet Encryption**: https://docs.djangoproject.com/en/stable/topics/signing/#cryptographic-signing
- **DRF Serializers**: https://www.django-rest-framework.org/api-guide/serializers/

---

**Document Status**: ✅ Ready for Sprint Planning  
**Last Updated**: April 4, 2026  
**Maintainer**: Development Team  
**Questions?**: Refer to full roadmap or contact tech lead
