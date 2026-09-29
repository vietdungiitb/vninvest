# HANDOFF MASTER - Global Signal Services Control Center

## 1. Mục tiêu bàn giao

Đây là tài liệu master để chuyển giao trọn gói chương trình xây dựng:

1. `Global Whale Alerts Service`,
2. `Global Dark Money Flow Service`,
3. `Unified Signal Control Center` cho admin vận hành hai service trên một surface thống nhất.

Chương trình này giải quyết đồng thời ba vấn đề đã được chốt trong các phiên thảo luận:

1. pipeline phát hiện whale và dark flow hiện còn gắn một phần vào ngữ cảnh user,
2. các global surface đang dùng nhiều nguồn canonical khác nhau nhưng chưa có event-store và control-plane đủ rõ,
3. admin UI vận hành hiện phân mảnh giữa Django admin, `AdminOps`, mission-control screens và raw model tables.

## 2. Kết quả cuối bắt buộc

Sau khi hoàn thành, hệ thống phải đồng thời đạt đủ các kết quả sau:

1. Có hai service chạy nền toàn cục, độc lập với từng user khi detect:
   - `Global Whale Alerts Service`
   - `Global Dark Money Flow Service`
2. Universe chạy nền được xác định từ cấu hình hệ thống của admin và có thể hợp nhất thêm demand thực từ `TrackedSymbol` và `WatchlistItem` thành `global effective universe`.
3. Mọi phát hiện whale/dark flow sau khi đạt điều kiện đều được persist vào DB canonical và cache read-model để không phải lọc lại từ `IntradayTick` cho các global consumer.
4. Fan-out được thực hiện sau detection, phân phối đến toàn bộ user đang theo dõi mã tương ứng.
5. Admin có một trung tâm điều hành thống nhất để xem health, universe, config, jobs, events, retention, distribution và audit.
6. Django admin chỉ còn vai trò registry, forensic, audit và emergency backoffice; không còn là nơi điều hành chính hàng ngày.
7. Bộ tài liệu phải đủ cho đội code, QA, internal auditor và final auditor đi hết vòng triển khai mà không phải đoán lại semantics, ownership, coding rules, test gates hay evidence obligations.

## 3. Bộ tài liệu trong gói này

### 3.1 Triad bắt buộc theo AI Coding Regulation

1. `docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
2. `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
3. `docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`

### 3.2 Tài liệu vận hành, chất lượng và audit

1. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_HANDOFF_MASTER_20260428.md`
2. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_CODE_QUALITY_CONSTITUTION_20260428.md`
3. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_TRACEABILITY_MATRIX_20260428.md`
4. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
5. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_EXECUTION_EVIDENCE_TEMPLATE_20260428.md`
6. `docs/RUN_CODE_REVIEW_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
7. `docs/RUN_INTEGRATION_TESTS_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
8. `docs/RUN_SPEC_AUDIT_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
9. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_HANDOFF_AUDIT_REPORT_20260428.md`

### 3.3 Repo rulebook phải tuân thủ

1. `AGENTS.md`
2. `quality/QUALITY.md`
3. `docs/AI_CODING_REGULATION.md`

## 4. Thứ tự ưu tiên khi có xung đột diễn giải

1. `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
3. `docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
4. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_TRACEABILITY_MATRIX_20260428.md`
5. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_CODE_QUALITY_CONSTITUTION_20260428.md`
6. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
7. `docs/RUN_CODE_REVIEW_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
8. `docs/RUN_INTEGRATION_TESTS_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
9. `docs/RUN_SPEC_AUDIT_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
10. `AGENTS.md`
11. `docs/AI_CODING_REGULATION.md`

## 5. Các quyết định đã khóa

### 5.1 Service boundaries

1. Detection của whale và dark flow là toàn cục, không phụ thuộc user cụ thể.
2. User chỉ tham gia ở phase `audience resolution`, không tham gia phase `signal existence`.
3. `WhaleAdvisory` không còn được xem là nguồn sự thật cho global whale event detection.
4. `OrderFlowSignal` tiếp tục là canonical persisted signal cho dark flow, nhưng phải được refactor để trở thành output của global dark-flow service sạch hơn.

### 5.2 Canonical data stores

1. Whale global phải có event-store canonical riêng, tạm gọi là `WhaleAlertEvent`.
2. Dark flow canonical tiếp tục đi qua `OrderFlowSignal`.
3. `IntradayTick` chỉ là raw feed cho detection, recovery và nearline analytics; không phải read model chính cho global consumer.

### 5.3 Universe policy

1. Universe toàn cục mặc định là `hybrid`:
   - admin curated groups/symbols là nguồn ưu tiên,
   - hệ thống có thể union thêm các mã thực tế từ tracked/watchlist theo policy đã khóa.
2. Mọi consumer runtime phải đọc `effective universe snapshot`, không query trực tiếp nhiều bảng user mỗi vòng detect.

### 5.4 Distribution policy

1. Sau khi persist event canonical, service phải resolve audience gồm toàn bộ user đang theo dõi mã ở `TrackedSymbol` và `WatchlistItem`.
2. Distribution phải hỗ trợ:
   - cache hot snapshot,
   - websocket group push theo symbol và per-user alerts,
   - `UserAlertHistory` cho audit giao nhận tối thiểu.

### 5.5 Admin control center

1. Frontend admin vận hành chính phải nằm trong `AdminOps` hoặc route con trực thuộc nó.
2. UI đích là `Signal Control Center`, không phải thêm từng panel rời.
3. Control center phải có tối thiểu 7 zones:
   - Overview
   - Universe
   - Whale Service
   - Dark Flow Service
   - Distribution
   - Storage and Retention
   - Jobs and Audit
4. Nếu có list phân trang, bắt buộc dùng `frontend/src/components/shared/PaginationBar.jsx`.

### 5.6 AI coding governance

1. Mặc định mọi AI session chỉ được audit, planning, research và documentation.
2. AI không được sửa source code nếu chưa có lệnh xác nhận rõ ràng của user theo `docs/AI_CODING_REGULATION.md`.
3. Mọi `.md` thay đổi trong `docs/` đều phải có audit report và sync ledger/progress.

## 6. Role matrix và AI skill matrix

| Vai trò | Phạm vi chính | Được code phần nào | AI / skill bắt buộc | Human gate |
|---|---|---|---|---|
| Product Owner / Final Auditor | chốt scope, behavior, GO / NO-GO | không phải coder chính | không áp dụng | bắt buộc approve trước coding và trước closure |
| Tech Lead | chốt SSOT, domain boundary, migration strategy | backend + cross-cutting | GitHub Copilot + repo rulebook | approve ARC slices |
| Backend Lead | models, Celery, cache, APIs, retention | backend service slices | GitHub Copilot (GPT-5.4) cho Django/Celery; không dùng speculative schema | review migration, idempotency, performance |
| Frontend Lead | admin control center, React integration, UX flow | frontend admin UI slices | `Expert React Frontend Engineer` + `react19-source-patterns` | review route IA, React 19 compliance, i18n |
| QA Lead | regression, integration, audit evidence | test/docs/evidence slices | `quality-playbook` cho protocol shaping | verify evidence pack |
| DevOps / Runtime Owner | beat schedule, rollout, rebuild, observability | ops/runtime config slices | GitHub Copilot theo repo governance | approve runtime refresh and rollback path |

### 6.1 Skill mapping bắt buộc cho AI sessions

1. Tài liệu quality/audit/spec review: dùng `quality-playbook`.
2. Frontend admin center React: dùng `Expert React Frontend Engineer` và `react19-source-patterns`.
3. Backend Django/Celery/services: dùng GitHub Copilot theo rulebook repo; không tạo bypass ngoài SSOT.
4. Không có skill nào được phép vượt qua `docs/AI_CODING_REGULATION.md`.

## 7. File anchors hiện tại

### Backend

1. `backend/portfolio/tasks_order_flow.py`
2. `backend/portfolio/market_data_service.py`
3. `backend/portfolio/views_whale_orchestration.py`
4. `backend/portfolio/views_admin_runtime.py`
5. `backend/portfolio/views_stock_workspace_admin.py`
6. `backend/portfolio/tasks_prefetch.py`
7. `backend/portfolio/tasks_whale_broadcast.py`
8. `backend/portfolio/models.py`
9. `backend/portfolio/models_alert_history.py`

### Frontend

1. `frontend/src/pages/AdminOps.jsx`
2. `frontend/src/components/adminops/WhaleServiceOpsPanel.jsx`
3. `frontend/src/api/client.js`
4. `frontend/src/App.jsx`
5. `frontend/src/i18n/vi.js`
6. `frontend/src/i18n/en.js`

## 8. Chỉ dẫn cho đội code

1. Không bắt đầu bằng UI trước khi khóa xong service boundaries và universe policy.
2. Không dùng `WhaleAdvisory` làm event-store thay thế cho `WhaleAlertEvent` chỉ để tiết kiệm migration.
3. Không cho phép detection đọc threshold riêng theo user để quyết định event có tồn tại hay không.
4. Không re-filter whale/dark flow từ `IntradayTick` cho global consumers khi canonical event-store đã tồn tại.
5. Mọi text mới trên admin UI phải qua i18n tiếng Việt đầy đủ dấu.
6. Mọi list lớn trong admin UI phải dùng `PaginationBar` dùng chung.
7. Sau edit thực chất đầu tiên của mỗi slice phải chạy focused validation ngay.
8. Không đánh dấu xong nếu chưa cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.

## 9. Chỉ dẫn cho internal auditor

1. Audit theo traceability matrix trước, không audit cảm tính.
2. Soi đầu tiên luôn là `SSOT boundary` và `user-independent detection`.
3. Với admin control center, phải audit bằng flow vận hành thực:
   - xem summary,
   - preview universe,
   - apply config,
   - trigger manual run,
   - xác nhận persisted event,
   - xác nhận fan-out.
4. Slice nào thiếu payload proof, job evidence hoặc residual risk note thì chưa được PASS.

## 10. Checklist nghiệm thu tối thiểu

### 10.1 Functional

1. Whale service chạy nền trên `effective universe` và persist event canonical.
2. Dark-flow service chạy nền trên `effective universe` và persist signal canonical.
3. Distribution gửi event đến mọi user đang theo dõi mã.
4. Global consumers không cần lọc lại từ `IntradayTick` để dựng global feed chính.
5. Admin control center có thể quản lý config, universe, jobs, retention và audit ở một nơi.

### 10.2 Quality

1. Event IDs deterministic và dedupe ổn định.
2. Universe preview trước apply là bắt buộc.
3. Không có service slice nào bỏ qua evidence template.
4. Không có code edit nào được thực hiện trước explicit consent của owner.

### 10.3 Validation and evidence

1. Focused backend tests pass.
2. Frontend build và targeted UI tests pass.
3. Có payload snapshot cho config, universe preview, persisted event, distributed alert.
4. Có screenshot/video cho admin control center flows.
5. Ledger và progress dashboard đã sync.

## 11. Điều kiện chuyển sang coding

Đội code chỉ được xem là đủ điều kiện coding khi đồng thời đúng:

1. Bộ tài liệu trong gói này tồn tại đầy đủ.
2. Product Owner xác nhận scope và cho explicit consent bắt đầu coding.
3. Tech Lead xác nhận ARC-01, ARC-02, ARC-03 đã khóa.
4. Taskboard có owner, required skill, test gate và evidence cho từng slice.

## 12. Câu chốt bắt buộc

Global Signal Services Control Center là bài toán `domain truth + operational reliability + unified operator UX` trước, convenience của coder sau.

Nguyên tắc không được vi phạm:

1. Thà thêm một migration event-store còn hơn tiếp tục dùng nguồn sự thật sai domain.
2. Thà để admin phải preview trước khi apply còn hơn áp cấu hình mù vào toàn thị trường.
3. Thà tách detection khỏi user context dứt điểm còn hơn vá thêm logic fan-out chồng chéo.