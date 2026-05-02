# HANDOFF MASTER - Package Track Foundation Baseline

**Ngày**: 2026-05-02  
**Trạng thái**: READY FOR IMPLEMENTATION HANDOFF

## 1. Mục tiêu bàn giao

Đây là tài liệu master để chuyển giao trọn gói slice `package foundation baseline` cho đội code theo đúng kiến trúc đã được owner duyệt.

Slice này không nhằm cutover ngay khỏi runtime hiện tại. Mục tiêu của nó là dựng ra một baseline thật, có thể kiểm tra được, cho ba trục nền tảng đầu tiên:

1. `packages/core` có Python manifest, app skeleton, contract folders và compose topology stub,
2. `packages/web` có shared shell thật cho route catalog, navigation catalog và adapter seams,
3. `shared` có các contracts đầu tiên cho `build target`, `capability bootstrap` và `session payloads`.

## 2. Kết quả cuối bắt buộc

Sau khi hoàn thành, hệ thống phải đồng thời đạt đủ các kết quả sau:

1. Package track có baseline code thật, không còn chỉ là README placeholders.
2. `packages/core` có một Python package import được, phản ánh boundary `core` mà không đụng legacy runtime.
3. `packages/web` có catalog hóa route/navigation và có hai adapter seam tách `core` với `vip-app`.
4. `shared/api-contracts` có ba contract additive đầu tiên đủ để các package khác bám vào cùng một SSOT.
5. `packages/web` vẫn là frontend source duy nhất; không sinh frontend thứ hai cho VIP hay OpenCore.
6. Không file nào trong `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` bị dùng làm implementation target của baseline mới.
7. Bộ tài liệu phải đủ để đội code triển khai tiếp các slice kế tiếp mà không phải hỏi lại về naming, file placement, interface shape hay validation path.

## 3. Bộ tài liệu trong gói này

### 3.1 Triad bắt buộc

1. `docs/IMPLEMENTATION_PLAN_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`
2. `docs/TECH_SPEC_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`
3. `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`

### 3.2 Tài liệu điều phối và kiểm soát chất lượng

1. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER_20260502.md`
2. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_TRACEABILITY_MATRIX_20260502.md`
3. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_SELF_AUDIT_AND_TEST_PROTOCOL_20260502.md`
4. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_EXECUTION_EVIDENCE_TEMPLATE_20260502.md`
5. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_AUDIT_REPORT_20260502.md`
6. `quality/QUALITY.md`
7. `AGENTS.md`

## 4. Thứ tự ưu tiên tài liệu

Khi có xung đột diễn giải, dùng thứ tự sau:

1. `docs/TECH_SPEC_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`
2. `docs/IMPLEMENTATION_PLAN_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`
3. `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`
4. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_TRACEABILITY_MATRIX_20260502.md`
5. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_SELF_AUDIT_AND_TEST_PROTOCOL_20260502.md`
6. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_EXECUTION_EVIDENCE_TEMPLATE_20260502.md`
7. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_AUDIT_REPORT_20260502.md`
8. `docs/PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502.md`
9. `docs/CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE_20260502.md`
10. `docs/WEB_VIP_APP_SHARED_FRONTEND_BLUEPRINT_20260502.md`
11. `quality/QUALITY.md`
12. `AGENTS.md`

## 5. Các quyết định đã khóa

### 5.1 Package ownership

1. `packages/core` là nơi sở hữu backend nền tảng tương lai, nhưng ở slice này chỉ dựng foundation importable và runnable ở mức stub.
2. `packages/web` là shared frontend source duy nhất cho `community`, `saas`, `vip`.
3. `packages/opencore` chỉ package hóa distribution/funnel cho build artifacts lấy từ `packages/web`; không có frontend source riêng.
4. `packages/vip-app` chỉ sở hữu local backend/orchestrator, không chứa shared React shell.
5. `shared` là SSOT cho contracts/constants dùng chung; không chứa business logic package-specific.

### 5.2 Build target và capability semantics

1. Build target canonical giai đoạn này chỉ có `community`, `saas`, `vip`.
2. Capability bootstrap phải bám current auth/capability anchors đang tồn tại trong legacy frontend: `PortfolioContext`, `AbilityContext`, `ProtectedRoute`, `Can`, `TopNav`.
3. Contract build target, capability bootstrap và session payload phải là additive-first và độc lập với implementation internals.

### 5.3 Web shared shell rules

1. `routeCatalog` là product-level route registry, không phải React Router tree trực tiếp.
2. `navigationCatalog` là navigation registry bám theo capability/build target, không hardcode logic menu vào nhiều component khác nhau.
3. Adapter `core` và adapter `vip-app` phải cùng surface interface để shell phía trên không biết backend cụ thể nào đang đứng sau.
4. Không import trực tiếp legacy `frontend/src/*` vào `packages/web` trong slice baseline này.

### 5.4 Core baseline rules

1. Python manifest phải neo rõ dependency families tương thích với Django/Celery/Redis/PostgreSQL hiện tại.
2. App skeleton phải có namespace rõ ràng và import được bằng Python, không chỉ là thư mục rỗng.
3. Contract folders trong `packages/core` phải phản ánh các boundary tối thiểu: `access`, `market`, `operator`, `partner`.
4. Compose file của `packages/core` phải thể hiện topology mục tiêu `api`, `worker`, `beat`, `redis`, `db`, nhưng được phép là stub ở mức foundation.

## 6. Current repo anchors

### 6.1 Frontend anchors

1. `frontend/src/App.jsx`
2. `frontend/src/components/TopNav.jsx`
3. `frontend/src/components/ProtectedRoute.jsx`
4. `frontend/src/components/Can.jsx`
5. `frontend/src/context/PortfolioContext.jsx`
6. `frontend/src/context/AbilityContext.js`
7. `frontend/src/api/client.js`

### 6.2 Backend and commercial anchors

1. `backend/config/settings.py`
2. `backend/portfolio/opencore_dpi.py`
3. `backend/portfolio/opencore_api.py`

### 6.3 Current package-track anchors

1. `packages/core/README.md`
2. `packages/core/docker-compose.core.yml`
3. `packages/web/package.json`
4. `packages/web/src/config/buildTarget.js`
5. `shared/README.md`
6. `shared/api-contracts/README.md`

## 7. Build and validation commands

### 7.1 Web shell validation

```powershell
Push-Location ./packages/web
npm run check:shell
Pop-Location
```

### 7.2 Core package validation

```powershell
& ".\.venv\Scripts\python.exe" -m compileall packages/core/backend/src
```

### 7.3 Repo indexing refresh

```powershell
& ".\.venv\Scripts\python.exe" scripts/ops/generate_module_tree.py
```

## 8. Operating discipline cho đội code

1. Làm theo slice nhỏ, không copy wholesale legacy frontend/backend sang package path.
2. Sau edit đầu tiên của mỗi slice phải chạy focused validation ngay.
3. Không đánh dấu xong nếu chưa sync `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.
4. Nếu slice chỉ chạm package baseline và contracts, không cần rebuild Docker dev stack hiện tại.
5. Nếu slice bắt đầu tạo runtime thật trong `packages/` có tác động tới audit runtime, phải ghi rõ command khởi động và health proof.
6. `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md` là live status board bắt buộc cho pack này; trạng thái `[x] / [/] / [ ]` phải khớp với thực tế và không được drift với entry audit mới nhất.
7. Tại một thời điểm chỉ được có một slice ở trạng thái `[/]` trong lane đang active; muốn claim slice mới phải cập nhật taskboard trước khi code.
8. `docs/CODE_CHANGE_AUDIT_LEDGER.md` là log bằng chứng bất biến theo slice; `PROGRESS_DASHBOARD.md` là mirror cho auditor. Hai file này không thay thế vai trò điều phối hiện hành của taskboard.
9. Trước khi resume một slice, phải đọc taskboard hiện hành, entry audit mới nhất và residual risk note liên quan; nếu ba nguồn mâu thuẫn nhau thì sửa control docs trước khi code tiếp.
10. Mỗi handoff phải để lại đủ bốn ý: trạng thái khi rời slice, lệnh validation pass cuối cùng, bước kế tiếp được khuyến nghị và blockers/guardrails cần giữ nguyên.

## 9. Evidence obligations

Mỗi slice phải có tối thiểu:

1. danh sách file đổi,
2. command validation và kết quả,
3. payload snapshot nếu chạm contract,
4. residual risk note,
5. ledger/progress sync proof,
6. handoff packet để phiên sau resume mà không phải suy đoán trạng thái.

Đội code chuyển sang `IMPLEMENTATION PLAN` để bắt đầu triển khai.