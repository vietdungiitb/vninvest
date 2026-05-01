# IMPLEMENTATION PLAN: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01  
**Cross-ref:** [Tech Spec](file:///c:/Mujoco%20Projects/vninvest/docs/TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md) | [Handoff Master](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER_20260501.md)

---

## Mục đích
Định hướng từng bước triển khai kỹ thuật để đảm bảo tính an toàn, không phá vỡ logic cũ và dễ dàng rollback nếu có lỗi.

---

## Step 1: Xây dựng nền tảng BYOK (Bring Your Own Key)
*Thời gian: 1-2 ngày | Owner: Backend Lead | Priority: P0*

### Files to Create/Modify
- **[NEW]** `backend/portfolio/ai_services/__init__.py`
- **[NEW]** `backend/portfolio/ai_services/encryption.py` — Fernet helpers
- **[MODIFY]** `backend/portfolio/models.py` — Thêm `UserAIConfiguration`
- **[MODIFY]** `backend/portfolio/admin.py` — Register model vào Admin Panel
- **[NEW]** `backend/portfolio/tests/test_ai_configuration.py` — Unit tests

### Actions
1. Thêm `cryptography` vào `requirements.txt`.
2. Tạo `FERNET_KEY` trong `.env` và `settings.py`.
3. Implement `encrypt_key()` / `decrypt_key()` trong `encryption.py`.
4. Tạo model `UserAIConfiguration` theo Tech Spec §1.
5. Tạo migration: `python manage.py makemigrations portfolio`.
6. Viết API endpoint `GET/PUT /api/v1/ai/config/` trong `views.py` + `urls.py`.
7. Viết unit tests: encryption round-trip, CRUD config, key isolation giữa users.

### Verification Commands
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py makemigrations portfolio --check
../.venv/Scripts/python.exe manage.py migrate
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_ai_configuration --keepdb -v2
Pop-Location
```

### Acceptance Criteria
- [ ] Migration chạy thành công, không conflict
- [ ] `SELECT openai_key FROM portfolio_useraiconfiguration` trả về binary blob, không plaintext
- [ ] API `PUT` lưu key → API `GET` trả về `api_keys_set` (không lộ key)
- [ ] User A không đọc được config User B

### Rollback
- Revert migration: `python manage.py migrate portfolio <previous_migration_number>`

---

## Step 2: Xây dựng "Công cụ" (Tools) cho Agents
*Thời gian: 2 ngày | Owner: Backend Lead | Priority: P0*

### Files to Create
- **[NEW]** `backend/portfolio/ai_services/tools/__init__.py`
- **[NEW]** `backend/portfolio/ai_services/tools/whale_tools.py`
- **[NEW]** `backend/portfolio/ai_services/tools/tech_tools.py`
- **[NEW]** `backend/portfolio/ai_services/tools/risk_tools.py`
- **[NEW]** `backend/portfolio/ai_services/tools/sentiment_tools.py`
- **[NEW]** `backend/portfolio/tests/test_ai_tools.py`

### Actions
1. Mỗi file tool: nhận input JSON → parse params → gọi hàm Django SSOT nội bộ → trả JSON.
2. `whale_tools.py` gọi `global_signal_universe_policy.get_realtime_whale_metrics(symbol)`.
3. `tech_tools.py` gọi existing KLine/MA/RSI query functions.
4. `risk_tools.py` gọi `global_signal_policy_helpers` + liquidity calculation.
5. `sentiment_tools.py` gọi `opennews-main` API (hoặc return stub nếu service chưa sẵn sàng).
6. Export JSON Schema definitions theo Tech Spec §3.

### Verification
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_ai_tools --keepdb -v2
Pop-Location
```

### Acceptance Criteria
- [ ] Mỗi tool trả JSON đúng schema khi gọi với symbol hợp lệ
- [ ] Tool trả error JSON khi symbol không tồn tại
- [ ] Whale tool data MATCH với data trên UI KLineChart (SSOT parity)
- [ ] Không có import trực tiếp từ DB queries — chỉ gọi qua service layer

### Rollback
- Xóa thư mục `ai_services/tools/` — không ảnh hưởng code cũ.

---

## Step 3: Xây dựng Multi-Agent Orchestrator (Luồng Async)
*Thời gian: 3-4 ngày | Owner: Backend Lead | Priority: P0*

### Files to Create/Modify
- **[NEW]** `backend/portfolio/ai_services/orchestrator.py` — Class `AITradingOrchestrator`
- **[NEW]** `backend/portfolio/ai_services/providers.py` — LLM provider abstraction
- **[MODIFY]** `backend/portfolio/views.py` — Thêm SSE streaming view
- **[MODIFY]** `backend/portfolio/urls.py` — Route `/api/v1/ai/debate/stream/`
- **[NEW]** `backend/portfolio/tests/test_ai_orchestrator.py`

### Actions
1. Tạo `providers.py`: abstraction layer cho OpenAI/Anthropic/Google SDK.
2. Tạo `AITradingOrchestrator` class với methods:
   - `load_config(user)` → đọc `UserAIConfiguration`
   - `prefetch_context(symbol)` → lấy giá, VN-Index
   - `dispatch_agents(symbol, context)` → `asyncio.gather` 4 agents
   - `synthesize(agent_results)` → gọi Orchestrator LLM với prompt tổng hợp
3. Tạo SSE view dùng `StreamingHttpResponse` với `content_type='text/event-stream'`.
4. Xử lý fallback: báo lỗi nếu user chưa nhập key, hoặc 1 agent fail thì tiếp tục với agents còn lại.

### Verification
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_ai_orchestrator --keepdb -v2
Pop-Location
```

### Acceptance Criteria
- [ ] Orchestrator trả stream bước đầu tiên trong < 1s
- [ ] Tổng thời gian debate < 15s (4 agents parallel)
- [ ] Khi 1 agent fail, stream tiếp tục với 3 agents (graceful degradation)
- [ ] SSE events đúng format Tech Spec §2.2
- [ ] Endpoint chạy trên Uvicorn ASGI, không deadlock

### Rollback
- Xóa `orchestrator.py`, `providers.py`, revert views/urls changes.

---

## Step 4: Cập nhật Frontend UI & SSE
*Thời gian: 2 ngày | Owner: Frontend Lead | Priority: P1*

### Files to Create/Modify
- **[NEW]** `frontend/src/components/AIConfigurationPanel.jsx`
- **[MODIFY]** `frontend/src/components/AIAdvisoryPanel.jsx` — SSE thay REST
- **[MODIFY]** `frontend/src/api/client.js` — Thêm endpoints
- **[MODIFY]** `frontend/src/i18n/` — Thêm translations

### Actions
1. Viết `AIConfigurationPanel.jsx`: form nhập API Keys, Select Box chọn model.
2. Viết EventSource hook bắt SSE stream từ debate endpoint.
3. Render loading states theo từng agent: "Đang gọi Whale Agent...", "✅ Hoàn thành".
4. Render kết quả cuối: radar chart 4 góc + confidence score + summary.
5. Xử lý mất kết nối: báo lỗi, không treo vĩnh viễn.
6. Thêm i18n tiếng Việt cho tất cả text mới.

### Verification
```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### Acceptance Criteria
- [ ] Build thành công 0 errors
- [ ] Form lưu API key → reload → key vẫn hiển thị (masked)
- [ ] SSE loading states hiển thị đúng
- [ ] Mất mạng giữa chừng → UI báo lỗi, không treo
- [ ] Tất cả text đã Việt hóa

### Rollback
- Revert `AIAdvisoryPanel.jsx` về bản REST cũ.

---

## Step 5: Final Audit & Regression
*Thời gian: 1 ngày | Owner: QA + All Leads | Priority: P0*

### Actions
1. Đối chiếu toàn bộ commit với Tech Spec và Traceability Matrix.
2. Chạy regression test suite:
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```
3. Demo end-to-end SSE stream (record video evidence).
4. Security audit: verify encryption, key isolation.
5. Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`.

### Acceptance Criteria
- [ ] Tất cả regression tests PASS
- [ ] Video demo SSE stream end-to-end
- [ ] Encryption audit PASS
- [ ] Audit Ledger cập nhật
