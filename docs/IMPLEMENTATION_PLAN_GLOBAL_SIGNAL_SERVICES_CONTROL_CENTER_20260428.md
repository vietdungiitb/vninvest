# IMPLEMENTATION PLAN - Global Signal Services Control Center

**Ngày tạo**: 2026-04-28  
**Scope**: Global Whale Alerts Service + Global Dark Money Flow Service + Unified Signal Control Center  
**Level**: A (major architecture, backend services, admin frontend, QA and governance bundle)  
**Status**: READY FOR OWNER CONFIRMATION

---

## 1. Business objective

### Vấn đề cần giải quyết

Hệ thống hiện có khung phát hiện whale và dark flow tương đối mạnh, nhưng còn ba vấn đề nền:

1. detection chưa tách sạch khỏi ngữ cảnh user trong một số path,
2. global surfaces đang đọc từ nhiều nguồn canonical theo từng use-case nhưng chưa có event-store whale riêng và read-model thống nhất cho scale lớn,
3. admin UI vận hành hai service đang bị phân mảnh giữa Django admin, `AdminOps`, mission-control views và raw tables.

### Mục tiêu nghiệp vụ

1. Tạo hai service nền toàn cục có thể phục vụ hàng nghìn user mà không phải tái lọc từ raw ticks cho mỗi consumer.
2. Chuẩn hóa persisted canonical outputs để global consumers tái sử dụng lâu dài.
3. Cung cấp một trung tâm quản trị thống nhất giúp admin điều hành universe, config, jobs, retention, distribution và audit trên cùng một surface.

### KPI đầu ra

| Chỉ số | Baseline | Mục tiêu |
|---|---:|---:|
| Nơi admin phải vào để vận hành whale + dark flow | 3+ | 1 control center chính |
| Mức độ phụ thuộc user trong detection | Có | 0 |
| Số global consumer cần re-filter từ `IntradayTick` | Nhiều | 0 cho read-path chính |
| Nguồn persisted canonical cho whale global | Chưa rõ | 1 event-store riêng |
| Thời gian audit một slice vận hành | Cao, phân mảnh | Có evidence pack chuẩn cho từng slice |

---

## 2. Scope and non-scope

### In-scope

1. Thiết kế và triển khai `WhaleAlertEvent` canonical store.
2. Refactor dark-flow service thành global detector sạch, persist rồi mới fan-out.
3. Thiết kế `effective universe snapshot` hợp nhất từ admin config và demand thực tế.
4. Thiết kế read models/cache cho whale và dark flow global.
5. Xây dựng `Signal Control Center` trong admin frontend.
6. Tạo admin APIs thống nhất cho summary, config, universe preview, jobs, events, retention.
7. Xây dựng test, audit, evidence protocol theo từng slice.

### Out-of-scope

1. Không redesign toàn bộ Django admin site.
2. Không mở rộng AI advisory logic trong cùng gói này, trừ khi cần consume canonical event mới theo downstream contract.
3. Không thay chart engine hay website design system ngoài phạm vi admin control center.
4. Không thay pipeline market data provider hay bypass `vnstock adapter`.

---

## 3. Current-state assessment

### Điều đang có

1. `tasks_order_flow.py` đã chạy dark-flow periodic và persist `OrderFlowSignal`.
2. `market_data_service.py` đã có aggregate whale/unified alerts cho consumer runtime.
3. `tasks_prefetch.py` đã có snapshot universe hợp nhất từ nhiều nguồn symbol.
4. `AdminOps.jsx` đã có structure tabbed admin surface và panel whale jobs.
5. `WhaleServiceJob` và `WhaleJobManager` đã có nền idempotency tốt cho whale jobs.

### Vấn đề gốc chưa giải quyết

1. Whale global chưa có event-store canonical riêng; nhiều consumer vẫn phải suy ngược từ raw ticks hoặc advisory.
2. Dark-flow global detection còn chứa logic gắn user/advisory trong chính task detector.
3. Admin runtime control nằm rải rác: mission control ở Django admin, whale jobs ở frontend panel, dark flow gần như không có operator UI tương xứng.
4. Không có một `service summary contract` thống nhất cho operator nhìn sức khỏe toàn hệ.

---

## 4. Target architecture summary

### 4.1 Ba lớp đích

1. `Detection layer`
   - Global whale detector
   - Global dark-flow detector
2. `Canonical persistence and cache layer`
   - `WhaleAlertEvent`
   - `OrderFlowSignal`
   - service snapshots / hot caches
3. `Operations and delivery layer`
   - audience resolution
   - websocket + user alert history
   - admin control center

### 4.2 Nguyên tắc kiến trúc

1. Detection trước, audience sau.
2. Persist canonical trước, UI/read-model sau.
3. Operator UI đọc service summary, không đọc trực tiếp từng model table.
4. Mọi config thay đổi phải có preview before apply.

---

## 5. Delivery team and required AI skills

| Workstream | Owner chính | Phối hợp | AI skill / mode bắt buộc |
|---|---|---|---|
| Service boundary, event-store, cache | Backend Lead | Tech Lead | GitHub Copilot (GPT-5.4) theo repo governance |
| Universe policy và config semantics | Tech Lead | Backend Lead, Product Owner | GitHub Copilot + repo rulebook |
| Admin control center React | Frontend Lead | Tech Lead, QA | `Expert React Frontend Engineer` + `react19-source-patterns` |
| Test protocol, traceability, evidence | QA Lead | Tech Lead | `quality-playbook` |
| Runtime rollout, beat, rebuild | DevOps Lead | Backend Lead | GitHub Copilot theo ops guardrails |

### Coding gate

Không slice nào được chuyển sang implementation nếu chưa có explicit consent từ owner theo `docs/AI_CODING_REGULATION.md`.

---

## 6. Execution phases

## Phase 0 - Governance and semantics freeze

### ARC-01
Mục tiêu:
- Khóa service boundaries giữa detection, persistence, distribution, advisory downstream.

### ARC-02
Mục tiêu:
- Khóa `global effective universe policy`, threshold policy và retention ordering.

### ARC-03
Mục tiêu:
- Khóa admin control center IA, command surface và preview-before-apply semantics.

## Phase 1 - Domain foundation and universe

### BE-1.1
Mục tiêu:
- Thiết kế `GlobalSignalUniverseResolver` và `effective universe snapshot` contract.

### BE-1.2
Mục tiêu:
- Chốt nơi lưu runtime config toàn cục, ưu tiên `SystemSetting` JSON keys thay vì tạo scattered flags.

### BE-1.3
Mục tiêu:
- Thêm invalidation policy khi admin đổi curated universe hoặc demand sources đổi mạnh.

## Phase 2 - Global dark-flow service hardening

### BE-2.1
Mục tiêu:
- Refactor `tasks_order_flow.py` để detector chỉ làm detect + persist + cache.

### BE-2.2
Mục tiêu:
- Tách audience resolution và advisory accumulation sang downstream phase riêng.

### BE-2.3
Mục tiêu:
- Chuẩn hóa admin-visible summary cho dark-flow health, last run, signal count, failure count.

## Phase 3 - Global whale service canonicalization

### BE-3.1
Mục tiêu:
- Tạo model canonical `WhaleAlertEvent` và deterministic event-id policy.

### BE-3.2
Mục tiêu:
- Tạo global whale detection service lưu event canonical và hot caches.

### BE-3.3
Mục tiêu:
- Chuyển read-path global whale feed/unified alert sang event-store hoặc read-model derived từ event-store.

## Phase 4 - Unified distribution and retention

### BE-4.1
Mục tiêu:
- Tạo `GlobalSignalDistributionService` resolve audience từ tracked/watchlist và push `UserAlertHistory` + websocket.

### BE-4.2
Mục tiêu:
- Chuẩn hóa policy dedupe, retry, mute/backpressure ở lớp phân phối.

### BE-4.3
Mục tiêu:
- Thiết kế retention strategy: raw ticks giữ ngắn, canonical events giữ dài, purge có preview.

## Phase 5 - Admin backend control plane

### BE-5.1
Mục tiêu:
- Tạo summary API cho control center.

### BE-5.2
Mục tiêu:
- Tạo config read/write API với preview.

### BE-5.3
Mục tiêu:
- Tạo universe preview/apply API, jobs API, recent events API, retention preview API.

## Phase 6 - Admin frontend control center

### FE-6.1
Mục tiêu:
- Tạo `SignalControlCenter` shell trong `AdminOps` hoặc route con chính thức.

### FE-6.2
Mục tiêu:
- Render `Overview`, `Universe`, `Whale Service`, `Dark Flow Service`, `Distribution`, `Storage and Retention`, `Jobs and Audit`.

### FE-6.3
Mục tiêu:
- Đưa whale jobs panel cũ vào luồng mới và bổ sung dark-flow operator UI tương xứng.

### FE-6.4
Mục tiêu:
- Hoàn thiện i18n tiếng Việt, pagination chuẩn, error states, preview modals, confirmation guards.

## Phase 7 - QA, rollout and closure

### QA-7.1
Mục tiêu:
- Viết focused backend tests cho universe, event-store, distribution và retention.

### QA-7.2
Mục tiêu:
- Viết frontend tests cho control center IA, preview/apply, tab flows và operator safeguards.

### QA-7.3
Mục tiêu:
- Chạy integration matrix, spec audit, code review protocol và điền evidence per slice.

### OPS-7.4
Mục tiêu:
- Rebuild/restart stack bị ảnh hưởng, verify Celery beat/worker, ready for final auditor.

### DOC-7.5
Mục tiêu:
- Ghi walkthrough, closure docs, ledger/progress sync.

---

## 7. Rollout strategy

1. Khóa scope trước bằng ARC slices.
2. Làm backend canonical store và distribution trước frontend operator UI.
3. Chỉ bật control center write-actions sau khi summary/read-only đã được verify.
4. Trong giai đoạn chuyển đổi, Django admin và panel cũ có thể tồn tại read-only song song để so sánh, nhưng không được tiếp tục mở rộng logic vận hành ở đó.

---

## 8. Coding quality standards áp dụng cho chương trình này

1. Mọi public contract mới phải additive hoặc có migration plan rõ.
2. Event IDs phải deterministic.
3. Job execution phải idempotent và observable.
4. React admin UI phải tuân thủ React 19 source patterns.
5. Mọi admin list phân trang phải dùng `PaginationBar`.
6. Mọi text mới phải qua i18n tiếng Việt đầy đủ dấu.
7. Không bypass SSOT bằng quick fixes ở layer view.

---

## 9. Test and evidence expectations

Mỗi slice bắt buộc có:

1. file đổi,
2. command validation,
3. payload proof hoặc screenshot/video phù hợp loại slice,
4. residual risk note,
5. ledger/progress sync.

Không có evidence template điền đầy đủ thì slice chưa PASS.

---

## 10. Điều kiện GO sang execution

1. Product Owner xác nhận scope và explicit consent cho coding.
2. Tech Lead chốt xong ARC-01/02/03.
3. Taskboard assign rõ owner và required AI skill cho từng slice.
4. Internal auditor xác nhận docs bundle này đủ để không phải hỏi lại semantics khi code.