# ĐỀ XUẤT CƠ CẤU LẠI SOURCE CODE (CODEBASE RESTRUCTURING)

**Updated:** 2026-05-02 — Chuyển sang `packages-first parallel migration`

Dựa trên cấu trúc thư mục hiện tại của dự án VNInvest (`backend`, `frontend`, `mobile-app`, `opennews-main`, `infra`...), để đạt được mô hình B2B MCP Enterprise, chúng ta sẽ tổ chức lại Monorepo hiện tại thành **5 Packages có ranh giới rõ ràng** (Monorepo with Boundaries). Khi đến giai đoạn phân phối cho khách VIP, mới tách thành repos riêng.

> [!NOTE]
> Quyết định giữ Monorepo đã được Owner phê duyệt. Chi tiết lý do và trigger conditions tách repo xem tại [REPO_STRATEGY_AND_EXECUTION_ROADMAP](file:///c:/Mujoco%20Projects/vninvest/docs/REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md).

> [!IMPORTANT]
> Từ quyết định Owner ngày 2026-05-02, tài liệu này không chỉ là **folder target map** mà còn là **workspace plan** cho package track mới. Cách hiểu đúng là:
> - kiến trúc mới được xây trong `packages/` và `shared/`,
> - legacy runtime (`backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/`) tiếp tục tồn tại như reference/fallback cho tới cutover,
> - không bulk-move runtime code cũ sang `packages/` như một bước rename hàng loạt,
> - sau khi package track đạt parity và cutover ổn định, legacy runtime sẽ bị loại bỏ.
>
> Khi chạm tới `packages/core/`, bộ tài liệu phải dùng làm chuẩn review là:
> - [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md)
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)

## Quy tắc chuyển tiếp bắt buộc

Trong mô hình `packages-first parallel migration`, phải đạt đủ các nguyên tắc sau:

1. `packages/` là implementation track mới; legacy paths chỉ là reference/fallback cho tới cutover.
2. Không blind-copy hoặc bulk-rename toàn bộ runtime code cũ sang `packages/` trong một đợt.
3. Core contracts, PAT/tenant semantics, build variants và adapter seams phải được chốt trong package track trước cutover.
4. Docker/runtime/test commands phải được chuẩn hóa để có thể chạy trực tiếp trên `packages/*` trước khi gỡ legacy.

Dưới đây là sơ đồ ánh xạ (Mapping) từ code hiện tại sang cấu trúc Packages mới:

> [!NOTE]
> Cấu trúc bên dưới là nơi **xây kiến trúc mới**. Các thư mục legacy hiện tại không biến mất ngay; chúng tồn tại song song cho tới khi package track đạt parity và cutover hoàn tất.

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
│   ├── opencore/                      ← Community / Self-host / Upgrade Funnel
│   │   ├── distribution/              ← compose overlays, installer, release manifests
│   │   ├── activation/                ← license bootstrap, upgrade hooks, pricing metadata
│   │   ├── docs-public/               ← public-safe onboarding, quickstart, migration docs
│   │   └── docker-compose.opencore.yml
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

**Nguồn tham chiếu và phạm vi tái cấu trúc:**
- `backend/` là runtime/reference behavior cho `packages/core/backend/`; không bulk-move ngay từ đầu.
- `opennews-main/`, `infra/` và `scripts/` được tái tổ chức dần vào `packages/core/` khi package track đủ ổn định.
- Các file cấu hình server chỉ switch sang package paths ở thời điểm cutover, không đổi đồng loạt từ ngày đầu.

---

## 2. Package `packages/web/` (Frontend Unified — 1 Source, 3 Builds)
*Vai trò: **DUY NHẤT 1 source code** React phục vụ tất cả biến thể (Community, SaaS, VIP).*
*Khi tách repo: Trở thành `vninvest-common-web`.*

**Nguồn tham chiếu và phạm vi tái cấu trúc:**
- `frontend/` là nguồn tham chiếu UX, routing và auth flow để dựng `packages/web/`, không phải nơi tiếp tục triển khai kiến trúc mới.
- **Build Variants:** `packages/web/` sẽ dùng `REACT_APP_BUILD_TARGET` (community/saas/vip) để build ra các lane khác nhau.
- `packages/web/` là nơi gom shared shell, admin surfaces, VIP pages và build gates trong cùng một source.
- Community/OpenCore build van duoc sinh ra tu `packages/web`, nhung duoc `packages/opencore` package hoa de phan phoi.
- Hạ tầng sẵn có như `userPlan`, `ProtectedRoute`, `Can` được kế thừa như behavioral reference, rồi hợp thức hóa trong package track mới.

---

## 3. Package `packages/opencore/` (Community / Self-host / Upgrade Funnel)
*Vai trò: Package phân phối de thu hut user trai nghiem, kich hoat, nang cap va di chuyen dan len SaaS/VIP ma khong tao backend truth hay frontend source rieng.*
*Khi tách repo: Trở thành `vninvest-opencore`.*

**Nguồn tham chiếu và phạm vi tái cấu trúc:**
- Tieu thu build artifacts tu `packages/web` cho lane `community` / `pro-self-host`.
- Tieu thu commercial APIs, capability APIs va activation hooks tu `packages/core`.
- Chua compose/community overlays, install scripts, release manifests, pricing/feature catalog public-safe va onboarding docs.
- Khong duoc giu entitlement/quota/billing truth rieng, khong duoc fork frontend source khoi `packages/web`.

---

## 4. Package `packages/mobile/` (Ứng dụng Điện thoại)
*Vai trò: App di động cho người dùng.*
*Khi tách repo: Trở thành `vninvest-mobile` (Public/Private tùy ý).*

**Nguồn tham chiếu và phạm vi tái cấu trúc:**
- `mobile-app/` hiện hành là reference lane; migration sang `packages/mobile/` có thể diễn ra sau khi `core/web/vip-app` đã ổn định hơn.
- Khối này tiếp tục giao tiếp với `core` qua REST/API contracts, không tạo coupling đặc biệt với `vip-app`.

---

## 5. Package `packages/vip-app/` (Local Backend + Orchestrator B2B)
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
> `packages/vip-app/` được dựng mới trực tiếp trong package track; không có legacy folder tương ứng để move từ code cũ.

> [!NOTE]
> Dữ liệu sub-users, chat logs, branding... chạy hoàn toàn trên máy VIP. **KHÔNG** gửi về Central Server. Điều này đảm bảo tính riêng tư cho khách VIP.

---

## 6. Thư mục `shared/` (Code dùng chung)
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
