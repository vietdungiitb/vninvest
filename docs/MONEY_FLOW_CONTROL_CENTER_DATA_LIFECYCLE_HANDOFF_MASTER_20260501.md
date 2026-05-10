# HANDOFF MASTER - Money Flow Control Center and Data Lifecycle

**Ngày**: 2026-05-01  
**Trạng thái**: READY FOR DISCUSSION FREEZE

## 1. Mục tiêu bàn giao

Đây là tài liệu master để chốt hướng kiến trúc trước khi đi sâu hơn vào implementation cho chương trình:

1. `Money Flow Control Center` trong `AdminOps`,
2. chiến lược lưu trữ dữ liệu dài hạn cho `Whale Alerts` và `Dark Money Flow`,
3. lộ trình facts-first để route `whale-alerts/:symbol` không còn lệ thuộc vào việc tổng hợp full raw `IntradayTick` mỗi lần tải trang.

Chương trình này xử lý đồng thời bốn vấn đề đã được xác nhận trong các phiên thảo luận gần đây:

1. admin runtime hiện còn nhiều writer surface chồng nhau giữa `Signal Control Center`, `Data Ops`, runtime settings và whale mission-control,
2. dữ liệu money-flow còn quá raw-centric ở một số read path quan trọng, đặc biệt trên cold path của `whale-alerts/:symbol`,
3. retention đang có nguy cơ bị hiểu như một tập hợp cờ rời rạc thay vì một lifecycle nhiều tầng có safety gate rõ ràng,
4. dark flow cần được tích hợp vào cùng operator center với whale, nhưng không được nhập nhằng policy domain.

## 2. Kết quả cuối bắt buộc

Sau khi triển khai tương lai theo pack này, hệ thống phải đồng thời đạt đủ các kết quả sau:

1. Có một `Money Flow Control Center` thống nhất trong `AdminOps`, nhưng không tạo thêm config store mới song song.
2. Boundary ghi cấu hình được khóa rõ thành ba domain:
   - shared lifecycle and runtime coordination,
   - whale policy and governance,
   - dark-flow policy.
3. `whale-alerts/:symbol` đọc từ canonical events + materialized facts của selected session trên primary path, không còn full-scan raw ticks cho request chính khi facts đã sẵn sàng.
4. Raw `IntradayTick` được xem là staging/recovery input ngắn hạn; long-lived storage ưu tiên canonical events, bucket facts, session summaries và selective forensic windows.
5. Mọi thay đổi có rủi ro cao về universe, materialization, retention, backfill hoặc purge đều phải có preview-before-apply.
6. Mọi backfill/recompute phải invalidate impacted L4 caches ngay sau materialization, không chờ TTL hết hạn.
7. Whale governance write-through phải đi qua pending/draft bridge, không được overwrite active version trực tiếp nếu chưa có approval/rollout proof từ mission-control.
8. Link-out tới `Data Ops` hoặc `Vnstock Config` phải permission-aware; thiếu quyền thì render disabled state thay vì link chết.
9. Selective forensic windows phải là physical carve-out sang L5 table riêng, không phải tagging trên raw L0.
10. Bộ tài liệu phải đủ cho kiến trúc, implementation, QA và audit nội bộ mà không cần đoán lại ownership, retention rules hay migration boundaries.

## 3. Bộ tài liệu trong gói này

### 3.1 Triad bắt buộc

1. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
2. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
3. `docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`

### 3.2 Tài liệu bàn giao, audit và thực thi

1. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
2. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
3. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
4. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_EXECUTION_EVIDENCE_TEMPLATE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
7. `docs/RUN_CODE_REVIEW_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
8. `docs/RUN_INTEGRATION_TESTS_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
9. `docs/RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
10. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_AUDIT_REPORT_20260501.md`

### 3.3 Repo rulebook phải tuân thủ

1. `AGENTS.md`
2. `quality/QUALITY.md`

## 4. Thứ tự ưu tiên khi có xung đột diễn giải

1. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
2. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
3. `docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
8. `docs/RUN_CODE_REVIEW_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
9. `docs/RUN_INTEGRATION_TESTS_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
10. `docs/RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
11. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_AUDIT_REPORT_20260501.md`
12. `AGENTS.md`
13. `quality/QUALITY.md`

## 5. Các quyết định đã khóa

### 5.1 Operator IA

1. `Money Flow Control Center` là bước tiến hóa của tab `signals` trong `AdminOps`, không phải một settings island mới đứng cạnh `Signal Control Center`.
2. `Signal Control Center` hiện hữu phải được hấp thụ hoặc mở rộng theo IA mới, không được để tồn tại hai operator surface cùng ghi vào cùng domain config.
3. `Data Ops` tiếp tục là surface cho upstream ingest/provider/runtime ops, không phải nơi ghi whale policy hoặc dark-flow policy.

### 5.2 Config ownership matrix

1. Shared lifecycle, service enablement, distribution policy và detection universe tiếp tục bám `global_signal_policy_helpers.py` và control plane liên quan.
2. Raw ingest cadence, provider throttling, realtime stream và raw-staging cleanup tiếp tục bám `runtime_policy_helpers.py` cùng `RuntimeVnstockConfig`.
3. Whale governance có versioning, approval và rollout phải tiếp tục bám các `WhaleConfig*` models và services hiện có; UI mới chỉ được write-through vào domain này, không tạo config whale song song.
4. Write-through bridge cho whale governance chỉ được tạo pending/draft version và phải chờ explicit approval trước khi apply/publish active version.
5. Dark-flow policy hiện chưa có mission-control versioning tương đương, nên giai đoạn đầu vẫn bám `global_signal_services_config.dark_flow_service` cho write path.

### 5.3 Xử lý các duplicate knob hiện có

1. `runtime_policy_helpers.intraday_tick_keep_days` là canonical raw-staging retention; `global_signal_retention_policy.raw_intraday_keep_days` không được tiếp tục tồn tại như một writer độc lập trong end-state.
2. `global_signal_universe_policy` là SSOT cho detection universe của whale và dark flow; `intraday_universe_group_ids` chỉ là ingest/warm-tier hint for prefetch/runtime.
3. Whale detection thresholds và semantic policy thuộc whale mission-control; `global_signal_services_config.whale_service.default_threshold_vnd` chỉ được giữ như compatibility field tạm thời hoặc derived effective value, không phải writer vĩnh viễn.

### 5.4 Data lifecycle tiers

1. `L0 - Raw staging`: `IntradayTick` và các raw slices chỉ giữ ngắn hạn để ingest, recovery và backfill gần.
2. `L1 - Canonical events`: `WhaleAlertEvent` và `OrderFlowSignal` là truth dài hạn cho signal-level history.
3. `L2 - Bucket facts`: facts theo symbol/trade date/time bucket là truth lâu dài cho chart/session analytics.
4. `L3 - Session summaries`: các tổng hợp per-session, per-domain, per-symbol phục vụ fast reads, overview và advisory context.
5. `L4 - Hot snapshots and caches`: Redis hoặc snapshot cache chỉ là accelerator, không phải source of truth.
6. `L5 - Selective forensic windows`: raw slices dài hơn chỉ được giữ theo severity/anomaly rule dưới dạng physical carve-out riêng, không giữ toàn bộ raw vô thời hạn và không dùng tagging-only trên L0.

### 5.5 Read-path truth cho whale route

1. `whale-alerts/:symbol` tiếp tục dùng `KLineChart` làm surface trung tâm.
2. Selected-session truth vẫn là luật cứng cho bubble, advisory, CVD, strength và route snapshot.
3. Primary path của route này phải chuyển sang facts-first: bucket facts + session summaries + canonical events, không còn tổng hợp full raw ticks trên mỗi cache miss thông thường.

### 5.6 Background services bắt buộc

1. Ingest/prefetch services tiếp tục thu raw data và chuẩn hóa universe đầu vào.
2. Materialization services phải chạy nền để tạo bucket facts, session summaries và snapshot warm cache.
3. Retention services phải preview và purge theo tier, không xóa mù.
4. Backfill/recompute services phải có run registry, safety gate và freshness markers rõ ràng.
5. Backfill/recompute services phải invalidate impacted L4 caches sau recompute và ghi rõ cache keys bị ảnh hưởng trong evidence.

### 5.7 Non-negotiables

1. Không tạo parallel writer cho cùng một business meaning.
2. Không kéo `IntradayTick` thành long-term read model mặc định chỉ vì tiện triển khai.
3. Không trộn whale policy và dark-flow policy thành một blob cấu hình không có domain boundary.
4. Mọi compute nặng phải ưu tiên SQL-first projection và Pandas vectorized batch compute.
5. Mọi text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu.
6. Legacy write surfaces phải hard-block ở backend; demote UI không đủ để chặn phantom writes.
7. Forensic carve-out phải physical, không được tag-only trên raw.
8. **Mandatory Docker Rebuild**: Sau mỗi lần sửa code, bắt buộc chạy lệnh build/update docker dev (ví dụ: `docker compose -f ./docker-compose.dev.yml up -d --build frontend backend`) để đảm bảo code mới được cập nhật; nếu không hệ thống sẽ vẫn chạy code cũ.

## 6. File anchors hiện tại

### Frontend

1. `frontend/src/pages/AdminOps.jsx`
2. `frontend/src/components/adminops/SignalControlCenter.jsx`
3. `frontend/src/pages/WhaleAlertsDashboard.jsx`
4. `frontend/src/components/KLineChartPanel.jsx`
5. `frontend/src/api/client.js`

### Backend

1. `backend/portfolio/global_signal_policy_helpers.py`
2. `backend/portfolio/runtime_policy_helpers.py`
3. `backend/portfolio/views_signal_admin.py`
4. `backend/portfolio/views_whale_analytics.py`
5. `backend/portfolio/services_whale_analytics_snapshot.py`
6. `backend/portfolio/services.py`
7. `backend/portfolio/models.py`
8. `backend/portfolio/views_stock_workspace_admin.py`

## 7. Role matrix và AI skill matrix

| Vai trò | Phạm vi chính | AI / skill bắt buộc | Human gate |
|---|---|---|---|
| Product Owner / Final Auditor | chốt scope, owner consent, go/no-go | không áp dụng | bắt buộc approve trước coding |
| Tech Lead | khóa SSOT, ownership, migration order | GitHub Copilot theo repo governance | approve ARC slices |
| Backend Lead | models, services, retention, APIs, backfill | GitHub Copilot (GPT-5.4) | review schema, performance, idempotency |
| Frontend Lead | Money Flow Control Center IA và React integration | `Expert React Frontend Engineer` + `react19-source-patterns` | review IA, i18n, React 19 compliance |
| QA Lead | traceability, performance evidence, regression pack | `quality-playbook` | verify evidence pack |
| DevOps / Runtime Owner | rebuild, worker/beat rollout, rollback path | GitHub Copilot theo ops guardrails | approve runtime rehearsal |

## 8. Điều kiện chuyển sang coding

Đội code chỉ được xem là đủ điều kiện coding khi đồng thời đúng:

1. bộ tài liệu trong gói này đã tồn tại đầy đủ,
2. Product Owner xác nhận scope và cho explicit consent bắt đầu coding,
3. Tech Lead xác nhận writer boundary, retention boundary và selected-session truth đã khóa,
4. taskboard có owner, required skill, test gate và evidence cho từng slice.
5. **Mandatory Docker Rebuild**: Mọi thay đổi logic code bắt buộc phải build/update docker dev environment để đảm bảo code mới được cập nhật.

## 9. Câu chốt bắt buộc

Money Flow Control Center không phải bài toán vẽ thêm một dashboard admin. Đây là bài toán khóa `writer ownership`, `facts-first data lifecycle` và `operator UX` để hệ thống load nhanh hơn mà vẫn sạch dữ liệu và không đẻ thêm SSOT giả.

Nguyên tắc không được vi phạm:

1. Thà để một panel read-only link sang surface upstream còn hơn thêm một writer thứ hai cho cùng một knob.
2. Thà materialize facts chạy nền còn hơn tiếp tục build route chính từ raw ticks mỗi lần cache miss.
3. Thà giữ raw ngắn hạn nhưng có forensic window chọn lọc còn hơn lưu thô toàn bộ vô thời hạn.