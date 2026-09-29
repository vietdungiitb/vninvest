# SELF-AUDIT & TEST PROTOCOL: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01  
**Purpose:** Checklist nghiêm ngặt để Auditor và Dev tự kiểm tra sau mỗi slice, đảm bảo tuân thủ Handoff Master, Tech Spec và SSOT constraints.

---

## 1. Pre-Code Checklist (Trước khi bắt đầu mỗi Slice)

- [ ] Đã đọc Handoff Master và hiểu Hard Constraints
- [ ] Đã xác định scope slice (chỉ chạm các file trong phạm vi)
- [ ] Đã kiểm tra Traceability Matrix để biết requirement nào đang implement
- [ ] Đã verify SSOT source functions vẫn tồn tại và không bị deprecated

---

## 2. Per-Slice Audit Checklist

### 2.1. Code Quality Gates

| # | Check Item | Pass? |
|---|-----------|-------|
| CQ-01 | Không hardcode LLM provider name hay API key trong code | |
| CQ-02 | Mọi LLM call đều thông qua abstraction layer (`orchestrator.py`) | |
| CQ-03 | API Keys lưu DB dùng Fernet encryption, không plaintext | |
| CQ-04 | Tools chỉ READ từ SSOT, không tạo parallel computation | |
| CQ-05 | Text UI mới đã qua i18n (tiếng Việt đầy đủ dấu) | |
| CQ-06 | Agent names dùng canonical: Whale/Tech/Risk/Sentiment Agent | |
| CQ-07 | Model format dùng `provider:model_name` convention | |
| CQ-08 | SSE events tuân thủ format trong Tech Spec §2.2 | |
| CQ-09 | Không import trực tiếp `openai`/`anthropic` SDK ngoài abstraction | |
| CQ-10 | Async code dùng `asyncio.gather` cho parallel dispatch | |

### 2.2. Functional Verification

| # | Check Item | Command / Method | Pass? |
|---|-----------|-----------------|-------|
| FV-01 | Model `UserAIConfiguration` migrate thành công | `python manage.py migrate` | |
| FV-02 | API `PUT /api/v1/ai/config/` lưu và encrypt key | `curl` + DB inspect | |
| FV-03 | API `GET /api/v1/ai/config/` trả về config (masked keys) | `curl` test | |
| FV-04 | SSE endpoint `/api/v1/ai/debate/stream/` trả events | `curl -N` hoặc browser EventSource | |
| FV-05 | Whale Tool trả đúng JSON format khi gọi `get_whale_flow_data` | Unit test | |
| FV-06 | Tech Tool trả đúng JSON format | Unit test | |
| FV-07 | Risk Tool trả đúng JSON format | Unit test | |
| FV-08 | Orchestrator dispatch 4 agents parallel (timing < 15s total) | Test + timing log | |
| FV-09 | Orchestrator trả final_decision đúng JSON schema | Unit test | |
| FV-10 | Frontend form lưu API key thành công | Browser test | |
| FV-11 | Frontend SSE hiển thị loading states từng agent | Browser test | |
| FV-12 | Frontend fallback hiển thị form nhập key khi chưa có key | Browser test | |

### 2.3. Security Verification

| # | Check Item | Method | Pass? |
|---|-----------|--------|-------|
| SEC-01 | DB dump không chứa plaintext API key | `SELECT openai_key FROM portfolio_useraiconfiguration` phải là binary blob | |
| SEC-02 | User A không đọc được config của User B | API test với 2 auth tokens khác nhau | |
| SEC-03 | Unauthenticated request bị reject 401 | `curl` without token | |
| SEC-04 | Rate limiting trên debate endpoint | Gửi 10 requests liên tục, verify throttle | |

### 2.4. Regression Verification

| # | Check Item | Command | Pass? |
|---|-----------|---------|-------|
| REG-01 | Whale Analytics Snapshot API vẫn PASS | `python manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb` | |
| REG-02 | Order Flow tests vẫn PASS | `python manage.py test portfolio.tests.test_order_flow --keepdb` | |
| REG-03 | Frontend build thành công không lỗi | `npm run build` | |
| REG-04 | Existing AI Advisory endpoint vẫn hoạt động (backward compat) | Manual API test | |

---

## 3. Post-Slice Evidence Requirements

Sau mỗi slice hoàn thành, Dev phải ghi lại:

```markdown
## Slice Evidence: [Slice Name]

### Files Changed
- `path/to/file.py` — mô tả thay đổi

### Validation Commands & Results
```
[paste command output]
```

### API Payload Snapshots (nếu chạm contract)
```json
[paste SSE events or API response]
```

### Screenshots/Videos (nếu UI)
[attach]

### Residual Risks
- [mô tả nếu có]

### Audit Ledger Updated
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật
```

---

## 4. Final Release Gate (Trước khi merge toàn bộ feature)

| # | Gate | Required By | Status |
|---|------|------------|--------|
| G-01 | Tất cả unit tests PASS | Backend Lead | |
| G-02 | Frontend build 0 errors, 0 warnings | Frontend Lead | |
| G-03 | SSE stream demo end-to-end (video evidence) | QA | |
| G-04 | BYOM config demo với ≥2 providers khác nhau | QA | |
| G-05 | Security audit: encryption verified | Backend Lead | |
| G-06 | Regression suite PASS (Whale, Order Flow) | Backend Lead | |
| G-07 | Traceability Matrix cập nhật đầy đủ | Architect | |
| G-08 | CODE_CHANGE_AUDIT_LEDGER cập nhật | All | |
| G-09 | i18n review: tất cả text Việt hóa | Frontend Lead | |

---

## 5. Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sentiment Agent phụ thuộc `opennews-main` chưa có API ổn định | Sentiment tool có thể fail | Defer Sentiment Agent sang Phase 3, Phase 1 chạy 3 agents |
| LLM API latency > 20s gây timeout | User experience kém | SSE streaming + client-side timeout handling |
| Fernet key rotation chưa có plan | Key cũ decrypt fail | Document key rotation procedure trước production |
| `asyncio` trong Django WSGI context | Deadlock potential | Bắt buộc chạy trên ASGI (Uvicorn) cho debate endpoint |
