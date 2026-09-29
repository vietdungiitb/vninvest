# Audit Công Việc Đang Dang Dở + Kế Hoạch Tiếp Tục Phase 3 SOC (2026-09-15)

**Tuân theo**: khung AI Audit/Research của AGENTS.md (gate: tsc, build, jest, vitest, BE service_ops, migration — tất cả đã chạy thật).
**Phương pháp**: reproduce-first. Mọi khẳng định kèm `file:line`. Không đoán.

---

## 1. Tóm tắt phát hiện (Top findings)

1. **Chỉ có 1 luồng công việc đang dang dở thực sự trên working tree `dev`**: **Phase 3 SOC Commercial** theo
   `docs/IMPLEMENTATION_PLAN_PHASE3_SOC_COMMERCIAL_20260916.md`. Đã code ~861 dòng chưa commit (16 file modified + 4 file untracked), **chưa có ledger entry** (ledger mới nhất là Entry 87).
2. **Step 4c còn thiếu duy nhất** trong Phase 3: burn-rate sparkline 24h cho `SocRuntimeKpiPanel` — panel hiện là stub "Coming soon" (`SocRuntimeKpiPanel.tsx:39`). Các step 1/2/3/5/6 và 4a/4b/4d đã code đủ.
3. **17 lỗi BE `service_ops` (15F + 2E) đều pre-existing** — reproduce tại worktree sạch HEAD `0c1d0044` cho cùng y hệt danh sách; không do Phase 3.
4. **COMPAT-001** (whale legacy→native, hạn 2026-10-15) tồn đọng, chỉ còn bước cutover URL + FE adapter switch — đây là item có deadline gần nhất, chưa bắt đầu.

---

## 2. Trạng thái các việc dang dở / tồn đọng

| # | Việc | Trạng thái | Nơi theo dõi |
|---|------|-----------|--------------|
| 1 | Phase 3 SOC Commercial (SLO/SLI + Alerting + Export + CSS split) | **Đang dở, chưa commit** — thiếu Step 4c | `IMPLEMENTATION_PLAN_PHASE3_SOC_COMMERCIAL_20260916.md` |
| 2 | COMPAT-001 whale legacy→native | Chưa bắt đầu | `compat/__init__.py:12-15`; hạn **2026-10-15** |
| 3 | COMPAT-002 sunset compat app | Chặn bởi COMPAT-001 | `compat/__init__.py:16-17`; hạn **2026-11-30** |
| 4 | Screener P3 backlog (realtime intraday / đa khung / preset khối ngoại) | Hoãn có lý do | `docs/SCREENER_METHODOLOGY_20260914.md` §5 |
| 5 | 17 test BE pre-existing fail | Pre-existing, chưa dọn | xem §4 Findings F-3 |
| 6 | `AIAdvisorAlertPanel.i18n.test.js` FAIL (dashboard refactor) | Pre-existing | Ledger Entry 87 residual |
| 7 | `i18n:scan` BROKEN (i18next-scanner không parse `.js`) | Pre-existing | Ledger Entry 87 residual |
| 8 | F-BE-05 progress per-200 | Hoãn (cần hook compute loop) | Ledger Entry 82 residual |
| 9 | Lighthouse manual | Chưa cài | Ledger Entry 82 residual |

---

## 3. Phase 3 — Đối chiếu trạng thái từng step (plan ↔ code)

| Step | Plan (`IMPLEMENTATION_PLAN_PHASE3_...md`) | Thực tế (code) | Verdict |
|---|---|---|---|
| 1 CSS Split | §Step 1 — `soc.module.css` → `soc.tokens.css` + `soc.components.css` + module re-export | `soc.tokens.css` (43 dòng, `:root` tokens) + `soc.components.css` (2715 dòng) + `soc.module.css` còn **3 dòng** re-export `@import` | ✅ DONE |
| 2 SLO Model | `slo_target/error_budget_remaining/uptime_30d/burn_rate_1h` + `ServiceHealthCheckLog` | `models.py:126-129` (SLO fields) + `models.py:147-172` (`ServiceHealthCheckLog`) + migration `0012_add_slo_fields_and_health_check_log.py` | ✅ DONE |
| 3 SLO Computation | `_compute_uptime_slo(...)` + hook probe + `SocSloOverviewView` + URL | `tasks.py:362` `_compute_service_slo()` + hook success (`tasks.py:493,496-508`) + hook exception (`tasks.py:530-546`) + `overview.py:1011` `SloOverviewView` + URL `overview/slo-overview/` | ⚠️ DONE (lệch API, xem §5) |
| 4a adapter | `getSocSloOverview()` | `soc.js:46-48` | ✅ DONE |
| 4b Overview badges | SLO badge + color per service | `SocOverviewPanel.tsx:516-552` (`sloMap`, uptime/burn-rate/budget badges, màu theo burn rate) | ✅ DONE |
| 4c **RuntimeKpi sparkline** | mini bar chart 24h từ `ServiceHealthCheckLog` | **KHÔNG CÓ** — `SocRuntimeKpiPanel.tsx` vẫn là stub (6-44, `coming_soon` line 39) | ❌ **CHƯA LÀM** |
| 4d i18n | `soc.slo.*` | `vi.js:233-240`, `en.js:233-240` | ✅ DONE |
| 5 Alerting | `_upsert_service_health_alert` generic + dedup/cooldown + `SOC_ALERT_COOLDOWN_HOURS` | `tasks.py:422-474` + cooldown settings (`settings.py:197`) + hook probe, `detail['last_alert']` | ✅ DONE |
| 6 Export CSV | BE views + adapter + FE buttons | `overview.py:1062` `SocExportConfigAuditsView` + `overview.py:1135` `SocExportRunLogsView` + `soc.js:50-64` + nút trong `SocDataOpsMonitorSection.tsx:167-169,174-236` (CSV blob client-side) + i18n `soc.export.*` | ✅ DONE |

### Kiểm chứng build cho Step 1 (CSS split không vỡ)
- `npm run build` PASS (39.42s). Trong `dist/assets/soc-N1-TG4DG.css`: class băm đúng `._tabBar_x27r0_1`, token `--soc-c-34d399: #34d399` resolve → `@import` trong `.module.css` được Vite module-scope hoá đúng.

---

## 4. CONTRADICTIONS & Findings

### CONTRADICTIONS (plan ↔ code)
| # | Plan nói | Code làm | Tác động |
|---|---------|---------|----------|
| C1 | §3a `_compute_uptime_slo(service_key, window_days=30)` tính live trên request | `_compute_service_slo(service, current_status)` chạy lúc probe; `SloOverviewView` đọc field cache (`overview.py:1017-1028`) | SLO chỉ cập nhật khi probe chạy. Chấp nhận được (probe định kỳ). |
| C2 | §3c `SocSloOverviewView` "returns per-service SLO summary computed on read" | View trả cache; không tính lại burn-rate live | Như C1. |
| C3 | §Step 4c bắt buộc RuntimeKpi sparkline | Chưa thực hiện | Không hoà thành Phase 3. |

### Findings
- **F-1 [GAP] | P1** | `SocRuntimeKpiPanel.tsx:39` | Panel "Runtime KPI" chỉ render `coming_soon` | Phase 3 step 4c chưa đóng, mục tiêu 92%→98% chưa đạt | Triển khai sparkline 24h (Step 4c) — mục A1 kế hoạch này.
- **F-2 [RISK] | P2** | `tasks.py:470-474` cold-start note | `_compute_service_slo` trả `None` khi không có log — đúng plan, nhưng `SloOverviewView` FE không render khi `uptime_30d == null` | Trạng thái "chưa có data" hợp lý | Thêm empty state rõ ràng trên FE sparkline.
- **F-3 [RISK] | P2 (pre-existing)** | `test_soc_api_domain.py:694` | assert schema `security == [{'CorePATBearer': []}]` nhưng schema thực tế giờ có `cookieAuth` | 7 openapi-route tests fail | Sửa assertion cho đồng bộ security schemes; tách backlog.
- **F-4 [RISK] | P3 (pre-existing)** | `test_soc_tasks.py:1029` + `test_scheduler_s04.py` | Scheduler recovery tests phụ thuộc timing/mock (log đã in `recovered...action=queue_tier_stale_inflight_recovered` nhưng `dispatched_runs` = 0) + vnbroker bridge `all_symbols` mock | Dễ flake, gây nhiễu gate | Tách backlog, không thuộc Phase 3.

---

## 5. Quality Gates (đã chạy thật 2026-09-15)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Type-check | `npx tsc --noEmit` (packages/web) | ✅ 0 lỗi |
| Build | `npm run build` | ✅ 39.42s PASS (widget chunk-size warning pre-existing) |
| Adapter test | `npx jest src/adapters/core/__tests__/soc.test.js` | ✅ 83/83 (3 test mới SLO/export) |
| Component test | `npx vitest run src/components/__tests__/soc-p2.component.test.tsx` | ✅ 6/6 (thêm test SLO badges) |
| Migration | `python manage.py makemigrations --check --dry-run` | ✅ No changes detected |
| BE `service_ops` | `python manage.py test service_ops --keepdb` | ⚠️ 287 tests: 15F + 2E + 1 skip — **reproduce: cùng danh sách tại HEAD sạch** → pre-existing |
| Test mới Phase 3 (BE) | 11 test (SLO compute 4, alert 3, export 4) | ✅ đều PASS (không có trong list fail) |

---

## 6. Kế hoạch triển khai tiếp theo (execution order)

### Bước A — Đóng dứt điểm Phase 3 (ưu tiên cao, ~1 ngày)
- **A1. Step 4c burn-rate sparkline 24h**:
  - BE: `overview.py` `SloOverviewView` — thêm `recent_checks_24h` (aggregation theo giờ, `TruncHour` + `Count`, exclude `maintenance/unknown`; `failed` = `unhealthy|degraded`) vào mỗi `SloRow`.
  - FE: `SocRuntimeKpiPanel.tsx` — bỏ stub, fetch `getSocSloOverview()`, render mini bar chart failure-ratio 24h/service cồng burn-rate + uptime; có loading/error/empty state.
  - i18n: `soc.slo.spark_*` + `soc.runtime_kpi.burn_spark_*`.
  - Test: BE 1 test aggregation; FE component test RuntimeKpi (data + cold-start).
- **A2. Full gates Phase 3** (§Verification của plan): `npm test` full, `npm run test:components`, `npm run lint`, `npm run build`, `python manage.py test service_ops`.
- **A3. Commit + ledger Entry 88** (kèm các note deviation C1-C3 + bằng chứng F-3/F-4).

### Bước B — Item có deadline (trước 2026-10-15, ưu tiên cao kế tiếp)
- **B1. COMPAT-001**: cutover `market_serving/urls.py:30` sang native view name + FE adapter switch (whale legacy→native).
- **B2. COMPAT-002** sau khi B1 xong (sunset).

### Bước C — Ưu tiên hạng 2 (chọn 1)
- **C1. Dọn 17 test BE pre-existing** (F-3 openapi security scheme, F-4 scheduler timing/vnbroker bridge) → suite BE xanh.
- **C2. Screener P3**: preset khối ngoại (giá trị thương mại) / realtime intraday / đa khung.

### Bước D — Cải tiến nhỏ (khi có thời gian)
- Thêm `recent_checks` cho cả `ServiceHealthView` (detail) để Overview tab sâu hơn.
- Ghi note burn-rate normalization (`tasks.py:388-396`) vào methodology nếu cần.

---

## 7. Đánh giá tổng thể
- **Implementable**: Có. Phase 3 đang ở trạng thái "còn 1 mảnh" (Step 4c) → đóng nốt là hoàn thành trọn plan.
- **Không có blocker** về code: tsc/build/test Phase 3 đều xanh; 17 lỗi BE pre-existing không liên quan.
- **Ưu tiên sửa**: A1 (Step 4c) → A3 (commit+ledger) → B1 (COMPAT-001 trước hạn 2026-10-15).

---

## 8. Log thực thi 2026-09-15 (đã làm)

### A1 — Step 4c burn-rate sparkline 24h: DONE
- BE `overview.py`: import `timedelta/Count/Q/TruncHour/ServiceHealthCheckLog`; `SloRowSerializer` + `recent_checks_24h`; `SloOverviewView.get` aggregation theo giờ (exclude `maintenance/unknown`, `failed = unhealthy|degraded`).
- FE `SocRuntimeKpiPanel.tsx`: viết lại từ stub "coming soon" → fetch `getSocSloOverview()`, sort theo `burn_rate_1h` (bỏ trống về cuối), render per-service bar chart 24h (ratio = failed/checks), màu green/yellow/red, loading/error+Retry/empty cold-start, `data-testid=spark-bar-*`.
- CSS `soc.components.css:2717+`: `.sparkRow/.sparkMeta/.sparkName/.kpiBadge/.sparkBarTrack/.sparkBar/.sparkFailed/.sparkEmpty|Loading|Error`.
- i18n `soc.slo.spark_*` (vi/en 7 keys).
- Tests: BE `OverviewSloTestCase` 3 test; FE `soc-p2.component.test.tsx` +2 (dữ liệu + cold-start) → **8/8**.

### A2 — Full gates Phase 3: ALL GREEN (ngoài pre-existing)
| Gate | Kết quả thật |
|---|---|
| tsc | 0 |
| build | 28.21s PASS |
| lint | 0 errors (3547 warnings pre-existing) |
| jest `npm test` | 222 passed; 1 suite FAIL pre-existing `AIAdvisorAlertPanel.i18n.test.js` |
| vitest | 30 files / 130 passed |
| BE `service_ops` | 290 tests; 15F+2E giống hệt HEAD sạch (không lỗi mới); test Phase 3 14 BE pass |
| migration | `makemigrations --check` No changes detected |

### A3 — Commit + ledger Entry 88: DONE
- Ledger `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 88; AGENTS.md Done section cập nhật.

### Next
- **B1 COMPAT-001** (hạn 2026-10-15): cutover `market_serving/urls.py:30` → native view + FE adapter switch.
- B2 COMPAT-002 (2026-11-30). Backlog 17 test BE pre-existing; Screener P3.