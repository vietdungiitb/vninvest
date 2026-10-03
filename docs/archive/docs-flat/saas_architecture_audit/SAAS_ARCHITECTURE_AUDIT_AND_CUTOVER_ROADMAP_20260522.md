# VNINVEST — SAAS ARCHITECTURE AUDIT & CUTOVER ROADMAP

> [!IMPORTANT]
> **TÀI LIỆU THIẾT KẾ & ĐỒNG THUẬN KỸ THUẬT (OFFICIAL)**
> - **Ngày phê duyệt:** 2026-05-22  
> - **Trạng thái:** Rebased theo codebase audit ngày 2026-05-22 để phản ánh đúng snapshot triển khai hiện tại  
> - **Mục tiêu:** Định hướng lộ trình cutover SaaS Native dựa trên code đang chạy thật, tránh giả định sai về mức độ hoàn thành trước khi decommission và xoá bỏ hoàn toàn các thư mục legacy (`backend/` và `frontend/`).

---

## 1. Sơ Đồ Kiến Trúc Hiện Trạng (Hybrid Đã Kiểm Chứng)

Hệ thống đang ở trạng thái **hybrid bất đối xứng**: một số surface người dùng đã chuyển khá xa sang `packages/core` + `packages/web`, nhưng quyền sở hữu build, route host và một phần UI composition vẫn còn nằm ở `frontend/` cũ.

```mermaid
graph TD
    User([Người dùng]) -->|Nginx :80| FE_Host[Frontend Shell Host<br/>frontend/]
    FE_Host -->|mount route host + auth/context| Web_Pkg[@vninvest/web<br/>packages/web]
    FE_Host -->|build artifact hiện tại| FrontendBuild[react-scripts build từ frontend/]
    FE_Host -->|API calls| Core_API[Core API<br/>packages/core :8100]

    subgraph SaaS Native đã hiện diện
        Web_Pkg -->|native pages/adapters| WebPages[DashboardPage, StockDetailPage,<br/>AlertCenterPage, coreApiAdapter]
        Core_API -->|native workspace + stock + signals| CoreNative[Native core routes]
        Core_API -->|compat alias| CoreCompat[Compat routes trong core]
        Core_API -->|stub còn sót| CoreStubs[Stub/empty legacy views]
        CoreNative --> PG_Core[(PostgreSQL: vninvest_core)]
        CoreNative --> Redis_Core[(Redis / streams / cache)]
        Celery_Core[Core Celery Workers] --> CoreNative
    end

    subgraph Legacy còn là blocker
        Legacy_FE_Deps[frontend/src/components + route hosts<br/>vẫn còn được mount ở vài lane]
        Legacy_Build[frontend Docker/build pipeline<br/>vẫn sở hữu artifact production]
    end

    style FE_Host fill:#2a3a52,stroke:#5c88c4,stroke-width:2px
    style Web_Pkg fill:#1a4d3a,stroke:#3cb371,stroke-width:2px
    style Core_API fill:#3d2f5c,stroke:#8a2be2,stroke-width:2px
```

### 1.1 Snapshot được xác minh từ codebase

Các điểm sau đã được kiểm chứng trực tiếp từ source:

1. `packages/web` đã có page source và adapter thật cho nhiều surface người dùng, không còn là shared package thuần túy.
2. `packages/core` đã có native routes thật cho `workspace/portfolios`, `workspace/transactions`, `workspace/watchlists`, `workspace/whale-analytics`, `stock-management/*`, `signals/alert-center/*`.
3. `frontend/` vẫn là shell host thực tế cho app web hiện tại: giữ router, auth/context provider, route host, và pipeline build/deploy.
4. `frontend/` hiện không chỉ là thư mục tham khảo; riêng với web runtime hiện tại, nó vẫn là dependency sống cho build và một số lane UI.
5. `backend/` legacy không còn là blocker lớn nhất trong audited slice này; blocker rõ nhất trước khi xoá là `frontend/` shell/build ownership và các compat caller còn sót.

---

## 2. Các Khoảng Trống Kiến Trúc Cốt Lõi (Architecture Gaps)

Để đạt trạng thái **SaaS Full Independence** và có thể chạy `rm -rf backend/ frontend/` một cách an toàn mà không làm hỏng ứng dụng, chúng ta phải giải quyết các khoảng trống kỹ thuật thực tế dưới đây.

### ⚠️ GAP 1: Thiếu Canonical Workspace API cho SubAccount
- **Thực tế:** Native portfolio transaction API đã tồn tại trong core, nhưng canonical workspace API cho `SubAccount` vẫn chưa có. Các route `portfolio/subaccounts/*` hiện vẫn là stub rỗng, trong khi frontend legacy còn gọi thẳng vào chúng.
- **Ý nghĩa cutover:** Không thể coi phase workspace/brokerage là hoàn tất nếu caller thực tế vẫn phải đi qua `portfolio/subaccounts/*` và không có native replacement rõ ràng trong `coreApiAdapter`.
- **Điểm cần sửa đúng:** Tách bạch `transaction theo portfolio` (đã native) với `transaction/subaccount workflow` (chưa native hóa xong).

### ⚠️ GAP 2: `packages/web` Chưa Sở Hữu Build/Deploy Runtime
- **Thực tế:** `packages/web` đã có nhiều page source thật, nhưng artifact production hiện vẫn được tạo bằng `react-scripts` từ `frontend/`, sau đó copy sang `packages/web/dist` hoặc image nginx.
- **Ý nghĩa cutover:** Xóa `frontend/` ở thời điểm này sẽ làm hỏng cả build pipeline lẫn image build path cho web app.
- **Điểm cần sửa đúng:** Xem đây là blocker hạ tầng cấp 1, không phải chi tiết triển khai phụ.

### ⚠️ GAP 3: Quyền Sở Hữu UI Của Dashboard Vẫn Nằm Ở `frontend/`
- **Thực tế:** `DashboardPage` trong `packages/web` chưa tự sở hữu toàn bộ UI. Page này vẫn nhận render-prop slots từ `PackageDashboardHost`, còn host lại import trực tiếp `SmartStatsHeader`, `FactsFirstModularPositionDeck`, `PortfolioHeatmap`, `UnifiedAlertCenter`, `AIAdvisorAlertPanel` từ `frontend/src/components/*`.
- **Ý nghĩa cutover:** Dù data adapter đã native hơn trước, dashboard vẫn chưa thể sống độc lập nếu bỏ `frontend/`.
- **Điểm cần sửa đúng:** Đây không chỉ là “di chuyển component”, mà là chuyển ownership của layout composition, slot contract và dependency graph.

### ⚠️ GAP 4: Route Ownership Và API Contract Vẫn Bị Phân Mảnh
- **Thực tế:** Một số bề mặt đã native hóa xa hơn roadmap cũ mô tả, nhưng các lane khác vẫn còn hybrid. Ví dụ:
  - `StockDetailPage` và `AlertCenterPage` đã có consumer route thật qua `@vninvest/web`.
  - `Transactions`, `Watchlist`, `Settings`, `AI Command Center`, `Support` vẫn còn phụ thuộc route host/fallback từ `frontend/`.
  - Watchlist group CRUD và whale-feed namespace vẫn đang dùng lẫn native route, compat route và realtime route.
- **Ý nghĩa cutover:** Nếu không làm route ownership matrix rõ ràng, đội triển khai sẽ dễ xóa nhầm lane đã chạy thật hoặc bỏ sót compat caller còn sống.

---

## 3. Trạng Thái Thực Tế Của Các Surface Chính

### 3.1 Đã native hóa tương đối tốt

1. `workspace/portfolios/*`, `workspace/transactions/*`, `workspace/watchlists/*` trong core.
2. `coreApiAdapter` đã gọi thẳng nhiều route native cho portfolio, analytics, technicals, watchlists, whale analytics.
3. `StockDetailPage` trong `packages/web` đã là page thật với model riêng, chart panel và radar panel riêng.
4. `AlertCenterPage` đã được route consumer dùng trực tiếp qua `@vninvest/web`.

### 3.2 Vẫn hybrid hoặc chưa đủ điều kiện decommission

1. Dashboard vẫn cần `PackageDashboardHost` để inject UI từ `frontend/src/components/*`.
2. SubAccount caller vẫn bám `portfolio/subaccounts/*` stub.
3. Watchlist group CRUD vẫn dựa một phần vào contract legacy `portfolio/watchlist/groups/*`.
4. Whale feed và aggregate feed vẫn đang chia giữa realtime path và signal path.
5. Nhiều lane trong app vẫn còn fallback/hybrid ownership ở `frontend/src/App.jsx`.
6. Build web hiện tại vẫn do `frontend/` sở hữu.

---

## 4. Lộ Trình Cutover & Xoá Bỏ Legacy (Rebased Theo Hiện Trạng)

Lộ trình dưới đây được điều chỉnh để phản ánh đúng việc **một số phần đã native hóa xong nền tảng**, còn **blocker thật** nằm ở quyền sở hữu route/build/composition.

### 4.0 Phase Đã Hoàn Thành Một Phần (Không Làm Lại)

Những phần sau **không nên đưa lại về trạng thái “chưa làm”** trong roadmap:

1. Native workspace routes cho portfolio, transactions, watchlists.
2. Native adapter path cho analytics, technicals, whale analytics.
3. Consumer route `/stocks/:symbol` đã đi qua `@vninvest/web` page mới.
4. Consumer route `/whale-alerts` đã đi qua `AlertCenterPage` của `@vninvest/web`.

### 4.1 Phase 1 — Hoàn Thiện Canonical Workspace Brokerage Surface

**Mục tiêu:** loại bỏ dependency vào stub `portfolio/subaccounts/*` và hợp nhất workflow broker/subaccount vào core workspace thật.

**Đầu việc chính:**
1. Tạo native API `/core/v1/workspace/subaccounts/`.
2. Tạo native API `/core/v1/workspace/subaccounts/<id>/transactions/` nếu còn cần subaccount-scoped ledger.
3. Chuyển toàn bộ caller trong `frontend/src/api/client.js` và các consumer liên quan sang native adapter.
4. Giữ DNSE sync/reconcile là input path, nhưng không dùng nó thay cho canonical workspace read path.

### 4.2 Phase 2 — Chuyển Ownership UI Từ `frontend/` Sang `packages/web`

**Mục tiêu:** xóa dependency trực tiếp vào `frontend/src/components/*` khỏi các page SaaS trong `packages/web`.

**Đầu việc chính:**
1. Dashboard: đưa `SmartStatsHeader`, `FactsFirstModularPositionDeck`, `PortfolioHeatmap`, `UnifiedAlertCenter`, `AIAdvisorAlertPanel` sang ownership của `packages/web` hoặc bọc lại trong package.
2. Giảm dần render-prop contract của `DashboardPage` cho đến khi page này tự render full layout.
3. Chuyển các lane còn hybrid như `transactions`, `watchlist`, `settings`, `support`, `ai-command-center` sang page ownership rõ ràng trong `packages/web`.
4. Chỉ giữ `frontend/` như thin bootstrap tạm thời trong giai đoạn trung gian, không để nó chứa business UI mới.

### 4.3 Phase 3 — Độc Lập Hoá Build Và Deploy Của `packages/web`

**Mục tiêu:** để `packages/web` tự build và tự deploy mà không cần `frontend/react-scripts`.

**Đầu việc chính:**
1. Thêm app entry thực sự cho web runtime của `packages/web`.
2. Dùng bundler riêng cho package web, ưu tiên Vite.
3. Viết Dockerfile/Nginx path riêng cho `packages/web`.
4. Loại bỏ script/build path còn trỏ sang `frontend/build`.

### 4.4 Phase 4 — Retirement Compat Routes Và Shell Hosts

**Mục tiêu:** xóa caller legacy đang còn sống trong app và thu hẹp compat layer bên trong core.

**Đầu việc chính:**
1. Chuyển caller khỏi `portfolio/watchlist/groups/*` nếu contract đó còn được dùng.
2. Chuyển caller khỏi `portfolio/subaccounts/*` stub.
3. Hợp nhất namespace whale-feed và aggregate feed theo contract chuẩn đã chọn.
4. Xóa các shell host/fallback route không còn cần trong `frontend/src/App.jsx`.

### 4.5 Phase 5 — Decommission Theo Gate, Không Theo Cảm Tính

**Mục tiêu:** chỉ xóa `frontend/` và `backend/` khi dependency graph thực tế đã sạch.

**Gate bắt buộc trước khi xóa `frontend/`:**
1. `packages/web` tự build, tự boot, tự deploy.
2. Không còn import hoặc slot injection từ `frontend/src/components/*`.
3. Không còn consumer route người dùng nào phụ thuộc `PackageDashboardHost`, `TransactionsShellHost`, `WatchlistShellHost`, `SettingsShellHost`, `AICommandCenterShellHost`, `SupportShellHost`.
4. Không còn caller runtime vào `portfolio/subaccounts/*` và các compat route bắt buộc khác.

**Gate bắt buộc trước khi xóa `backend/`:**
1. Đã grep audit toàn repo và CI scripts, không còn runtime/import/reference cần thiết tới `backend/` cũ.
2. Các flow broker, advisory, market data, websocket, jobs đã có owner rõ ràng trong `packages/core`.
3. Shadow/parity/soak evidence cho các luồng còn nhạy cảm đã đạt chuẩn.

---

## 5. Quản Trị Rủi Ro & Biện Pháp Khắc Phục

| Rủi ro | Mức độ | Nguyên nhân | Biện pháp khắc phục |
| :--- | :--- | :--- | :--- |
| **Xóa `frontend/` quá sớm làm hỏng build web** | Cao | Artifact production hiện vẫn phụ thuộc `frontend/react-scripts` và Docker shell build. | Tách build ownership của `packages/web` xong rồi mới đặt gate decommission. |
| **Dashboard regress dù API đã native** | Cao | Layout composition vẫn do `PackageDashboardHost` và component legacy điều khiển. | Chuyển ownership UI sang `packages/web` trước khi bỏ shell host. |
| **Sai đánh giá tiến độ vì roadmap cũ không sát code** | Cao | Tài liệu cũ coi vài phần là “chưa làm” dù thực tế đã native một phần, và ngược lại bỏ sót blocker thật. | Dùng route ownership matrix + caller audit + build audit làm SSOT cho cutover decision. |
| **Regression SubAccount/DNSE sau khi bỏ compat** | Cao | DNSE sync đã có dữ liệu nhưng canonical read/write path cho subaccount chưa hoàn chỉnh. | Xây native workspace subaccount API trước, rồi mới cắt caller khỏi stub routes. |
| **Namespace whale-feed bị phân mảnh** | Trung bình | Một số caller dùng realtime path, một số flow dùng signal path hoặc whale-analytics path. | Chốt chuẩn contract và migrate caller theo một ma trận namespace rõ ràng. |
| **Xung đột CSS/Tailwind khi package web tách build** | Trung bình | Dashboard và các surface đang hưởng style/runtime assumptions từ shell cũ. | Tách build song song trên staging, thêm visual regression cho các lane chính. |

---

## 6. Kế Hoạch Phân Công Công Việc Kế Tiếp

1. **Backend Team:**
   - [ ] Thiết kế và triển khai canonical `/core/v1/workspace/subaccounts/` cùng contract giao dịch liên quan.
   - [ ] Lập matrix caller nào còn bám `portfolio/subaccounts/*`, `portfolio/watchlist/groups/*`, `realtime/whale-feed/*`.
   - [ ] Chốt namespace whale-feed và aggregate feed để frontend không gọi lẫn nhiều kiểu.
2. **Frontend Team:**
   - [ ] Tách ownership dashboard UI khỏi `frontend/src/components/*`.
   - [ ] Rebase `DashboardPage` từ render-prop host sang self-owned composition trong `packages/web`.
   - [ ] Audit toàn bộ route trong `frontend/src/App.jsx` để đánh dấu lane nào đã native, lane nào còn shell/fallback.
3. **Platform Team:**
   - [ ] Tạo app build độc lập cho `packages/web`.
   - [ ] Viết Docker/Nginx path mới cho web package, không còn copy artifact từ `frontend/build`.
   - [ ] Thêm gate CI kiểm tra không còn dependency build từ `frontend/` trước khi cho phép decommission.

---

## 7. Kết Luận Điều Hành

Kết luận quan trọng nhất từ audit này là:

1. Hệ thống **không còn ở trạng thái “mọi thứ đều chưa native”**, vì một số bề mặt đã cutover khá xa.
2. Hệ thống cũng **chưa đủ điều kiện xoá legacy**, vì blocker thật hiện nằm ở `frontend/` shell/build ownership, dashboard composition dependency, subaccount API gap, và contract fragmentation.
3. Do đó, thứ tự cutover đúng phải là: **caller truth -> UI ownership -> build ownership -> compat retirement -> delete legacy**, không phải xóa thư mục trước rồi vá theo sau.
