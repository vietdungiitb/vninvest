# ENTERPRISE CORE STORAGE AND SCHEMA STRATEGY

**Date:** 2026-05-02  
**Status:** Schema-last companion artifact for `core`  
**Purpose:** Chốt chiến lược lưu trữ và tổ chức schema cho `core` theo kiểu production platform thực tế: contract trước, serving model trước, storage split sau.

---

## 1. Mục tiêu và phi mục tiêu

### 1.1 Mục tiêu

- bảo vệ `core` khỏi split schema quá sớm,
- phân biệt rõ canonical events, mutable state, read models, staging và cache,
- đưa ra tiêu chí thực tế cho việc khi nào cần bảng mới, khi nào cần read model, khi nào cần physical schema split,
- giúp `vip-app` và `opencore` có storage semantics ổn định trước khi build.

### 1.2 Phi mục tiêu

- không thiết kế chi tiết từng migration SQL ở giai đoạn này,
- không ép tách Postgres schemas hay database routers ngay,
- không giới thiệu ClickHouse, Kafka hay data lake nếu chưa có trigger thật.

---

## 2. Reality check của repo hiện tại

Hiện tại VNInvest đang có mô hình phù hợp cho phase platformization sớm:

- một backend Django/DRF/Channels/Celery,
- một PostgreSQL source-of-record,
- một Redis runtime substrate cho cache, broker, result backend, streams và channels,
- nhiều read paths mạnh/yếu đan xen,
- nhiều nghiệp vụ lõi đã tồn tại nhưng chưa được chuẩn hóa thành `core` contracts.

Điểm nghẽn chính hiện tại không phải thiếu schema split. Điểm nghẽn chính là:

- nhiều route còn composite và fallback theo request,
- chưa có read models chuẩn cho partner/public usage,
- tenant/token/meter/billing semantics mới ở mức kiến trúc chứ chưa thành contract và storage model rõ.

---

## 3. Mô hình lưu trữ đề xuất cho `core`

### 3.1 PostgreSQL giữ vai trò gì

PostgreSQL vẫn là source-of-record cho 5 nhóm dữ liệu:

1. identity và access control,
2. market reference và snapshots lâu dài,
3. canonical signal events,
4. quota/billing/commercial ledgers,
5. audit và operator lineage.

### 3.2 Redis giữ vai trò gì

Redis chỉ nên giữ các lớp runtime sau:

1. ephemeral cache,
2. hot ticker/session/alert projections ngắn hạn,
3. Celery broker/result,
4. stream transport,
5. rate limit / quota counters thời gian ngắn.

Redis không được trở thành source-of-record duy nhất cho partner/public contracts.

---

## 4. Phân loại storage objects trong `core`

| Loại storage object | Mục đích | Ví dụ | Cho public contract trực tiếp không |
|---|---|---|---|
| Mutable state table | giữ trạng thái hiện tại | tenant status, service account status, subscription state | Có, nếu semantics ổn định |
| Canonical event table | giữ sự kiện nghiệp vụ bất biến | whale event, alert event, quota ledger entry | Có thể, nhưng thường qua projection |
| Materialized read model | phục vụ read path nhanh và ổn định | symbol snapshot, session facts, quota snapshot | Có, đây là lớp ưu tiên |
| Staging table | đệm ingest hoặc recovery | `IntradayTick` | Không |
| Audit log table | kiểm toán và truy vết | token usage log, policy audit log | Không public trực tiếp, chỉ qua filtered projection |
| Redis ephemeral projection | cache/ngắn hạn | ticker hot cache, alert hot feed | Không là source contract cuối cùng |

---

## 5. Logical namespace map cho `core`

Ở phase đầu, dùng logical namespaces thay vì physical schema split.

| Logical namespace | Owner service | Current anchors | Future tables/read models |
|---|---|---|---|
| `identity_access` | `identity_access_service` | `auth_user`, `UserConfig` | `CoreTenant`, `CoreTenantMembership`, `CoreServiceAccount`, `CoreAccessPolicy`, `CorePATCredential`, `CoreTokenSecretVersion` |
| `market_reference` | `market_reference_service` | `StockProfile`, groups, sync logs | `SectorReferenceSnapshot`, `MarketUniverseSnapshot` |
| `market_serving` | `market_snapshot_service` | `DailyPrice`, `TickerSessionClose`, cache projections | `CoreSymbolSnapshot`, `PriceBoardSnapshot`, `RealtimeTickerSnapshot` |
| `signal_intelligence` | `signal_intelligence_service` | `WhaleAlertEvent`, `WhaleAdvisory`, `SignalServiceRun`, forensic windows | `SessionFacts`, `SymbolSignalSummary`, `UnifiedAlertProjection` |
| `commercial` | `entitlement_service`, `quota_billing_service` | `DPI*` models | `CoreUsageMeter`, `CoreUsageAggregateHourly`, `CoreBillingAccount`, `TenantQuotaLedger`, `BillingCreditGrant` |
| `ai_runtime` | `ai_runtime_service` | `AICommandCenterConfig`, `SystemAISettings` | `AIRuntimeCapabilitySnapshot`, `PartnerPromptPolicy` |
| `ops_audit` | `operator_runtime_service` | health, job runs, settings | token anomaly projections, ops snapshots |

---

## 6. Khi nào thêm bảng mới, khi nào thêm read model, khi nào giữ nguyên

### 6.1 Thêm bảng canonical mới khi

- xuất hiện một business object mới có lifecycle riêng,
- cần audit/history bất biến,
- cần ownership rõ ràng không nên nhồi vào bảng cũ,
- hoặc cần commercial ledger chính xác.

Ví dụ:

- `CoreTenant`,
- `CoreServiceAccount`,
- `CorePATCredential`,
- `CoreUsageMeter`,
- `TenantQuotaLedger`.

### 6.2 Thêm materialized read model khi

- route hiện tại còn fan-out quá nhiều,
- partner/public contract cần response ổn định,
- dữ liệu là derived facts từ nhiều nguồn canonical,
- hoặc workload đọc nhiều hơn ghi rõ rệt.

Ví dụ:

- `CoreSymbolSnapshot`,
- `SessionFacts`,
- `PriceBoardSnapshot`,
- `UnifiedAlertProjection`,
- `QuotaSnapshotProjection`.

### 6.3 Giữ trong bảng hiện có khi

- object chưa có lifecycle riêng,
- chỉ là metadata phụ,
- hoặc consumer contract còn chưa chốt.

Không nên tách bảng chỉ để “nghe có vẻ enterprise”.

---

## 7. Physical schema strategy theo phase

### Phase S0 - Single physical schema, strict ownership

- giữ cùng một Postgres schema vật lý chính,
- dùng logical namespace trong docs, code ownership và review,
- mọi bảng mới phải gắn owner service rõ.

### Phase S1 - Read-model maturation

- tạo read models cho symbol snapshot, session facts, quota snapshot, unified alerts,
- public contracts chỉ đọc từ read models hoặc stable canonical tables,
- staging/raw không được public.

### Phase S2 - Physical split evaluation

Chỉ bắt đầu đánh giá split schema vật lý khi:

- ít nhất 2 consumer đang dùng cùng contract ổn định,
- read path chính đã bớt join chéo ad-hoc,
- migration/backfill plan đã viết,
- ownership và permission boundaries đủ rõ.

### Phase S3 - Selective schema split nếu thật sự cần

Nếu đủ điều kiện, chỉ split những vùng có lý do thật:

- retention khác biệt mạnh,
- permission boundary khác biệt,
- migration cadence khác biệt,
- scale/write profile khác biệt.

Không split toàn bộ chỉ vì muốn map 1-1 với package names.

---

## 8. Quy tắc thiết kế bảng cho `core`

### 8.1 External IDs và internal PK

- Internal PK có thể tiếp tục dùng bigint/uuid tùy Django pattern hiện hành.
- External contract ids nên có prefix ổn định và không phụ thuộc internal PK.
- Consumer không được phụ thuộc vào internal database id.

### 8.2 Audit columns bắt buộc

Với hầu hết bảng mới dành cho control-plane/commercial-plane, nên có:

- `created_at`,
- `updated_at`,
- `created_by_user_id` hoặc actor equivalent nếu có,
- `status`,
- `metadata` nhẹ nếu cần,
- version/revision field nếu object dễ evolve.

### 8.3 Soft delete vs hard delete

- Control-plane objects như tenant, service account, token nên ưu tiên `status`/`revoked_at` hơn hard delete.
- Staging data có thể cleanup hard delete theo retention.
- Invoices, ledgers, canonical events không nên hard delete theo đường thông thường.

### 8.4 Immutable vs mutable

- Event tables nên immutable hoặc append-mostly.
- Snapshot/read model tables có thể mutable theo last-write-wins hoặc revision-based update.
- Quota ledgers nên append-only; quota snapshots chỉ là projection từ ledger.

---

## 9. Partition, retention và index strategy

### 9.1 Candidate partitioned datasets

| Dataset | Strategy |
|---|---|
| `IntradayTick` | partition theo `trade_date`; giữ ngắn hạn |
| usage raw logs | partition theo ngày/tháng; dùng cho rollup và audit |
| whale/unified alert events | partition theo `occurred_at` hoặc `trade_date` nếu volume đủ lớn |
| quota ledger | partition theo billing period nếu growth cao |

### 9.2 Candidate hot indexes

| Table / model | Index cần có |
|---|---|
| tenant/service account/token | `tenant_id`, `status`, `expires_at` |
| symbol snapshots | `symbol`, `trade_date`, `as_of` |
| session facts | `symbol`, `trade_date`, `selected_session` |
| unified alerts | `symbol`, `occurred_at`, `severity`, `alert_type` |
| quota ledger | `tenant_id`, `meter_code`, `period_start`, `period_end` |
| invoices | `tenant_id`, `status`, `issued_at`, `due_at` |

### 9.3 Retention rules

- staging giữ ngắn,
- raw request logs giữ theo policy audit/cost,
- rollups giữ dài hơn raw,
- canonical events giữ dài,
- invoices, ledgers và audit quan trọng giữ theo compliance policy.

---

## 10. Migration và backfill discipline

### 10.1 Trước khi migration

Phải có:

1. contract reference đến resource liên quan,
2. owner service rõ,
3. backfill source rõ,
4. rollback plan rõ,
5. consumer impact note rõ.

### 10.2 Khi backfill

- backfill chỉ đọc từ canonical sources đã được chỉ định,
- không backfill từ Redis cache như source-of-truth,
- phải ghi rõ idempotency strategy cho backfill jobs,
- phải tách `backfill complete` khỏi `public endpoint switched`.

### 10.3 Khi switch read path

- có canary hoặc dual-read verification nếu route quan trọng,
- có metric freshness/staleness,
- có rollback switch về path cũ nếu read model chưa ổn định.

---

## 11. Tiêu chí để được tách physical schema

Một logical namespace chỉ được tách thành physical schema riêng khi đạt đồng thời:

1. Contract đã freeze.
2. Serving model đã freeze.
3. Có ít nhất một consumer production ngoài backend admin nội bộ.
4. Join chéo request-time với namespace khác đã rất thấp hoặc đã được che qua projections.
5. Permission boundary hoặc retention boundary thực sự khác biệt.
6. Migration và rollback đã được rehearsal ở môi trường non-prod.

Nếu thiếu bất kỳ điều kiện nào ở trên, giữ schema chung vẫn là phương án an toàn hơn.

---

## 12. Những việc không nên làm

1. Tách schema theo package names ngay từ đầu.
2. Public route đọc trực tiếp từ staging tables.
3. Dùng raw request logs làm invoice source chính.
4. Dùng Redis cache làm source-of-truth cho partner contracts.
5. Tạo quá nhiều bảng projection trước khi chốt resource semantics.
6. Để consumer phụ thuộc vào internal DB ids.

---

## 13. Kết luận

Chiến lược đúng cho `core` không phải “schema-first”, mà là:

- contract-first,
- logical ownership first,
- read-model first cho serving,
- schema split only when justified.

Với repo hiện tại, đây là cách gần nhất với những hệ production thực tế: giảm rủi ro drift, giữ rollback đơn giản và chỉ nâng độ phức tạp storage khi có tín hiệu vận hành thật.