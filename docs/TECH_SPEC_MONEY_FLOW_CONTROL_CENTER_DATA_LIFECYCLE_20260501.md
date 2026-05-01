# TECH SPEC - Money Flow Control Center and Data Lifecycle

## 1. Mục tiêu kỹ thuật

Thiết kế này nhằm tạo một kiến trúc money-flow đủ bền cho bốn việc đồng thời:

1. vận hành whale + dark flow trên một operator center thống nhất,
2. khóa đúng SSOT và writer ownership để không phát sinh parallel writers,
3. materialize dữ liệu đủ sâu để primary read path không phải build từ raw mỗi lần,
4. duy trì retention nhiều tầng để dữ liệu sạch, nhanh và còn giá trị forensic khi cần.

## 2. Domain boundaries và SSOT

### 2.1 Domain truth bắt buộc

1. `WhaleAlertEvent` là canonical event-store cho whale global.
2. `OrderFlowSignal` là canonical persisted signal cho dark-flow global.
3. `IntradayTick` là raw feed cho ingest, recovery, nearline backfill và selective forensic, không phải read model chính cho money-flow route lâu dài.
4. `whale-alerts/:symbol` phải tiếp tục bám selected-session truth và KLine-centered semantics.

### 2.2 Ownership matrix bắt buộc

| Domain | Canonical writer | Money Flow Control Center behavior |
|---|---|---|
| Shared service enablement, distribution, detection universe | `global_signal_policy_helpers.py` | preview/apply writer trực tiếp |
| Raw ingest cadence, provider throttling, realtime flags, raw keep-days | `runtime_policy_helpers.py` và `RuntimeVnstockConfig` | read-only hoặc link-out cho đến khi có migration rõ ràng |
| Whale governance, rollout, approval, active version | `WhaleConfig*` models + `backend/portfolio/services.py` | write-through, không duplicate field |
| Dark-flow thresholds và domain policy | `global_signal_services_config.dark_flow_service` | preview/apply writer trực tiếp ở phase hiện tại |
| Materialization, retention tiers, forensic policy | control-plane mới của pack này | preview/apply writer trực tiếp |

### 2.3 Duplicate knob resolution

1. `intraday_tick_keep_days` trong runtime policy là raw-staging owner; bất kỳ field trùng nghĩa ở signal retention chỉ được hiển thị dưới dạng `effective value` hoặc bị deprecate.
2. `global_signal_universe_policy` là detection universe SSOT; ingest group IDs ở runtime policy không được dùng như alternate truth cho whale/dark detection.
3. Whale thresholds không được tồn tại đồng thời như hai writer giữa mission-control và signal service config. End-state là write-through hoặc derived display value.

### 2.4 Nghiêm cấm

1. Tạo thêm một `money_flow_settings` blob mới nếu chỉ lặp lại dữ liệu đã có ở ba domain trên.
2. Để `Data Ops` và `Money Flow Control Center` cùng ghi vào cùng một raw-retention knob.
3. Để `Signal Control Center` cũ và `Money Flow Control Center` mới cùng tồn tại như hai writer đồng cấp cho cùng config.

## 3. Data lifecycle architecture

### 3.1 Lifecycle tiers

| Tier | Artifact | Mục đích | Retention mặc định | Ghi chú |
|---|---|---|---|---|
| `L0` | `IntradayTick` và raw staging inputs | ingest, short-term recovery, nearline backfill | 3-7 trade days | owner là runtime/data ops |
| `L1` | `WhaleAlertEvent`, `OrderFlowSignal` | canonical signal history | 180-365 ngày hoặc theo policy | event-level truth |
| `L2` | `MoneyFlowBucketFact` | facts theo bucket để dựng CVD, strength, heatmap, session flow | 365+ ngày, partitioned | logical artifact, tên model có thể khác |
| `L3` | `MoneyFlowSessionSummary` | session-level aggregates, overview, advisory context, route warm reads | 365+ ngày | logical artifact, semantics là bắt buộc |
| `L4` | hot snapshot caches | phục vụ low-latency reads | TTL 15 phút đến 24 giờ | accelerator, không phải SSOT |
| `L5` | `MoneyFlowForensicWindow` | raw slices được chọn lọc quanh severe/anomalous events | 30-90 ngày | không giữ toàn thị trường |

### 3.2 Logical artifacts bắt buộc

#### A. `MoneyFlowBucketFact`

Semantics bắt buộc:

1. khóa theo `symbol`, `trade_date`, `bucket_start`, `bucket_minutes`, `domain`;
2. chứa đủ metrics để dựng hoặc suy ra:
   - buy/sell/notional totals,
   - normalized CVD,
   - buy strength,
   - institutional strength,
   - event counts / severity hints,
   - completeness and freshness flags;
3. đủ dữ liệu để primary route không cần quét full raw ticks cho session bình thường.

#### B. `MoneyFlowSessionSummary`

Semantics bắt buộc:

1. khóa theo `symbol`, `trade_date`, `domain` hoặc combined session view;
2. chứa totals, extremes, quality flags, dominant buckets, event density, anomaly hints;
3. là nguồn chính cho overview panels, selected-session context và advisory consumers.

#### C. `MoneyFlowForensicWindow`

Semantics bắt buộc:

1. chỉ lưu raw slice quanh event/severity/anomaly đủ điều kiện;
2. retention dài hơn raw staging nhưng hẹp hơn full-market raw;
3. phải có source reason và expiry timestamp rõ ràng.

## 4. Processing pipeline

### 4.1 Ingest and projection

1. Chọn universe bằng SQL-first projection từ curated/admin + tracked/watchlist snapshot theo đúng domain boundary.
2. Chỉ lấy các cột raw cần cho materialization thay vì kéo full `IntradayTick` payload.
3. Dùng Pandas vectorized compute cho bucket/session aggregations có khối lượng lớn.

### 4.2 Whale materialization flow

1. Input: raw staging + canonical whale events + effective session context.
2. Output:
   - whale bucket facts,
   - whale session summary,
   - hot snapshot cache cho selected session.
3. Tất cả phải gắn freshness/completeness markers để UI biết đang đọc fully materialized hay degraded fallback.

### 4.3 Dark-flow materialization flow

1. Input: raw staging + `OrderFlowSignal` + same session context.
2. Output:
   - dark-flow bucket facts,
   - dark-flow session summary,
   - control-plane freshness metrics.
3. Whale và dark flow có thể dùng shared scheduling/backfill pipeline nhưng không được trộn policy semantics.

### 4.4 Snapshot assembly cho `whale-alerts/:symbol`

Primary path phải ưu tiên thứ tự:

1. `MoneyFlowBucketFact` + `MoneyFlowSessionSummary`,
2. canonical events để enrich markers, bubble context, advisory context,
3. hot cache nếu còn tươi,
4. raw-based recompute fallback chỉ khi facts chưa sẵn sàng và phải có quality/degraded flag.

### 4.5 Retention and cleanup

Purge raw hoặc facts chỉ được chạy khi đồng thời đúng:

1. preview đã chỉ ra impacted rows/partitions,
2. materialization completeness đạt chuẩn,
3. không có backfill hoặc recompute đang chờ phụ thuộc vào tier sắp purge,
4. forensic windows liên quan đã được carve-out nếu policy yêu cầu,
5. forensic carve-out phải là physical copy/move sang L5 table riêng, không chỉ gắn cờ trên raw L0,
6. nếu completeness không thể phục hồi do upstream gap vĩnh viễn, preview phải hiển thị bounded override hoặc TTL fallback với explicit human approval, không được block vô thời hạn.

### 4.6 Backfill and recompute

1. Mọi backfill/recompute phải đi qua run registry thống nhất và sau khi materialize xong phải invalidate các L4 cache keys bị ảnh hưởng.
2. Nếu có dual-write hoặc shadow materialization trong migration, giai đoạn đó phải time-boxed và có explicit rollback plan.
3. Không được duy trì song song hai read paths chính thức sau khi facts-first cutover đã pass audit.

## 5. Admin control plane IA và write semantics

### 5.1 Zones bắt buộc

1. `Overview`
2. `Shared Lifecycle`
3. `Whale Governance`
4. `Dark Flow Policy`
5. `Materialization`
6. `Storage and Retention`
7. `Jobs and Audit`

### 5.2 Zone semantics

| Zone | Mục đích | Write behavior |
|---|---|---|
| Overview | health, freshness, owner matrix, anomalies | read-only |
| Shared Lifecycle | service toggles, distribution, detection universe | preview/apply writer |
| Whale Governance | active whale config version, rollout, anomaly state | write-through sang whale mission-control qua pending/draft bridge, không auto-publish active version |
| Dark Flow Policy | thresholds, windows, severity policy | preview/apply writer |
| Materialization | recompute, backfill, freshness preview | guarded writer |
| Storage and Retention | tier preview, purge preview, forensic policy | guarded writer |
| Jobs and Audit | run registry, recent actions, residual risk | read-only + guarded run actions |

### 5.3 Read-only link-out rules

1. Nếu một knob còn thuộc `Data Ops` hoặc `Vnstock Config`, `Money Flow Control Center` chỉ hiển thị effective value và link-out, không thêm nút apply thứ hai.
2. Nếu một whale domain field còn thuộc whale mission-control, control center chỉ được write-through hoặc open flow hiện có; write-through bridge chỉ được tạo pending/draft version và không được tự Apply/Publish active version nếu thiếu explicit approval từ mission-control.
3. UI phải gắn nhãn rõ `Nguồn chỉnh sửa chuẩn` khi hiển thị effective value từ domain khác.
4. Nếu operator không có quyền trên `Data Ops` hoặc `Vnstock Config`, UI phải render disabled state kèm badge `Requires Data Ops permission` thay vì link chết.

## 6. API surface guidelines

1. Ưu tiên mở rộng family `/api/admin-ops/signals/*` thay vì tạo một silo API mới không liên hệ với control plane cũ.
2. Các contract mới nên nhóm theo sub-surface `money-flow` nhưng vẫn ở cùng operator family, ví dụ:
   - `/api/admin-ops/signals/money-flow/summary/`
   - `/api/admin-ops/signals/money-flow/materialization/preview/`
   - `/api/admin-ops/signals/money-flow/materialization/run/`
   - `/api/admin-ops/signals/money-flow/retention/preview/`
   - `/api/admin-ops/signals/money-flow/forensic/preview/`
3. Preview payload phải luôn trả `effective_owner`, `effective_values`, `diff`, `impacted_counts`, `freshness`.

## 7. Performance và quality gates

1. Primary read path của `whale-alerts/:symbol` không được full-scan raw ticks sau khi facts-first cutover hoàn tất.
2. Selected-session truth phải giữ nguyên ở bubble, advisory, CVD, strength và marker semantics.
3. UI phải phân biệt được `fresh`, `stale`, `degraded fallback`, `recompute pending`.
4. Performance evidence phải có before/after benchmark hoặc payload timing snapshot theo cùng symbol/session.

## 8. Migration and rollout notes

1. Bắt đầu bằng boundary freeze và deprecation warnings, không đổi hành vi read/write trước khi owner approve.
2. Materialization có thể triển khai trước ở chế độ shadow build, nhưng chỉ một control plane được quyền ghi config trong suốt quá trình.
3. Facts-first cutover phải đi kèm fallback flag và explicit removal plan cho raw-first primary path.
4. Sau cutover, phải xóa hoặc demote các compatibility writer để không tái sinh drift.