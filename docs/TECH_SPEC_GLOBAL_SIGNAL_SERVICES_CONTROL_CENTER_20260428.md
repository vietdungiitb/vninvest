# TECH SPEC - Global Signal Services Control Center

## 1. Mục tiêu kỹ thuật

Thiết kế này nhằm tạo một kiến trúc global-signal đủ bền cho:

1. detect whale và dark-flow ở chế độ toàn cục,
2. persist canonical event để tái sử dụng lâu dài,
3. phân phối signal cho đúng audience,
4. vận hành qua một admin control center thống nhất.

## 2. Domain boundaries và SSOT

### 2.1 Domain truth bắt buộc

1. `WhaleAlertEvent` là canonical event-store cho whale global.
2. `OrderFlowSignal` là canonical persisted signal cho dark-flow global.
3. `WhaleAdvisory` là downstream consumer cho AI, không phải event-store whale.
4. `IntradayTick` là raw feed cho detection/recovery, không phải global read model chính.

### 2.2 Nghiêm cấm

1. Dùng `WhaleAdvisory` để thay thế whale event-store global.
2. Dùng read-path query trực tiếp từ `IntradayTick` để dựng global feed chính sau khi canonical store đã có.
3. Cho user-specific threshold quyết định sự tồn tại của canonical event.

## 3. Target backend modules

### 3.1 Modules mới hoặc refactor lớn

1. `backend/portfolio/services_global_signal_universe.py`
2. `backend/portfolio/services_global_whale_alerts.py`
3. `backend/portfolio/services_global_dark_flow.py`
4. `backend/portfolio/services_global_signal_distribution.py`
5. `backend/portfolio/views_signal_admin.py`

### 3.2 Existing anchors cần tái sử dụng

1. `backend/portfolio/tasks_order_flow.py`
2. `backend/portfolio/tasks_prefetch.py`
3. `backend/portfolio/market_data_service.py`
4. `backend/portfolio/tasks_whale_broadcast.py`
5. `backend/portfolio/views_admin_runtime.py`
6. `backend/portfolio/views_whale_orchestration.py`

## 4. Canonical models

## 4.1 WhaleAlertEvent (mới)

### Mục đích

Là record canonical cho mọi whale event global đã qua rule detect và dedupe.

### Shape bắt buộc

```text
id
event_id (deterministic, unique)
symbol
side
matched_value_vnd
threshold_vnd
threshold_policy_version
severity
event_score
confidence
source
source_layer
trade_date
occurred_at
market_wide
is_market_discovery
payload_json
created_at
```

### Quy tắc event_id

`event_id` phải deterministic, ví dụ dựa trên:

```text
whale:{symbol}:{occurred_at}:{side}:{matched_value_vnd}:{source_key}
```

Không dùng synthetic id tăng dần theo request.

## 4.2 OrderFlowSignal (existing canonical)

Tiếp tục dùng model hiện có, nhưng cần thêm hoặc khóa các semantic sau ở service layer:

1. detector không được trộn audience resolution vào phase detect,
2. severity mapping cho dark-flow không dùng ratio whale threshold,
3. `event_id` phải tiếp tục deterministic và ổn định qua retries.

## 4.3 SystemSetting JSON keys

Để tránh thêm nhiều model config lẻ, runtime config toàn cục ưu tiên nằm trong `SystemSetting` với các key:

1. `global_signal_services_config`
2. `global_signal_universe_policy`
3. `global_signal_retention_policy`

### Shape gợi ý

```json
{
  "enabled": true,
  "whale_service": {
    "enabled": true,
    "default_threshold_vnd": 500000000,
    "market_top_tier_multiplier": 5,
    "cooldown_seconds": 120,
    "manual_run_limit": 200
  },
  "dark_flow_service": {
    "enabled": true,
    "window_seconds": 300,
    "warning_strength": 40,
    "urgent_strength": 70,
    "cooldown_seconds": 300
  },
  "distribution": {
    "websocket_enabled": true,
    "history_enabled": true,
    "fanout_batch_size": 200
  }
}
```

## 5. Universe resolution

## 5.1 GlobalSignalUniverseResolver

`GlobalSignalUniverseResolver` phải trả ra một payload duy nhất:

```json
{
  "effective_symbols": ["HPG", "VCB", "FPT"],
  "counts": {
    "admin_curated": 120,
    "tracked": 48,
    "watchlist": 92,
    "effective": 173
  },
  "sources": {
    "admin_groups": [1, 4],
    "admin_symbols": ["HPG"],
    "include_tracked": true,
    "include_watchlists": true
  },
  "generated_at": "..."
}
```

## 5.2 Preview-before-apply

Mọi thay đổi universe trên admin UI phải đi qua:

1. config draft,
2. preview effective count,
3. preview source counts,
4. preview retained symbols bị thêm/bớt,
5. explicit apply.

## 6. Service execution flow

## 6.1 Global Whale Alerts Service

### Flow

1. Lấy `effective universe snapshot`.
2. Read raw source ưu tiên theo current market data policy.
3. Detect whale candidates.
4. Chọn single winner threshold per trade.
5. Persist `WhaleAlertEvent`.
6. Update hot caches/read models.
7. Enqueue distribution.

### Bắt buộc

1. Không gọi AI advisory trong phase detection.
2. Không tính existence theo threshold riêng user.
3. Không emit duplicate event cho cùng một trade chỉ vì vượt nhiều threshold.

## 6.2 Global Dark Flow Service

### Flow

1. Lấy `effective universe snapshot`.
2. Chạy detect dark flow per symbol.
3. Persist `OrderFlowSignal` nếu đạt rule.
4. Update hot caches/read models.
5. Enqueue distribution.

### Bắt buộc

1. `tasks_order_flow.py` không giữ logic advisory accumulation bên trong phase detect chính.
2. Severity mapper dark-flow phải dựa trên `strength`, `confidence`, `cvd_change`, `signal_type`, không dùng heuristic whale ratio.

## 6.3 Distribution service

### Audience source

1. `TrackedSymbol`
2. `WatchlistItem`

### Delivery outputs

1. websocket symbol group,
2. websocket per-user alert group,
3. `UserAlertHistory` tối thiểu,
4. optional downstream advisory queue nếu feature đó bật.

## 7. Read-model caches

### Cache families bắt buộc

1. `global_signal:whale:latest_by_symbol:{symbol}`
2. `global_signal:dark_flow:latest_by_symbol:{symbol}`
3. `global_signal:summary:overview`
4. `global_signal:universe:effective_snapshot`
5. `global_signal:events:recent:{domain}`

### Nguyên tắc

1. Cache là accelerator, không phải source of truth.
2. Mọi cache invalidation phải gắn với config apply hoặc service run complete.

## 8. Jobs and observability

## 8.1 Run registry

Khuyến nghị tạo `SignalServiceRun` generic cho cả whale và dark flow, thay vì tiếp tục nhân đôi UI theo model riêng.

### Shape tối thiểu

```text
id
service_domain (whale / dark_flow)
run_type (scheduled / manual / backfill / recompute / retention_preview)
status
params_json
started_at
finished_at
progress_pct
processed_items
stored_items
failed_items
log
created_by
```

### Transition note

`WhaleServiceJob` cũ có thể được adapter vào UI trong giai đoạn chuyển đổi, nhưng target end-state là control center đọc `SignalServiceRun` làm run registry thống nhất.

## 8.2 Summary contract cho admin UI

Admin summary API phải trả tối thiểu:

1. service enabled state,
2. last successful run,
3. last failed run,
4. effective universe count,
5. recent persisted event counts,
6. cache freshness,
7. Celery worker / beat health,
8. retention summary.

## 9. Admin APIs

## 9.1 Endpoints đề xuất

1. `GET /api/portfolio/admin/signals/summary/`
2. `GET /api/portfolio/admin/signals/config/`
3. `PUT /api/portfolio/admin/signals/config/`
4. `POST /api/portfolio/admin/signals/universe/preview/`
5. `POST /api/portfolio/admin/signals/universe/apply/`
6. `GET /api/portfolio/admin/signals/jobs/`
7. `POST /api/portfolio/admin/signals/jobs/run/`
8. `POST /api/portfolio/admin/signals/jobs/{id}/retry/`
9. `GET /api/portfolio/admin/signals/events/recent/`
10. `POST /api/portfolio/admin/signals/retention/preview/`

### Permission

Tất cả write endpoints dùng `IsAdminUser` hoặc stricter role matrix nếu repo đã có.

## 10. Frontend admin IA

## 10.1 Route

Ưu tiên một trong hai cách:

1. `AdminOps` thêm page key `signals`, hoặc
2. route mới `/admin-ops/signals` mount trong shell `AdminOps`.

## 10.2 Component tree đề xuất

1. `frontend/src/pages/AdminOps.jsx` (route shell)
2. `frontend/src/components/adminops/SignalControlCenter.jsx`
3. `frontend/src/components/adminops/signal-center/SignalOverviewPanel.jsx`
4. `frontend/src/components/adminops/signal-center/SignalUniversePanel.jsx`
5. `frontend/src/components/adminops/signal-center/WhaleServicePanel.jsx`
6. `frontend/src/components/adminops/signal-center/DarkFlowServicePanel.jsx`
7. `frontend/src/components/adminops/signal-center/SignalDistributionPanel.jsx`
8. `frontend/src/components/adminops/signal-center/SignalRetentionPanel.jsx`
9. `frontend/src/components/adminops/signal-center/SignalJobsAuditPanel.jsx`

## 10.3 UI rules bắt buộc

1. Mọi text mới qua i18n tiếng Việt đầy đủ dấu.
2. Không dùng inline pagination riêng.
3. Nếu có table lớn, dùng `PaginationBar`.
4. Mọi action nguy hiểm phải có preview hoặc confirmation modal với số lượng ảnh hưởng thật.
5. React source phải tuân thủ React 19 patterns.

## 11. Retention strategy

## 11.1 Raw tick retention

`IntradayTick` chỉ giữ trong khoảng ngắn phục vụ recovery và microstructure analytics.

## 11.2 Canonical signal retention

1. `WhaleAlertEvent`: giữ dài hơn theo nhu cầu historical analysis và audit.
2. `OrderFlowSignal`: giữ dài hơn raw ticks, có archive policy rõ.

## 11.3 Safeguard

Purge retention phải có preview trước:

1. số rows raw sẽ xóa,
2. số canonical events đã an toàn,
3. earliest retained date,
4. rollback note nếu purge nhầm.

## 12. Coding guardrails

1. Không code trước explicit consent.
2. Không mở route song song cho cùng domain nếu chưa có lý do architecture-grade.
3. Không hardcode business policy rải rác ở view.
4. Không dùng `WhaleAdvisory` làm shortcut thay event-store whale.
5. Không để admin center chỉ là collection các raw CRUD tables.

## 13. Validation strategy

1. Backend unit/integration cho universe, detect, dedupe, persistence, fan-out.
2. Frontend tests cho summary, preview/apply, write guardrails, jobs tables, error states.
3. Integration matrix và Council of Three spec audit theo docs pack này.