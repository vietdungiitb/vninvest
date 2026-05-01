# CHIẾN LƯỢC REPOSITORY & LỘ TRÌNH THỰC THI B2B MCP

**Date:** 2026-05-01  
**Updated:** 2026-05-01 — Chuyển sang chiến lược "Monorepo with Boundaries"

Tài liệu này giải đáp vấn đề tổ chức Source Code và lộ trình phát triển để đạt được mô hình B2B Enterprise / VIP Client.

---

## 1. Chiến lược Tổ chức Source Code (Codebase Strategy)

### Quyết định: Monorepo with Boundaries (Phân vùng thư mục)

Thay vì tách ngay thành 4 repos riêng biệt (gây overhead quản lý cho đội dev nhỏ), chúng ta áp dụng chiến lược **"Monorepo with Boundaries"** — giữ nguyên 1 repo `vninvest`, tổ chức lại cấu trúc thư mục thành **4 Packages** có ranh giới rõ ràng. Khi đến thời điểm phù hợp (có khách VIP đầu tiên, team scale lên), mới tách thành repos riêng.

**Lý do:**
1. **Đội dev nhỏ:** Overhead quản lý 4 repos + 4 CI pipelines + cross-repo dependencies lớn hơn lợi ích.
2. **Chưa có khách VIP:** IP Protection chưa phải ưu tiên số 1 ở giai đoạn phát triển.
3. **API contracts chưa ổn định:** Tách sớm gây breaking changes liên tục khi refactor.
4. **Atomic commits:** Dev cần sửa API ở backend + frontend trong 1 commit.

Chi tiết ánh xạ thư mục: [CODEBASE_RESTRUCTURING_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md).

### 4 Packages (Phân vùng logic)

#### Package `packages/core/` → Tương lai sẽ thành repo `vninvest-core`
- **Chứa:** Backend Django, Data Ops, SSOT, cấu hình Kong, ClickHouse, `opennews-main`, `infra`.
- **Vai trò:** "Máy mẹ" (Central MCP Server). Lưu giữ 100% bí mật kinh doanh.

#### Package `packages/web/` → Tương lai sẽ thành repo `vninvest-common-web`
- **Chứa:** Frontend ReactJS — **DUY NHẤT 1 source code** cho tất cả biến thể (Community, SaaS, VIP).
- **Vai trò:** Dùng biến `REACT_APP_BUILD_TARGET` để build ra 3 bản khác nhau. Xem chi tiết tại [mục Build Variants](#4-chiến-lược-build-variants-1-source--3-bản-build).

#### Package `packages/mobile/` → Tương lai sẽ thành repo `vninvest-mobile`
- **Chứa:** Mobile app hiện hành.
- **Vai trò:** App di động, giao tiếp với core qua REST API.

#### Package `packages/vip-app/` → Tương lai sẽ thành repo `vninvest-vip-app`
- **Chứa:** Local Backend (FastAPI) + AI Orchestrator + Docker Compose.
- **Local Backend lưu trữ:** Sub-users, RBAC, branding/white-label, API keys (Fernet), AI chat logs, usage analytics. Dữ liệu này chạy trên DB local của VIP (SQLite/PostgreSQL nhẹ), **KHÔNG** gửi về Central Server.
- **KHÔNG chứa frontend** — VIP frontend là build variant từ `packages/web/` (`BUILD_TARGET=vip`).
- **Đặc điểm:** Tuyệt đối không có `Money Flow Control Center`. Market data lấy qua MCP API.

### Quy tắc Ranh giới (Boundary Rules) — BẮT BUỘC

> [!CAUTION]
> Các quy tắc sau phải được tuân thủ nghiêm ngặt. Vi phạm boundary = Code Review REJECT.

1. `packages/core/` **KHÔNG** import trực tiếp từ `packages/web/` hay `packages/vip-app/`.
2. `packages/web/` giao tiếp với `packages/core/` **CHỈ** qua REST API (thông qua `shared/api-contracts/`).
3. `packages/vip-app/` giao tiếp với `packages/core/` **CHỈ** qua MCP API.
4. `packages/mobile/` giao tiếp với `packages/core/` **CHỈ** qua REST API.
5. Code dùng chung (TypeScript interfaces, constants) phải nằm trong thư mục `shared/`.

---

## 2. Lộ Trình Thực Thi (Execution Roadmap — 2 Giai đoạn)

### Giai đoạn A: Phát triển trong Monorepo (DEV PHASE)
*Áp dụng ngay — Dành cho toàn bộ quá trình phát triển feature pack.*

**Bước A1: Tổ chức lại thư mục (Restructure)**
1. Tạo cấu trúc `packages/` và `shared/` trong repo hiện tại.
2. Di chuyển `backend/`, `opennews-main/`, `infra/`, `scripts/` vào `packages/core/`.
3. Di chuyển `frontend/` vào `packages/web/`.
4. Di chuyển `mobile-app/` vào `packages/mobile/`.
5. Tạo `packages/vip-app/` (thư mục trống ban đầu, code khi làm đến Phase VIP).
6. Cập nhật tất cả đường dẫn trong `docker-compose.dev.yml`, CI config, IDE workspace.

**Bước A2: Chuẩn bị "Máy Mẹ" (Core MCP Preparation)**
1. **Database:** Code thêm bảng `Tenant` và `API_Keys` vào Django Backend.
2. **MCP API:** Viết Endpoint API bọc `global_signal_universe_policy` thành JSON Schema.
3. **Gateway:** Setup Kong API Gateway cho Rate Limiting.
4. *(Hệ thống Web SaaS hiện tại vẫn chạy bình thường, không bị ảnh hưởng.)*

**Bước A3: Phát triển VIP Features (Build Variants, không clone)**
1. Thêm `config/buildTarget.js` vào `packages/web/src/` — compile-time flags.
2. Viết 5 VIP-only pages (`AIConfigBYOK`, `SubUserManagement`, `WhiteLabelSettings`, `UsageAnalytics`, `AIPromptStudio`) trực tiếp trong `packages/web/src/pages/` — gated bằng `SHOW_VIP_PAGES`.
3. Wrap routes trong `App.jsx` với flags từ `buildTarget.js` (xem Build Variants section).
4. Tạo `packages/vip-app/orchestrator/` — Multi-Agent Debate logic (FastAPI).
5. Tất cả giao tiếp với core phải đi qua API (không import trực tiếp).

### Giai đoạn B: Tách Repo khi Production-Ready (DEPLOY PHASE)
*Chỉ thực hiện khi đáp ứng ĐỦ CẢ 3 điều kiện trigger.*

**Trigger Conditions (3/3 phải đạt):**
1. ✅ API contracts giữa core ↔ web ↔ vip-app đã ổn định (không breaking change > 2 tuần).
2. ✅ Có ít nhất 1 khách VIP thực tế cần nhận bản deploy riêng.
3. ✅ Team đã vượt 5 dev → cần independent deployment cadence.

**Khi tách:**
1. Dùng `git filter-repo` hoặc `git subtree split` để tách mỗi package thành repo riêng, giữ nguyên commit history.
2. `shared/` trở thành npm package `@vninvest/contracts` và pip package `vninvest-shared`.
3. CI/CD chuyển từ 1 pipeline → 4 pipelines riêng.
4. Đóng gói `vninvest-vip-app` thành Docker Images cho khách VIP:
   ```yaml
   services:
     vninvest-vip-app:
       image: vninvest/vip-client:latest
       environment:
         - VNINVEST_CORE_TOKEN="nhập_token_mua_từ_vninvest"
       ports:
         - "80:80"
   ```

---

## 3. Lợi Ích Của Chiến Lược Monorepo with Boundaries

1. **Tốc độ phát triển cao:** 1 repo, 1 IDE, atomic commits — dev không bị overhead.
2. **Đường cắt sẵn sàng:** Khi cần tách thì tách trong 1 ngày nhờ cấu trúc `packages/`.
3. **IP Protection khi cần:** Giai đoạn B đảm bảo VIP client không nhận được source code lõi.
4. **Shared testing:** CI chạy cả backend + frontend test trong 1 pipeline.
5. **Không có "dependency hell":** Không cần quản lý phiên bản cross-repo packages.
6. **Không duplicate code:** 1 frontend source → 3 builds. Tiết kiệm ~85% effort so với clone.

---

## 4. Chiến lược Build Variants (1 Source → 3 Bản Build)

Frontend dùng **2 chiều phân quyền** để phục vụ 4 nhóm đối tượng mà không duplicate code:

### Chiều 1: `BUILD_TARGET` (Compile-time)
Biến môi trường quyết định bản build nào được tạo. React tree-shaking loại bỏ code không cần.

| BUILD_TARGET | Đối tượng | Loại bỏ |
|-------------|----------|--------|
| `community` | Self-host OpenCore miễn phí | Admin pages, VIP pages, AI nâng cao |
| `saas` | Khách hàng trả phí trên vninvest.vn | VIP pages (BYOK, SubUsers) |
| `vip` | Quỹ đầu tư VIP self-host | Admin pages (AdminOps, CrawlControl) |

### Chiều 2: `userPlan` (Runtime — đã có sẵn)
Đã có trong `PortfolioContext.jsx` (`free`, `pro`, `enterprise`). Phân quyền theo gói dịch vụ.

### Build Matrix

| Lệnh | Output | Phân phối |
|------|--------|----------|
| `REACT_APP_BUILD_TARGET=community npm run build` | `build-community/` | Docker Community (OpenCore) |
| `REACT_APP_BUILD_TARGET=saas npm run build` | `build-saas/` | Server vninvest.vn |
| `REACT_APP_BUILD_TARGET=vip npm run build` | `build-vip/` | Docker VIP B2B |

### Hạ tầng có sẵn (không cần viết mới)
- `userPlan` (free/pro/enterprise) → `PortfolioContext.jsx`
- `ProtectedRoute` component → route-level permission
- `Can` component (CASL) → component-level permission
- `Upgrade` page → CTA cho free users

Chi tiết tham chiếu: [OPEN_CORE_STRATEGY](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_STRATEGY_MASTER_FINAL.md) | [FEATURE_BOUNDARY_MATRIX](file:///c:/Mujoco%20Projects/vninvest/docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md)

---

## Status

> [!NOTE]
> **Đã được Owner phê duyệt ngày 2026-05-01.** Chiến lược Monorepo with Boundaries + Build Variants được chọn làm phương án chính thức.
