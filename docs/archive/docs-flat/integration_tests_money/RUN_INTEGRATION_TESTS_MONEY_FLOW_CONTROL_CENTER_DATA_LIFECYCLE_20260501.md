# RUN INTEGRATION TESTS - Money Flow Control Center and Data Lifecycle

## Working Directory

Toàn bộ command trong tài liệu này chạy từ thư mục gốc project bằng relative path.

## 1. Mục tiêu

Xác nhận end-to-end rằng:

1. Money Flow Control Center đủ để đội vận hành quản lý shared lifecycle, whale governance bridge, dark-flow policy, materialization, retention và jobs trên một narrative thống nhất,
2. facts-first path cho `whale-alerts/:symbol` thực sự hoạt động trên primary path và vẫn giữ selected-session truth,
3. raw retention, forensic windows và materialization jobs tuân thủ owner matrix đã khóa,
4. evidence đủ mạnh để internal QA kết luận PASS/NO-GO trước khi chuyển sang final overall audit.

## 2. Safety constraints

1. Chỉ chạy trên dev hoặc staging.
2. Không mark complete nếu chưa rebuild stack tương ứng với slice runtime/UI.
3. Nếu write action không có preview-before-apply hoặc effective owner rõ ràng, dừng integration và trả NO-GO ngay.

## 3. Pre-flight

### 3.1 Governance check

Xác nhận:

1. explicit consent cho coding đã tồn tại,
2. triad docs + ownership matrix + quality constitution + traceability matrix tồn tại,
3. evidence template đã sẵn cho slice đang test.

### 3.2 Build and focused validation baseline

```powershell
Push-Location ./frontend
npm run build
Pop-Location

Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
Pop-Location
```

### 3.3 Runtime refresh

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend celery_worker celery_beat
```

## 4. Execution matrix

| Step | Scope | Expected result |
|---|---|---|
| 1 | Effective owner summary | owner, effective values, deprecation warnings hiển thị đúng |
| 2 | Shared lifecycle preview/apply | universe/service knobs preview đúng và apply an toàn |
| 3 | Whale governance bridge | whale-related writes không tạo writer blob song song |
| 4 | Materialization run | facts/session summaries được tạo và run registry cập nhật đúng |
| 5 | Whale route parity | route dùng facts-first primary path, selected-session truth không drift |
| 6 | Retention + forensic preview | purge bị chặn đúng khi safety fail; forensic windows có scope hẹp |
| 7 | Operator UX | control center đủ zones, pagination/i18n/guard hoạt động |
| 8 | Evidence and self-audit | evidence template, ledger, progress và residual risks đã sync |

## 5. Integration test matrix

## T1. Effective owner summary

Pass criteria:

1. summary trả `effective_owner`, `effective_values`, `freshness`, `deprecation_warnings`,
2. raw retention và detection universe hiển thị đúng owner theo ownership matrix.

Evidence:

1. payload snapshot summary,
2. screenshot overview/control-center badges.

## T2. Shared lifecycle preview/apply

Pass criteria:

1. preview universe/services trả source counts, effective counts và diffs,
2. apply flow yêu cầu confirmation rõ ràng,
3. field read-only/link-out không render writer action thứ hai,
4. deprecated writer surfaces bị hard-block ở backend, không chỉ ẩn trên UI.

Evidence:

1. preview payload,
2. video hoặc chuỗi screenshot flow apply.

## T3. Whale governance bridge

Pass criteria:

1. whale governance updates đi qua bridge hoặc flow mission-control hiện có,
2. không có blob writer song song cho whale threshold/policy,
3. bridge trả pending/draft state và không auto-publish active version nếu chưa có approval/rollout proof.

Evidence:

1. payload snapshot bridge/write-through,
2. audit note hoặc rollout proof.

## T4. Materialization run

Pass criteria:

1. run manual hoặc scheduled tạo/refresh bucket facts và session summaries hợp lệ,
2. run registry, freshness và completeness cập nhật đúng,
3. degraded fallback không bị báo healthy giả.

Evidence:

1. fact/summary payload snapshot,
2. run registry entry,
3. screenshot summary panel.

## T5. Whale route facts-first parity

Pass criteria:

1. `whale-alerts/:symbol` load theo facts-first primary path,
2. selected session của bubble/advisory/CVD/strength/markers giữ nguyên,
3. timing trước/sau cutover cải thiện theo benchmark đã định.

Evidence:

1. payload/source marker snapshot,
2. timing benchmark,
3. screenshot route runtime.

## T6. Retention and forensic safety

Pass criteria:

1. raw/facts purge bị chặn nếu completeness hoặc dependency checks fail,
2. forensic preview hiển thị rõ reason, scope, expiry,
3. raw retention owner không bị split ở UI/API,
4. forensic window là physical carve-out sang L5 riêng, không phải tag-only trên raw,
5. bounded override/TTL fallback phải xuất hiện khi completeness không thể phục hồi.

Evidence:

1. preview payload,
2. blocked purge proof,
3. forensic sample proof.

## T7. Operator UX

Pass criteria:

1. load được các zones chính,
2. không có white screen,
3. list lớn dùng phân trang chuẩn,
4. text mới qua i18n tiếng Việt đầy đủ dấu,
5. operator không phải nhảy sang surface cũ để hoàn tất workflow chính,
6. link-out upstream thiếu quyền phải render disabled state + badge, không phải link chết.

Evidence:

1. screenshot từng zone,
2. video chuyển tab/route,
3. pagination proof,
4. before/after navigation map.

## T8. Self-audit package completeness

Pass criteria:

1. evidence template được điền đầy đủ,
2. ledger + progress dashboard đã cập nhật,
3. residual risks đã map lại vào taskboard hoặc final audit backlog.

Evidence:

1. evidence file,
2. ledger/progress entries,
3. triage note.

## 6. Reporting format

| Test ID | Kết quả | Evidence | Notes |
|---|---|---|---|
| T1 | PASS / FAIL | ____ | ____ |
| T2 | PASS / FAIL | ____ | ____ |
| T3 | PASS / FAIL | ____ | ____ |
| T4 | PASS / FAIL | ____ | ____ |
| T5 | PASS / FAIL | ____ | ____ |
| T6 | PASS / FAIL | ____ | ____ |
| T7 | PASS / FAIL | ____ | ____ |
| T8 | PASS / FAIL | ____ | ____ |

## 7. GO / NO-GO rules

### GO khi đồng thời đúng

1. frontend build pass,
2. focused backend suites pass,
3. T1-T8 pass hoặc tối đa 1 mục `PASS WITH NOTES` không ảnh hưởng owner matrix, selected-session truth, retention safety hoặc facts-first source path,
4. preview-before-apply guard tồn tại ở mọi write action,
5. ledger + progress dashboard + evidence template đã cập nhật.

### NO-GO nếu xảy ra một trong các lỗi sau

1. cùng một knob có hơn một writer hợp lệ,
2. whale route vẫn dùng raw-full-scan như primary path sau cutover,
3. selected-session truth bị drift,
4. raw retention owner vẫn split hoặc compatibility field vẫn có write semantics thật,
5. purge không có preview safety gate,
6. control center vẫn buộc operator chuyển qua nhiều surface cũ để hoàn tất một workflow chính.