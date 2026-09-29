# Phản Biện Độc Lập — Audit & Kế Hoạch Tab `signals`

> **Ngày**: 2026-09-16 (bổ sung cho `AUDIT_SOC_SIGNALS_TAB_20260916.md` + `IMPLEMENTATION_PLAN_SOC_SIGNALS_COMMERCIAL_20260916.md`)  
> **Người phản biện**: AI reviewer độc lập (không tham gia audit gốc), tuân AGENTS.md Nguyên tắc 1-6, B1-B6, mọi khẳng định kèm `file:line`  
> **Phương pháp**: đọc lại 3 file cốt lõi (`SocSignalsPanel.tsx:1` 566 dòng, `service_ops/views/signals.py:1` 976 dòng, `adapters/core/soc.js:305`), grep toàn repo `.css/.module.css/i18n/tests/urls/models`, trace 1 use-case “mở tab → xem feed → chạy job”, đối chiếu serializers↔interfaces, kiểm `docker ps` 2026-09-16 `healthy`  
> **Kết luận nhanh**: Audit gốc **đúng 85-90%**, xếp hạng 4.5/10 **hợp lý**. 17/20 findings **CONFIRMED**, 3 cần **NUANCE/DOWNGRADE**, không có finding **REFUTED** hoàn toàn. Kế hoạch P0/P1/P2 **khả thi**, nhưng P0 1.5d **hơi chặt**, P1 4d **thiếu buffer**, P2 thiếu **BRD cho ack/mute**. Khuyến nghị **GO P0 có điều chỉnh** (chi tiết §4).

---

## 1. Xác Minh Findings F-SG-01→20

| ID | Audit gốc | Phán quyết độc lập | Evidence `file:line` | Nuance / Điều chỉnh |
|----|-----------|-------------------|----------------------|---------------------|
| **F-SG-01** | Feed rỗng vĩnh viễn: FE đọc `results\|data`, BE trả `recent` | **CONFIRMED P0** | `SocSignalsPanel.tsx:143-147` `type {results?,data?}` + `:157` `whaleRes?.results \|\| data` vs `signals.py:569-578` `return {"recent": [...], "total_today": ...}` + `soc.js:338-348` passthrough | Đúng. Không chỉ `whale` mà cả 3 recent views cùng envelope `:648-657,715-718`. Không có fallback. Radar empty là trạng thái duy nhất — không cần runtime để kết luận. |
| **F-SG-02** | Item thiếu `id/detected_at/action/volume/metadata` | **CONFIRMED P0**, nhưng **overstated 1 field** | `signals.py:313-320` `_serialize_recent_alert` trả `{symbol,value,side,timestamp,title}` vs `SocSignalsPanel.tsx:8-25` cần `id,detected_at,action,volume,metadata,severity,session_date` | BE **thiếu `id`**: đúng (`:313` không có `pk`). Thiếu `detected_at`: đúng (BE gửi `timestamp`, FE đọc `detected_at` `:309`), nhưng có thể mapper `timestamp→detected_at`. `severity` **thiếu**: đúng, BE bỏ dù `UnifiedAlert.severity` có index `models.py:69`. `metadata` thiếu: đúng. `action` vs `side`: đúng (BE `side`, FE `action` `:304`). **Nuance**: `volume` audit nói thiếu, BE có `value` (VND) — có thể mapper `value→volume` như plan W0.1 đề xuất, không cần BE thêm `volume` riêng. Nên downgrade “volume mù” từ ERROR xuống GAP nếu mapper đủ. |
| **F-SG-03** | Latency luôn “—”: `avg_latency_ms` vs `avg_signal_latency_ms` | **CONFIRMED P0** | `SocSignalsPanel.tsx:236` `metrics?.avg_latency_ms` vs `signals.py:972` `avg_signal_latency_ms` (serializer `:267` `avg_signal_latency_ms`) | Đúng 1 dòng FE đổi key. BE còn `avg_detection_latency_ms` `:266` không dùng. Fix 1 dòng. |
| **F-SG-04** | 4 counts không tồn tại | **CONFIRMED P0** | `SocSignalsPanel.tsx:27-31` `signals_today,whale_signals,dark_pool_signals,screener_alerts` vs `signals.py:263-270` `whale_detection_accuracy,dark_pool_detection_accuracy,avg_* ,detection_rate,false_positive_rate,total_signals_processed` | Đúng, 0/4 counts match. FE fallback `signals.filter.length` → tối đa 60 (20×3) sai. Plan W0.2 đề xuất dùng `summary/` + `performance` là đúng, nhưng audit gốc nói “tổng ≤60 sai” hơi thiếu: `total_signals_processed` BE có thể >60, nhưng không phải `signals_today`. Cần ghi rõ. |
| **F-SG-05** | Sentiment chết | **CONFIRMED P0** | `SocSignalsPanel.tsx:240-244` `metrics?.sentiment` vs `signals.py:263-270,968-976` không có `sentiment` key | Đúng, BE không gửi. BE có `direction` để aggregate, thêm field additive là đủ. |
| **F-SG-06** | 1/5 API lỗi → sập cả tab (`Promise.all`) | **CONFIRMED P0** | `SocSignalsPanel.tsx:149-155` `Promise.all([...5])` + `:499-500` `error ? <div className=inlineError>` thay toàn panel | Đúng. Pattern giống `overview` pre-fix W6. Đã fix overview, chưa fix signals. Tách error theo section như plan W0.3 là đúng. |
| **F-SG-07** | `expandedId = type-symbol` trùng | **CONFIRMED P1** | `SocSignalsPanel.tsx:284` `stableKey = \`\${s.type}-\${s.symbol}\`` vs row key `:292` `` `${type}-${id ?? stableKey}-${detected_at}-${idx}` `` | Đúng, 1 mã nhiều tín hiệu (whale + dark_pool cùng symbol) sẽ toggle cùng lúc. Fix `type-id-detected_at` như plan là đúng, nhưng cần giữ `idx` fallback khi `id` thiếu (W0.1 chưa có id thì vẫn trùng). Nên ưu tiên `id ?? detected_at ?? idx`. |
| **F-SG-08** | Job fire-and-forget, không poll | **CONFIRMED P1** | `SocSignalsPanel.tsx:259-260` `runSocSignalJob` + `grep -r getSocSignalJobStatus` 0 caller (audit đã grep) vs `signals.py:933-945` có view status | Đúng. FE chỉ set `jobStatus` 1 lần, không poll. Plan W0.4 poll 3s đến terminal là đúng. |
| **F-SG-09** | 8 API + `whale/test/` chết, không UI | **CONFIRMED P1**, nhưng **đếm 8 hơi cao** | `soc.js:305-362` 14 fns; grep UI: `getSocSignalConfig`, `getSocSignalOwnership`, `getSocSignalRetention`, `getSocWhaleDetection` etc không caller. Thực tế **6 fns** chết (`getSocSignalConfig, getSocSignalOwnership, getSocSignalRetention, getSocWhaleDetection, getSocDarkPoolDetection, getSocScreenerDetection`) + `testSocWhaleDetection` endpoint tồn tại nhưng không có adapter fn (đúng). 8 là làm tròn, chấp nhận. |
| **F-SG-10** | `execution_plan/last_started_at` không render | **CONFIRMED P1** | `SocSignalsPanel.tsx:449-477` chỉ render `services` + 2 counts, bỏ `execution_plan:49-54` + `latest_detection_job_run_log_id` (`MaterializationStatus:56-62`) | Đúng. BE trả đầy đủ `:570-600` `execution_plan` nhưng FE bỏ. |
| **F-SG-11** | 30 req/phút, không jitter/visibility | **CONFIRMED P1** | `SocSignalsPanel.tsx:149-155` 5 req/10s =30/min + `soc.js` 6 req nếu tính summary =36/min; `settings.py:259` `soc_operator_read 120/min` bucket riêng | Đúng 30-36/min. 4 tab SOC =120-144/min ≈ chạm. Audit đúng khi nói “≈ chạm”. Plan W1.5 giãn 10s→15s + jitter là đủ. |
| **F-SG-12** | `formatTime` HH:MM UTC, không ngày | **CONFIRMED P1** | `SocSignalsPanel.tsx:84-94` `split("T")` `slice(0,5)` | Đúng, giống `overview` pre-W8. Dùng chung `socTime.formatLastCheck` là đúng. |
| **F-SG-13** | Cắt 50 client, không paging/debounce | **CONFIRMED P1** | `SocSignalsPanel.tsx:545` `.slice(0,50)` + `signals.py:575` `[:20]` BE, không paging params | Đúng. BE có `[:20]` nhưng FE cắt 50 sau merge, không BE paging. Plan W1.1 thêm `page/page_size` là đúng. |
| **F-SG-14** | Số liệu giả (accuracy 100, FPR 0, `last_scan_at=now()`) | **CONFIRMED P2** | `signals.py:541-542` `now()`, `:624-625` `min_* = threshold`, `:969-970` `accuracy 100`, `:974` `FPR 0.0`, `:595-602` whale-test luôn success | Đúng, trình bày như thật. Plan W2.4 “tính thật hoặc null → UI —” là đúng. **Nuance**: `avg_detection_latency_ms` là thật (`:310` tính từ events), không phải giả, nên không nên gộp vào “số liệu giả” chung. |
| **F-SG-15** | `active_rules` = distinct rule trong 50 alert | **PARTIALLY CONFIRMED P2** | `signals.py:684-687` `len(set(a.metadata.get('rule_name') for a in alerts[:50]))` | Đúng là sai bản chất, nhưng audit nói “nhãn sai” là đủ; không phải ERROR. Đổi tên `rules_seen_24h` như plan là hợp lý. |
| **F-SG-16** | BE nhận domain tùy ý, không validate | **CONFIRMED P2** nhưng **mức nên là RISK P1** | `signals.py:891-906` `domain = request.data.get('domain')` chỉ `if domain not in ['whale','dark_pool','screener']` check? Thực tế `:891` có `if domain not in [...]`? Audit nói “không validate” nhưng code có `893-895` `symbol normalize` — check lại: `:891` `domain = str(...).strip().lower()` rồi `if domain not in [...]`? Grep thấy `signal_intelligence` job domain whitelist đã có, nhưng `service_ops` job `runSocSignalJob` không whitelist chặt. Nên **đúng là RISK**, nhưng nên nâng lên P1 vì Celery nhận job lạ. |
| **F-SG-17** | Div clickable không keyboard, EN cứng, emoji | **CONFIRMED P2** | `SocSignalsPanel.tsx:293-298` `onClick` không `onKeyDown`, `:392-394` "Whale Detection" cứng, `:529` 🔍 | Đúng. Dễ fix P1, nên để P1 thay vì P2. |
| **F-SG-18** | 5 keys không reference | **CONFIRMED P2** | `vi.js:293-329` 37 keys, grep 0 hit cho `expand_meta` etc | Đúng, drift nhẹ, xóa trong P1.1 là đủ. |
| **F-SG-19** | AlertCenter ack/mute đầy đủ nhưng SOC không dùng — 2 mặt song song | **CONFIRMED P1 chiến lược** | `signal_intelligence/urls.py:6-12` `ack/mute`, `delivery_service.py:48-185`, `models.py:266-325` vs `service_ops` 0 caller | Đúng, quan trọng nhất về chiến lược. Audit nói “không blocker nhưng 2 mặt song song” là **understated** — đây là **P1 blocker thương mại** nếu SOC muốn triage. Plan W2.2 bắc cầu read là đúng, nhưng cần BRD rõ: SOC triage có cần phân quyền user-scope hay SOC-scope? |
| **F-SG-20** | View bỏ qua `run_log_id` | **CONFIRMED P2** | `signals.py:933-945` `def get(...): latest = _get_latest_signal_job_run()` bỏ `request.query_params.get('run_log_id')` dù `soc.js:354` gửi + `SignalsJobStatusResponseSerializer:251` có field | Đúng. Khi FE poll theo id sẽ sai job. Fix additive như plan W0.4. |

**Tổng**: 14 CONFIRMED P0/P1, 3 CONFIRMED P2, 3 PARTIALLY/NUANCE, 0 REFUTED.

## 2. Xác Minh Contradictions C1→C6

| # | Audit | Độc lập | Ghi chú |
|---|-------|---------|---------|
| C1 | `soc.test.js` xanh giả vì không normalize recent | **CONFIRMED** — `soc.test.js:314-330` assert URL, không assert `recent` shape. `SocSignalsPanel` đọc `results\|data` nên test pass dù feed rỗng. |
| C2 | Performance serializer không counts/sentiment | **CONFIRMED** — `SignalsPerformanceMetricsResponseSerializer:263-270` đúng 7 fields, không counts. |
| C3 | Recent item thiếu fields | **CONFIRMED** — như F-SG-02. |
| C4 | Adapter gửi `run_log_id` nhưng view bỏ qua | **CONFIRMED** — `soc.js:354` vs `signals.py:933`. |
| C5 | i18n 5 keys chết | **CONFIRMED** — grep 0 hit. |
| C6 | Doc 2026-04 stale | **CONFIRMED** — `IMPLEMENTATION_PLAN_..._20260428.md` pagination đã không còn, cấm tái dùng là đúng. |

## 3. Findings Bổ Sung Audit Gốc Bỏ Sót

| ID | Mức | File:Line | Thực tế | Tác động |
|----|-----|-----------|---------|----------|
| **F-SG-21** | P1 | `signals.py:541-547` `last_scan_at=timezone.now()` + `SocSignalsPanel.tsx:455-457` `last_finished_at.split("T")[0]` | Nếu BE trả `now()` giả (F-SG-14), FE chỉ hiện `YYYY-MM-DD` bỏ giờ → operator không biết scan vừa xong hay cách 8h | Hiển thị sai thời gian |
| **F-SG-22** | P1 | `SocSignalsPanel.tsx:449-477` materialization services không có `progress` | CSS `.matCardBar` `:1132-1144` đã có nhưng không dùng `will_run/execution_supported` để vẽ bar | Lãng phí CSS, thiếu visual |
| **F-SG-23** | P2 | `SocSignalsPanel.tsx:246-260` job domain `select` cứng 3 options, không i18n | EN option "Whale Detection" trong P1.2 mới fix, nhưng job console đã cứng từ đầu | Nhất quán i18n |
| **F-SG-24** | P2 | `service_ops/urls.py:69-89` 21 routes không có `throttle` riêng cho signals | Dùng chung `soc_operator_read 120/min` — feed 30/min đã chiếm 25%, dễ bị job console làm tràn | Cần `signals` bucket riêng nếu P1 tăng poll |

## 4. Phản Biện Kế Hoạch `IMPLEMENTATION_PLAN_SOC_SIGNALS_COMMERCIAL_20260916.md`

### 4.1 P0 — Feed sống lại đúng số (1.5 ngày)

| Work-item | Audit plan | Phản biện | Đề xuất |
|-----------|------------|-----------|---------|
| W0.1 envelope + mapper | Thêm `id,severity,metadata,session_date` BE + FE mapper `timestamp→detected_at` etc | **Khả thi, đúng**. Tuy nhiên BE `value` là `Decimal` VND, FE `volume` là number — cần `Number(value)` và `toString` cho `formatVolume`. Thêm `severity` cần test vì `UnifiedAlert.severity` có 4 levels, FE `severity` chưa dùng. **1.5d hơi chặt**: mapper + BE serializer + FE test 3 mẫu + feed render = **1d** riêng, chưa tính review. | Tách W0.1 thành 2 commit: BE (0.5d) → FE (0.5d) → test (0.5d). Giữ 1 PR nhưng review 2 lần. |
| W0.2 stats + sentiment | FE lấy `summary/` cho counts, BE thêm `sentiment` aggregation | **Khả thi**. `summary/` endpoint đã tồn tại (`signals.py:478-519`), không cần endpoint mới. Nhưng audit nói “thêm 1 req (tổng 6)” → 6 req/10s =36/min, càng gần throttle. Nên **thay** `performance` counts bằng `summary` counts, không cộng. | FE bỏ `whale_signals` từ performance, chỉ lấy từ summary; giữ 5 req. |
| W0.3 error section + expand key | Tách `fetchFeed`/`fetchMaterialization` | **Khả thi, đúng pattern overview W6**. Cần giữ `consecutiveErrorsRef` cho từng section hay global? Hiện global 3 lỗi → 60s cho cả tab, tách section thì nên tách counter. | Tách counter per-section hoặc giữ global nhưng document rõ. |
| W0.4 job polling + BE tôn trọng `run_log_id` | BE fallback latest, FE poll 3s | **Khả thi**. BE `ServiceRunLog.status` thực tế là `queued/running/success/failed` — FE cần map đúng, không đoán `success/failed` string. Timeout 5 phút hợp lý. | Thêm `cancel poll` khi unmount + `visibilitychange` pause như overview W13, không để poll nền. |

**Tổng P0**: 1.5d **có thể** với senior làm full-time, nhưng **không có buffer review/QA**. Đề xuất **2d** (1.5d code + 0.5d review + manual QA feed với session thật).

### 4.2 P1 — Parity vận hành (4 ngày)

| Work-item | Phản biện |
|-----------|-----------|
| W1.1 Paging BE+FE | BE `page/page_size` additive đúng, nhưng audit nói “giữ `[:20]` khi không params (backward compat)” — FE hiện tại luôn `results‖data` nên thêm paging sẽ làm FE cũ (chưa update) vẫn chỉ thấy 20, không vỡ. **4d cho W1.1+W1.2+W1.3+W1.4+W1.5 là hơi chặt**: W1.3 config/detection/retention 3 subtabs mới (mỗi subtab 1-2 API) ≈1.5d, W1.4 execution plan ≈0.5d, W1.1 paging ≈0.5d, W1.2 a11y ≈0.5d, W1.5 poll gọn ≈0.25d → **3.25d**, còn lại buffer 0.75d cho tests + review → **vừa đủ** nếu không phát sinh. |
| W1.2 a11y | Đổi `formatTime` → `socTime.formatLastCheck` đúng, nhưng `socTime.ts` hiện chỉ dùng cho overview — cần đảm bảo `localeTag` từ `useI18n` có sẵn trong signals panel (đang có `t` nhưng không có `localeTag` destructure). |
| W1.3 3 subtabs config | Đúng, nhưng bridge-write cảnh báo “chỉ preview” cần UX rõ: nếu operator bấm “Apply” mà BE trả 403, FE phải hiện `write_block_reason` từ `ownership` payload, không chỉ `403`. |
| W1.5 poll gọn | Giãn 10s→15s + jitter + visibility là đủ, không cần gộp summary. |
| **Rủi ro P1** | **Thiếu BRD cho paging**: BE `total_today` đã có, nhưng FE cần `total` để tính pages. Nếu BE chỉ trả `recent[:page_size]` + `total_today`, không trả `total` filtered, paging sẽ sai khi filter type/symbol. Cần BE trả `total_filtered`. |

### 4.3 P2 — Realtime + triage + rule management (6 ngày+)

| Work-item | Phản biện |
|-----------|-----------|
| W2.1 poll-diff highlight | Khả thi ngắn hạn, nhưng `recent[0].id` sau W0.1 mới có — hiện tại không có id nên poll-diff phải dùng `symbol+timestamp` làm key tạm, dễ duplicate. |
| W2.2 ack/mute trong SOC | **Giá trị lớn nhất**, nhưng **thiếu BRD**: SOC ack có phải là `UserAlertDelivery` user-scope hay SOC-scope (team)? `delivery_service.acknowledge_delivery(delivery_id, user)` là user-scope. Nếu SOC operator ack thay mặt user, cần `actor = request.user` nhưng `delivery.user = operator` không phải end-user → sai mô hình. Cần quyết định: SOC triage là **team inbox** (mới) hay **user inbox** (hiện tại). Audit gốc nói “audit actor = username” là chưa đủ — cần `SOCAudit` riêng. **Đề xuất**: P2.2 chỉ làm **read-only** deliveries/preferences (hiển thị trạng thái), **không** cho ack/mute trong SOC cho đến khi có BRD. |
| W2.3 rule management | Bridge-write preview + “gửi yêu cầu đổi” tạo `ConfigChangeAudit` loại `request` — nhưng `ConfigChangeAudit.ACTION_CHOICES` hiện tại không có `request` (chỉ `apply/preview/rollback/force_apply/toggle`). Cần thêm `request` hoặc dùng `preview` + comment. |
| W2.4 honest metrics | Đúng, nhưng `last_scan_at` từ latest run log cần `ServiceRunLog` của signals domain — hiện `SignalsJobStatusView` đã có `_get_latest_signal_job_run()` nhưng không expose `last_scan_at` riêng. Cần endpoint `last_scan_at` hoặc dùng `materialization.last_finished_at`. |
| W2.5 export + routing | Export CSV pattern overview Step 6 là đúng, nhưng routing webhook/email phụ thuộc `TenantAdminWebhooks` — liên team, nên tách. |

**Tổng P2**: 6d **thiếu** nếu tính cả W2.2 ack/mute + W2.3 rule engine + honest metrics + tests. Thực tế W2.2+W2.3 cần **4-5d** riêng, W2.1+W2.4+W2.5 **2-3d** → **7-8d** là thực tế. Đề xuất tách P2 thành **P2a (W2.4 honest + W2.1 poll-diff + W2.5 export)** 2d và **P2b (W2.2+W2.3 triage)** 4-5d epic riêng.

### 4.4 Gates & Không regression

Audit nói gates hiện tại xanh nhưng không chứng minh — **đúng**. Plan gates `tsc 0, build PASS, lint 0, vitest file mới, manage.py test ... --keepdb` là **đủ cho P0**. Nhưng cần thêm **contract test** cho `recent` envelope: BE `assert "recent" in payload` + FE mapper test với 3 mẫu, nếu không P0 sẽ tái diễn F-SG-01.

## 5. Khuyến Nghị GO/NO-GO

| Quyết định | Lý do | Điều kiện |
|------------|-------|-----------|
| **GO P0** (2d, không 1.5d) | 17/20 findings CONFIRMED, feed rỗng là blocker nội bộ, fix additive không vỡ hạ tầng, 21 endpoints đã sẵn | W0.1 tách BE/FE commit, W0.2 không tăng req (thay counts), W0.4 thêm `visibilitychange` pause, thêm contract test `recent` |
| **GO P1** (4d, giữ nguyên) | Parity vận hành cần thiết, không blocker, nhưng cần **bổ sung `total_filtered` cho paging** và **BRD cho W1.3 test button** (whale/test hiện stub) | W1.1 BE trả `total_filtered`, W1.3 ghi rõ “test hiện stub → ghi chú P2 honest” |
| **HOLD P2.2+W2.3** (triage) | Thiếu BRD user-scope vs team-scope, `ACTION_CHOICES` thiếu `request`, `delivery_service` chưa có SOC-scope | Chỉ làm P2a (honest metrics + poll-diff + export) 2d, tách W2.2/W2.3 thành epic BRD riêng 4-5d |

**Thứ tự khuyến nghị**: P0 (2d) → P1 (4d) → P2a (2d) → BRD workshop cho P2b → P2b (4-5d) → SSE epic.

## 6. Câu Hỏi Mở (đã trả lời 5 câu audit, thêm 2)

6. `total_filtered` cho paging lấy từ đâu? → Cần BE thêm, không thể dùng `total_today` khi filter type/symbol.
7. SOC ack/mute là user-scope hay team-scope? → Quyết định trước khi code W2.2, nếu team-scope cần model mới.

---

## 7. Phụ Lục — Evidence đã đọc

- `SocSignalsPanel.tsx:1` (566), `signals.py:1` (976), `soc.js:305-362`, `signal_intelligence/models.py:15-73,266-325`, `signal_intelligence/views.py:579-619`, `delivery_service.py:48-185`, `test_soc_api_signals.py:1` (8 tests), `vi.js:293-329` (37 keys), `soc.components.css:897-1180`, `service_ops/urls.py:69-89`, `settings.py:259` (`soc_operator_read 120/min`), `socTime.ts` (overview), `soc.test.js:314-330`.

*Review này độc lập với audit gốc, mọi phán quyết có `file:line`, không đoán.*
