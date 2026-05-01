# TECHNICAL SPECIFICATION: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01

## 1. Database Schema Changes (Django)

Tạo một app mới hoặc thêm vào module `portfolio/models.py`.

```python
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet # Yêu cầu cài đặt thư viện cryptography

class UserAIConfiguration(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_config')
    
    # API Keys (Mã hóa ở cấp database)
    openai_key = models.BinaryField(null=True, blank=True)
    anthropic_key = models.BinaryField(null=True, blank=True)
    google_key = models.BinaryField(null=True, blank=True)
    
    # Model Assignments
    orchestrator_model = models.CharField(max_length=50, default='openai:gpt-4o')
    whale_agent_model = models.CharField(max_length=50, default='anthropic:claude-3-5-sonnet')
    tech_agent_model = models.CharField(max_length=50, default='anthropic:claude-3-5-sonnet')
    risk_agent_model = models.CharField(max_length=50, default='openai:gpt-4o-mini')
    sentiment_agent_model = models.CharField(max_length=50, default='google:gemini-1.5-flash')
```
*Note cho đội Backend:* Cần tạo `encrypt_key` và `decrypt_key` helpers sử dụng Fernet AES symmetric encryption. KHÔNG LƯU PLAINTEXT API KEY.

## 2. API Contracts

### 2.1. API Cấu hình BYOM (REST)
- **Endpoint:** `PUT /api/v1/ai/config/`
- **Payload:**
```json
{
  "api_keys": {"openai": "sk-...", "anthropic": "sk-ant-..."},
  "models": {
    "orchestrator": "openai:gpt-4o",
    "whale_agent": "anthropic:claude-3-5-sonnet"
  }
}
```

### 2.2. API Debate Orchestrator (SSE Streaming)
- **Endpoint:** `GET /api/v1/ai/debate/stream/?symbol=SSI`
- **Response Format (Server-Sent Events):**
```text
data: {"step": "init", "message": "Đang nạp cấu hình User..."}
data: {"step": "dispatching", "message": "Gửi yêu cầu tới 4 Agents..."}
data: {"step": "agent_done", "agent": "whale", "signal": "BUY", "message": "CVD đạt 120 tỷ"}
data: {"step": "synthesis", "final_decision": "STRONG BUY", "confidence": 85}
```

## 3. Function Calling Tools Definitions (Chuẩn JSON Schema)

Đội Backend cần bọc các hàm có sẵn thành Tools cho Agent.

**Tool 1: `get_whale_flow_data`**
```json
{
  "name": "get_whale_flow_data",
  "description": "Lấy dữ liệu CVD, Buy Strength và Institutional Strength của mã cổ phiếu trong phiên hiện tại.",
  "parameters": {
    "type": "object",
    "properties": {
      "symbol": {"type": "string", "description": "Mã chứng khoán, ví dụ: SSI"}
    },
    "required": ["symbol"]
  }
}
```
*Logic Backend map với hàm:* `global_signal_universe_policy.get_realtime_whale_metrics(symbol)`

## 4. System Prompts Reference

**Orchestrator Prompt:**
> "Bạn là Giám đốc Đầu tư của VNINVEST. Hãy đọc báo cáo JSON từ 4 phân tích viên: Whale, Tech, Risk, Sentiment. Hãy kiểm tra các mâu thuẫn. Trọng số của Whale Flow là cao nhất (40%), Kỹ thuật (30%), Rủi ro (20%), Sentiment (10%). Hãy trả về kết luận theo định dạng JSON chứa 'final_decision', 'confidence_score' và 'summary'."

**Whale Agent Prompt:**
> "Bạn là Chuyên gia Dòng tiền lớn (Whale Analyst). Nhiệm vụ của bạn là gọi hàm `get_whale_flow_data` để phân tích CVD và sức mạnh thể chế (Institutional Strength). Nếu CVD > 0 và Institutional Strength > 60, tín hiệu là BUY."
