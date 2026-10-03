# CHIẾN LƯỢC REPOSITORY & LỘ TRÌNH THỰC THI B2B MCP

**Date:** 2026-05-01  
**Updated:** 2026-05-02 — Owner phê duyệt `packages-first parallel migration`

Tài liệu này giải đáp vấn đề tổ chức Source Code và lộ trình phát triển để đạt được mô hình B2B Enterprise / VIP Client.

---

## 1. Chiến lược Tổ chức Source Code (Codebase Strategy)

### Quyết định: Monorepo with Boundaries (Phân vùng thư mục)

Thay vì tách ngay thành 5 repos riêng biệt (gây overhead quản lý cho đội dev nhỏ), chúng ta áp dụng chiến lược **"Monorepo with Boundaries"** — giữ nguyên 1 repo `vninvest`, tổ chức lại cấu trúc thư mục thành **5 Packages** có ranh giới rõ ràng. Khi đến thời điểm phù hợp (có khách VIP đầu tiên, team scale lên), mới tách thành repos riêng.

**Lý do:**
1. **Đội dev nhỏ:** Overhead quản lý 5 repos + 5 CI pipelines + cross-repo dependencies lớn hơn lợi ích.
2. **Chưa có khách VIP:** IP Protection chưa phải ưu tiên số 1 ở giai đoạn phát triển.
3. **API contracts chưa ổn định:** Tách sớm gây breaking changes liên tục khi refactor.
4. **Atomic commits:** Dev cần sửa API ở backend + frontend trong 1 commit.

Chi tiết ánh xạ thư mục: [CODEBASE_RESTRUCTURING_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md).

> [!IMPORTANT]
> Với quyết định Owner ngày 2026-05-02, `packages/` **được bắt đầu ngay** nhưng theo mô hình **implementation track song song**. Điều này có nghĩa là:
> - **không** bulk-move `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` như một PR rename lớn,
> - kiến trúc mới được xây trong `packages/` và `shared/`,
> - legacy runtime tiếp tục chạy như reference/fallback lane cho tới cutover,
> - sau khi packages đạt parity và vận hành ổn định, legacy runtime sẽ bị loại bỏ.
>
> Trước mọi quyết định package split hay move vật lý liên quan `core`, phải đọc bộ `core` docs hiện hành:
> - [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md)
> - [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
> - [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
> - [ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md)
> - [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md)
> - [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)

### 5 Packages (Phân vùng logic)

#### Package `packages/core/` → Tương lai sẽ thành repo `vninvest-core`
- **Chứa:** Backend Django, Data Ops, SSOT, cấu hình Kong, ClickHouse, `opennews-main`, `infra`.
- **Vai trò:** "Máy mẹ" (Central MCP Server). Lưu giữ 100% bí mật kinh doanh.
- **KHÔNG chứa:** React admin shell cho operator hay tenant admin pages.

#### Package `packages/web/` → Tương lai sẽ thành repo `vninvest-common-web`
- **Chứa:** Frontend ReactJS — **DUY NHẤT 1 source code** cho tất cả biến thể (Community, SaaS, VIP).
- **Vai trò:** Dùng biến `REACT_APP_BUILD_TARGET` để build ra 3 bản khác nhau. Xem chi tiết tại [mục Build Variants](#4-chiến-lược-build-variants-1-source--3-bản-build).
- **Bao gồm cả:** Central Operator Admin và Tenant Admin Console, vì đây đều là human-facing UI shells tiêu thụ APIs từ `core`.

#### Package `packages/opencore/` → Tương lai sẽ thành repo `vninvest-opencore`
- **Chứa:** Community/self-host distribution bundle, install scripts, compose overlays, activation/upgrade funnel assets, public-safe docs và packaging metadata.
- **Vai trò:** Funnel thu hút user trai nghiem Community/Pro, sau do nang cap len SaaS hoac VIP.
- **KHÔNG chứa:** Frontend source rieng, entitlement/quota/billing truth rieng, market/signal backend rieng.

#### Package `packages/mobile/` → Tương lai sẽ thành repo `vninvest-mobile`
- **Chứa:** Mobile app hiện hành.
- **Vai trò:** App di động, giao tiếp với core qua REST API.

#### Package `packages/vip-app/` → Tương lai sẽ thành repo `vninvest-vip-app`
- **Chứa:** Local Backend (FastAPI) + AI Orchestrator + Docker Compose.
- **Local Backend lưu trữ:** Sub-users, RBAC, branding/white-label, API keys (Fernet), AI chat logs, usage analytics. Dữ liệu này chạy trên DB local của VIP (SQLite/PostgreSQL nhẹ), **KHÔNG** gửi về Central Server.
- **KHÔNG chứa frontend** — VIP frontend là build variant từ `packages/web/` (`BUILD_TARGET=vip`).
- **Đặc điểm:** Tuyệt đối không có `Money Flow Control Center`. Giao tiếp với `core` đi qua versioned partner/global APIs cho control-plane, commercial-plane và data-plane; MCP/data tools chỉ là lớp bổ sung cho AI/integration use cases, không phải đường duy nhất.

### Quy tắc Ranh giới (Boundary Rules) — BẮT BUỘC

> [!CAUTION]
> Các quy tắc sau phải được tuân thủ nghiêm ngặt. Vi phạm boundary = Code Review REJECT.

1. `packages/core/` **KHÔNG** import trực tiếp từ `packages/web/`, `packages/opencore/` hay `packages/vip-app/`.
2. `packages/web/` giao tiếp với `packages/core/` **CHỈ** qua REST API (thông qua `shared/api-contracts/`).
3. `packages/opencore/` chỉ được package hoa build artifacts tu `packages/web` va tieu thu commercial/user APIs tu `packages/core`; khong fork frontend source va khong import core internals.
4. `packages/vip-app/` giao tiếp với `packages/core/` qua versioned partner/global APIs và MCP/data tools phù hợp theo use case; không import trực tiếp code từ `core`.
5. `packages/mobile/` giao tiếp với `packages/core/` **CHỈ** qua REST API.
6. Code dùng chung (TypeScript interfaces, constants) phải nằm trong thư mục `shared/`.
7. Mọi human-facing source pages vẫn thuộc `packages/web/`; `packages/opencore/` chỉ sở hữu distribution/activation/doc assets cho lane OpenCore.

---

## 2. Lộ Trình Thực Thi (Execution Roadmap — 3 Giai đoạn)

### Giai đoạn A: Xây kiến trúc mới trong `packages/` song song với legacy (DEV PHASE)
*Áp dụng ngay — Đây là execution mode chính thức đã được Owner chấp thuận.*

**Bước A0: Đóng băng mở rộng kiến trúc trên legacy runtime**
1. Giữ `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` như runtime đang phục vụ, reference semantics và rollback lane.
2. Chỉ cho phép hotfix hoặc parity fix trên legacy path; mọi hạng mục kiến trúc mới đi vào `packages/` và `shared/`.
3. Chuẩn hóa contract inventory, parity gates, cutover evidence và decommission rules trước khi scaffold lớn.

**Bước A1: Tạo `packages/` và `shared/` làm implementation track mới**
1. Tạo `packages/core/`, `packages/web/`, `packages/opencore/`, `packages/mobile/`, `packages/vip-app/`, `shared/api-contracts/`, `shared/constants/`.
2. Bootstrap workspace config, manifests và compose/dev helpers để package track có thể phát triển độc lập.
3. Tuyệt đối không bulk-move các folder legacy sang `packages/` trong cùng bước này.

**Bước A2: Dựng `packages/core` trước**
1. Thực thi tenant / service account / PAT / quota / billing / capability snapshot trong `packages/core`.
2. Dựng partner APIs, symbol snapshot, session facts, AI runtime contracts và control-plane/commercial-plane read models.
3. Tiếp tục ưu tiên Redis/PostgreSQL/Channels/Streams-first; Kong/ClickHouse chỉ đi sau khi trigger rõ ràng.

**Bước A3: Dựng `packages/web`, `packages/opencore` và `packages/vip-app`**
1. Dựng shared frontend shell trong `packages/web/src/` với `BUILD_TARGET`, route catalog, nav catalog và adapter seams.
2. Dựng `packages/opencore/` như package distribution/commercial funnel cho community/self-host lane, activation va upgrade path.
3. Dựng `packages/vip-app/` như thin local backend + orchestrator; VIP browser chỉ đi qua local APIs.
4. Giữ rule bất biến: không clone frontend cho VIP hoac OpenCore, không cho browser VIP cầm machine PAT.

**Bước A4: Parity verification và pilot**
1. So sánh payload, auth flow, capability gating, route behavior và UX flows giữa legacy và package track.
2. Chạy focused suites và build commands trên package track.
3. Chỉ khi parity đạt yêu cầu mới chuyển sang cutover.

### Giai đoạn B: Cutover hoàn toàn sang `packages/` và loại bỏ legacy runtime (CUTOVER PHASE)
*Chỉ thực hiện khi đáp ứng ĐỦ CẢ 4 điều kiện trigger.*

**Trigger Conditions (4/4 phải đạt):**
1. ✅ API contracts giữa `core` ↔ `web` ↔ `opencore` ↔ `vip-app` đã ổn định.
2. ✅ Focused validation suites và build của package track đã pass ổn định.
3. ✅ Compose/CI/workspace có thể chạy trực tiếp từ `packages/*`.
4. ✅ Có runbook rollback và evidence parity đủ để cắt chuyển an toàn.

**Khi cutover:**
1. Chuyển `docker-compose`, CI, workspace và deployment sang `packages/*`.
2. Đánh dấu `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` là read-only fallback trong một giai đoạn ổn định ngắn.
3. Khi package track vận hành ổn định, xóa legacy runtime paths, scripts và docs references bám đường cũ.

### Giai đoạn C: Tách Repo khi Production-Ready (DEPLOY PHASE)
*Chỉ cân nhắc sau khi cutover sang `packages` đã ổn định.*

**Trigger Conditions (3/3 phải đạt):**
1. ✅ Package boundaries và API contracts đã ổn định sau cutover.
2. ✅ Có ít nhất 1 khách VIP thực tế cần nhận bản deploy riêng.
3. ✅ Team đã vượt 5 dev → cần independent deployment cadence.

**Khi tách:**
1. Dùng `git filter-repo` hoặc `git subtree split` để tách mỗi package thành repo riêng, giữ nguyên commit history.
2. `shared/` trở thành npm package `@vninvest/contracts` và pip package `vninvest-shared`.
3. CI/CD chuyển từ 1 pipeline → 5 pipelines riêng.
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
| `REACT_APP_BUILD_TARGET=community npm run build` | `build-community/` | `packages/opencore` self-host/community distribution |
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
> **Đã được Owner phê duyệt cập nhật ngày 2026-05-02.** Chiến lược chính thức là Monorepo with Boundaries + Build Variants + `packages-first parallel migration` cho tới khi cutover hoàn tất.
