# TRACEABILITY MATRIX: MULTI-AGENT AI TRADING INFRASTRUCTURE

**Date:** 2026-05-01  
**Purpose:** Mapping từ Requirement → Tech Spec → Code Location → Test Coverage để đảm bảo không có gap giữa thiết kế và triển khai.

---

## 1. Feature Requirements → Spec → Code → Test

| ID | Requirement | Tech Spec Section | Code Location (Target) | Test |
|----|------------|-------------------|----------------------|------|
| REQ-01 | User có thể nhập và lưu API Keys (BYOM/BYOK) | TS §1 Database Schema, TS §2.1 API Config | `backend/portfolio/models.py` → `UserAIConfiguration` | `test_ai_configuration.py` |
| REQ-02 | API Keys được mã hóa Fernet trong DB | TS §1 Note Encryption | `backend/portfolio/ai_services/encryption.py` | `test_ai_configuration.py::test_encryption` |
| REQ-03 | User có thể chọn Model cho từng Agent | TS §2.1 Payload `models` field | `backend/portfolio/models.py` → `*_agent_model` fields | `test_ai_configuration.py::test_model_assignment` |
| REQ-04 | Whale Agent gọi được CVD, Institutional Strength | TS §3 Tool `get_whale_flow_data` | `backend/portfolio/ai_services/tools/whale_tools.py` | `test_ai_tools.py::test_whale_tools` |
| REQ-05 | Tech Agent gọi được KLine, MA, RSI | TS §3 (cần bổ sung) | `backend/portfolio/ai_services/tools/tech_tools.py` | `test_ai_tools.py::test_tech_tools` |
| REQ-06 | Risk Agent gọi được Global Screener Signals | TS §3 (cần bổ sung) | `backend/portfolio/ai_services/tools/risk_tools.py` | `test_ai_tools.py::test_risk_tools` |
| REQ-07 | Sentiment Agent đọc được tin tức/sentiment score | TS §3 (cần bổ sung) | `backend/portfolio/ai_services/tools/sentiment_tools.py` | `test_ai_tools.py::test_sentiment_tools` |
| REQ-08 | Orchestrator gọi 4 Agents song song (async) | Orchestrator Design §3 | `backend/portfolio/ai_services/orchestrator.py` → `asyncio.gather` | `test_ai_orchestrator.py::test_parallel_dispatch` |
| REQ-09 | Orchestrator tổng hợp kết quả thành 1 Decision | Orchestrator Design §4 | `backend/portfolio/ai_services/orchestrator.py` → `synthesize()` | `test_ai_orchestrator.py::test_synthesis` |
| REQ-10 | API trả về SSE stream từng bước | TS §2.2 SSE Format | `backend/portfolio/views.py` → `StreamingHttpResponse` | `test_ai_orchestrator.py::test_sse_stream` |
| REQ-11 | Frontend hiển thị loading states theo từng Agent | Impl Plan Step 4 | `frontend/src/components/AIAdvisoryPanel.jsx` | Manual browser test |
| REQ-12 | Frontend có form nhập API Keys | Impl Plan Step 4 | `frontend/src/components/AIConfigurationPanel.jsx` | Manual browser test |
| REQ-13 | Fallback khi user chưa nhập API Key | Handoff §3.1 | `backend/portfolio/ai_services/orchestrator.py` → validate | `test_ai_orchestrator.py::test_no_key_fallback` |
| REQ-14 | Trọng số agents: Whale 40%, Tech 30%, Risk 20%, Sentiment 10% | TS §4 System Prompts | `backend/portfolio/ai_services/orchestrator.py` → prompts | `test_ai_orchestrator.py::test_weighting` |

---

## 2. SSOT Compliance Map

Đảm bảo Tools không tạo parallel writer, chỉ **đọc** từ SSOT hiện có.

| Tool | SSOT Source Function | File Source | Access Mode |
|------|---------------------|-------------|-------------|
| `get_whale_flow_data` | `global_signal_universe_policy.get_realtime_whale_metrics()` | `runtime_policy_helpers.py` | READ-ONLY |
| `get_technical_indicators` | Existing KLine/MA/RSI query functions | `portfolio/services/` | READ-ONLY |
| `get_risk_assessment` | Global Screener signals | `global_signal_policy_helpers.py` | READ-ONLY |
| `get_sentiment_score` | News ingestion + NLP scoring | `opennews-main` service | READ-ONLY |

---

## 3. Gap Analysis

| Gap ID | Mô tả | Status | Remediation |
|--------|-------|--------|-------------|
| GAP-01 | Tech Spec chỉ có Tool definition cho `get_whale_flow_data`, thiếu 3 tools còn lại | 🔴 OPEN | Bổ sung JSON Schema cho Tech, Risk, Sentiment tools vào Tech Spec |
| GAP-02 | Sentiment Agent phụ thuộc vào `opennews-main` chưa có API contract rõ ràng | 🟡 OPEN | Xác định API hoặc defer Sentiment Agent sang Phase 3 |
| GAP-03 | Backtest Engine (Phase 2 Roadmap) chưa có entry trong Traceability | ℹ️ DEFERRED | Phase 2 — sẽ bổ sung khi bắt đầu Phase 2 |

---

## 4. Cross-Document Reference Integrity

| From | To | Verified |
|------|----|----------|
| Handoff Master §2 | AI Trading Roadmap | ✅ |
| Handoff Master §2 | Orchestrator Design | ✅ |
| Handoff Master §2 | Tech Spec | ✅ |
| Handoff Master §2 | Implementation Plan | ✅ |
| Handoff Master §2 | Taskboard | ✅ |
| Handoff Master §2 | Traceability Matrix (this doc) | ✅ |
| Handoff Master §2 | Self-Audit Protocol | ✅ |
| Tech Spec §3 → Tool `get_whale_flow_data` | `runtime_policy_helpers.py` | ✅ |
| Orchestrator Design §3 → Model format | Tech Spec §1 `provider:model` | ✅ |
