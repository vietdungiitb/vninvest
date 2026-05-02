# TỔNG HỢP TÀI LIỆU: KIẾN TRÚC DOANH NGHIỆP VNINVEST (B2B MCP & AI TRADING)

**Date:** 2026-05-01
**Mục đích:** Đây là **Mục lục Tổng (Master Index)** hệ thống hóa toàn bộ các tài liệu nghiên cứu và thiết kế kiến trúc mà chúng ta đã xây dựng để nâng cấp VNInvest từ một Web App thành một **Nền tảng Bán Dữ Liệu (Data API Provider)** và **Hệ sinh thái AI Trading (White-label SaaS)**.

> [!IMPORTANT]
> Bộ tài liệu bên dưới mô tả **target-state architecture**. Thứ tự triển khai bám theo code hiện tại được chốt tại [ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md). Khi có xung đột giữa kiến trúc đích và thực tế repo hiện tại, **Rebaseline** là tài liệu ưu tiên cho sequencing và entry conditions.
>
> Entry point chính thức cho mọi việc liên quan `core` hiện tại là bộ tài liệu sau:
> - [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md)
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)
> - [ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)
> - [ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md)
> - [ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)
> - [ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md)
>
> Visual companion de doc nhanh tong the:
> - [SYSTEM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/SYSTEM_ARCHITECTURE_BLUEPRINT_20260502.md)
>
> Sequencing chinh thuc cho package track song song:
> - [PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502.md)

---

## PHẦN 1A: CORE PLATFORM FOUNDATION (CURRENT-CODE-ALIGNED)
*Bộ tài liệu chính thức để chốt `core` trước khi triển khai package split, partner APIs hay schema migrations lớn.*

1. **[ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md)**
   *   Blueprint tổng thể cho `core`: boundaries, services architecture, global APIs, contract-first và schema-last gates.
2. **[ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)**
   *   Bộ contract pack cho `core`: resource catalog, field dictionary, endpoint matrix, auth/scope/meter matrix, error model và change policy.
3. **[ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)**
   *   Kiến trúc UI cho Central Operator Admin, Tenant Admin Console và ranh giới với VIP Internal Admin; chốt placement ở `web`, không ở `core`.
4. **[ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md)**
   *   Ma trận roles, abilities, capability claims và route gating cho Central Operator Admin và Tenant Admin Console; bám theo CASL/ProtectedRoute hiện có.
5. **[ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)**
   *   Screen-level spec cho từng route admin: widgets, actions, states, APIs và implementation shape ở `frontend/src/`.
6. **[ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)**
   *   Backlog contract cho operator admin APIs nội bộ: overview, tenant registry, runtime health/jobs, audit trace và các write actions P1.
7. **[ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md)**
   *   Hợp đồng chi tiết cho từng operator read endpoint P0: query params, response fields, list ordering và degrade semantics.
8. **[ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)**
   *   Contract payload backend dùng để bootstrap abilities, navigation gating và admin surfaces cho frontend.
9. **[ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md)**
   *   Taskboard execution chia `Core Admin` thành các slice frontend/backend theo thứ tự contract-first.
10. **[ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)**
   *   Checklist freeze cho 6 resource đầu tiên: tenant, service account, PAT, usage meter, symbol snapshot, session facts.
11. **[ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)**
   *   Chiến lược storage và schema theo hướng logical ownership first, read-model first, physical schema split sau cùng.
12. **[ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)**
   *   Phân tích chi tiết candidate schema, quan hệ dữ liệu, cardinality, control-plane/commercial/data-plane/op-audit families.
13. **[ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md)**
   *   Draft contract chi tiết cho partner/vip-app APIs: control-plane, commercial-plane, data-plane, headers, errors.

---

## PHẦN 1: TẦM NHÌN VÀ KIẾN TRÚC VĨ MÔ (MACRO ARCHITECTURE)
*Gói tài liệu dành cho Ban Giám đốc (C-Level) và Kiến trúc sư Hệ thống để định hình mô hình kinh doanh.*

1. **[MCP_PLATFORM_TRANSFORMATION_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/MCP_PLATFORM_TRANSFORMATION_ROADMAP.md)**
   *   Tầm nhìn chuyển đổi VNInvest thành MCP Server, cung cấp Data API (Whale Flow, KLine) cho AI Bots của khách hàng tự gọi.
2. **[VNINVEST_OVERALL_SYSTEM_ARCHITECTURE](file:///c:/Mujoco%20Projects/vninvest/docs/VNINVEST_OVERALL_SYSTEM_ARCHITECTURE_20260501.md)**
   *   Sơ đồ luồng hoạt động (Mermaid Diagram) chia hệ thống thành 3 thực thể: Lõi Máy Mẹ (Central Data), VNInvest Web (SaaS) và VNInvest VIP Client (B2B).
3. **[B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL_20260501.md)**
   *   Chiến lược tách bạch cơ sở dữ liệu (Data Segregation). Mô hình B2B2C cho phép Khách hàng VIP (Quỹ, Broker) có User con riêng của họ.
4. **[SYSTEM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/SYSTEM_ARCHITECTURE_BLUEPRINT_20260502.md)**
   *   Tài liệu trực quan chuẩn hóa cho Core, Web và VIP-App; hình ảnh hóa topology, database ownership, API mesh và build model, nhưng không thay thế SSOT kiến trúc tích hợp.

---

## PHẦN 2: CHIẾN LƯỢC CÔNG NGHỆ & MÃ NGUỒN (TECH STACK & CODEBASE)
*Gói tài liệu dành cho Tech Lead / DevOps để chuẩn bị hạ tầng chịu tải lớn.*

4. **[HIGH_CONCURRENCY_TECH_STACK_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/HIGH_CONCURRENCY_TECH_STACK_PROPOSAL_20260501.md)**
   *   Công nghệ áp dụng để chịu tải **10,000 người dùng đồng thời (CCU)**: Kong API Gateway, Django ASGI (Uvicorn), ClickHouse (OLAP), Redis Pub/Sub, Server-Sent Events (SSE).
5. **[REPO_STRATEGY_AND_EXECUTION_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md)**
   *   Chiến lược **Monorepo with Boundaries**: Giữ 1 repo, phân vùng 5 Packages (`core`, `web`, `opencore`, `mobile`, `vip-app`) với boundary rules nghiêm ngặt. Tách repo khi có khách VIP đầu tiên.
6. **[CODEBASE_RESTRUCTURING_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md)**
   *   Bản thiết kế ánh xạ: Cấu trúc thư mục `packages/` mới, mapping từ code hiện tại (`backend/`, `frontend/`, `mobile-app/`) sang 5 Packages trong Monorepo, bao gồm `packages/opencore` cho funnel Community/Self-host.
7. **[WEB_VIP_APP_SHARED_FRONTEND_BLUEPRINT](file:///c:/Mujoco%20Projects/vninvest/docs/WEB_VIP_APP_SHARED_FRONTEND_BLUEPRINT_20260502.md)**
   *   Blueprint thực dụng cho hạng mục `web` va `vip-app`: 1 frontend source, build variants, adapter seam, route taxonomy va ownership rules de code mot lan cho ca SaaS va VIP, trong khi OpenCore duoc package hoa o package rieng.
8. **[CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE](file:///c:/Mujoco%20Projects/vninvest/docs/CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE_20260502.md)**
   *   SSOT kien truc tich hop cho `core`, `web`, `opencore`, `vip-app`: ownership matrix, database planes, API families, auth model va workstreams lam co so cho implementation plans chi tiet.
   *   Companion execution plan: **[PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502.md)**
   *   Ke hoach thuc thi owner-approved cho `packages-first parallel migration`: governance freeze, package scaffold, parity gates, cutover va legacy decommission.

---

## PHẦN 3: LÕI TRÍ TUỆ NHÂN TẠO (AI INFRASTRUCTURE)
*Gói tài liệu thiết kế bộ não Multi-Agent Debate.*

9. **[AI_TRADING_INFRASTRUCTURE_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/AI_TRADING_INFRASTRUCTURE_ROADMAP_20260501.md)**
   *   Lộ trình 4 giai đoạn tiến hóa AI của VNInvest.
10. **[MULTI_AGENT_ORCHESTRATOR_DESIGN](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_ORCHESTRATOR_DESIGN_20260501.md)**
   *   Luồng hoạt động tranh luận (Debate) của 4 Agents (Whale, Tech, Risk, Sentiment) và cơ chế BYOM/BYOK.
11. **[VIP_APP_INTERNAL_ADMIN_FEATURES](file:///c:/Mujoco%20Projects/vninvest/docs/VIP_APP_INTERNAL_ADMIN_FEATURES_20260501.md)**
   *   Phác thảo 5 tính năng quản trị cực kỳ giá trị dành riêng cho chủ Quỹ VIP (AI Prompt Studio, Sub-User Management, White-label Branding).

---

## PHẦN 4: TÀI LIỆU TRIỂN KHAI CHO ĐỘI CODE (EXECUTION HANDOFF)
*Gói tài liệu cầm tay chỉ việc dành cho lập trình viên (Developer Handoff Pack).*

12. **[MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER_20260501.md)**
    *   Tài liệu bao trùm: Hard Constraints, Anchor Files, Build/Test Commands, Operating Discipline, Evidence Obligations.
13. **[TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)**
    *   Định nghĩa rõ Database Schema (`UserAIConfiguration`), Mã hóa Fernet, API Contracts (REST + SSE), JSON Function Calling cho 4 AI Tools, System Prompts, Auth & Rate Limiting.
14. **[IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)**
    *   Kế hoạch triển khai kỹ thuật chia làm 5 bước an toàn, kèm file-level breakdown, verification commands và rollback procedures.
15. **[TASKBOARD_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/TASKBOARD_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)**
    *   Danh sách Todo-list (Jira-style) với Owner, Priority, ETA, Dependencies cho đội Backend và Frontend.
16. **[TRACEABILITY_MATRIX_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_TRACEABILITY_MATRIX_20260501.md)**
    *   Mapping Requirement → Tech Spec → Code Location → Test Coverage. Bao gồm SSOT Compliance Map.
17. **[SELF_AUDIT_AND_TEST_PROTOCOL_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md)**
    *   Checklist QA cho mỗi slice: Code Quality, Functional, Security, Regression. Release Gates và Known Risks.
18. **[PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER](file:///c:/Mujoco%20Projects/vninvest/docs/PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER_20260502.md)**
   *   Handoff pack cho baseline đầu tiên của `packages/core`, `packages/web`, `shared`; chốt triad, taskboard, contracts-first shell baseline và validation path trước khi đi vào feature slices.

---

## PHẦN 5: CHIẾN LƯỢC OPEN CORE & PRICING
*Gói tài liệu dành cho Product Owner và Ban Giám đốc để thiết kế mô hình kinh doanh Open Core, phân chia ranh giới tính năng và chiến lược định giá.*

19. **[OPEN_CORE_STRATEGY_MASTER_FINAL](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md)**
    *   Bản tóm tắt điều hành (Executive Summary) về chiến lược Open Core. Quyết định hướng đi: Dual-lane SaaS + self-host, trong đó Community lane triển khai qua Build Variants.
20. **[OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md)**
    *   Ma trận phân định ranh giới tính năng (Feature Boundary) giữa bản Community (Free), Pro Individual và Pro Team dựa trên User Value, Monetization Leverage và Risk.
21. **[OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md)**
    *   Bản nháp (Draft) về chiến lược định giá và đóng gói (Pricing and Packaging) cho các gói sản phẩm, tập trung vào Annual-first pricing và giới hạn quota.
