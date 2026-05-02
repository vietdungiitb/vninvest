# ĐỀ XUẤT CƠ CẤU LẠI SOURCE CODE (CODEBASE RESTRUCTURING)

**Updated:** 2026-05-01 — Chuyển từ "4 Repos riêng biệt" sang "4 Packages trong Monorepo"

Dựa trên cấu trúc thư mục hiện tại của dự án VNInvest (`backend`, `frontend`, `mobile-app`, `opennews-main`, `infra`...), để đạt được mô hình B2B MCP Enterprise, chúng ta sẽ tổ chức lại Monorepo hiện tại thành **4 Packages có ranh giới rõ ràng** (Monorepo with Boundaries). Khi đến giai đoạn phân phối cho khách VIP, mới tách thành repos riêng.

> [!NOTE]
> Quyết định giữ Monorepo đã được Owner phê duyệt. Chi tiết lý do và trigger conditions tách repo xem tại [REPO_STRATEGY_AND_EXECUTION_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md).

> [!IMPORTANT]
> Tài liệu này là **folder target map**, không phải chỉ thị move toàn bộ runtime code ngay trong PR đầu tiên. Theo [EXECUTION_REBASELINE](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md), canonical runtime ở phase đầu vẫn là `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/`. Boundary artifacts như `shared/api-contracts/` và `frontend/src/config/buildTarget.js` đi trước, folder move đi sau.
>
> Khi chạm tới `packages/core/`, bộ tài liệu phải dùng làm chuẩn review là:
> - [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md)
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)

## Quy tắc chuyển tiếp bắt buộc

Trước khi bắt đầu move vật lý sang `packages/`, phải đạt đủ các điều kiện sau:

1. Core API contracts và PAT/tenant semantics đã ổn định trên backend hiện tại.
2. Build variants đã chạy được trong frontend source hiện tại.
3. Docker/runtime/test commands đã được chuẩn hóa theo boundary mới.
4. Không còn import/runtime assumption cứng bám vào paths cũ mà chưa có alias hoặc workspace update.

Dưới đây là sơ đồ ánh xạ (Mapping) từ code hiện tại sang cấu trúc Packages mới:

---

## Cấu trúc Thư mục Mục tiêu

```
vninvest/                              ← Monorepo (giữ nguyên)
├── packages/
│   ├── core/                          ← Tương lai → repo vninvest-core
│   │   ├── backend/                   ← từ ./backend
│   │   ├── opennews-main/             ← từ ./opennews-main
│   │   ├── infra/                     ← từ ./infra
│   │   ├── scripts/                   ← từ ./scripts
│   │   └── docker-compose.core.yml
│   │
│   ├── web/                           ← 1 SOURCE → 3 BUILDS (community/saas/vip)
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   └── buildTarget.js     ← [KEY] Compile-time flags
│   │   │   ├── components/            ← 100% shared
│   │   │   ├── pages/                 ← Shared + Build-gated pages
│   │   │   ├── features/
│   │   │   │   ├── community/         ← OpenCore-specific logic
│   │   │   │   ├── saas/              ← SaaS-specific logic
│   │   │   │   └── vip/               ← VIP-specific logic
│   │   │   └── context/
│   │   │       └── PortfolioContext.jsx ← userPlan đã có sẵn
│   │   └── package.json               ← từ ./frontend/package.json
│   │
│   ├── mobile/                        ← Tương lai → repo vninvest-mobile
│   │   └── ...                        ← từ ./mobile-app
│   │
│   └── vip-app/                       ← Local Backend + Orchestrator (không có frontend)
│       ├── local-backend/             ← [NEW] FastAPI: Sub-users, RBAC, Branding, Chat Logs
│       ├── orchestrator/              ← [NEW] Multi-Agent Debate logic
│       └── docker-compose.vip.yml
│
├── shared/                            ← Code dùng chung giữa các packages
│   ├── api-contracts/                 ← TypeScript interfaces / JSON Schemas
│   └── constants/                     ← Shared enums, i18n keys
│
├── docs/                              ← Giữ nguyên
├── quality/                           ← Giữ nguyên
└── docker-compose.dev.yml             ← Dev stack chung
```

---

## 1. Package `packages/core/` (Lõi Backend & Data Server)
*Vai trò: Máy chủ trung tâm lưu giữ toàn bộ dữ liệu thị trường, tài sản trí tuệ (IP) và đóng vai trò MCP API Server.*
*Khi tách repo: Trở thành `vninvest-core` (Tuyệt mật - Private).*

**Các phần code chuyển vào:**
- Toàn bộ thư mục `backend/` (Django): Bao gồm Database models, Data Ingestion, và đặc biệt là toàn bộ logic tính toán `Money Flow Control Center`, `Whale Alerts`.
- Thư mục `opennews-main/`: Tích hợp vào Core như một microservice phụ trách cào tin tức và cấp data Sentiment.
- Thư mục `infra/` và `scripts/`: Chứa cấu hình triển khai Docker/Portainer, file cấu hình `.env.production`.
- Các file cấu hình Server (như `docker-compose.prod.yml`, `portainer-stack-*.yml`).

---

## 2. Package `packages/web/` (Frontend Unified — 1 Source, 3 Builds)
*Vai trò: **DUY NHẤT 1 source code** React phục vụ tất cả biến thể (Community, SaaS, VIP).*
*Khi tách repo: Trở thành `vninvest-common-web`.*

**Các phần code chuyển vào:**
- Toàn bộ thư mục `frontend/` (ReactJS).
- **Build Variants:** Dùng biến `REACT_APP_BUILD_TARGET` (community/saas/vip) để build ra bản khác nhau. React tree-shaking tự động loại bỏ code không cần thiết khỏi bundle.
- **Giao diện này chứa ĐẦY ĐỦ** tất cả các tính năng, bao gồm Admin ẩn, VIP pages và Community pages. Mỗi nhóm được guard bằng flags từ `config/buildTarget.js`.
- Tận dụng hạ tầng có sẵn: `userPlan` (PortfolioContext), `ProtectedRoute`, `Can` (CASL).

---

## 3. Package `packages/mobile/` (Ứng dụng Điện thoại)
*Vai trò: App di động cho người dùng.*
*Khi tách repo: Trở thành `vninvest-mobile` (Public/Private tùy ý).*

**Các phần code chuyển vào:**
- Toàn bộ thư mục `mobile-app/` hiện hành.
- Khối này hoàn toàn độc lập, giao tiếp với core thông qua REST API bình thường. Không cần phải thay đổi gì nhiều.

---

## 4. Package `packages/vip-app/` (Local Backend + Orchestrator B2B)
*Vai trò: Chứa Local Backend (lưu dữ liệu riêng VIP) + Multi-Agent Debate Orchestrator.*
*Khi tách repo: Trở thành `vninvest-vip-app` (Phân phối thương mại).*

> [!IMPORTANT]
> Package này **KHÔNG chứa frontend**. VIP frontend là build variant từ `packages/web/` (`BUILD_TARGET=vip`).

**Chứa:**
- **Local Backend (FastAPI):** Xử lý dữ liệu riêng tư của VIP, lưu trên DB local (SQLite hoặc PostgreSQL nhẹ):
  - Sub-User CRUD + RBAC (Basic User / AI User / Pro User)
  - White-label / Branding settings (logo, colors, domain)
  - LLM API Keys (Fernet encrypted)
  - AI Chat Logs / Audit Logs
  - Usage Analytics (token consumption, API quota)
  - Custom Screener Rules của Quỹ
- **Orchestrator:** Module Multi-Agent Debate tích hợp trong cùng FastAPI app. Giao tiếp với VNInvest Central **CHỈ** qua MCP API, tuyệt đối không import code từ `packages/core/backend/`.
- **Docker Compose:** Đóng gói VIP build (frontend + local-backend). Không có ClickHouse, không có PostgreSQL nặng nề.

> [!NOTE]
> Dữ liệu sub-users, chat logs, branding... chạy hoàn toàn trên máy VIP. **KHÔNG** gửi về Central Server. Điều này đảm bảo tính riêng tư cho khách VIP.

---

## 5. Thư mục `shared/` (Code dùng chung)
*Vai trò: SSOT cho interface contracts giữa các packages. Khi tách repo sẽ thành npm/pip packages riêng.*

**Chứa:**
- `api-contracts/`: TypeScript interfaces cho API request/response, JSON Schemas cho MCP Tools.
- `constants/`: Shared enums (mã lỗi, loại agent), i18n keys dùng chung.

**Quy tắc:** Mọi giao tiếp giữa packages phải thông qua contracts định nghĩa tại đây.

---

## Lợi Ích Của Cấu Trúc Packages
1. **Không gián đoạn phát triển:** Dev vẫn làm việc trong 1 repo, 1 IDE, atomic commits.
2. **Đường cắt sẵn sàng:** Cấu trúc `packages/` cho phép tách repo bằng `git filter-repo` trong 1 ngày khi cần.
3. **Quản lý rủi ro mã nguồn (IP Leak):** Boundary rules đảm bảo `vip-app/` không import trực tiếp code lõi → khi tách ra, VIP client sẽ không nhận được source code backend.
4. **Shared testing:** CI/CD chạy 1 pipeline test tất cả packages → phát hiện lỗi cross-package sớm.
