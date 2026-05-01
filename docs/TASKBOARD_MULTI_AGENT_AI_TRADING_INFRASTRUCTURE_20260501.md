# TASKBOARD: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01  
**Cross-ref:** [Implementation Plan](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)

---

## Phase 1: Database & User Configuration (BYOM)
**Owner:** Backend Lead | **Priority:** P0 | **ETA:** 2 ngày | **Blocked-by:** None

- [ ] Backend: Thêm `cryptography` vào `requirements.txt` — Owner: Backend
- [ ] Backend: Tạo `FERNET_KEY` trong `.env` và `settings.py` — Owner: Backend
- [ ] Backend: Implement `ai_services/encryption.py` (Fernet encrypt/decrypt) — Owner: Backend
- [ ] Backend: Thiết kế model `UserAIConfiguration` trong `models.py` — Owner: Backend
- [ ] Backend: Tạo migration và register Admin Panel — Owner: Backend
- [ ] Backend: Viết API endpoint `GET/PUT /api/v1/ai/config/` — Owner: Backend
- [ ] Backend: Viết unit tests `test_ai_configuration.py` (encryption, CRUD, isolation) — Owner: Backend
- [ ] Frontend: Xây dựng `AIConfigurationPanel.jsx` (form API Keys + model selector) — Owner: Frontend
- [ ] Frontend: Test gửi API lưu cấu hình thành công — Owner: Frontend

## Phase 2: Agent Tools Layer
**Owner:** Backend Lead | **Priority:** P0 | **ETA:** 2 ngày | **Blocked-by:** Phase 1 (cần model UserAIConfiguration)

- [ ] Backend: Tạo `ai_services/tools/whale_tools.py` bọc `get_realtime_whale_metrics` — Owner: Backend
- [ ] Backend: Tạo `ai_services/tools/tech_tools.py` bọc KLine/MA/RSI — Owner: Backend
- [ ] Backend: Tạo `ai_services/tools/risk_tools.py` bọc Global Screener signals — Owner: Backend
- [ ] Backend: Tạo `ai_services/tools/sentiment_tools.py` (stub nếu opennews chưa sẵn sàng) — Owner: Backend
- [ ] Backend: Viết unit tests `test_ai_tools.py` — Owner: Backend
- [ ] Backend: Verify SSOT parity: tool output phải MATCH UI data — Owner: Backend

## Phase 3: Orchestrator Logic
**Owner:** Backend Lead | **Priority:** P0 | **ETA:** 3-4 ngày | **Blocked-by:** Phase 2

- [ ] Backend: Tạo `ai_services/providers.py` — LLM provider abstraction — Owner: Backend
- [ ] Backend: Viết class `AITradingOrchestrator` với `asyncio.gather` — Owner: Backend
- [ ] Backend: Viết SSE view `StreamingHttpResponse` + route — Owner: Backend
- [ ] Backend: Implement graceful degradation (1 agent fail → tiếp tục 3 agents) — Owner: Backend
- [ ] Backend: Xử lý fallback (user chưa nhập key → error event) — Owner: Backend
- [ ] Backend: Viết tests `test_ai_orchestrator.py` — Owner: Backend
- [ ] Backend: Verify timing: first event < 1s, total < 15s — Owner: Backend

## Phase 4: Frontend UI
**Owner:** Frontend Lead | **Priority:** P1 | **ETA:** 2 ngày | **Blocked-by:** Phase 3 (cần SSE endpoint)

- [ ] Frontend: Viết EventSource hook bắt SSE stream — Owner: Frontend
- [ ] Frontend: Cập nhật `AIAdvisoryPanel.jsx` chuyển REST → SSE — Owner: Frontend
- [ ] Frontend: Render loading states từng agent — Owner: Frontend
- [ ] Frontend: Render radar chart 4 góc + confidence score — Owner: Frontend
- [ ] Frontend: Xử lý mất kết nối (báo lỗi, không treo) — Owner: Frontend
- [ ] Frontend: Thêm i18n tiếng Việt cho tất cả text mới — Owner: Frontend
- [ ] Frontend: Build thành công 0 errors — Owner: Frontend

## Phase 5: QA & Audit
**Owner:** QA + All Leads | **Priority:** P0 | **ETA:** 1 ngày | **Blocked-by:** Phase 4

- [ ] Regression: `test_whale_analytics_snapshot_api` PASS — Owner: QA
- [ ] Regression: `test_order_flow` PASS — Owner: QA
- [ ] Security: Encryption audit (DB dump check) — Owner: Backend
- [ ] Security: User isolation test (User A ≠ User B config) — Owner: Backend
- [ ] Demo: Record video SSE stream end-to-end — Owner: QA
- [ ] Demo: BYOM config với ≥2 providers khác nhau — Owner: QA
- [ ] Audit: Kiểm tra "Echo chamber" khi 4 agents dùng cùng model — Owner: QA
- [ ] Documentation: Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` — Owner: All
- [ ] Documentation: Cập nhật Traceability Matrix — Owner: Architect
