# Kế hoạch nâng cấp Signals lên chuẩn thương mại — Backend + Frontend + UX

> **Ngày**: 2026-09-16 · **Nguồn**: `docs/AUDIT_SOC_SIGNALS_TAB_20260916.md` (20 findings F-SG-01→20, 6 contradictions)
> **Benchmark**: Bloomberg alerts / Datadog Monitors (ack–mute–escalate) / Grafana OnCall (ack/resolve/silence) / PagerDuty / TradingView webhooks
> **Nguyên tắc**: Không đổi contract BE hiện hữu (chỉ **thêm** fields/params optional); FE theo BE canonical; mỗi work-item có nghiệm thu + tests; sau mỗi item `tsc` + test file; cuối PR `build + lint + i18n:scan`.
>
> **Status**: P0 ✅ · P1 ✅ · P2a ✅ (Entry 104–106) · **P2b ✅ (Entry 107–108 — W2.2 triage + W2.3 rules, verify 2026-09-16)** · P2c ⏸ SSE (epic riêng).

---

## Phase P0 — Feed sống lại đúng số (1.5 ngày, 1 PR, merge trước)

### W0.1 — Recent envelope + item mapper (F-SG-01, F-SG-02, C1, C3)
- **BE** `service_ops/views/signals.py:313-320` `_serialize_recent_alert`: thêm `id` (pk), `severity`, `metadata`, `session_date` (additive; serializers recent `:118-137` thêm 4 fields optional).
- **FE** `SocSignalsPanel.tsx:8-25`: `RecentSignal` thêm `id?, severity?, session_date?`; type adapter `:143-147` đọc `{recent?}`; mapper mới `mapRecentItem(raw, type)`:
  `detected_at←timestamp`, `action←side`, `volume←Number(value ?? order_value_vnd ?? matched_value_vnd)`, `price←undefined` (BE không có — bỏ cột giá trị ảo, hiển thị volume), `metadata←metadata ?? {}`, `severity`, `id`.
- **Nghiệm thu**: feed hiện đúng 20 items/session, sort đúng giờ, volume/time/action đầy.
- **Tests**: BE assert 4 fields mới có mặt; FE mapper unit test (3 recent mẫu whale/darkpool/screener) + test feed render rows.

### W0.2 — Stats keys + sentiment (F-SG-03, F-SG-04, F-SG-05, C2)
- **FE**: counts lấy từ `getSocSignalMetrics()` (`summary/`: `active/whale/dark_flow/signal_alerts`, `:478-519`) — thêm 1 req (tổng 6) hoặc thay performance cho counts; latency key → `avg_signal_latency_ms`; detection_rate giữ.
- **BE** `SignalsPerformanceMetricsView:960-976`: thêm `sentiment: {bullish, bearish, neutral}` đếm theo `direction` của alerts session (additive).
- **Nghiệm thu**: 6 stat cards + sentiment bar sống theo session; session trống → "—"/"Chờ dữ liệu" đúng nghĩa.
- **Tests**: BE sentiment aggregation; FE stats render với fixture summary+performance.

### W0.3 — Error theo section + expand key (F-SG-06, F-SG-07)
- Tách `fetchData` thành `fetchFeed()` (3 recents + metrics + summary) và `fetchMaterialization()` với error riêng (pattern overview W6: banner + giữ section còn lại).
- `expandedId` → `` `${type}-${id ?? symbol}-${detected_at}-${idx}` ``.
- **Nghiệm thu**: 1 endpoint 500 → banner section đó, các phần còn lại sống; 2 tín hiệu cùng mã expand độc lập.
- **Tests**: FE section-error isolation + expand độc lập.

### W0.4 — Job polling + tôn trọng run_log_id (F-SG-08, F-SG-20, C4)
- **BE** `SignalsJobStatusView:933-945`: khi có `?run_log_id=` hợp lệ → trả đúng job đó (fallback latest như cũ).
- **FE** job console: sau `runSocSignalJob` → poll `getSocSignalJobStatus(run_log_id)` 3s/lần đến terminal (`success/failed` — đối chiếu `ServiceRunLog` status thực tế khi code) + timeout 5 phút; hiện run_log_id + link.
- **Tests**: BE status-by-id; FE polling đến success (mock timer).

## Phase P1 — Parity vận hành thương mại (4 ngày, 1–2 PR)

### W1.1 — Paging + filter + feed scroll (F-SG-13)
- **BE** 3 recent views (`:559-578,638-657,705-718`): params `page/page_size` (default 20, max 100) + trả `total_today` đã có; giữ `[:20]` khi không params (backward compat).
- **FE**: pagination (reuse pattern overview W10: pageSize 20/50/100, range, numbers), thêm filter severity (BE đã có field sau W0.1) + direction, debounce 300ms search (reuse), `.signalFeed` max-height (~560px) + scroll.
- i18n: `severity_all/severity_label/direction_*` (VI/EN).

### W1.2 — Thời gian + a11y + text cứng (F-SG-12, F-SG-17, F-SG-18)
- `formatTime` → `socTime.formatLastCheck` (absolute local + relative + tooltip ISO).
- Rows/subtabs keyboard-operable (`role=button/tab`, tabIndex, Enter/Space, `aria-selected/aria-expanded`); options domain dùng i18n (thay "Whale Detection"...); "Log #" → key; 🔍 → LucideIcon `Search`; xóa 5 keys chết hoặc wire đúng.

### W1.3 — Khai thác API chết: config/ownership/detection/retention/test (F-SG-09)
- Subtab mới **"Cấu hình"** (read-only, bridge-write hiển thị rõ): cards từ `getSocSignalConfig` (thresholds/intervals/universe) + ownership box (`can_apply=false` + `write_block_reason`) + nút "Mở tài liệu owner" (link text).
- Subtab **"Detection"**: 3 cards whale/dark-pool/screener từ 3 endpoints settings + nút **"Chạy thử"** gọi `whale/test/` (adapter thêm `testSocWhaleDetection`) hiện kết quả thật (BE hiện stub — ghi chú P2 honest).
- Subtab **"Retention"**: bảng policy + nút Preview hiện impact (`alerts_in_scope/events_in_scope`), cảnh báo bridge-write lock.

### W1.4 — Materialization đầy đủ (F-SG-10)
- Render `execution_plan` (bảng service × will_run/symbol), `last_started_at` + finished (relative), `latest_detection_job_run_log_id` link tới job status; `matCardBar` CSS có sẵn (`:1128-1136`) mà chưa dùng → progress started→finished.

### W1.5 — Poll gọn (F-SG-11)
- Gộp summary vào performance? Không — giữ 6 req nhưng giãn poll 10s→15s + jitter 0–3s + `visibilitychange` pause (pattern overview W13); đo throttle thực tế qua response headers khi có.

## Phase P2 — Realtime + triage + rule management (6 ngày+, epic tách PR)

### W2.1 — Realtime feed (thiếu của Datadog/Grafana)
- Ngắn hạn: poll-diff (so `recent[0].id` + `total_today`) → highlight row mới + unread badge + title blink; âm thanh toggle (default tắt).
- Dài hạn: SSE `/operator/soc/signals/stream/` (BE mới, epic riêng như overview SSE).

### W2.2 — Ack/Mute trong SOC (F-SG-19) — giá trị thương mại lớn nhất
- **BE** `service_ops/views/signals.py` mới: `SignalsDeliveriesView` (GET deliveries của `request.user`, filter state/symbol, page) + `SignalsDeliveryAckView` (POST ack via `delivery_service.acknowledge_delivery`) + `SignalsDeliveryMuteView` (POST via `upsert_user_alert_preference`) — reuse engine, `IsAdminUser` đã có từ `SOCBaseView`, audit actor = username. Serializer theo `UserAlertDeliveryStateSerializer`.
- **FE** feed: cột trạng thái delivery (new/seen/ack), nút Ack + Mute (modal lý do + thời hạn, reuse pattern overview W1), filter "chưa ack"; seen tự đánh khi expand row.
- **Tests**: BE transition guards (reuse pattern `test_delivery_service.py`), FE ack flow.

### W2.3 — Rule management + precision (Bloomberg/Datadog rules)
- UI bật/tắt rule + sửa threshold/cooldown qua **preview + "gửi yêu cầu đổi"** (bridge-write: tạo `ConfigChangeAudit` loại `request`, không apply trực tiếp) — tôn trọng ownership.
- **BE** aggregation mới: precision/recall proxy per rule (alerts có ack vs muted/suppressed từ deliveries) + endpoint feedback (thumbs up/down → transition `acknowledged`/`suppressed` + lý do).
- Hiển thị hit-rate/precision per rule + top noisy rules (điểm trừ Datadog-style "noisiest monitors").

### W2.4 — Honest metrics (F-SG-14, F-SG-15)
- `last_scan_at` ← latest run log (thay `now()`); `min_volume/min_signal_count` ← config thật hoặc bỏ field; accuracy/FPR: tính từ ack/mute (W2.3) hoặc trả `null` → UI "—" + tooltip "chưa đủ dữ liệu"; `active_rules` → `rules_seen_24h` hoặc đếm registry; whale-test chạy detection thật hoặc gắn nhãn "smoke".

### W2.5 — Export + routing (điều kiện)
- Export CSV feed (pattern overview Step 6: BE view limit ≤5000 + FE blob); routing webhook/email: **phụ thuộc TenantAdminWebhooks** — liên team, tách ticket.

> **Trạng thái P2 (2026-09-16, Entry 104-106)**: W2.4 ✅, W2.1 poll-diff ✅, W2.5 export ✅. Còn lại theo Phase P2b + P2c bên dưới.

## Phase P2b — Triage ack/mute + rule management (6–8 ngày, 2 PR, tách theo W-item)

### W2.2 — Ack/Mute trong SOC (F-SG-19) — giá trị thương mại lớn nhất còn lại
- **BE** tách file mới `service_ops/views/signals_triage.py` (giữ `signals.py` khỏi phình):
  - `SignalsDeliveriesView` — `GET /signals/deliveries/`: deliveries của `request.user`, filter `delivery_state/symbol`, page; serializer tái dùng `UserAlertDeliveryStateSerializer` (`signal_intelligence/views.py:110`).
  - `SignalsDeliveryAckView` — `POST /signals/deliveries/{delivery_id}/ack/`: gọi `delivery_service.acknowledge_delivery` (`delivery_service.py:170`) — transition guard (new→ack, seen→ack; ack/muted không chuyển lại).
  - `SignalsDeliveryMuteView` — `POST /signals/deliveries/mute/`: `{symbol|alert_family, mute_minutes, reason}` → `delivery_service.upsert_user_alert_preference` (`delivery_service.py:175`).
  - Scope quyết định: **deliveries của SOC operator user** (ISOC theo plan gốc, audit actor = username) — triage toàn cục mọi end-user là epic riêng, không nhồi PR này. Reuse guard tests từ `test_delivery_service.py:48,76-93`.
- **FE** `SocSignalsPanel.tsx`:
  - Cột trạng thái delivery (new/seen/ack/muted badge màu) — fetch `/deliveries/` song song, **không nhồi vào recent envelope** (giữ contract recent bất biến).
  - Nút **Ack** (single + bulk via checkbox) + **Mute** (modal lý do + thời hạn, reuse pattern overview W1); filter "Chưa ack" (`unacked_only`); `seen` tự đánh khi expand row.
  - i18n: `ack/mute/muted_until/unacked_only/mark_seen/ack_reason/delivery_state_*`.
- **Tests**: BE transition guards 4 state + mute upsert (reuse test_delivery_service patterns); FE ack flow + mute modal + unacked filter (vitest).

### W2.3 — Rule management + precision (Bloomberg/Datadog rules)
- **BE** `service_ops/models.py:322` `ConfigChangeAudit.ACTION_CHOICES` **thêm `('request', 'Change Requested')`** (giữ immutable trail: yêu cầu đổi rule ghi audit, **không apply trực tiếp** — tôn trọng ownership bridge-write).
  - `SignalsRuleRequestView` — `POST /signals/rules/request/`: `{rule_key, threshold?/cooldown_s?/enabled?}` → validate + tạo `ConfigChangeAudit(action='request', before/after_snapshot, change_summary)`, trả `{request_id, pending: true}`.
  - `SignalsRuleFeedbackView` — `POST /signals/rules/feedback/`: `{alert_id, signal: up|down, reason?}` → chuyển delivery `acknowledged`→`suppressed` (thumbs down) qua service layer + ghi `suppression_reason`.
  - `SignalsRulePerformanceView` — `GET /signals/rules/performance/`: precision/recall **proxy** per rule từ deliveries (ack = positive, muted/suppressed = negative), hit-rate + alert_count + top noisy (Datadog "noisiest monitors"); không đủ data → `null` + UI "—" (hồi W2.4 pattern).
- **FE** subtab "Rules": bảng rule (threshold/cooldown/enabled) + nút "Gửi yêu cầu đổi" (preview → request, hiện `request_id` + "chờ owner"); hit-rate/precision per rule + top noisy; thumbs up/down per row.
  - i18n: `rule_enable/rule_disable/rule_request_sent/precision/noisy_rules/feedback_thanks/rule_state_*`.
- **Tests**: BE ConfigChangeAudit request tạo + ownership guard (chỉ user có scope, hành động là request không phải apply); FE rule table + feedback + request flow.

## Phase P2c — SSE realtime stream (epic tách PR, sau P2b)

> **Tiền đề**: chưa có SSE nào trong codebase — chỉ stream CSV (`identity_access/views_usage.py:251`). SSE là pattern **mới của project**, module riêng + test stream riêng.

### W2.1-long — `/operator/soc/signals/stream/`
- **BE** module mới `service_ops/streams.py`:
  - `SignalsStreamView` — `StreamingHttpResponse(content_type='text/event-stream')`; nguồn sự kiện: `UnifiedAlert` mới theo session (poll DB hoặc signal/receiver khi `_upsert_*`); `event: signal`, `data: {id, type, symbol, severity, direction, detected_at, title}`; heartbeat comment `: ping` 15s; `retry: 3000`; filter theo query `type/severity/symbol` per connection; auth như `SOCBaseView`.
  - Boundary: 1 connection/operator tab, giới hạn query tối đa, timeout idle; test bằng test client stream + generator.
- **FE** hook `useSignalStream` (`src/hooks/`): EventSource, reconnect backoff 1s→30s, heartbeat watchdog, **thay poll-diff (W2.1) khi stream active, fallback poll nếu stream fail** (graceful degradation giữ FE poll), highlight/badge/title-blink giữ nguyên (nút badge + `.signalRowNew` reuse).
- i18n: `stream_reconnecting/stream_audio_toggle`.

## i18n keys thêm (VI+EN, theo phase)

P0: `feed_error/materialization_error` (tái dùng pattern), `job_polling/job_timeout/job_run_id`. P1: `severity_all/severity_label/direction_buy/direction_sell/direction_neutral`, `config_tab/detection_tab/retention_tab`, `bridge_write_note/test_button/test_result`, `page_size_label/sort_label` (tái dùng overview nếu share được), `no_job_history`. P2: `ack/mute/muted_until/unacked_only/mark_seen`, `rule_enable/rule_disable/rule_request_sent`, `precision/noisy_rules/feedback_thanks`, `export_csv`.

## Tests bắt buộc (DoD mỗi phase)

- **BE**: envelope fields mới, sentiment agg, paging params, status-by-id, deliveries/ack/mute (kế thừa guard tests), whitelist domain.
- **FE**: mapper unit, feed render, expand keys, section errors, job polling (fake timers), paging+filters, ack/mute flow, config/retention render.
- **Gates**: `tsc 0`, `build PASS`, `lint 0 errors`, `vitest` file signals mới, `manage.py test service_ops.tests.test_soc_api_signals --keepdb` OK, `i18n:scan` sạch.
- **Không regression**: adapter tests + 8 BE tests hiện tại giữ xanh.

## Thứ tự + ước lượng

P0 (1.5d): W0.1 → W0.2 → W0.3 → W0.4 → gates → ledger. P1 (4d): W1.1 → W1.3 → W1.4 → W1.2 → W1.5 → gates → ledger. P2a (2d, ✅ Entry 104-106): W2.4 → W2.1 (poll-diff) → W2.5 export. **P2b (✅ Entry 107-108)**: W2.2 ack/mute → W2.3 rule management → gates → ledger. **P2c (epic riêng, 4–5d, next)**: SSE stream BE → useSignalStream FE → fallback poll → gates → ledger.

## Không làm (có lý do)

- Gộp AlertCenter user app vào SOC (epic hội tụ riêng, ảnh hưởng quyền user-scope).
- Backtest engine, ML false-positive model (ngoài scope SOC ops).
- Đa khung thời gian intraday realtime tick (đã ghi backlog screener methodology §5).
- Doc legacy 2026-04: cấm dùng khi chưa re-verify (C6).
