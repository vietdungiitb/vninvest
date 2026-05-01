# MULTI-AGENT AI TRADING INFRASTRUCTURE HANDOFF MASTER

**Date:** 2026-05-01
**Domain:** AI Trading, AI Advisory, Multi-Agent Systems, Backend, Frontend.

## 1. Executive Summary
Bản Handoff này là bộ tài liệu hoàn chỉnh để Đội Phát triển (Engineering Team) tiến hành triển khai kiến trúc Multi-Agent Debate thay thế cho tính năng AI Advisory tĩnh hiện tại của VNINVEST. Hệ thống cho phép cấu hình cá nhân hóa LLM API Keys (BYOM/BYOK) và chạy luồng tranh luận 4 Agents (Whale, Tech, Risk, Sentiment) để chốt tín hiệu giao dịch.

## 2. Directory of Documents
Đây là danh sách các tài liệu kỹ thuật thuộc Gói Tính năng này. **Đội code BẮT BUỘC phải đọc theo thứ tự sau trước khi code:**

1. **Roadmap & Architecture Design (High-level):**
   - [AI_TRADING_INFRASTRUCTURE_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/AI_TRADING_INFRASTRUCTURE_ROADMAP_20260501.md)
   - [MULTI_AGENT_ORCHESTRATOR_DESIGN](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_ORCHESTRATOR_DESIGN_20260501.md)

2. **Core Execution Documents (Tài liệu triển khai cấp code):**
   - [TECH SPEC](file:///c:/Mujoco%20Projects/vninvest/docs/TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md): Chứa Database Schema, API Contracts, System Prompts.
   - [IMPLEMENTATION PLAN](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md): Phân rã quá trình code thành các Milestone.
   - [TASKBOARD](file:///c:/Mujoco%20Projects/vninvest/docs/TASKBOARD_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md): Danh sách Todo list để commit và QA audit.

## 3. Hard Constraints (Quy định bắt buộc)
1. **Tuyệt đối không hardcode LLM Provider:** Mọi request tới OpenAI/Anthropic/Gemini phải lấy cấu hình từ `UserAIConfiguration` của người dùng.
2. **Tuân thủ SSOT:** Các Tools cấp cho Whale Agent bắt buộc phải gọi logic nội bộ trong `Money Flow Control Center` (tái sử dụng `runtime_policy_helpers.py`), không để Agent tự tính toán sai lệch data.
3. **Streaming Requirement:** API trả về từ Orchestrator bắt buộc phải dùng Server-Sent Events (SSE) để render kết quả từng phần lên giao diện, chống nghẽn và timeout.

## 4. Sign-off / Audit
Đội code chỉ đánh dấu hoàn thành Task khi có đủ API payload snapshot và giao diện cấu hình BYOM hoạt động.
