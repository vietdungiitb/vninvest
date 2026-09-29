# TECHNICAL SPECIFICATION: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01  
**Status:** PLANNING  
**Cross-ref:** [Handoff Master](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER_20260501.md)

> [!NOTE]
> Tài liệu này đặc tả slice AI trading. Nếu có thay đổi đụng tới `core` contracts, tenant/token semantics, partner APIs hoặc storage/schema của `core`, phải defer theo bộ tài liệu `core` mới hơn:
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)

---

## 1. Database Schema Changes (Django)

Tạo model mới trong `backend/portfolio/models.py`.

```python
from django.db import models
from django.conf import settings

class UserAIConfiguration(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_config')
    
    # API Keys (Mã hóa Fernet ở application layer)
    openai_key = models.BinaryField(null=True, blank=True)
    anthropic_key = models.BinaryField(null=True, blank=True)
    google_key = models.BinaryField(null=True, blank=True)
    
    # Model Assignments (format: "provider:model_name")
    orchestrator_model = models.CharField(max_length=50, default='openai:gpt-4o')
    whale_agent_model = models.CharField(max_length=50, default='anthropic:claude-3-5-sonnet')
    tech_agent_model = models.CharField(max_length=50, default='anthropic:claude-3-5-sonnet')
    risk_agent_model = models.CharField(max_length=50, default='openai:gpt-4o-mini')
    sentiment_agent_model = models.CharField(max_length=50, default='google:gemini-1.5-flash')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 1.1. Encryption Helpers (`ai_services/encryption.py`)

```python
from cryptography.fernet import Fernet
from django.conf import settings

_cipher = Fernet(settings.FERNET_KEY)

def encrypt_key(plaintext: str) -> bytes:
    return _cipher.encrypt(plaintext.encode('utf-8'))

def decrypt_key(ciphertext: bytes) -> str:
    return _cipher.decrypt(ciphertext).decode('utf-8')
```

> `FERNET_KEY` phải được tạo 1 lần bằng `Fernet.generate_key()` và lưu trong `.env`. Không commit vào repo.

---

## 2. API Contracts

### 2.1. API Cấu hình BYOM (REST)

**`PUT /api/v1/ai/config/`** — Auth: Bearer Token required  
**Request:**
```json
{
  "api_keys": {"openai": "sk-...", "anthropic": "sk-ant-..."},
  "models": {
    "orchestrator": "openai:gpt-4o",
    "whale_agent": "anthropic:claude-3-5-sonnet"
  }
}
```
**Success:** `200 OK` → `{"status": "saved", "api_keys_set": ["openai", "anthropic"]}`

**`GET /api/v1/ai/config/`** — Auth: Bearer Token required  
**Response:** `200 OK` → config with `api_keys_set` (provider names only, NO plaintext keys)

**Errors:** `401` unauthenticated | `400` invalid provider/model format

### 2.2. API Debate Orchestrator (SSE Streaming)

**`GET /api/v1/ai/debate/stream/?symbol=SSI&prompt=...`** — Auth required

```text
event: init
data: {"step": "init", "message": "Đang nạp cấu hình AI..."}

event: dispatching
data: {"step": "dispatching", "agents": ["whale", "tech", "risk", "sentiment"]}

event: agent_done
data: {"step": "agent_done", "agent": "whale", "signal": "BUY", "score": 90, "reason": "CVD +120B"}

event: agent_done
data: {"step": "agent_done", "agent": "tech", "signal": "BUY", "score": 75, "reason": "Phá MA50"}

event: agent_done
data: {"step": "agent_done", "agent": "risk", "signal": "HOLD", "score": 40, "reason": "Thanh khoản thấp"}

event: agent_done
data: {"step": "agent_done", "agent": "sentiment", "signal": "BUY", "score": 80, "reason": "Tin tích cực"}

event: result
data: {"step": "result", "final_decision": "STRONG BUY", "confidence_score": 85, "summary": "...", "agent_breakdown": {...}}

event: done
data: {"step": "done"}
```

**Error events:** `{"step": "error", "code": "no_api_key|agent_failed|llm_rate_limit", "message": "..."}`

---

## 3. Function Calling Tools Definitions

### Tool 1: `get_whale_flow_data`
```json
{"name": "get_whale_flow_data", "description": "Lấy CVD, Buy Strength, Institutional Strength.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}
```
**Backend:** `global_signal_universe_policy.get_realtime_whale_metrics(symbol)` — READ-ONLY

### Tool 2: `get_technical_indicators`
```json
{"name": "get_technical_indicators", "description": "Lấy MA20, MA50, RSI-14, MACD, candlestick pattern.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}, "timeframe": {"type": "string", "enum": ["1D","1W","1M"], "default": "1D"}}, "required": ["symbol"]}}
```
**Backend:** Existing KLine query services — READ-ONLY

### Tool 3: `get_risk_assessment`
```json
{"name": "get_risk_assessment", "description": "Đánh giá thanh khoản TB20, volatility, điểm rủi ro thị trường.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}
```
**Backend:** `global_signal_policy_helpers` + liquidity calc — READ-ONLY

### Tool 4: `get_sentiment_score`
```json
{"name": "get_sentiment_score", "description": "Điểm tâm lý thị trường (-1 đến 1) từ tin tức và diễn đàn.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}
```
**Backend:** `opennews-main` service — READ-ONLY. Nếu chưa sẵn sàng, defer sang Phase 3.

---

## 4. System Prompts

**Orchestrator:** "Bạn là CIO VNINVEST. Đọc báo cáo 4 agents. Trọng số: Whale 40%, Tech 30%, Risk 20%, Sentiment 10%. Trả JSON: `{final_decision, confidence_score, summary}`."

**Whale Agent:** "Gọi `get_whale_flow_data`. CVD > 0 và Inst. Strength > 60 → BUY. Trả JSON: `{signal, score, reason}`."

**Tech Agent:** "Gọi `get_technical_indicators`. Đánh giá MA crossover, RSI, mô hình nến. Trả JSON: `{signal, score, reason}`."

**Risk Agent:** "Gọi `get_risk_assessment`. Thanh khoản TB20 < 50 tỷ → cảnh báo. Trả JSON: `{signal, score, reason}`."

**Sentiment Agent:** "Gọi `get_sentiment_score`. Cảnh báo phân kỳ đám đông vs dòng tiền. Trả JSON: `{signal, score, reason}`."

---

## 5. Auth & Rate Limiting

- Debate endpoint: **5 req/min/user** (DRF Throttle). Bắt buộc ASGI (Uvicorn).
- Config endpoint: **20 req/min/user**. Có thể WSGI.
- User A không đọc được config User B (queryset filter by `request.user`).
