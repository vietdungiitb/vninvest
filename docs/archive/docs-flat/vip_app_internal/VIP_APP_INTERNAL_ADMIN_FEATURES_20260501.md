# TÍNH NĂNG QUẢN TRỊ NỘI BỘ (INTERNAL ADMIN) CHO VIP APP

**Date:** 2026-05-01  
**Updated:** 2026-05-01 — Tích hợp chiến lược Build Variants + Local Backend

Mặc dù chúng ta xóa bỏ các chức năng "Super Admin" của hệ thống gốc VNInvest khỏi bản VIP (để bảo vệ dữ liệu tổng), bản thân **VIP App bắt buộc phải có một hệ thống Quản trị Nội bộ riêng** dành cho người Quản lý của Quỹ Đầu tư / Công ty Môi giới (Chủ sở hữu bản VIP đó).

Dưới đây là phác thảo 5 Module Quản trị cốt lõi cần phải xây dựng.

> [!NOTE]
> **Kiến trúc triển khai:** 5 module dưới đây nằm trong **cùng 1 frontend source** (`packages/web/src/pages/`), gated bằng `SHOW_VIP_PAGES` flag (chỉ hiện khi `BUILD_TARGET=vip`). Dữ liệu của các module này được lưu trên **Local Backend** (`packages/vip-app/local-backend/`) chạy trên máy VIP, **KHÔNG** gửi về Central Server. Chi tiết kiến trúc xem tại [CODEBASE_RESTRUCTURING_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md).
>
> Mọi kết nối từ VIP local backend lên `core` phải bám theo bộ partner/core docs sau:
> - [ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md)
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)
>
> `VIP Internal Admin` khac voi `Core Admin UI` cua VNInvest central. Ca hai cung co the dung chung frontend source trong `web`, nhung `VIP Internal Admin` doc/ghi chu yeu vao `packages/vip-app/local-backend/`, con `Core Admin UI` la operator/tenant console noi chuyen voi `core`.

---

## 1. Module Quản lý Tổ chức & Tùy biến Giao diện (White-Label Settings)
*Mục đích: Biến phần mềm VNInvest thành phần mềm mang thương hiệu riêng của Quỹ.*
*   **Branding (Thương hiệu):** Upload Logo của Quỹ, đổi tên hiển thị trên Header/Title trình duyệt, đổi màu sắc chủ đạo (Theme colors).
*   **Domain Settings:** Cấu hình tên miền nội bộ (Ví dụ: `trade.alpha-fund.com`).

## 2. Module Quản lý Khách hàng (Sub-User Management)
*Mục đích: Quỹ VIP (Broker) cần tạo tài khoản cho nhân viên hoặc khách hàng của chính họ.*
*   **User CRUD:** Thêm mới, Khóa, Xóa tài khoản khách hàng.
*   **Role-Based Access Control (RBAC):** Phân quyền chi tiết:
    *   *Basic User:* Chỉ được xem KLineChart và giá.
    *   *AI User:* Được chat với AI Advisory (tiêu tốn API OpenAI của Quỹ).
    *   *Pro User:* Được dùng tính năng Backtest.

## 3. Module Cấu hình Cốt lõi (Core Connections)
*Mục đích: Khai báo các "Chìa khóa" để phần mềm hoạt động.*
*   **VNInvest Connection:** Nhập `VNInvest API Token` (để có quyền tải dữ liệu Whale Flow, Intraday Ticks từ máy mẹ). Cảnh báo màn hình màu đỏ nếu Token hết hạn hoặc bị VNInvest khóa.
*   **LLM API Keys:** Nơi nhập API Key của OpenAI, Anthropic, Gemini. Hỗ trợ tính năng "Xoay vòng Key" (Key Rotation) nếu Quỹ có nhiều tài khoản OpenAI để tránh bị Rate Limit.

## 4. AI Prompt Engineering Studio (Tinh chỉnh Trí tuệ Nhân tạo)
*Mục đích: Đây là tính năng "Ăn tiền" nhất của bản VIP. Quỹ đầu tư có quyền tùy biến tư duy của AI theo trường phái giao dịch của họ.*
*   **Agent Prompt Editor:** Trình soạn thảo văn bản cho phép sửa đổi *System Prompts* của 4 Agents (Whale, Tech, Risk, Sentiment). 
    *   *Ví dụ:* Quỹ A theo trường phái an toàn, họ sẽ sửa Prompt của Risk Agent: "Tuyệt đối đánh giá SELL nếu thanh khoản trung bình 20 phiên dưới 50 tỷ".
*   **Custom Rules:** Thêm các luật Screener riêng lẻ của Quỹ vào Hệ thống AI (không phụ thuộc vào VNInvest).

## 5. Thống kê & Quản trị Chi phí (Usage Analytics)
*Mục đích: Quản lý chi phí tài nguyên, tránh việc User con làm cháy tài khoản API.*
*   **LLM Token Usage:** Thống kê xem User nào (Khách hàng nào) đang chat với AI nhiều nhất, tiêu tốn bao nhiêu USD tiền API của Quỹ trong tháng.
*   **VNInvest API Quota:** Hiển thị thanh trạng thái (Progress Bar) cho biết Quỹ đã gọi bao nhiêu Request tới VNInvest Central trong ngày. Báo động vàng nếu sắp hết hạn mức gói mua từ VNInvest.
*   **Audit Logs:** Lưu lại toàn bộ lịch sử các câu hỏi (Chat Logs) của khách hàng với AI để Quỹ có thể phân tích xem khách hàng của họ đang quan tâm đến mã cổ phiếu nào nhất.

---

## 💡 Tổng Kết
Hệ thống **VIP Internal Admin** này thực chất biến `vninvest-vip-app` thành một sản phẩm phần mềm **SaaS thu nhỏ** (Mini SaaS). Chủ Quỹ mua nó từ bạn, cài lên server, và lập tức họ trở thành một "Nhà cung cấp dịch vụ" cho khách hàng của riêng họ.
