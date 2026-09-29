# Audit: PAT & API Usage Analytics Solution

> Ngày: 2026-07-10 (cập nhật lần cuối)
> Nguồn: `docs/PAT_USAGE_ANALYTICS_SOLUTION_20260710.md`
> Mục đích: Phản biện thiết kế, chỉ ra lỗ hổng và rủi ro trước khi triển khai.

---

## 1. Hiện trạng — thiếu context quan trọng

| Thiếu | Vấn đề |
|---|---|
| `AuditEvent` — 219k records, không có phân tích index/partition | Phase 2 query group_by trên table 219k rows không index → full scan chậm. Cần audit index hiện tại. |
| Middleware chain order không rõ | `TenantResolutionMiddleware` có chạy *trước* `TenantQuotaMiddleware` không? Nếu chưa → Phase 1 ghi `PATAuditLog` sẽ thiếu `request.tenant`. |
| `RequestTrace` model tồn tại (ops_audit/models.py:44) | Model có sẵn nhưng không ai ghi. Có thể tận dụng thay vì tạo `PATAuditLog` riêng? Cần quyết định explicit. |

### Audit recommendation
- [ ] Audit index trên `AuditEvent` trước Phase 2
- [ ] Verify middleware ordering trong settings
- [ ] Quyết định: reuse `RequestTrace` hay tạo mới

---

## 2. Bug analysis — thiếu 1 bug critical

| Bug trong doc | Mức độ | Đồng ý? |
|---|---|---|
| `snapshot_quota_history` không schedule | 🔴 Critical | ✅ |
| Meter code mismatch | 🔴 Critical | ✅ |
| Alert không enforce | 🟠 Major | ✅ |
| `api_calls_used` không update | 🟠 Major | ✅ |
| `api_calls_limit/api_calls_used` bị exclude khỏi serializer | 🟡 Minor | ✅ |

### Bug thiếu — đưa lên Critical

| Bug | Mô tả | Mức độ | Fix |
|---|---|---|---|
| `TenantQuotaMiddleware` không ghi `last_used_at` | `CorePATCredential.last_used_at` không bao giờ update | 🔴 Critical | Thêm 1 dòng: `request.auth.last_used_at = timezone.now(); save(update_fields=['last_used_at'])` |

### Quyết định
- Đây là critical, không phải feature. Fix ngay trong Phase 0, session đầu tiên.
- Với ~200-600 PAT requests/ngày, `save()` trên mỗi request là chấp nhận được.

---

## 3. PATAuditLog — model riêng, không gộp vào AuditEvent

### Kết luận sau phản biện: **Giữ nguyên PATAuditLog riêng như doc gốc**

Lý do:
1. **Middleware ordering conflict:** `RequestTraceMiddleware` (index #1) ghi `AuditEvent` — tại thời điểm đó chưa có `request.auth`. `TenantQuotaMiddleware` (index #9) mới có PAT info. Không thể ghi `pat_id` vào `AuditEvent` cùng lúc.
2. **Không muốn move middleware chain** vì ảnh hưởng đến các middleware khác.
3. **Optimize storage:** `PATAuditLog` chỉ ghi cho PAT requests (~20-30% tổng request). `AuditEvent` ghi mọi request (kể cả health check, /metrics/, anonymous). Thêm `pat_id` + `user_agent` vào `AuditEvent` = ~100 bytes × 10M rows/tháng overhead vô ích cho request không PAT.

### Giải pháp: Dual-write với cross-reference

| Table | Ghi bởi | Index | Khi nào | Mục đích |
|---|---|---|---|---|
| `AuditEvent` | `RequestTraceMiddleware` (#1) | #1 | Mọi request | General audit, health check, /metrics/ |
| `AuditEvent.pat_id` | `TenantQuotaMiddleware` (#9) UPDATE | nullable | Chỉ PAT request | Cross-reference cho cross-table analytics |
| `PATAuditLog` | `TenantQuotaMiddleware` (#9) INSERT | * | Chỉ PAT request | PAT-specific analytics, retention riêng |

- `PATAuditLog` là single source of truth cho PAT analytics
- `AuditEvent.pat_id` (nullable) chỉ để support cross-table JOIN khi cần — populate bằng UPDATE từ `TenantQuotaMiddleware`

### Thiết kế PATAuditLog (giữ nguyên doc gốc)

```python
class PATAuditLog(models.Model):
    pat = ForeignKey(CorePATCredential, related_name='audit_logs')
    tenant = ForeignKey(CoreTenant)
    ip_address = GenericIPAddressField()
    endpoint = CharField(256)
    method = CharField(8)
    status_code = SmallIntegerField()
    user_agent = TextField(blank=True)
    duration_ms = IntegerField()
    auth_source = CharField(16)  # 'pat' | 'session' | 'jwt'
    occurred_at = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'identity_access_pat_audit_log'
        indexes = [
            models.Index(fields=['pat', 'occurred_at']),
            models.Index(fields=['tenant', 'occurred_at']),
            models.Index(fields=['ip_address']),
        ]
```

### Effort đánh giá
- **Extend `AuditEvent` approach** — sai do middleware ordering. Bỏ qua.
- **PATAuditLog riêng** — đúng. Giữ nguyên.

---

## 4. Phase 2 — Rollup table bắt buộc

### Vấn đề

Doc gốc không mention query strategy cho Phase 2. Query `AuditEvent` với `GROUP BY ip/endpoint` trên 200k+ records sẽ chậm dù có index.

### Giải pháp: `ApiCallRollup` table

```python
class ApiCallRollup(models.Model):
    tenant = ForeignKey(CoreTenant)
    date = DateField()
    hour = SmallIntegerField(null=True)           # 0-23; null = daily total
    ip_address = GenericIPAddressField(null=True) # null = all IPs
    endpoint_group = CharField(64, null=True)     # null = all endpoints
    status_group = CharField(8, null=True)        # '2xx'/'4xx'/'5xx'/null
    call_count = IntegerField()
    error_count = IntegerField()
    total_duration_ms = BigIntegerField()

    class Meta:
        db_table = 'ops_audit_api_call_rollup'
        indexes = [
            models.Index(fields=['tenant', 'date', 'hour']),
            models.Index(fields=['tenant', 'endpoint_group', 'date']),
            models.Index(fields=['tenant', 'ip_address', 'date']),
        ]
```

Celery task chạy mỗi 5 phút:
1. Aggregate từ `AuditEvent` + `PATAuditLog` vào `ApiCallRollup`
2. Raw data >90 ngày → archive/delete

Phase 2 query trên rollup table, không query trực tiếp transaction table.

### Quyết định
- **Đồng ý.** Thêm rollup table vào Phase 1 (cùng lúc với PATAuditLog).
- Phase 2 views query rollup, không cần đụng raw table.

---

## 5. Phase 3 — Alert còn thiếu logic

| Thiếu | Issue | Fix |
|---|---|---|
| `UsageAlertConfig` granularity? | Không rõ per-tenant/per-meter | Giữ nguyên thiết kế, thêm doc |
| Khi critical → 429, ai mở lại? | Không có auto-unblock | Auto-unblock khi quota counter reset (daily/monthly) |
| Alert 5 phút → spam | Không có cooldown | Thêm `cooldown_minutes` field (default 60) |
| Email template có sẵn? Webhook format? | Chưa define | Define webhook payload schema trong phase design |

### Quyết định
- **Đồng ý** các fix trên. Thêm vào Phase 3 scope.

---

## 6. Phase 4 — Rate limiting rủi ro kỹ thuật

| Issue | Detail | Fix |
|---|---|---|
| `request.auth` có là `CorePATCredential` instance? | Nếu là `string`/`dict`, `PATRateThrottle` không chạy | Verify `request.auth` type trước khi implement |
| "Unlimited" cho Enterprise | Rủi ro abuse | Soft limit 100k/hour + webhook alert admin |
| `X-RateLimit-Resource: pat:vni_free_abc123` | Format ambiguous | Chuẩn hóa: `{resource_type}:{tenant_id}:{pat_public_id}` |
| False positive → chặn oan | Grace period 10s | Thêm logic: request đầu tiên sau limit không block ngay |

---

## 7. Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Ghi DB trong middleware chậm response | Medium | High | Batch write queue + timeout fallback |
| Rollup task không kịp 5 phút | Low | Medium | Monitoring + alert nếu lag >15 phút |
| AuditEvent table quá lớn | High | Medium | Retention 90 ngày + archive |
| Rate limit false positive | Medium | High | Grace period 10s + clear error message + admin override |
| Migration lỗi (Phase 1 new table) | Low | High | Chạy migration trong maintenance window |
| PATAuditLog retention cleanup quên schedule | High | Medium | Gắn cleanup task cùng `flush_quota_counters` — không để task riêng |

---

## 8. Testing + Rollback plan

| Phase | Unit/Integration Tests | Rollback |
|---|---|---|
| 0 (fix lõi) | `test_quota_counters.py`, `test_meter_codes.py`, `test_last_used_at.py` | `git revert` + restart core-api |
| 1 (PAT log + rollup) | `test_pat_audit_log_write.py`, `test_pat_usage_api.py`, `test_rollup_aggregation.py` | Drop table + remove middleware write |
| 2 (analytics) | `test_api_analytics_group_by.py`, `test_api_timeline.py`, `test_api_export.py` | Remove views + URLs |
| 3 (alert) | `test_quota_alert_thresholds.py`, `test_alert_email_sending.py`, `test_alert_cooldown.py` | Disable beat task |
| 4 (rate limit) | `test_pat_rate_limit.py`, `test_rate_limit_headers.py`, `test_enterprise_soft_limit.py` | Remove throttle class từ settings |

Phase 0 cần test data correctness: so sánh Redis counter vs `QuotaRecord` sau khi flush để detect mismatch sớm.

---

## 9. Effort tổng

| Phase | Effort | Ghi chú |
|---|---|---|
| 0. Fix lõi (critical) | 1 ngày | last_used_at + meter codes + beat schedule + serializer |
| 1. PAT log + rollup | 3 ngày | PATAuditLog model + middleware write + AuditEvent.pat_id + rollup table + migration |
| 2. API analytics | 3 ngày | Views, group_by, timeline, export CSV (query rollup) |
| 3. Alert enforcement | 2 ngày | check_usage_thresholds + email + webhook + cooldown |
| 4. Rate limiting | 2 ngày | PATRateThrottle + headers + soft limit |
| Testing + rollback | 2 ngày | Cross-phase |
| Buffer | 1 ngày | Unexpected issues |
| **Tổng** | **14 ngày** | ±2 ngày |

### So sánh với doc gốc

| Phase | Doc gốc | Adjusted | Lý do |
|---|---|---|---|
| 0 | 1-2 ngày | 1 ngày | Thêm last_used_at + rollup setup |
| 1 | 2-3 ngày | 3 ngày | Thêm rollup table + AuditEvent.pat_id migration |
| 2 | 3-4 ngày | 3 ngày | Rollup table giúp view đơn giản hơn |
| 3 | 2 ngày | 2 ngày | Thêm cooldown logic |
| 4 | 2-3 ngày | 2 ngày | Không đổi nhiều |
| (mới) | - | 2+1 ngày | Testing/rollback + buffer |
| **Tổng** | **10-14 ngày** | **14 ngày** | |

---

## 10. Tổng kết

### Rating

| Tiêu chí | Đánh giá |
|---|---|
| Hiện trạng analysis | 🟡 Tốt nhưng thiếu index/middleware ordering context |
| Bug identification | 🟢 Chính xác, đã bổ sung 1 critical bug (last_used_at) |
| Phase design | 🟢 PATAuditLog riêng (giữ nguyên doc). Thêm rollup table cho Phase 2. |
| Kiến trúc | 🟢 Middleware chain giữ nguyên. Dual-write với cross-reference. |
| Risk management | 🟡 Đã bổ sung risk register + rollback plan. |
| Effort estimate | 🟢 14 ngày ±2. Realistic. |

### Quyết định thiết kế

| Decision | Kết luận | Voting |
|---|---|---|
| PATAuditLog riêng hay gộp AuditEvent? | **Riêng.** Middleware ordering conflict, optimization cho PAT-only data. | Doc gốc ✅ |
| Phase 2 query raw table hay rollup? | **Rollup.** `ApiCallRollup` table pre-aggregated. | Audit đề xuất ✅ |
| `last_used_at` priority? | **Critical.** Fix ngay Phase 0, session đầu. | Audit bổ sung ✅ |
| "Unlimited" Enterprise rate limit? | **Soft limit 100k/hour + admin alert.** | Audit bổ sung ✅ |
| Alert cooldown? | **Thêm `cooldown_minutes` field (default 60).** | Audit bổ sung ✅ |
| Risk register thiếu? | **Đã bổ sung 6 risks + mitigation.** | Audit bổ sung ✅ |

### Top 3 ưu tiên hành động

1. **🔴 Phase 0 — Fix `last_used_at`** + meter codes + beat schedule (1 ngày)
2. **🔴 Phase 1 — PATAuditLog model** + rollup table + middleware write (3 ngày)
3. **🟠 Testing framework** — Viết test data correctness trước khi deploy Phase 0
