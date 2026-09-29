# Kế hoạch Triển khai: Dọn dẹp Định tuyến Trùng lặp `/api/` vs `/core/v1/`

Tài liệu này đề xuất kế hoạch chi tiết để dọn dẹp các route trùng lặp và chuyển dịch các Django endpoints về định dạng chuẩn `/core/v1/` theo tài liệu audit [AUDIT_DJANGO_API_ROUTING_CORE_V1_VS_API_20260615.md](file:///c:/Mujoco%20Projects/vninvest/docs/AUDIT_DJANGO_API_ROUTING_CORE_V1_VS_API_20260615.md).

---

## 1. Các điểm cần lưu ý và thảo luận (User Review Required)

### 💡 Chủ đề 1: Bảo toàn khả năng tương thích của `/core/v1/operator/mail-configs/`
*   **Hiện trạng:** Tệp `api_urls.py` định nghĩa route singular `/operator/mail-config/` còn `urls.py` định nghĩa route plural `/operator/mail-configs/`.
*   **Đề xuất:** Thêm cả route singular `/operator/mail-config/` vào `urls.py` để tránh làm hỏng các UIs/Tests đang gọi tới route cũ.

### 💡 Chủ đề 2: Chuyển đổi trên Frontend
*   Yêu cầu cấu hình Frontend (`REACT_APP_CORE_API_BASE_URL`) trỏ tới `/core/v1/` thay vì `/api/`. 
*   UIs của phần Partner/Tenant Admin cần chuyển sang gọi `/core/v1/partner/` thay vì `/api/core/v1/partner/`.

### 💡 Chủ đề 3: Quyết định về `market_data.public_urls` (Public Read Access)
*   **Hiện trạng:** `market_data/public_urls.py` mirror gần như hoàn toàn các read endpoints của `core_urls.py` dưới `/api/` cho truy cập công khai không auth.
*   **Cần quyết định:** Giữ lại làm public read API hay gỡ bỏ? Nếu giữ → cần document rõ ranh giới "public read-only" vs "tenant-scoped write".

### 💡 Chủ đề 4: Sửa đổi các lỗi Test Unit có sẵn (Baseline Test Bugs)
Chúng tôi phát hiện một số test cases hiện tại bị lỗi độc lập với thay đổi routing do cấu trúc thư mục thay đổi trước đó:
*   Mocks trong `test_password_reset.py` đang vá nhầm module `views_auth` thay vì `views.password_reset`.
*   Mocks trong `test_email_tasks.py` đang vá nhầm `send_mail` thay vì `send_system_email`.
Chúng tôi sẽ tiện sửa lại các tệp này để đảm bảo test suite chạy xanh 100%.

---

## 2. Các thay đổi đề xuất (Proposed Changes)

### Phase 0 — Immediate Cleanup (Không cần thay đổi Frontend)

#### [MODIFY] [urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/vninvest_core/urls.py)
*   Xóa mount `signal_intelligence.api_urls` (namespace `signal_intelligence_api`).
*   Xóa mount `identity_access.api_urls` (namespace `identity_access_api`).
*   Xóa mount `market_data.urls` trùng lặp thứ 2 dưới `/api/` (namespace `market_data_api` — dòng mount thứ 2).
*   Xóa mount `support.urls` trùng lặp dưới `/api/support/` (namespace `support_api`).
*   **Ghi chú:** Giữ nguyên `commercial.public_urls`, `market_data.public_urls`, `market_serving.api_urls`, `user_workspace` (as `user_workspace_api`), `advertising.api_urls` — các mount này phục vụ mục đích riêng (public tracking, compat layer) và sẽ xử lý ở Phase 1/2.

#### [DELETE] [api_urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/api_urls.py)
*   Xóa tệp trùng lặp hoàn toàn (chứa duplicate routes + dead stubs).

#### [DELETE] [api_urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/signal_intelligence/api_urls.py)
*   Xóa tệp trùng lặp hoàn toàn (chỉ khác trailing slashes).

#### [MODIFY] [urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/urls.py)
*   Import thêm `DNSECredentialView` và `tenant_member_views`.
*   Đăng ký thêm các route nghiệp vụ (auth register, verify-email, resend-verification, password-reset, dnse-credential, tenant-members) vốn trước đây khai báo trong `api_urls.py`.
*   Giữ cả hai phiên bản singular (`operator/mail-config/`) và plural (`operator/mail-configs/`) để đảm bảo tương thích ngược.

---

### Phase 1 — Identity & Workspace (Yêu cầu Frontend Migration)

#### [MODIFY] [urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/vninvest_core/urls.py)
*   Xóa mount `user_workspace` dưới `/api/` (namespace `user_workspace_api`) sau khi frontend đã chuyển sang `/core/v1/workspace/*`.

#### [MODIFY] [urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/user_workspace/urls.py)
*   Xóa các legacy stub routes (dòng ~63-78): `LegacyWatchlistGroupListView`, `LegacyWatchlistGroupDetailView`, `LegacyWatchlistItemCreateView`, `LegacyWatchlistItemDeleteView`, `PortfolioUserConfigView`, `GenericEmptyListView/StaffView` cho ai-advisory, screener config, whale backtest.
*   Xóa các route `portfolio/*` duplicate (giữ lại `workspace/*` native).

#### [MODIFY] Frontend (`packages/web`)
*   Cập nhật `REACT_APP_CORE_API_BASE_URL=/core/v1`
*   Chuyển tất cả gọi API: `/api/portfolio/*` → `/core/v1/workspace/*`, `/api/auth/*` → `/core/v1/auth/*`, `/api/core/v1/partner/*` → `/core/v1/partner/*`

---

### Phase 2 — Market Data & Signals

#### [MODIFY] [urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/vninvest_core/urls.py)
*   Xóa mount `market_serving.api_urls` (namespace `market_serving_api`).
*   **Quyết định:** Xóa hoặc giữ `market_data.public_urls` (namespace `market_data_public`) tùy kết quả Chủ đề 3.

#### [DELETE] [api_urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/market_serving/api_urls.py)
*   Xóa tệp (chứa legacy bridge views + duplicate native routes).

#### [MODIFY] [urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/market_serving/urls.py)
*   Đăng ký thêm endpoint `realtime/symbol-investigation/<str:symbol>/` (sử dụng view `RealtimeSymbolInvestigationView` từ `native_views.py`) để bảo toàn route này trước khi xóa `api_urls.py`.

#### [MODIFY] [public_urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/market_data/public_urls.py) — *Nếu quyết định xóa*
*   Xóa tệp và mount tương ứng.

---

### Phase 3 — Advisory (Đã sạch, không hành động)
*   `advisory` chỉ mount dưới `/core/v1/`. Không có mount `/api/`.

---

### 2.2 Cập nhật Test Cases (Update Tests Cases)

Cập nhật các chuỗi API path trong toàn bộ các tệp test của backend:
*   [test_dnse_credential.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/tests/test_dnse_credential.py): đổi `/api/core/v1/dnse-credential/` thành `/core/v1/dnse-credential/`.
*   [test_operator_mail_config.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/tests/test_operator_mail_config.py): đổi `/api/core/v1/operator/mail-config/` thành `/core/v1/operator/mail-config/` (hoặc `/core/v1/operator/mail-configs/`).
*   [test_identity_access.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/tests/test_identity_access.py): đổi `/api/core/v1/partner/...` thành `/core/v1/partner/...`.
*   [test_identity_access_api_routes.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/tests/test_identity_access_api_routes.py): đổi `/api/core/v1/...` thành `/core/v1/...`.

Sửa lỗi patch imports trong tests:
*   [test_password_reset.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/tests/test_password_reset.py): Sửa patch từ `identity_access.views_auth.send_password_reset_email` thành `identity_access.views.password_reset.send_password_reset_email`.
*   [test_email_tasks.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/tests/test_email_tasks.py): Sửa patch từ `data_ingest.tasks.send_mail` thành `data_ingest.tasks.send_system_email`.

---

## 3. Kế hoạch xác thực (Verification Plan)

### Automated Tests
*   Chạy bộ test suite của `identity_access` để xác thực toàn bộ các route đã định vị chuẩn xác:
    ```bash
    $env:DJANGO_DEBUG="true"
    python manage.py test identity_access
    ```
*   Chạy bộ test suite integration của `backend`:
    ```bash
    $env:DJANGO_DEBUG="true"
    python manage.py test identity_access.tests
    python manage.py test identity_access.tests.test_identity_access_api_routes
    ```

### Smoke Tests (Post-Deploy Verification)
*   [ ] `GET /core/v1/health` → 200
*   [ ] `GET /core/v1/capability-bootstrap` → 200
*   [ ] `GET /core/v1/auth/me` (authenticated) → 200
*   [ ] `GET /api/health` (compat) → 200
*   [ ] `GET /api/soc/` endpoints → 200 (unaffected)
*   [ ] Swagger UI tại `/core/v1/schema/swagger-ui/` load thành công
*   [ ] Toàn bộ test suite pass: `python manage.py test`

### Rollback Plan
*   Nếu smoke test fail: revert `vninvest_core/urls.py` và restore deleted `api_urls.py` files từ git.
*   Không cần migration DB (chỉ thay đổi routing).

---

## 4. Appendix: Files to Modify/Delete Summary

### Delete Entirely
- `packages/core/backend/src/identity_access/api_urls.py`
- `packages/core/backend/src/signal_intelligence/api_urls.py`
- `packages/core/backend/src/market_serving/api_urls.py` (Phase 2)

### Modify (Remove Mounts from Root urls.py)
- `packages/core/backend/src/vninvest_core/urls.py` — Remove 4 mounts (Phase 0) + 1-2 mounts (Phase 1/2)

### Modify (Clean Legacy Code)
- `packages/core/backend/src/identity_access/urls.py` — Add missing routes, keep singular/plural mail-config
- `packages/core/backend/src/user_workspace/urls.py` — Remove legacy stubs + portfolio/* duplicates (Phase 1)
- `packages/core/backend/src/market_serving/urls.py` — Add realtime/symbol-investigation (Phase 2)
- `packages/core/backend/src/market_data/public_urls.py` — **Decision pending** (Phase 2)

### No Action Needed (Confirmed Correct Placement)
- `packages/core/backend/src/commercial/public_urls.py` — Public legal pages only
- `packages/core/backend/src/advertising/api_urls.py` — Public ad tracking (impression/click logging)
- `packages/core/backend/src/advisory/urls.py` — Only under `/core/v1/`
- `packages/core/backend/src/ops_audit/urls.py` — Only under `/core/v1/`
- `packages/core/backend/src/data_ingest/urls.py` — Only under `/core/v1/`
- `packages/core/backend/src/support/urls.py` — Only under `/core/v1/` (duplicate mount removed in Phase 0)

---

*Generated by audit on 2026-06-15. Updated per review feedback.*