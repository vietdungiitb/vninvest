# Implementation Plan: Watchlist SaaS-Native Core (Smart Watchlist Radar)
## Kế hoạch Triển khai Có Sprint Sequence & Definition of Done

> **Phiên bản**: v3 (2026-05-30) — Viết lại từ đầu thay thế bản duplicate cũ.
> **Tác giả kiểm toán**: GitHub Copilot Audit Session.
> **Tài liệu liên quan**: `TASKBOARD.md` (task chi tiết), `ROADMAP.md` (rollout + rollback), `BACKEND_DESIGN.md`, `FRONTEND_DESIGN.md`, `CHECKLIST.md`, `TEST_PROTOCOL.md`.

---

## 0. Ràng buộc & Giả định Cứng (Hard Constraints)

| # | Ràng buộc | Tài liệu gốc |
|---|-----------|-------------|
| HC-1 | Mọi feature mới phải nằm trong `packages/core` (backend) và `packages/web` (frontend). **Cấm** phát triển vào `backend/` và `frontend/` legacy ở gốc repo. | AGENTS.md §rule |
| HC-2 | Tất cả API từ `packages/web` phải qua `coreApiAdapter.js`. Cấm `fetch` trực tiếp. | AGENTS.md §8 |
| HC-3 | Mọi text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu. | AGENTS.md §9 |
| HC-4 | CPS Scheduler phải plug into hệ thống CPS đã có (ref `BACKEND_DESIGN_COORDINATED_PARALLEL_SCRAPING...20260517.md`). Cấm tạo scheduler song song. | AGENTS.md §12 |
| HC-5 | `CoreTenant.features` là `JSONField(default=list)`. Feature flag `watchlist_saas_native` được lưu như một string trong list này, không phải boolean column. | Verified: `identity_access/models.py` line 90 |
| HC-6 | Task **1.0 Security Gate** phải hoàn thành và PASS trước khi bắt đầu Shadow Run. | TASKBOARD.md Task 1.0 |

---

## 1. Sơ đồ Phụ thuộc Sprint (Dependency Map)

```
[Sprint 1: Backend Foundation]
  └─ S1.0: Security Gate (vá tenant isolation legacy shim)      ← PREREQUISITE cho S4.1
  └─ S1.1: Schema & Model (Watchlist, WatchlistItem)
  └─ S1.2: Technicals Bulk API — verify + mở rộng fields
  └─ S1.3: CPS Integration (watchlist symbols refresh)

[Sprint 2: Frontend Base & UI Layout]       ← Có thể song song với Sprint 1
  └─ S2.1: WatchlistPage.css (glassmorphic dark, animations)
  └─ S2.2: WatchlistPage.js (Bloomberg-style layout, density modes)
  └─ S2.3: pageRegistry.js — đăng ký route "core-watchlist"

[Sprint 3: Realtime & Indicators]           ← Phụ thuộc: Sprint 1 + Sprint 2 hoàn thành
  └─ S3.1: Hook useRealtimeWS (mới tại packages/web/src/hooks/)
  └─ S3.2: HTTP Fallback Short-Polling (30s)
  └─ S3.3: SVG Sparklines (mini trend charts)
  └─ S3.4: Technicals display + Whale Icon từ backend snapshot

[Sprint 4: Cutover & Cleanup]               ← Phụ thuộc: Tất cả sprint trên PASS
  └─ S4.1: Shadow Run (staging, 72h parity check) ← cần S1.0 PASS trước
  └─ S4.2: Canary 10% (48h continuous)
  └─ S4.3: 100% Cutover
  └─ S4.4: Decommission legacy shims
```

---

## 2. Chi tiết Sprint & Definition of Done

### Sprint 1: Backend Domain Foundation (packages/core)

**File chính**: `packages/core/backend/src/user_workspace/models.py`, `views.py`, `serializers.py`, `urls.py`; `packages/core/backend/src/market_data/views.py`, `legacy_views.py`.

---

#### S1.0 — [SECURITY GATE — Bắt buộc trước Shadow Run]
**Mô tả**: `StockManagementGroupsView` tại `market_data/legacy_views.py` đang lọc `Watchlist.objects.filter(user=request.user)` mà **không có** `tenant=request.tenant`. Đây là lỗ hổng cross-tenant trước khi mở Shadow Run.

**Công việc**:
1. Mở `packages/core/backend/src/market_data/legacy_views.py`.
2. Import và thêm `TenantScopePermission` (có tại `user_workspace/permissions.py`) vào `permission_classes` của `StockManagementGroupsView` và `TrackedSymbolsView`.
3. Bổ sung `tenant=request.tenant` vào tất cả queryset trong 2 views này.

**DoD (Definition of Done)**:
- [ ] `python -m pytest packages/core/backend/src/vninvest_core/tests/test_user_workspace_tenant_isolation.py` — 100% PASS.
- [ ] Test thủ công: request với token của tenant A tới endpoint `/api/stock-management/groups/` không trả về dữ liệu của tenant B.
- [ ] `python -m pytest packages/core/` — no regression.

---

#### S1.1 — Schema & Model Native
**Mô tả**: Đảm bảo `Watchlist`, `WatchlistItem` có đủ fields theo spec `BACKEND_DESIGN.md §1`.

**Công việc**:
1. Kiểm tra `packages/core/backend/src/user_workspace/models.py` có đủ fields: `tenant (FK)`, `user (FK)`, `name`, `description`, `is_default`, `legacy_group_id`.
2. `WatchlistItem`: đủ `watchlist (FK)`, `symbol (uppercase, indexed)`, `note`, constraint `unique_together = [('watchlist', 'symbol')]`.
3. Tạo và apply migration nếu cần.

**DoD**:
- [ ] `python manage.py makemigrations --check` — no pending migrations sau khi apply.
- [ ] `python manage.py migrate` — thành công, không conflict.
- [ ] Models có `__str__` hữu ích.

---

#### S1.2 — Technicals Bulk API: Verify & Extend
**Mô tả**: Endpoint `GET /core/v1/market-data/technicals/bulk/` đã tồn tại. **Không tạo lại**. Chỉ verify và bổ sung fields còn thiếu.

**Công việc**:
1. Gọi `GET /core/v1/market-data/technicals/bulk/?symbols=ACB,VNM` và kiểm tra response.
2. Nếu thiếu bất kỳ field nào trong `{rsi_14, ma20_distance_pct, rvol, updated_at}`: bổ sung vào serializer tương ứng tại `market_data/serializers.py`.
3. Không đổi contract hiện có, chỉ thêm fields mới.

**DoD**:
- [ ] Response JSON có đủ 4 fields: `rsi_14`, `ma20_distance_pct`, `rvol`, `updated_at`.
- [ ] Payload < 50 KB cho 100 symbols.
- [ ] Latency p95 < 80ms (đo bằng `time curl`).
- [ ] Unit test serializer mới PASS.

---

#### S1.3 — CPS Integration (Watchlist Symbol Auto-Refresh)
**Mô tả**: Định kỳ làm mới giá cho symbols active trong watchlist, plug vào CPS đã có.

**Công việc**:
1. **Đọc** `docs/BACKEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md` trước khi code.
2. Promote watchlist symbols vào CPS global symbol matrix theo pattern đã có.
3. Không tạo Celery task riêng nếu CPS task có thể nhận demand source mới.

**DoD**:
- [ ] Symbols từ active watchlists xuất hiện trong CPS queue.
- [ ] Không có N+1 query tới DB (verify bằng `django-debug-toolbar` hoặc log count).
- [ ] Không tạo scheduler song song với CPS đã có.

---

### Sprint 2: Frontend Base Layout & UI (packages/web)

**Có thể bắt đầu song song với Sprint 1.** File chính: `packages/web/src/pages/WatchlistPage.js`, `WatchlistPage.css`, `packages/web/src/pages/pageRegistry.js`.

---

#### S2.1 — WatchlistPage.css
**Công việc**: Neon dark glassmorphic theme, `price-glow-up` / `price-glow-down` keyframe animations, density class `.compact` / `.comfortable`.

**DoD**:
- [ ] File < 400 lines, không dùng inline style hay `!important` trừ override cần thiết.
- [ ] Animation không gây layout reflow (chỉ dùng `opacity` / `box-shadow` / `transform`).

---

#### S2.2 — WatchlistPage.js (Bloomberg-Style Layout)
**Công việc**: Component 2 cột (Sector sidebar + SmartRadarTable), density toggle, tích hợp `coreApiAdapter.js` cho `GET /core/v1/workspace/watchlists/` và items, i18n tiếng Việt đầy đủ dấu.

**DoD**:
- [ ] Component mount thành công trong Storybook hoặc dev server.
- [ ] Không có direct `fetch()` — mọi call qua `coreApiAdapter`.
- [ ] Density toggle hoạt động mượt, không re-fetch data.
- [ ] Tất cả label UI có key i18n tiếng Việt.

---

#### S2.3 — pageRegistry.js Route Registration
**Công việc**: Đăng ký `"core-watchlist"` → `WatchlistPage`. Route `"watchlist"` cũ giữ nguyên. Logic gate: nếu `tenant.features.includes('watchlist_saas_native')` → redirect sang `"core-watchlist"`.

**DoD**:
- [ ] `/watchlist` với tenant không có flag → trang cũ.
- [ ] `/watchlist` với tenant có `watchlist_saas_native` trong `features` → `WatchlistPage` mới.
- [ ] Không break các route khác.

---

### Sprint 3: Realtime WebSocket & Indicators (packages/web)

**Phụ thuộc**: Sprint 1 + Sprint 2 đều phải DONE.

---

#### S3.1 — Hook `useRealtimeWS` (Hook mới)
**Mô tả**: Hook **mới** tại `packages/web/src/hooks/useRealtimeWS.js`. Không liên quan đến `useRealtimeFeed` trong legacy `frontend/`.

**Công việc**:
1. Lấy access token từ `authTokenStorage.getAccessToken()`.
2. Build URL động: `const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'; const wsUrl = \`${protocol}//${window.location.host}/ws/realtime/?token=${token}\``.
3. Circuit breaker: sau 3 lần reconnect thất bại → emit event `ws:degraded`, kích hoạt fallback HTTP.

**DoD**:
- [ ] File tại `packages/web/src/hooks/useRealtimeWS.js` — không import bất kỳ thứ gì từ `frontend/`.
- [ ] WS URL không hardcode host/port.
- [ ] Unit test với mock WS server: connect, receive tick, disconnect → fallback trigger.

---

#### S3.2 — HTTP Fallback Short-Polling
**Công việc**: Khi `ws:degraded` được emit, hook tự động poll `GET /core/v1/market-data/technicals/bulk/` mỗi 30s.

**DoD**:
- [ ] Test: mock WS failure → polling bắt đầu sau < 1s.
- [ ] Polling tự dừng khi WS reconnect thành công.

---

#### S3.3 — SVG Sparklines
**Công việc**: Render sparkline SVG inline trên mỗi dòng bảng, dùng 20 tick gần nhất.

**DoD**:
- [ ] Không gây jank khi nhận ticks liên tục (profiler < 16ms per frame).
- [ ] SVG không fetch thêm data riêng, dùng chung state từ `useRealtimeWS`.

---

#### S3.4 — Technicals Display + Whale Icon
**Công việc**: Map `rsi_14`, `rvol`, `ma20_distance_pct` từ Technicals Bulk API vào cột bảng. Whale icon hiển thị dựa trên backend snapshot (không tính toán client-side).

**DoD**:
- [ ] Số liệu khớp với response API (snapshot test).
- [ ] Whale icon không phụ thuộc vào client-side calculation.

---

### Sprint 4: Cutover, Validation & Decommissioning

**Phụ thuộc**: Sprint 1 (bao gồm S1.0 Security Gate) + Sprint 2 + Sprint 3 đều DONE.

---

#### S4.1 — Shadow Run (72 giờ Staging)
**Điều kiện tiên quyết**: S1.0 Security Gate PASS.

**Công việc**: Deploy lên staging, chạy parity check tự động mỗi giờ so khớp watchlist data giữa native core và legacy. Log mọi divergence.

**DoD**:
- [ ] Parity ≥ 99% trên toàn bộ test accounts trong 72 giờ liên tiếp.
- [ ] Zero cross-tenant data leak trong logs.
- [ ] Shadow run report được lưu và sign-off bởi Tech Lead.

---

#### S4.2 — Canary 10% (48 giờ Liên tiếp)
**Công việc**: Enable `watchlist_saas_native` trong `CoreTenant.features` cho 10% tenants ngẫu nhiên. Monitor FPS, error rate, latency.

**Activation**:
```python
# Django shell
from identity_access.models import CoreTenant
canary_tenants = CoreTenant.objects.filter(status='active').order_by('?')[:int(CoreTenant.objects.count() * 0.1)]
for t in canary_tenants:
    if 'watchlist_saas_native' not in t.features:
        t.features = list(t.features) + ['watchlist_saas_native']
        t.save(update_fields=['features'])
```

**DoD**:
- [ ] 48 giờ liên tiếp không có P1 incident.
- [ ] FPS ≥ 58 trên client sampling.
- [ ] Error rate < 0.1%.

---

#### S4.3 — 100% Cutover
**Công việc**: Enable cho toàn bộ tenants (thêm `watchlist_saas_native` vào `features`).

**DoD**:
- [ ] 100% traffic `/watchlist` serve `WatchlistPage` mới.
- [ ] No 5xx errors trong 2 giờ sau cutover.

---

#### S4.4 — Decommission Legacy Shims
**Công việc** (sau khi S4.3 ổn định ≥ 72 giờ):
1. Xóa `StockManagementGroupsView`, `StockManagementSeedView`, `StockManagementSyncView`, `TrackedSymbolsView` khỏi `packages/core/backend/src/market_data/legacy_views.py`.
2. Xóa routes tương ứng trong `market_data/` URL config.
3. Xóa `SecuritiesGroupListCreateView`, `TrackedSymbolListCreateView` khỏi `packages/core/backend/src/user_workspace/legacy_views.py` và dọn import trong `user_workspace/urls.py`.
4. Xóa `frontend/src/pages/Watchlist.jsx` cũ ở gốc repo (legacy).

**DoD**:
- [ ] `python -m pytest packages/core/` — 100% PASS sau khi xóa.
- [ ] `python manage.py check` — no errors.
- [ ] `git grep StockManagementGroupsView` → no results.
- [ ] Build `packages/web` thành công.

---

## 3. Rollback Nhanh

Nếu cần rollback bất cứ lúc nào từ S4.2 trở đi:

```python
# Django shell — tắt cờ cho toàn bộ tenants
from identity_access.models import CoreTenant
for t in CoreTenant.objects.all():
    if 'watchlist_saas_native' in t.features:
        t.features = [f for f in t.features if f != 'watchlist_saas_native']
        t.save(update_fields=['features'])
print("Rollback hoàn tất.")
```

Chi tiết kịch bản rollback xem thêm tại `ROADMAP.md §2`.

---

## 4. Tổng hợp Gates Bắt buộc

| Gate | Điều kiện PASS | Chặn Sprint |
|------|----------------|-------------|
| G1 — Security | S1.0 cross-tenant test 100% PASS | Shadow Run (S4.1) |
| G2 — Parity | Shadow Run ≥ 99% parity / 72h | Canary (S4.2) |
| G3 — Canary Stability | 48h liên tiếp, FPS ≥ 58, error < 0.1% | Cutover (S4.3) |
| G4 — Post-Cutover | 72h ổn định sau 100% cutover | Decommission (S4.4) | Tài liệu sửa chữa các sai lệch về mặt kiến trúc, chỉ định đúng nguồn sự thật kỹ thuật (sources of truth), làm rõ ranh giới áp dụng các quy tắc cứng, và thiết lập các gate PASS/FAIL định lượng cùng kế hoạch Rollout/Rollback chi tiết.

---

## 1. Findings theo Severity (Danh sách Sai lệch & Khoảng trống Kỹ thuật)

### 1.1 [CRITICAL] Áp sai bối cảnh quy tắc Whale Icon (Rule 5 Mismatch)
* **Sai lệch (Line 38 của bản v1):** Báo cáo v1 quy định áp dụng Quy tắc số 5 trong `AGENTS.md` ("Icon cá mập phải áp dụng cho top 10% nến đang hiển thị trong viewport, không phải toàn dataset") vào bảng danh sách watchlist.
* **Phản biện kỹ thuật:** Quy tắc cứng số 5 áp dụng duy nhất cho bối cảnh hiển thị nến (candlestick chart) của KLineChart để tối ưu hóa hiệu năng render đồ họa và tránh tính toán thừa. Việc ép buộc quy tắc này vào bảng quote/watchlist là sai bối cảnh, gây khó khăn cho việc triển khai và tạo ra các logic phức tạp không cần thiết cho bảng biểu dữ liệu tĩnh.
* **Hiệu chỉnh:** Giao diện bảng biểu Watchlist chỉ hiển thị cờ hiệu hoặc icon chỉ báo Whale Alert tĩnh dựa trên dữ liệu snapshot/feed từ backend, không liên quan đến cơ chế tính toán nến theo viewport của chart.

### 1.2 [HIGH] Sai lệch chỉ định module Backend phục vụ Legacy Bridge
* **Sai lệch (Line 14 của bản v1):** Báo cáo cũ chỉ định shim layer tương thích ngược cho `/stock-management/groups/` và `/stock-management/tracked-symbols/` nằm ở `user_workspace/legacy_views.py`.
* **Phản biện kỹ thuật:** Các endpoint tương thích ngược này thực chất đang được định nghĩa và phục vụ bởi `packages/core/backend/src/market_data/legacy_views.py` (Specifically lines 135 & 230). Việc ghi nhận sai đường dẫn sẽ dẫn tới việc sửa đổi nhầm file, gây khó khăn cho việc refactor và dọn dẹp shim layer sau này.
* **Hiệu chỉnh:** Xác định chính xác `packages/core/backend/src/market_data/legacy_views.py` là vị trí duy nhất chứa legacy shims `StockManagementGroupsView` và `TrackedSymbolsView` cho nhóm ngành/tracked-symbols.

### 1.3 [HIGH] Hiểu sai lớp hạ tầng Realtime (WebSocket vs HTTP layer)
* **Sai lệch (Line 66 của bản v1):** Báo cáo v1 ghi nhận việc tận dụng hạ tầng WebSocket sẵn có trong `packages/web/src/adapters/core/transport.js`.
* **Phản biện kỹ thuật:** File `transport.js` được thiết kế thuần túy làm nhiệm vụ HTTP transport và quản lý auth token (refresh token). Việc chỉ định cắm realtime adapter hoặc khởi tạo WebSocket trực tiếp tại `transport.js` sẽ phá vỡ quy chuẩn phân tách trách nhiệm (Separation of Concerns).
* **Hiệu chỉnh:** Kết nối Realtime WebSocket sẽ được xử lý riêng thông qua một hook chuyên biệt hoặc manager lớp mạng (`useRealtimeFeed` / `useRealtimeWS`), tách biệt hoàn toàn với HTTP request layer của `transport.js`. Hook này sẽ chỉ lấy access token từ `authTokenStorage` làm tham số bắt tay (handshake auth).

### 1.4 [HIGH] Thiếu kế hoạch tương thích Route Gating trong pageRegistry
* **Sai lệch (Line 94 của bản v1):** Đề xuất thay đổi trực tiếp route `"watchlist"` từ shell sang trang mới mà không có kế hoạch chuyển đổi, gate kiểm soát và rollback.
* **Phản biện kỹ thuật:** Trong `packages/web/src/pages/pageRegistry.js`, có sự phân chia rõ ràng giữa các trang shell `"baseline"` (như `"watchlist"`) và các trang nghiệp vụ thực tế `"core"` (như `"core-dashboard"`). Việc chuyển hướng thô bạo mà không có cơ chế gating sẽ gây vỡ luồng phân quyền (abilities) và điều hướng của hệ thống đối với các phân khúc người dùng khác nhau.
* **Hiệu chỉnh:** Thiết kế lộ trình rollout 2 giai đoạn (Baseline Shell co-existence -> Core swap) được điều khiển thông qua cấu hình Tenant-level Capability.

### 1.5 [MEDIUM] Thiếu dữ liệu đo lường hiệu năng định lượng
* **Sai lệch (Line 17 của bản v1):** Đưa ra kết luận "nghẽn >100 mã" trên client-side chỉ mang tính định tính, chưa có số liệu benchmark thực tế.
* **Hiệu chỉnh:** Thiết lập bộ chỉ số đo lường hiệu năng (latency, CPU, payload size) làm tiêu chí PASS/FAIL bắt buộc trước và sau khi nâng cấp.

---

## 2. Corrective Actions (Hành động Khắc phục)

### 2.1 Refactor Backend API & Clean Shim Layer
1. Phát triển Endpoint phân tích kỹ thuật gộp (`/core/v1/market-data/technicals/bulk/`) chịu trách nhiệm tính toán RSI(14) và khoảng cách MA20 hoàn toàn ở backend.
2. Thiết lập cơ chế tự động chạy tác vụ ngầm (background CPS workers) để đồng bộ và tính toán định kỳ cho toàn bộ các mã chứng khoán nằm trong watchlist của người dùng đang active, loại bỏ hoàn toàn việc đồng bộ thủ công.

### 2.2 Tách biệt Kiến trúc Realtime tại Frontend
1. WebSocket client được triển khai riêng biệt, kết nối tới kênh `/ws/realtime/` thông qua `authTokenStorage.getAccessToken()`.
2. Giao diện `WatchlistPage.js` mới sẽ gọi adapter kết nối WebSocket này và tự động fallback về short-polling HTTP (30s) nếu kết nối WebSocket bị ngắt đột ngột (Circuit Breaker mở).

### 2.3 Quản lý Route Gating và Đăng ký Page
1. Đăng ký trang mới dưới dạng core page trong `packages/web/src/pages/pageRegistry.js`:
   ```js
   makePageEntry("core-watchlist", "core", () => import("./WatchlistPage.js").then((m) => m.WatchlistPage))
   ```
2. Giữ nguyên route baseline `"watchlist"` để làm điểm kiểm tra quyền. Nếu cấu hình tenant bật cờ `"watchlist_saas_native"`, hệ thống tự động định tuyến sang `"core-watchlist"`.

---

## 3. Validation Gates (Gate Kiểm chứng PASS/FAIL Định lượng)

Để đáp ứng tiêu chuẩn nghiệm thu chặt chẽ của dự án, quá trình xác minh phải thỏa mãn các tiêu chí định lượng sau:

| Chỉ số / Tiêu chuẩn | Phương pháp đo | Trạng thái PASS | Trạng thái FAIL |
| :--- | :--- | :--- | :--- |
| **Tốc độ phản hồi UI** | Chrome DevTools Performance Profiling | Khung hình duy trì ổn định $\ge 58$ FPS khi nhận WebSocket ticks liên tục cho 120 mã | Khung hình tụt dưới $45$ FPS, xảy ra hiện tượng nghẽn luồng render (Jank) |
| **Độ trễ xử lý dữ liệu** | Log thời gian nhận và xử lý payload của WebSocket | Thời gian phân tách (parse) và cập nhật state của bảng radar $< 10$ ms | Thời gian xử lý state của bảng radar $> 50$ ms |
| **Bảo mật Multi-Tenant** | Test suite `test_user_workspace_tenant_isolation.py` | 100% test case kiểm tra truy cập chéo tenant bị từ chối bằng mã lỗi 403/404 | Có bất kỳ rò rỉ dữ liệu watchlist nào giữa các tenants |
| **Parity Dữ liệu** | So sánh API response của `/core/v1/workspace/watchlists/` và legacy view | Dữ liệu mã chứng khoán trùng khớp 100% về danh sách và ghi chú | Có sự sai lệch hoặc mất mát dữ liệu giữa hai lớp lưu trữ |
| **Kích thước Payload** | Network Tab trong trình duyệt | Dung lượng JSON payload khi lấy danh sách kỹ thuật gộp $< 50$ KB | Dung lượng JSON payload $> 250$ KB do thừa thãi dữ liệu thô |

---

## 4. Rollout & Rollback Plan (Kế hoạch Triển khai & Dự phòng)

### 4.1 Kế hoạch Rollout theo Từng giai đoạn
```
[Giai đoạn 1: Shadow Run]  ──>  [Giai đoạn 2: Canary Gated]  ──>  [Giai đoạn 3: 100% Cutover]
- Chạy song song API native      - Bật cờ "watchlist_saas_native" - Xóa hoàn toàn shim layer
- Ghi nhận logs đối soát          - Áp dụng cho 10% tenants        - Decommission legacy views
```

1. **Giai đoạn 1 (Shadow Run):** Triển khai mã backend và frontend mới lên môi trường staging. Dữ liệu watchlist được đồng bộ song song. Trình duyệt client chạy ngầm đối soát dữ liệu (parity checking) nhưng chưa đổi giao diện người dùng.
2. **Giai đoạn 2 (Canary Gated):** Bật cờ kiểm tra surface capability `"watchlist_saas_native"` cho nhóm 10% tenants (Canary). Theo dõi sát chỉ số FPS và độ trễ WebSocket.
3. **Giai đoạn 3 (100% Cutover):** Chuyển đổi toàn bộ tenants sang sử dụng trang native mới. Sau 72 giờ vận hành ổn định, thực hiện gỡ bỏ hoàn toàn legacy shim views trong `packages/core/backend/src/market_data/legacy_views.py`.

### 4.2 Tiêu chí Rollback (Rollback Criteria)
Kích hoạt rollback ngay lập tức về trạng thái sử dụng trang shell baseline và giao diện legacy nếu xảy ra một trong các trường hợp sau:
1. **Lỗi Giao dịch & Mạng:** Kết nối WebSocket lỗi liên tục dẫn đến HTTP short-polling quá tải làm tăng CPU server $> 85\%$.
2. **Mất Parity Dữ liệu:** Phát hiện sai lệch dữ liệu danh sách theo dõi giữa cơ sở dữ liệu core và legacy ảnh hưởng đến trải nghiệm người dùng.
3. **Downtime Migration:** Quá trình chạy di trú cơ sở dữ liệu khóa bảng $> 5$ giây trên môi trường sản xuất.

---

## 5. Quyết định Kiến trúc & Phản hồi Open Questions

### 5.1 Watchlist target contract chính thức sẽ đi theo con đường nào?
* **Quyết định:** Chuẩn hóa hoàn toàn trên hệ sinh thái native `/core/v1/workspace/watchlists/` và `/core/v1/workspace/watchlists/<watchlist_id>/items/`. Chúng ta thực hiện **Dual-Read** trong giai đoạn di trú (Shadow Run), sau đó cắt đứt hoàn toàn và dọn dẹp các đường dẫn cũ.

### 5.2 Kênh Realtime WebSocket và Fallback Strategy?
* **Quyết định:** Sử dụng kênh WebSocket chuẩn của dự án thông qua `/ws/realtime/?token=<access_token>`. 
* **Fallback:** Nếu kết nối WebSocket gặp lỗi (mất mạng, server khởi động lại) và Circuit Breaker mở sau 3 lần thử lại thất bại, giao diện tự động hạ cấp xuống cơ chế **HTTP Short-Polling** (gửi request lấy dữ liệu gộp mỗi 30 giây) để đảm bảo tính sẵn sàng cao của bảng giá.

### 5.3 Có cần sử dụng Feature Flag / Tenant-level capability không?
* **Quyết định:** **Bắt buộc**. Việc chuyển hướng route sẽ được kiểm soát thông qua thuộc tính `surfaces` trong bootstrap payload của từng tenant. Điều này cho phép bật/tắt tính năng theo từng phân khúc người dùng và môi trường (dev/staging/production) mà không cần deploy lại mã nguồn.
