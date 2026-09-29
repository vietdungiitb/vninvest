# Thiết kế Logic: Multi-Agent Orchestrator cho VNINVEST

**Date:** 2026-05-01
**Mục tiêu:** Thiết kế luồng xử lý trung tâm (Orchestrator) chịu trách nhiệm điều phối các AI Agents chuyên biệt, quản lý API Keys của người dùng (BYOM/BYOK) và tổng hợp kết quả thành một quyết định giao dịch cuối cùng.

---

## 1. Tổng quan Kiến trúc Orchestrator

Orchestrator đóng vai trò như một **"Nhạc trưởng" (Judge / Coordinator)**. Nó không trực tiếp phân tích data mà thực hiện các nhiệm vụ sau:
1. Nhận yêu cầu từ người dùng (ví dụ: *"Đánh giá mã VHM hôm nay"*).
2. Tải cấu hình Model và API Key của người dùng đó (BYOM/BYOK).
3. Kích hoạt đồng thời (Parallel Dispatch) các Agent chuyên môn (Whale, Tech, Risk, Sentiment).
4. Thu thập các bản báo cáo từ các Agent.
5. Tổng hợp, cân nhắc trọng số và đưa ra kết luận cuối cùng (STRONG BUY / SELL).
6. Stream kết quả về Frontend.

---

## 2. Luồng Thực thi Logic (Execution Flow)

### Bước 1: Nhận Request & Tải Cấu hình (Init & Config Load)
- Request gửi lên Backend (Django) chứa `user_id`, `symbol`, và `user_prompt`.
- Orchestrator query database lấy cấu hình AI của user.
- **Output:** Một Dictionary cấu hình cho các Agent:
  ```json
  {
    "orchestrator_model": {"provider": "openai", "model": "gpt-4o", "api_key": "sk-..."},
    "whale_agent": {"provider": "anthropic", "model": "claude-3-5-sonnet", "api_key": "sk-ant-..."},
    "tech_agent": {"provider": "anthropic", "model": "claude-3-5-sonnet", "api_key": "sk-ant-..."},
    "sentiment_agent": {"provider": "google", "model": "gemini-1.5-flash", "api_key": "AIza..."}
  }
  ```

### Bước 2: Chuẩn bị Global Context (Pre-fetch)
- Orchestrator gọi nhanh các API nội bộ không tốn thời gian để lấy bối cảnh chung truyền vào cho tất cả Agents:
  - Giá hiện tại của Symbol.
  - Điểm số VN-Index (để biết thị trường chung đang up hay down).

### Bước 3: Phân tán Task (Parallel Fan-out)
Orchestrator khởi tạo các LLM client tương ứng với cấu hình và gọi đồng thời (Asynchronous) 4 Agents. Mỗi Agent sẽ có một bộ công cụ (Tools) riêng để gọi ngược lại Database của VNINVEST nếu cần.

- **Whale Agent (Task):** "Truy xuất CVD, Institutional Strength, Heatmap của mã X. Xác định cá mập đang mua hay bán."
- **Tech Agent (Task):** "Truy xuất KLine, MA20/50, RSI. Tìm mô hình nến hiện tại."
- **Risk Agent (Task):** "Đánh giá thanh khoản, rủi ro điều chỉnh của thị trường chung. Tính Max Drawdown."
- **Sentiment Agent (Task):** "Đọc tin tức mới nhất và thống kê chỉ số hưng phấn F319."

### Bước 4: Tranh luận & Tổng hợp (Fan-in & Synthesis)
- Khi cả 4 Agents trả về kết quả (Mỗi Agent sẽ trả về một chuỗi JSON gồm: `Signal: BUY/SELL/HOLD`, `Score: 0-10`, `Reason: ...`).
- Orchestrator lấy báo cáo của 4 Agents gộp lại làm **Input Prompt** cho Model của chính nó (Ví dụ: `GPT-4o`).
- **System Prompt của Orchestrator:**
  *"Bạn là Giám đốc Đầu tư (CIO) của VNINVEST. Bạn vừa nhận được báo cáo từ 4 chuyên gia: Dòng tiền Cá mập, Phân tích Kỹ thuật, Rủi ro và Tâm lý. Hãy đọc kỹ, tìm ra các điểm mâu thuẫn (Ví dụ: Kỹ thuật báo Mua nhưng Cá mập đang Bán xả), đánh giá trọng số (Whale Flow luôn có trọng số cao nhất). Đưa ra quyết định cuối cùng."*

### Bước 5: Phản hồi về Client (Response)
- Trả về Frontend một khối JSON hoàn chỉnh:
  ```json
  {
    "symbol": "VHM",
    "final_decision": "STRONG BUY",
    "confidence_score": 85,
    "summary_reasoning": "Dòng tiền cá mập vào rất mạnh (CVD +120B), phá vỡ cản MA50, dù rủi ro thị trường chung hơi cao nhưng lực cầu đủ hấp thụ.",
    "agent_breakdown": {
      "whale": {"signal": "BUY", "score": 90},
      "tech": {"signal": "BUY", "score": 75},
      "risk": {"signal": "HOLD", "score": 40},
      "sentiment": {"signal": "BUY", "score": 80}
    }
  }
  ```

---

## 3. Kiến trúc Database & Cấu trúc Dữ liệu (Django pseudo-code)

**Mô hình lưu trữ User Configuration (BYOM/BYOK):**
```python
class UserAIConfiguration(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    
    # Encrypted API Keys
    openai_api_key = EncryptedCharField(max_length=255, blank=True)
    anthropic_api_key = EncryptedCharField(max_length=255, blank=True)
    google_api_key = EncryptedCharField(max_length=255, blank=True)
    
    # Role to Model Mapping
    orchestrator_model = models.CharField(max_length=50, default='gpt-4o')
    whale_agent_model = models.CharField(max_length=50, default='claude-3-5-sonnet')
    tech_agent_model = models.CharField(max_length=50, default='claude-3-5-sonnet')
    risk_agent_model = models.CharField(max_length=50, default='gpt-4o-mini')
    sentiment_agent_model = models.CharField(max_length=50, default='gemini-1.5-flash')
```

---

## 4. Xử lý Trải nghiệm Người dùng (UX & Streaming Latency)

Vì quá trình Orchestrator xử lý mất từ **10 - 20 giây** (do phải gọi Tools và chờ 4 mô hình chạy), hệ thống BẮT BUỘC phải dùng WebSockets hoặc Server-Sent Events (SSE) để stream tiến trình về UI:

1. `UI:` "Đang tải cấu hình AI của bạn..."
2. `UI:` "Đang phái cử 4 chuyên gia phân tích..."
3. `UI:` "✅ Chuyên gia Kỹ thuật đã có kết quả."
4. `UI:` "✅ Chuyên gia Cá mập đã có kết quả."
5. `UI:` "Đang tổng hợp báo cáo..."
6. `UI:` (Hiện ra báo cáo cuối cùng)
