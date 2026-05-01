# IMPLEMENTATION PLAN - Money Flow Control Center and Data Lifecycle

**Ngày tạo**: 2026-05-01  
**Scope**: Money Flow Control Center + long-term storage lifecycle cho Whale Alerts và Dark Money Flow  
**Level**: A (major architecture, control-plane consolidation, backend data lifecycle, route performance)  
**Status**: READY FOR OWNER CONFIRMATION

---

## 1. Business objective

### Vấn đề cần giải quyết

Hệ thống hiện đã có:

1. global signal control plane cho whale và dark flow,
2. runtime/data ops controls cho ingest và raw cleanup,
3. whale mission-control versioned governance,
4. route `whale-alerts/:symbol` dùng selected-session truth và KLine-centered UI.

Tuy nhiên vẫn còn bốn vấn đề nền:

1. writer boundary giữa signal lifecycle, raw runtime và whale governance chưa đủ rõ,
2. cold path của `whale-alerts/:symbol` còn có nguy cơ build snapshot từ raw `IntradayTick` quá nặng,
3. retention strategy chưa được chốt thành một lifecycle nhiều tầng nên dễ sinh dữ liệu thừa hoặc purge thiếu safety gate,
4. operator UI hiện chưa gom whale, dark flow, materialization và storage lifecycle vào một IA thống nhất.

### Mục tiêu nghiệp vụ

1. Giảm phụ thuộc vào raw ticks trên các read path money-flow quan trọng.
2. Khóa một trung tâm vận hành thống nhất nhưng không sinh thêm config writer song song.
3. Lưu giữ dữ liệu hữu ích lâu dài theo tier hợp lý, thay vì giữ nguyên raw data toàn phần.
4. Giữ selected-session truth và KLine semantics trong mọi tối ưu hiệu năng tương lai.

### KPI đầu ra

| Chỉ số | Baseline | Mục tiêu |
|---|---:|---:|
| Số operator surface có thể ghi money-flow policy | 3+ | 1 per domain meaning |
| Primary whale route cần full raw aggregation trên cold path chính | Có | 0 sau switch facts-first |
| Nơi admin phải mở để hiểu lifecycle whale + dark flow | nhiều surface | 1 center chính + link-out có chủ đích |
| Raw tick retention không có owner rõ ràng | Ambiguous | 1 canonical owner |
| Long-lived data cho session analytics | chưa chuẩn hóa | bucket facts + session summaries + canonical events |

---

## 2. Scope and non-scope

### In-scope

1. Khóa boundary giữa `Signal Control Center`, `Data Ops`, runtime policy và whale mission-control.
2. Thiết kế lifecycle tiers cho whale + dark flow.
3. Thiết kế facts-first data path cho `whale-alerts/:symbol`.
4. Thiết kế materialization, backfill, retention và forensic services.
5. Thiết kế `Money Flow Control Center` trong `AdminOps` theo IA hợp nhất.

### Out-of-scope

1. Không redesign toàn bộ Django admin.
2. Không thay chart engine hoặc đổi selected-session semantics.
3. Không mở rộng AI advisory logic ngoài phần tiêu thụ facts/canonical outputs cần thiết.
4. Không thay market-data provider stack ngoài các boundary cần để lifecycle vận hành an toàn.

---

## 3. Current-state assessment

### Điều đang có

1. `SignalControlCenter` đã quản lý services, universe, retention, jobs và recent events cho global signals.
2. `runtime_policy_helpers.py` đang giữ raw ingest/runtime knobs như `intraday_tick_keep_days`, prefetch cadence và realtime stream.
3. Whale mission-control đã có versioning/approval/rollout thông qua các `WhaleConfig*` models và services.
4. `views_whale_analytics.py` và `services_whale_analytics_snapshot.py` đang là cổ chai cold path cho route whale.

### Vấn đề gốc chưa giải quyết

1. Một số knob cùng business meaning đang nằm ở nhiều nơi và cần boundary/deprecation plan.
2. Route whale chưa có durable facts layer riêng đủ mạnh để bỏ request-time aggregation từ raw ticks trên primary path.
3. Dark-flow chưa có lifecycle/materialization spec tương đương whale route upgrade.
4. Admin IA chưa gom được storage/materialization/forensic concerns vào cùng operational narrative.

---

## 4. Target architecture summary

### 4.1 Bốn lớp đích

1. `Ingest and runtime layer`
   - prefetch/runtime settings,
   - provider throttling,
   - raw staging retention.
2. `Canonical signal layer`
   - `WhaleAlertEvent`,
   - `OrderFlowSignal`.
3. `Materialized facts layer`
   - bucket facts,
   - session summaries,
   - selective forensic windows,
   - hot snapshot caches.
4. `Operations and control layer`
   - Money Flow Control Center,
   - preview/apply semantics,
   - jobs and audit.

### 4.2 Kiến trúc delivery

1. Shared lifecycle config không được trộn lẫn với whale policy versioning.
2. Raw retention phải có owner duy nhất.
3. Facts-first phải thay thế raw-first ở primary path, nhưng migration có thể có shadow/backfill window ngắn hạn và phải time-boxed.
4. Mọi dangerous action phải có preview, confirmation và audit evidence.

---

## 5. Delivery team and required AI skills

| Workstream | Owner chính | Phối hợp | AI skill / mode bắt buộc |
|---|---|---|---|
| Writer boundary, storage tiers, migration order | Tech Lead | Backend Lead, Product Owner | GitHub Copilot theo repo governance |
| Materialization services và retention | Backend Lead | DevOps | GitHub Copilot (GPT-5.4) |
| Admin control plane React | Frontend Lead | Tech Lead, QA | `Expert React Frontend Engineer` + `react19-source-patterns` |
| Traceability, regression, performance evidence | QA Lead | Frontend Lead, Backend Lead | `quality-playbook` |
| Runtime rollout, rebuild, worker/beat validation | DevOps Lead | Backend Lead | GitHub Copilot theo ops guardrails |

### Coding gate

Không slice nào được chuyển sang implementation nếu chưa có explicit consent từ owner.

---

## 6. Execution phases

## Phase 0 - Governance and boundary freeze

### ARC-01
Mục tiêu:
- Khóa matrix ai được quyền ghi shared lifecycle, raw runtime, whale governance và dark-flow policy.

### ARC-02
Mục tiêu:
- Khóa lifecycle tiers, retention owner và duplicate knob deprecation plan.

### ARC-03
Mục tiêu:
- Khóa IA của `Money Flow Control Center` và rule link-out/read-only cho các surface upstream.

## Phase 1 - Shared lifecycle contracts

### BE-1.1
Mục tiêu:
- Chuẩn hóa `effective money-flow lifecycle view` ghép từ signal config, runtime policy và whale governance status.

### BE-1.2
Mục tiêu:
- Thêm deprecation semantics cho các duplicate knob hiện có thay vì để nhiều writer cùng sống.

### BE-1.3
Mục tiêu:
- Chuẩn hóa run registry cho materialization, recompute, retention preview và purge jobs.

## Phase 2 - Whale facts-first path

### BE-2.1
Mục tiêu:
- Tạo bucket facts cho whale theo symbol/trade date/time bucket.

### BE-2.2
Mục tiêu:
- Tạo session summary cho whale phục vụ KLine route, advisory context và overview.

### BE-2.3
Mục tiêu:
- Chuyển `views_whale_analytics.py` và snapshot service sang facts-first primary path, raw chỉ còn là fallback có kiểm soát.

## Phase 3 - Dark-flow lifecycle parity

### BE-3.1
Mục tiêu:
- Tạo bucket facts và freshness contract cho dark flow.

### BE-3.2
Mục tiêu:
- Tạo session summary / overview artifacts cho dark flow.

### BE-3.3
Mục tiêu:
- Đưa dark-flow materialization health vào control-plane summary.

## Phase 4 - Retention, forensic and cleanup

### BE-4.1
Mục tiêu:
- Tạo retention preview với completeness/freshness safety gate.

### BE-4.2
Mục tiêu:
- Tạo selective forensic window policy cho severe/anomalous events thay vì giữ raw toàn phần dài hạn.

### BE-4.3
Mục tiêu:
- Chuẩn hóa purge orchestration, recompute dependency checks và rollback notes.

## Phase 5 - Admin backend control plane

### BE-5.1
Mục tiêu:
- Mở rộng summary API cho lifecycle tiers, materialization freshness, anomaly backlog và effective owner matrix.

### BE-5.2
Mục tiêu:
- Tạo preview/apply APIs cho materialization, retention và deprecation-aware config updates.

### BE-5.3
Mục tiêu:
- Tạo bridge APIs để control center có thể thao tác whale governance theo write-through semantics thay vì duplicate writer.

## Phase 6 - Admin frontend Money Flow Control Center

### FE-6.1
Mục tiêu:
- Evolve tab `signals` thành shell `Money Flow Control Center` trong `AdminOps`.

### FE-6.2
Mục tiêu:
- Dựng các zone `Overview`, `Shared Lifecycle`, `Storage and Retention`, `Materialization`, `Jobs and Audit`.

### FE-6.3
Mục tiêu:
- Dựng `Whale Governance` và `Dark Flow Policy` panels với boundary rõ ràng.

### FE-6.4
Mục tiêu:
- Thêm preview, effective-value warnings, deprecation badges, i18n Việt và pagination chuẩn.

### FE-6.5
Mục tiêu:
- Demote hoặc link-out các writer cũ có nguy cơ gây nhầm, đặc biệt ở Data Ops và whale legacy surfaces.

## Phase 7 - QA, performance and rollout

### QA-7.1
Mục tiêu:
- Viết focused backend tests cho lifecycle facts, deprecation boundaries, retention safety và route snapshot parity.

### QA-7.2
Mục tiêu:
- Viết frontend tests cho IA, preview/apply, effective-value warnings và guard states.

### QA-7.3
Mục tiêu:
- Chạy performance evidence cho `whale-alerts/:symbol` trước/sau switch facts-first.

### OPS-7.4
Mục tiêu:
- Rebuild/restart stack bị ảnh hưởng, rehearse backfill/cleanup path và chuẩn bị evidence cho final auditor.

---

## 7. Exit criteria cho giai đoạn planning

Planning chỉ được xem là đủ điều kiện chuyển sang discussion sâu hoặc coding sau này khi:

1. owner matrix không còn ambiguity,
2. duplicate knob deprecation plan đã rõ,
3. facts-first target path cho whale route đã rõ,
4. taskboard có đầy đủ owner, gate và evidence,
5. Product Owner chấp thuận chuyển sang implementation.