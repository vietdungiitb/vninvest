# TỔNG HỢP TÀI LIỆU: KIẾN TRÚC DOANH NGHIỆP VNINVEST (B2B MCP & AI TRADING)

**Date:** 2026-05-01
**Mục đích:** Đây là **Mục lục Tổng (Master Index)** hệ thống hóa toàn bộ các tài liệu nghiên cứu và thiết kế kiến trúc mà chúng ta đã xây dựng để nâng cấp VNInvest từ một Web App thành một **Nền tảng Bán Dữ Liệu (Data API Provider)** và **Hệ sinh thái AI Trading (White-label SaaS)**.

---

## PHẦN 1: TẦM NHÌN VÀ KIẾN TRÚC VĨ MÔ (MACRO ARCHITECTURE)
*Gói tài liệu dành cho Ban Giám đốc (C-Level) và Kiến trúc sư Hệ thống để định hình mô hình kinh doanh.*

1. **[MCP_PLATFORM_TRANSFORMATION_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/MCP_PLATFORM_TRANSFORMATION_ROADMAP.md)**
   *   Tầm nhìn chuyển đổi VNInvest thành MCP Server, cung cấp Data API (Whale Flow, KLine) cho AI Bots của khách hàng tự gọi.
2. **[VNINVEST_OVERALL_SYSTEM_ARCHITECTURE](file:///c:/Mujoco%20Projects/vninvest/docs/VNINVEST_OVERALL_SYSTEM_ARCHITECTURE_20260501.md)**
   *   Sơ đồ luồng hoạt động (Mermaid Diagram) chia hệ thống thành 3 thực thể: Lõi Máy Mẹ (Central Data), VNInvest Web (SaaS) và VNInvest VIP Client (B2B).
3. **[B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL_20260501.md)**
   *   Chiến lược tách bạch cơ sở dữ liệu (Data Segregation). Mô hình B2B2C cho phép Khách hàng VIP (Quỹ, Broker) có User con riêng của họ.

---

## PHẦN 2: CHIẾN LƯỢC CÔNG NGHỆ & MÃ NGUỒN (TECH STACK & CODEBASE)
*Gói tài liệu dành cho Tech Lead / DevOps để chuẩn bị hạ tầng chịu tải lớn.*

4. **[HIGH_CONCURRENCY_TECH_STACK_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/HIGH_CONCURRENCY_TECH_STACK_PROPOSAL_20260501.md)**
   *   Công nghệ áp dụng để chịu tải **10,000 người dùng đồng thời (CCU)**: Kong API Gateway, Django ASGI (Uvicorn), ClickHouse (OLAP), Redis Pub/Sub, Server-Sent Events (SSE).
5. **[REPO_STRATEGY_AND_EXECUTION_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md)**
   *   Chiến lược **Monorepo with Boundaries**: Giữ 1 repo, phân vùng 4 Packages (`core`, `web`, `mobile`, `vip-app`) với boundary rules nghiêm ngặt. Tách repo khi có khách VIP đầu tiên.
6. **[CODEBASE_RESTRUCTURING_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md)**
   *   Bản thiết kế ánh xạ: Cấu trúc thư mục `packages/` mới, mapping từ code hiện tại (`backend/`, `frontend/`, `mobile-app/`) sang 4 Packages trong Monorepo.

---

## PHẦN 3: LÕI TRÍ TUỆ NHÂN TẠO (AI INFRASTRUCTURE)
*Gói tài liệu thiết kế bộ não Multi-Agent Debate.*

7. **[AI_TRADING_INFRASTRUCTURE_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/AI_TRADING_INFRASTRUCTURE_ROADMAP_20260501.md)**
   *   Lộ trình 4 giai đoạn tiến hóa AI của VNInvest.
8. **[MULTI_AGENT_ORCHESTRATOR_DESIGN](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_ORCHESTRATOR_DESIGN_20260501.md)**
   *   Luồng hoạt động tranh luận (Debate) của 4 Agents (Whale, Tech, Risk, Sentiment) và cơ chế BYOM/BYOK.
9. **[VIP_APP_INTERNAL_ADMIN_FEATURES](file:///c:/Mujoco%20Projects/vninvest/docs/VIP_APP_INTERNAL_ADMIN_FEATURES_20260501.md)**
   *   Phác thảo 5 tính năng quản trị cực kỳ giá trị dành riêng cho chủ Quỹ VIP (AI Prompt Studio, Sub-User Management, White-label Branding).

---

## PHẦN 4: TÀI LIỆU TRIỂN KHAI CHO ĐỘI CODE (EXECUTION HANDOFF)
*Gói tài liệu cầm tay chỉ việc dành cho lập trình viên (Developer Handoff Pack).*

10. **[MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER_20260501.md)**
    *   Tài liệu bao trùm: Hard Constraints, Anchor Files, Build/Test Commands, Operating Discipline, Evidence Obligations.
11. **[TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)**
    *   Định nghĩa rõ Database Schema (`UserAIConfiguration`), Mã hóa Fernet, API Contracts (REST + SSE), JSON Function Calling cho 4 AI Tools, System Prompts, Auth & Rate Limiting.
12. **[IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)**
    *   Kế hoạch triển khai kỹ thuật chia làm 5 bước an toàn, kèm file-level breakdown, verification commands và rollback procedures.
13. **[TASKBOARD_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/TASKBOARD_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)**
    *   Danh sách Todo-list (Jira-style) với Owner, Priority, ETA, Dependencies cho đội Backend và Frontend.
14. **[TRACEABILITY_MATRIX_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_TRACEABILITY_MATRIX_20260501.md)**
    *   Mapping Requirement → Tech Spec → Code Location → Test Coverage. Bao gồm SSOT Compliance Map.
15. **[SELF_AUDIT_AND_TEST_PROTOCOL_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md)**
    *   Checklist QA cho mỗi slice: Code Quality, Functional, Security, Regression. Release Gates và Known Risks.

---

## PHẦN 5: CHIẾN LƯỢC OPEN CORE & PRICING
*Gói tài liệu dành cho Product Owner và Ban Giám đốc để thiết kế mô hình kinh doanh Open Core, phân chia ranh giới tính năng và chiến lược định giá.*

16. **[OPEN_CORE_STRATEGY_MASTER_FINAL](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md)**
    *   Bản tóm tắt điều hành (Executive Summary) về chiến lược Open Core. Quyết định hướng đi: Dual-lane SaaS + self-host, trong đó Community lane triển khai qua Build Variants.
17. **[OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md)**
    *   Ma trận phân định ranh giới tính năng (Feature Boundary) giữa bản Community (Free), Pro Individual và Pro Team dựa trên User Value, Monetization Leverage và Risk.
18. **[OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md)**
    *   Bản nháp (Draft) về chiến lược định giá và đóng gói (Pricing and Packaging) cho các gói sản phẩm, tập trung vào Annual-first pricing và giới hạn quota.
