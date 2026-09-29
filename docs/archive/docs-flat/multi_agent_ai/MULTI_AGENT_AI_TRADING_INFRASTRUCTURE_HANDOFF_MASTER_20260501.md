# MULTI-AGENT AI TRADING INFRASTRUCTURE HANDOFF MASTER

**Date:** 2026-05-01  
**Domain:** AI Trading, AI Advisory, Multi-Agent Systems, Backend, Frontend.  
**Status:** PLANNING — target-state pack, phải thực thi qua execution rebaseline trước khi code.

---

## 1. Executive Summary

Bản Handoff này là bộ tài liệu hoàn chỉnh để Đội Phát triển (Engineering Team) tiến hành triển khai kiến trúc Multi-Agent Debate thay thế cho tính năng AI Advisory tĩnh hiện tại của VNINVEST. Hệ thống cho phép cấu hình cá nhân hóa LLM API Keys (BYOM/BYOK) và chạy luồng tranh luận 4 Agents (Whale, Tech, Risk, Sentiment) để chốt tín hiệu giao dịch.

> [!IMPORTANT]
> Repo hiện tại đã có `AICommandCenterConfig`, `ai_runtime_config`, OpenCore quota/billing primitives, Channels/WebSocket và Redis Streams. Vì vậy implementation **không** được bắt đầu bằng physical repo restructure, Kong, ClickHouse hoặc VIP local backend đầy đủ. Thứ tự thực thi bắt buộc đọc tại [ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md).
>
> Với mọi slice có chạm `core` contracts hoặc VIP/core integration semantics, phải đọc thêm:
> - [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md)
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)
> - [ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md)

**Phạm vi feature pack:**
- Mô hình BYOM/BYOK cho phép user tự nhập API Key
- Orchestrator điều phối 4 Agent chuyên biệt chạy parallel
- Server-Sent Events (SSE) streaming kết quả real-time
- Function Calling Tools bọc logic SSOT hiện có
- Giao diện cấu hình AI Configuration trên Frontend

---

## 2. Directory of Documents

Đây là danh sách các tài liệu kỹ thuật thuộc Gói Tính năng này. **Đội code BẮT BUỘC phải đọc theo thứ tự sau trước khi code:**

0. **Execution Rebaseline (đọc trước toàn bộ):**
   - [ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md)

1. **Roadmap & Architecture Design (High-level):**
   - [AI_TRADING_INFRASTRUCTURE_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/AI_TRADING_INFRASTRUCTURE_ROADMAP_20260501.md)
   - [MULTI_AGENT_ORCHESTRATOR_DESIGN](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_ORCHESTRATOR_DESIGN_20260501.md)

2. **Core Execution Documents (Tài liệu triển khai cấp code):**
   - [TECH SPEC](file:///c:/Mujoco%20Projects/vninvest/docs/TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md): Chứa Database Schema, API Contracts, System Prompts, Function Calling Tools definitions.
   - [IMPLEMENTATION PLAN](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md): Phân rã quá trình code thành các Milestone với file-level breakdown.
   - [TASKBOARD](file:///c:/Mujoco%20Projects/vninvest/docs/TASKBOARD_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md): Danh sách Todo list để commit và QA audit.

3. **Audit & Quality Documents:**
   - [TRACEABILITY MATRIX](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_TRACEABILITY_MATRIX_20260501.md): Mapping Requirement → Spec → Code → Test.
   - [SELF-AUDIT & TEST PROTOCOL](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md): Checklist cho mỗi slice và QA auditor.

4. **Context Documents (Đọc thêm nếu cần):**
   - [B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL_20260501.md)
   - [VIP_APP_INTERNAL_ADMIN_FEATURES](file:///c:/Mujoco%20Projects/vninvest/docs/VIP_APP_INTERNAL_ADMIN_FEATURES_20260501.md)
   - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
   - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)

---

## 3. Hard Constraints (Quy định bắt buộc)

1. **Tuyệt đối không hardcode LLM Provider:** Mọi request tới OpenAI/Anthropic/Gemini phải lấy cấu hình từ `UserAIConfiguration` của người dùng. Fallback khi chưa có key: hiển thị form yêu cầu nhập key, không crash.
2. **Tuân thủ SSOT:** Các Tools cấp cho Whale Agent bắt buộc phải gọi logic nội bộ trong `Money Flow Control Center` (tái sử dụng `runtime_policy_helpers.py` và `global_signal_universe_policy`), không để Agent tự tính toán sai lệch data.
3. **Streaming Requirement:** API trả về từ Orchestrator bắt buộc phải dùng Server-Sent Events (SSE) để render kết quả từng phần lên giao diện, chống nghẽn và timeout.
4. **Encryption Requirement:** API Keys lưu trong DB phải mã hóa bằng Fernet AES symmetric encryption. Tuyệt đối không lưu plaintext.
5. **Parallel Dispatch:** Orchestrator phải gọi 4 Agents song song bằng `asyncio.gather`, không gọi tuần tự.
6. **i18n:** Mọi text hiển thị trên UI phải qua hệ thống i18n tiếng Việt đầy đủ dấu.
7. **Agent Naming Convention:** Tên chuẩn 4 agents: `Whale Agent`, `Tech Agent`, `Risk Agent`, `Sentiment Agent`. Không dùng tên khác.
8. **Model Format Convention:** Dùng format `provider:model_name` (VD: `anthropic:claude-3-5-sonnet`).
9. **Build Variants:** Trang AI Config BYOK nằm trong `packages/web/src/pages/`, gated bằng `SHOW_VIP_PAGES` flag. KHÔNG clone frontend — dùng `REACT_APP_BUILD_TARGET=vip` để build bản VIP.
10. **VIP Local Backend:** Dữ liệu VIP (sub-users, API keys, chat logs, branding) lưu tại `packages/vip-app/local-backend/` trên máy VIP. KHÔNG gửi về Central Server.
11. **Current-code-first sequencing:** Không bắt đầu bằng physical folder move, Kong, ClickHouse hoặc VIP local backend đầy đủ. Phải tái sử dụng `AICommandCenterConfig`, OpenCore entitlement primitives, Redis Streams và Channels trước.

---

## 4. Anchor Files (Các file liên quan trực tiếp)

> **Lưu ý về đường dẫn:** Hiện tại dự án dùng chiến lược Monorepo with Boundaries. Paths dưới đây phản ánh cấu trúc **hiện tại** (`backend/`, `frontend/`). Khi hoàn thành bước restructure sang `packages/`, paths sẽ chuyển thành `packages/core/backend/`, `packages/web/src/`.

### Backend (sẽ tạo mới / chỉnh sửa)
- `backend/portfolio/models.py` — Thêm model `UserAIConfiguration`
- `backend/portfolio/ai_services/` — **[NEW]** Thư mục mới chứa Orchestrator
- `backend/portfolio/ai_services/orchestrator.py` — **[NEW]** Class `AITradingOrchestrator`
- `backend/portfolio/ai_services/tools/whale_tools.py` — **[NEW]** Function Calling wrapper
- `backend/portfolio/ai_services/tools/tech_tools.py` — **[NEW]** Function Calling wrapper
- `backend/portfolio/ai_services/tools/risk_tools.py` — **[NEW]** Function Calling wrapper
- `backend/portfolio/ai_services/tools/sentiment_tools.py` — **[NEW]** Function Calling wrapper
- `backend/portfolio/ai_services/encryption.py` — **[NEW]** Fernet encrypt/decrypt helpers
- `backend/portfolio/views.py` — Thêm SSE streaming endpoint
- `backend/portfolio/urls.py` — Đăng ký routes mới

### Backend (SSOT sources — CHỈ ĐỌC, KHÔNG SỬA)
- `backend/portfolio/services/runtime_policy_helpers.py` — Whale flow logic
- `backend/portfolio/services/global_signal_policy_helpers.py` — Signal universe

### Frontend (sẽ tạo mới / chỉnh sửa)
- `frontend/src/components/AIConfigurationPanel.jsx` — **[NEW]** Form nhập API Keys + chọn Model
- `frontend/src/components/AIAdvisoryPanel.jsx` — Chuyển từ REST sang SSE
- `frontend/src/api/client.js` — Thêm endpoints mới

### Tests
- `backend/portfolio/tests/test_ai_configuration.py` — **[NEW]** Test BYOM CRUD + encryption
- `backend/portfolio/tests/test_ai_orchestrator.py` — **[NEW]** Test debate flow
- `backend/portfolio/tests/test_ai_tools.py` — **[NEW]** Test function calling wrappers

---

## 5. Build & Test Commands

### Frontend build
```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### Backend focused suites
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_ai_configuration --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_ai_orchestrator --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_ai_tools --keepdb
Pop-Location
```

### Migration
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py makemigrations portfolio
../.venv/Scripts/python.exe manage.py migrate
Pop-Location
```

---

## 6. Operating Discipline

1. Làm theo slice nhỏ, focused, không mở rộng bề mặt ngoài task hiện tại.
2. Sau edit thực chất đầu tiên phải chạy focused validation ngay.
3. Không đánh dấu xong nếu chưa cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
4. Với slice runtime/UI phải rebuild hoặc restart stack bị ảnh hưởng.
5. Không dùng workaround làm sai SSOT logic hiện có trong `Money Flow Control Center`.
6. Mọi LLM provider call phải thông qua abstraction layer, không import trực tiếp `openai` SDK trong orchestrator logic.

---

## 7. Evidence Obligations

Mỗi slice phải có:
1. Danh sách file đổi.
2. Command validation và kết quả.
3. Screenshot/video nếu là UI.
4. Payload snapshot nếu chạm contract (SSE event format, API response).
5. Residual risk note nếu còn.
6. Encryption audit: confirm DB dump không lộ plaintext key.

---

## 8. Sign-off / Audit Gate

Đội code chỉ đánh dấu hoàn thành Task khi:
- [ ] API payload snapshot chứng minh SSE stream đúng format.
- [ ] Giao diện cấu hình BYOM hoạt động (nhập key, lưu, load lại).
- [ ] Debate flow chạy end-to-end với ít nhất 2 providers khác nhau.
- [ ] Unit tests toàn bộ PASS.
- [ ] Regression test `Money Flow Control Center` endpoints không bị ảnh hưởng.
- [ ] `CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật.
