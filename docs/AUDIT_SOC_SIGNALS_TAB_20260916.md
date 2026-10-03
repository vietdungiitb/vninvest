# Audit Chi Tiết Tab `signals` — `http://localhost/operations-center?tab=signals`

> **Ngày**: 2026-09-16
> **Phạm vi**: Tab `signals` SOC — FE `SocSignalsPanel.tsx` (566 dòng) + BE `service_ops/views/signals.py` (976 dòng, 21 endpoints) + adapter `soc.js:305-362` + i18n `signals_overview` + CSS signals + tests
> **Khung**: AGENTS.md AI Audit/Research Framework (Nguyên tắc 1-6, B1-B6, đầu ra A-G). Mọi khẳng định kèm `file:line`.
> **Trạng thái docker dev**: đang chạy (`start_dev.ps1` smoke OK nhiều lần 2026-09-16).

---

## 0. NGUYÊN TẮC BẮT BUỘC — đã tuân

1. Mọi khẳng định kèm `file:line`. 2. Không đoán → "CHƯA XÁC MINH" nếu chưa đọc. 3. Bắt buộc `grep/glob/read`. 4. `CONTRADICTIONS` riêng. 5. Quét `.css/i18n/adapters/tests` + BE đối ứng. 6. Chỉ nghiên cứu (không sửa code). 7. Không bịa file. 8. Tiếng Việt.

## 1. ĐỌC TRƯỚC

- `AGENTS.md:1` + `docs/CODE_CHANGE_AUDIT_LEDGER.md:1` (Entry 88-97: Phase 3 SLO, COMPAT, overview PR-1/PR-2 + UI polish)
- `docs/AUDIT_SOC_OVERVIEW_TAB_20260916.md` + `docs/IMPLEMENTATION_PLAN_SOC_OVERVIEW_TAB_20260916.md` (pattern lỗi tương tự: contract mismatch, error toàn panel)
- `docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md` + `TECH_SPEC_...` + `TASKBOARD_...` (legacy 2026-04, đối chiếu §C6)
- Live: `service_ops/urls.py:69-89` (21 routes signals), `signal_intelligence/models.py:15-73,266-325`, `signal_intelligence/views.py:555-619`, `signal_intelligence/urls.py:6-17`

## 2. PHẠM VI NGHIÊN CỨU

### A. Signals FE — `packages/web/src/components/soc/SocSignalsPanel.tsx:1` (566 dòng)
3 subtab (`overview` sentiment / `job-console` / `materialization`, `:64`), 5 request song song mỗi 10s (`:149-155`), feed gộp 3 nguồn + sort client (`:157-176`), filter type+symbol (`:221-228`), expand metadata (`:283-316`), radar empty state (`:319-329`).

### B. Signals BE — `packages/core/backend/src/service_ops/views/signals.py:1` (976 dòng)
21 endpoints: config/preview/apply(403)/ownership/summary/whale(+recent+test)/dark-pool(+recent)/screener(+recent)/retention(+preview)/materialization(+preview)/universe(+update 403)/jobs(run+status)/performance-metrics. Bridge-write: chỉ preview, không apply (`:445-449`, `:870-874`).

### C. CROSS-PACKAGE / EXTERNAL COUPLING
- web↔core: adapter `soc.js:305-362` passthrough `coreGet/corePost`, **không normalize** recent envelope (khác overview/DataOps có normalize).
- Song song tồn tại **AlertCenter user API** (`signal_intelligence/urls.py:6-12`: feed/summary/symbol-stats/detail/**ack**/context/mute) + engine ack/mute (`delivery_service.py:48-185`, models `UserAlertDelivery:266`, `UserAlertPreference:301`) — SOC tab **không dùng gì**.
- Dist/src, widget: không liên quan.

### D. QUALITY GATES
- Type-check `npx tsc --noEmit` 2026-09-16 → **0** (vừa chạy lại khi audit).
- Build/lint: PASS / 0 errors (lần dựng gần nhất).
- BE: `service_ops` 290 tests OK trong 301 gộp (Entry 91), gồm 8 tests signals (`test_soc_api_signals.py`: 8 test fns, contract-focused).
- FE: **0 component test** cho `SocSignalsPanel` (glob `**/*soc*test*` chỉ ra soc-p2/soc-overview-tab/soc.test.js); adapter tests chỉ assert URL (`soc.test.js:314-330`).

## 3. PHƯƠNG PHÁP

B1 đọc ledger/plan/audit overview. B2 glob `**/*ignal*` (FE 2 files, BE 3 files) + grep callers adapter. B3 grep toàn repo `.css/i18n/tests/urls/models`. B4 read 3 file cốt lõi (566 + 976 dòng + adapter) + trace use-case "mở tab → xem feed → chạy job". B5 đối chiếu serialiers↔interfaces + `CONTRADICTIONS`. B6 gates + AlertCenter đối ứng.

## 4. ĐẦU RA

### TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

**F-SG-01 P0** Feed rỗng vĩnh viễn — FE đọc `results|data` (`SocSignalsPanel.tsx:143-147,157-170`) nhưng BE trả `{recent, total_today}` (`signals.py:569-578,648-657,715-718`), adapter passthrough không normalize (`soc.js:338-348`) → radar empty state là trạng thái **duy nhất**. **F-SG-02 P0** Kể cả fix envelope, item vẫn lệch: BE gửi `{symbol,value,side,timestamp,title}` (`signals.py:313-320`), thiếu `id/detected_at/action/volume/metadata` mà FE cần (`SocSignalsPanel.tsx:8-25`) → sort toàn 0 (`:172-176`), giờ trống (`:309`), volume trống (`:305-307`), expand rỗng (`:288,312-314`). **F-SG-03 P0** Card "Độ trễ TB" luôn "—": FE đọc `avg_latency_ms` (`:236`), BE gửi `avg_signal_latency_ms` (`signals.py:972`). **F-SG-04 P0** 4 key count `signals_today/whale_signals/dark_pool_signals/screener_alerts` (`:27-31,231-234`) không tồn tại trong response (`signals.py:263-270`) → fallback list client bị cắt 20 nguồn, "Tổng cảnh báo" tối đa 60, sai lệch. **F-SG-05 P0** Sentiment chết: FE vẽ bar từ `metrics.sentiment` (`:240-244,332-381`) nhưng BE không bao giờ gửi (`:263-270,968-976`) → sprawled "Chờ dữ liệu phiên" vĩnh viễn.

---

### A. Bản đồ kiến trúc — `tab=signals`

| File | Lines | Trách nhiệm | Note |
|------|-------|-------------|------|
| `SocSignalsPanel.tsx:1` | 566 | Panel duy nhất tab signals: 3 subtab, feed, job console, materialization | `createElement`, poll 10s × 5 req (`:149-155,213`), backoff 60s (`:190-192`) |
| `service_ops/views/signals.py:1` | 976 | 21 endpoints signals (read + bridge-write block) | Serializers `:36-270`, views `:387-976` |
| `adapters/core/soc.js:305-362` | ~58 | 14 signal fns (config→jobs) | Passthrough thuần, **không normalize** recent/config |
| `service_ops/urls.py:69-89` | 21 routes | Mount signals views | Đầy đủ, khớp adapter paths |
| `signal_intelligence/models.py:15-73` | — | `UnifiedAlert` (+severity index `:69`) | BE serialize bỏ `id/severity/metadata/session_date` |
| `signal_intelligence/models.py:266-325` | — | `UserAlertDelivery` (5-state) + `UserAlertPreference` (mute/cooldown) | Engine có, SOC không dùng |
| `signal_intelligence/views.py:579-619` + `urls.py:6-17` | — | AlertCenter: feed/summary/stats/detail/**ack**/context/**mute** | User API song song, SOC không gọi |
| `delivery_service.py:48-185` | — | Ack state machine + preference upsert + delivery policy | Có test riêng, SOC không bắc cầu |
| `test_soc_api_signals.py` | 8 tests | Contract tests (config/ownership/summary/routes/auth) | Không assert shape FE cần |
| `vi.js:293-329` / `en.js:293-...` | 37 keys | `signals_overview` i18n | 5 keys chết (§F-SG-18) |
| `soc.components.css:897-1180,1293-1360` | — | signalRow/feed/sentiment/job/mat/subTab | `.signalFeed` không max-height scroll |

### B. Luồng dữ liệu đã trace — Use-case "Mở `?tab=signals`, xem feed, chạy job"

1. **Mount** `SocSignalsPanel.tsx:210-219` → `fetchData(false)` + poll 10s (`:213`). `Promise.all` 5 req (`:149-155`): performance-metrics + whale/dark-pool/screener recent + materialization ≈ **30 req/phút** chỉ riêng tab này.
2. **BE recent** (`signals.py:562-578` mẫu): lọc `UnifiedAlert` theo session mới nhất + alert_type, `[:20]`, trả `{recent: [{symbol,value,side,timestamp,title,...}], total_today}`.
3. **FE map** (`:143-147` type `{results?, data?}`, `:157` `whaleRes?.results || whaleRes?.data || []`) → **`[]` luôn** vì key thực là `recent`. `setSignals([])` → feed rỗng → `renderRadarEmptyState` (`:542-543`) + stats fallback `signals.length = 0`.
4. **Stats**: `signals_today/*_signals/screener_alerts/avg_latency_ms/sentiment` đều `undefined` → total 0, latency "—", sentiment "Chờ dữ liệu phiên". Chỉ `detection_rate` khớp key (`:235` ↔ `:967`).
5. **Job console**: nhập mã → `runSocSignalJob(domain, sym)` (`:259`) → hiện message 1 lần; **không poll** `getSocSignalJobStatus` (grep 0 caller); BE status view cũng bỏ qua `run_log_id` (`:933-945`).
6. **Materialization**: render services + 2 counts (`:449-477`); `execution_plan`, `last_started_at`, `latest_detection_job_run_log_id` (`:49-62`) **không render**.

**Bằng chứng live gián tiếp**: user chưa gửi screenshot signals, nhưng cả 2 phía đã đọc nguyên văn — mismatch ở mức key string, không cần runtime để kết luận (tương đương F-OV-03/04 đã verify bằng code).

### C. CONTRADICTIONS — doc/test vs code

| # | Doc / Test | Code thực tế | Tác động |
|---|-----------|---------------|----------|
| C1 | `soc.test.js:314-330` assert URL + normalize config → suite xanh | Recent fns không normalize; shape `{recent}` vs `{results\|data}` → feed rỗng mà test vẫn pass | Gates xanh giả (bản sao F-OV pattern) |
| C2 | `SignalsPerformanceMetricsResponseSerializer:263-270` (7 fields, không counts/sentiment) | FE `PerformanceMetrics:27-39` cần 4 counts + sentiment + `avg_latency_ms` | 6/8 ô stats/sentiment chết |
| C3 | Recent serializers `:134-155` `{recent, total_today}` + item `{symbol,value,side,timestamp,title}` | FE `RecentSignal:8-25` cần `id/detected_at/action/volume/metadata` | Kể cả fix C1, feed vẫn mù thời gian/volume/action |
| C4 | Adapter `getSocSignalJobStatus(runLogId)` gửi `?run_log_id=` (`soc.js:354-357`) + serializer `:236-238` có field | `SignalsJobStatusView:933-945` bỏ qua param, luôn trả job mới nhất | Poll theo run_log_id (khi FE làm) sẽ sai job |
| C5 | i18n `expand_meta/performance/title/domain/symbol_required` tồn tại (`vi.js:293-329`) | 0 reference trong panel (grep chỉ trúng dnse `symbol_required`) | Scope dang dở hoặc đã xóa UI mà quên keys |
| C6 | `IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md` + evidence pagination (2026-04) | Tab hiện tại: feed cắt 50 client, không pagination, không control-center triage | Doc legacy stale — cấm tái dùng khi chưa re-verify |

### D. Findings — `tab=signals` (ID | Mức | file:line | Thực tế | Tác động | Đề xuất)

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất |
|----|-----|-----------|---------|----------|---------|
| **F-SG-01** | <ERROR> **P0** | `SocSignalsPanel.tsx:143-147,157-170` ↔ `signals.py:569-578` | Đọc `results\|data`, BE trả `recent` → feed rỗng vĩnh viễn | Tab "trực tiếp" không bao giờ có dữ liệu | FE đọc `recent` (BE canonical) + test mapper |
| **F-SG-02** | <ERROR> **P0** | `SocSignalsPanel.tsx:8-25` ↔ `signals.py:313-320` | Thiếu `id/detected_at/action/volume/metadata/severity` | Sort/giờ/volume/expand mù | BE bổ sung fields (additive) + FE mapper `timestamp→detected_at, side→action, value→volume, metadata` |
| **F-SG-03** | <ERROR> **P0** | `SocSignalsPanel.tsx:236` ↔ `signals.py:972` | `avg_latency_ms` vs `avg_signal_latency_ms` | Card latency luôn "—" | FE đổi key (1 dòng) + test |
| **F-SG-04** | <ERROR> **P0** | `SocSignalsPanel.tsx:27-31,231-234` ↔ `signals.py:263-270` | 4 count keys không tồn tại | Tổng cảnh báo ≤60, sai | FE dùng `summary/` counts + performance rates (quyết §G P0) |
| **F-SG-05** | <ERROR> **P0** | `SocSignalsPanel.tsx:240-244,332-381` ↔ `signals.py:968-976` | `sentiment` không được gửi | Bar sentiment chết | BE cộng aggregation direction (additive) |
| **F-SG-06** | <ERROR> **P0** | `SocSignalsPanel.tsx:149-155,499-500` | `Promise.all` + error thay toàn panel | 1/5 API lỗi → mất cả tab | Tách error theo section (pattern overview W6) |
| **F-SG-07** | <ERROR> **P1** | `SocSignalsPanel.tsx:284-287` | `expandedId = type-symbol` trùng khi 1 mã nhiều tín hiệu | Bật/tắt hàng loạt cùng mã | Key `type-id-detected_at-idx` |
| **F-SG-08** | <GAP> **P1** | `SocSignalsPanel.tsx:259-260` + grep 0 caller `getSocSignalJobStatus` | Job fire-and-forget, không poll status | Không biết job xong/chết | Poll status đến terminal + BE tôn trọng `run_log_id` (C4) |
| **F-SG-09** | <GAP> **P1** | `soc.js:305-329,354-357` + grep 0 UI caller | 8 fns + `whale/test/` chết (không adapter fn) | Config/ownership/retention/detection settings/test vô hình | Section read-only + nút test (P1) |
| **F-SG-10** | <GAP> **P1** | `SocSignalsPanel.tsx:449-477` ↔ `:49-62` | `execution_plan/last_started_at/latest_run_log_id` không render | Mất nửa giá trị endpoint | Render plan + started + link run log |
| **F-SG-11** | <RISK> **P1** | `SocSignalsPanel.tsx:149-155,213` + `settings.py:259` | 30 req/phút/tab trên bucket 120/phút, không jitter/visibility | Mở 4 tab SOC ≈ chạm throttle | Gộp/giãn poll + visibility pause (pattern overview W13) |
| **F-SG-12** | <GAP> **P1** | `SocSignalsPanel.tsx:84-94` | `formatTime` HH:MM UTC, không ngày | Nhầm phiên | Dùng chung `socTime.formatLastCheck` |
| **F-SG-13** | <GAP> **P1** | `SocSignalsPanel.tsx:545,535-539` + css `:910-914` | Cắt 50 client, không paging/debounce/scroll | Không vận hành được khi bùng tín hiệu | Paging BE + debounce + feed scroll |
| **F-SG-14** | <RISK> **P2** | `signals.py:541-542,624-625,969-970,516,974,595-602` | `last_scan_at=now()`, min_* copy threshold, accuracy `100.0-0.0`, FPR 0.0, whale-test luôn success | Số liệu giả trình bày như thật | Tính thật hoặc `null` → UI "—" + tooltip |
| **F-SG-15** | <GAP> **P2** | `signals.py:684-687` | `active_rules` = distinct rule trong 50 alert gần nhất | Nhãn sai bản chất | Đổi tên `rules_seen_24h` hoặc đếm rule registry thật |
| **F-SG-16** | <RISK> **P2** | `signals.py:891-906` + panel `:249` | BE nhận domain tùy ý, không validate | Celery nhận job lạ | BE whitelist domain + symbol normalize đã có (`:893-895` giữ) |
| **F-SG-17** | <GAP> **P2** | Panel `:293-298,392-394,462,529,551-557` | Div clickable không keyboard, options EN cứng, "Log #", emoji 🔍, subtab thiếu `aria-selected` | A11y + i18n fail | Buttons/roles + keys + LucideIcon |
| **F-SG-18** | <GAP> **P2** | `vi.js:293-329` | 5 keys không reference | Drift i18n | Xóa hoặc wire đúng scope |
| **F-SG-19** | <GAP> **P1** chiến lược | `signal_intelligence/urls.py:6-12`, `views.py:579-619`, `delivery_service.py:48-185` | AlertCenter (feed/ack/mute/context) + engine triage đầy đủ nhưng SOC tab = 0 sử dụng; SOC không có ack/mute | 2 mặt signals song song, operator SOC không triage được | Bắc cầu SOC read endpoints cho deliveries/preferences (P2) + roadmap hội tụ |
| **F-SG-20** | <GAP> **P2** | `signals.py:933-945` ↔ `soc.js:354-357` | View bỏ qua `run_log_id` | Khi poll sẽ nhầm job | Tôn trọng param khi có, fallback latest |

### E. Quality Gates Audit

| Gate | Lệnh / trạng thái | Kết quả | Gap |
|------|------------------|---------|-----|
| Lint | `npm run lint` (lần dựng gần nhất) | 0 errors | Không phủ logic |
| Type-check | `npx tsc --noEmit` (chạy lại khi audit) | **0** | `as unknown as` cast (`:141-147,256-258`) mất type safety — đúng chỗ mismatch ẩn náu |
| Build | `npm run build` docker | PASS | Không chứng minh đúng |
| i18n | `vi/en.js:293` 37 keys + scan | Đủ keys, 5 keys chết | Keys ≠ features |
| Test BE | 8 tests signals trong 301 OK (Entry 91) | PASS | Chỉ assert contract BE, không shape FE cần |
| Test FE | 0 component test panel; adapter test URL-only | — | F-SG-01/02 qua lọt đúng vì thiếu test |

> **Kết luận gates**: Xanh nhưng không chứng minh tab hoạt động — cùng pattern overview pre-fix, nặng hơn (feed rỗng toàn phần).

### F. Câu hỏi cần làm rõ (đã tự trả lời bằng evidence, ghi để khỏi hỏi lại)

1. Chuẩn envelope là `recent` hay `results`? → `recent` (serializers + 3 views + tests BE) — FE phải theo.
2. Sentiment tính từ đâu? → `UnifiedAlert.direction` theo session (BE cộng aggregation, không đoán).
3. Counts lấy từ đâu? → `SignalsSummaryView` (`:478-519`) đã có sẵn, FE chưa gọi — dùng nó, không thêm endpoint.
4. Ack trong SOC theo quyền nào? → P2: `request.user` hiện tại qua cùng engine (giữ user-scope, thêm audit actor), không mượn quyền.
5. Có gộp AlertCenter vào SOC? → Không (P2 chỉ bắc cầu read ack/mute; hội tụ là epic riêng).

### G. Đánh giá tổng thể & Lộ trình (chi tiết ở plan riêng)

**Mức hiện tại: 4.5/10** — khung tab (stats fallback, radar, 3 subtab, job console, materialization) render được, nhưng **feed lõi rỗng vĩnh viễn + 6 ô số/sentiment chết** → chưa đạt nội bộ, xa chuẩn thương mại (Bloomberg alerts / Datadog Monitors + triage / Grafana OnCall ack-escalation / PagerDuty / TradingView webhooks: realtime push, severity triage acknowledge-mute-escalate, rule management, precision stats, explainability, routing, export).

**Không blocker hạ tầng** (21 endpoints + engine ack/mute + AlertCenter đã tồn tại) — vấn đề là **contract FE↔BE + UI chưa khai thác**. Thứ tự: **P0 1.5 ngày** (F-SG-01→06: feed sống lại đúng số), **P1 4 ngày** (parity vận hành: paging, severity, config/retention/detection UI, test button, job polling, execution plan, poll gọn, time/a11y), **P2 6 ngày+** (realtime, ack/mute SOC, rule management, precision/feedback, honest metrics, export, routing).

Plan chi tiết: `docs/IMPLEMENTATION_PLAN_SOC_SIGNALS_COMMERCIAL_20260916.md`.

---

## 5. ĐẦU RA NGẮN

5 lỗi nặng nhất: feed rỗng vì sai key envelope (`SocSignalsPanel.tsx:157` ↔ `signals.py:570`), item thiếu field nên mù thời gian/volume (`:8-25` ↔ `:313-320`), latency/counts/sentiment chết vì sai/thiếu key (`:231-244` ↔ `:263-270`), 1 API lỗi sập cả tab (`:149-155,499-500`), job không theo dõi tiến trình (0 caller `getSocSignalJobStatus`). Ngoài ra 8 API + `whale/test/` chết không UI, số liệu giả (accuracy 100, FPR 0, `last_scan_at=now()`), và AlertCenter ack/mute đầy đủ nhưng SOC không dùng. Fix P0 1.5 ngày là feed sống lại; chuẩn thương mại cần thêm P1/P2 theo plan riêng.
