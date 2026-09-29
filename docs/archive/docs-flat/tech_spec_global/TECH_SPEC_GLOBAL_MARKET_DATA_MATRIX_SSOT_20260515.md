# Technical Specification — Global Market Data Matrix SSOT
**Ngày**: 2026-05-15  
**Phiên bản**: 1.0  
**Status**: Approved  
**Parent**: `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`

---

## 1. Phạm vi kỹ thuật

Tài liệu này định nghĩa chi tiết kỹ thuật cho:

- persistence SSOT của global symbol universe
- demand-source aggregation
- coverage/freshness inventory
- crawl planner `missing-only`
- SOC Data Ops control plane cho market data
- read-path invariants dùng shared global data layer

---

## 2. Core entities

### 2.1 `GlobalSymbolRegistry`

Một row trên mỗi symbol, là canonical registry của toàn hệ thống.

**Fields tối thiểu**:
- `symbol` (unique, uppercase)
- `is_active`
- `current_priority_tier` (`hot`, `warm`, `cold`, `recovery`)
- `priority_score`
- `demand_source_count`
- `last_demand_at`
- `last_hydrated_at`
- `latest_trade_date`
- `freshness_state_summary`
- `coverage_state_summary`
- `decay_after_at`
- `metadata`

**Invariant**:
- Chỉ một row canonical cho mỗi mã.
- Không gắn ownership theo user.

### 2.2 `GlobalSymbolDemandSource`

Lưu từng nguồn demand đang kéo symbol vào matrix.

**Fields tối thiểu**:
- `registry` (FK)
- `source_type` (`system_default`, `admin_group`, `holding`, `watchlist`, `tracked_symbol`, `alert`)
- `source_ref`
- `tenant_id` (nullable nếu source toàn hệ thống)
- `user_id` (nullable nếu source không thuộc user)
- `is_active`
- `activated_at`
- `deactivated_at`
- `weight`
- `metadata`

**Invariant**:
- Cùng một source không tạo duplicate active edge cho cùng symbol.
- Việc remove source chỉ deactivate edge, không xóa ngay registry row.

### 2.3 `GlobalSymbolCoverage`

Persistence cho coverage/freshness theo dataset của từng symbol.

**Fields tối thiểu**:
- `registry` (FK)
- `dataset` (`daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts`)
- `latest_available_at`
- `oldest_available_at`
- `latest_complete_trade_date`
- `freshness_state` (`fresh`, `warm`, `stale`, `missing`, `error`)
- `missing_ranges`
- `last_verified_at`
- `next_recommended_action`
- `detail`

**Invariant**:
- Planner đọc coverage state thay vì tự suy đoán từ raw full scan ở request path.

---

## 3. Demand aggregation semantics

### 3.1 Nguồn demand hợp lệ

- system defaults
- admin global groups
- holdings
- watchlists
- tracked symbols
- alerts

### 3.2 Promotion semantics

- User add watchlist item: create/update `WatchlistItem` như hiện tại, sau đó upsert active demand edge kiểu `watchlist` cho symbol.
- User add tracked symbol: upsert active demand edge kiểu `tracked_symbol`.
- Holding xuất hiện hoặc tăng trạng thái active: upsert edge kiểu `holding`.
- Alert được tạo: upsert edge kiểu `alert`.

### 3.3 Demotion semantics

- Remove demand source chỉ deactivate edge tương ứng.
- Registry row chỉ được đánh `inactive` khi không còn active edge và đã qua `decay_after_at`.

---

## 4. Coverage/freshness model

### 4.1 Dataset-level rules

`daily_prices`
- thiếu phiên ngày -> `missing`
- phiên gần nhất quá ngưỡng lịch giao dịch -> `stale`

`price_board_snapshot`
- snapshot quá TTL runtime -> `stale`

`intraday_bars`
- thiếu bar window trong session hiện tại hoặc session cần thiết -> `missing`

`intraday_ticks`
- chỉ là staging/recovery input; thiếu có thể degrade nhưng không override facts-first read path nếu summary/facts đã đủ

`session_facts`
- facts read model là ưu tiên chính cho selected-session analytics

### 4.2 Planner policy

Default:
- `missing_only = true`
- `overwrite_existing = false`
- `repair_conflicts = false`

Explicit manual override mới được:
- `force_refresh = true`
- `repair_conflicts = true`

---

## 5. Execution model

### 5.1 Persistent SSOT vs execution state

Persistent SSOT:
- `GlobalSymbolRegistry`
- `GlobalSymbolDemandSource`
- `GlobalSymbolCoverage`

Execution state:
- `ServiceRunLog`
- `ScrapeMatrix`
- queue messages
- task retries

### 5.2 Reuse existing runtime surfaces

- `ServiceRunLog` tiếp tục là run/audit backbone.
- `ServiceConfig` tiếp tục giữ runtime config cho operator surface.
- `ScrapeMatrix` tiếp tục giữ cycle/cell progress của execution.
- `provider_catalog` tiếp tục là SSOT cho runtime provider readiness.

---

## 6. Queue tiers

### 6.1 Tiers bắt buộc

- `hot_user_demand`: symbol đang có active user demand + stale/missing critical data
- `warm_liquid_market`: symbol thanh khoản cao hoặc thuộc curated group active
- `cold_full_market`: long-tail market coverage
- `recovery_backlog`: repair, retry, historical gap recovery

### 6.2 Promotion rules

- Symbol mới có active watchlist/tracked/holding/alert demand được promote tối thiểu vào `hot_user_demand` hoặc `warm_liquid_market` theo policy.
- Nhiều user/nguồn demand tăng `priority_score`, nhưng không được tạo duplicate crawl items cho cùng symbol-range.

---

## 7. SOC Data Ops API surface

Các endpoint mục tiêu có thể thuộc namespace `api/soc/dataops/` hoặc mở rộng `vnbroker`/`matrix`, nhưng contract phải hỗ trợ tối thiểu:

- `GET /api/soc/dataops/global-registry/summary/`
- `GET /api/soc/dataops/global-registry/symbols/`
- `GET /api/soc/dataops/global-registry/symbols/<symbol>/`
- `GET /api/soc/dataops/coverage/summary/`
- `GET /api/soc/dataops/coverage/<symbol>/`
- `POST /api/soc/dataops/planner/preview/`
- `POST /api/soc/dataops/planner/run/`
- `GET /api/soc/dataops/queue-tiers/`
- `POST /api/soc/dataops/runtime-config/`
- `GET /api/soc/dataops/run-logs/`

Mỗi response lỗi phải theo envelope chuẩn `{detail, code, timestamp, request_id, field_errors}`.

### 7.1 `GET /api/soc/dataops/global-registry/summary/`

**Purpose**: Tóm tắt quy mô registry toàn cục và tình trạng demand/coverage hiện hành.

**Response shape**:

```json
{
	"totals": {
		"symbols": 0,
		"active_symbols": 0,
		"decaying_symbols": 0,
		"active_demand_edges": 0
	},
	"tiers": [
		{"tier": "hot", "symbols": 0},
		{"tier": "warm", "symbols": 0},
		{"tier": "cold", "symbols": 0},
		{"tier": "recovery", "symbols": 0}
	],
	"sources": [
		{"source_type": "watchlist", "active_edges": 0},
		{"source_type": "tracked_symbol", "active_edges": 0},
		{"source_type": "holding", "active_edges": 0},
		{"source_type": "alert", "active_edges": 0},
		{"source_type": "admin_group", "active_edges": 0},
		{"source_type": "system_default", "active_edges": 0}
	],
	"freshness": {
		"fresh": 0,
		"warm": 0,
		"stale": 0,
		"missing": 0,
		"error": 0
	},
	"updated_at": "2026-05-15T10:00:00Z"
}
```

### 7.2 `GET /api/soc/dataops/global-registry/symbols/`

**Purpose**: Danh sách symbol trong global registry, có pagination/filter/sort cho operator.

**Query params**:
- `page`
- `page_size`
- `search`
- `tier`
- `is_active`
- `freshness_state`
- `source_type`
- `ordering` (`symbol`, `-priority_score`, `-last_demand_at`, `-last_hydrated_at`)

**Response shape**:

```json
{
	"count": 0,
	"next": null,
	"previous": null,
	"results": [
		{
			"symbol": "FPT",
			"is_active": true,
			"current_priority_tier": "hot",
			"priority_score": 12.5,
			"demand_source_count": 4,
			"last_demand_at": "2026-05-15T09:30:00Z",
			"last_hydrated_at": "2026-05-15T09:29:00Z",
			"latest_trade_date": "2026-05-15",
			"freshness_state_summary": "fresh",
			"coverage_state_summary": "ok",
			"decay_after_at": null,
			"active_sources": ["watchlist", "tracked_symbol", "holding"],
			"datasets": {
				"daily_prices": "fresh",
				"price_board_snapshot": "fresh",
				"intraday_bars": "warm",
				"session_facts": "fresh"
			}
		}
	]
}
```

### 7.3 `GET /api/soc/dataops/global-registry/symbols/<symbol>/`

**Purpose**: Drill-down một symbol gồm registry row, demand edges, coverage rows và recommendation.

**Response shape**:

```json
{
	"registry": {
		"symbol": "FPT",
		"is_active": true,
		"current_priority_tier": "hot",
		"priority_score": 12.5,
		"demand_source_count": 4,
		"last_demand_at": "2026-05-15T09:30:00Z",
		"last_hydrated_at": "2026-05-15T09:29:00Z",
		"latest_trade_date": "2026-05-15",
		"freshness_state_summary": "fresh",
		"coverage_state_summary": "ok",
		"decay_after_at": null,
		"metadata": {}
	},
	"demand_sources": [
		{
			"id": 1,
			"source_type": "watchlist",
			"source_ref": "watchlist:12",
			"tenant_id": 3,
			"user_id": 42,
			"is_active": true,
			"weight": 1.0,
			"activated_at": "2026-05-15T09:00:00Z",
			"deactivated_at": null,
			"metadata": {"watchlist_id": 12, "watchlist_name": "Công nghệ"}
		}
	],
	"coverage": [
		{
			"dataset": "daily_prices",
			"freshness_state": "fresh",
			"latest_available_at": "2026-05-15T07:00:00Z",
			"oldest_available_at": "2026-01-02T00:00:00Z",
			"latest_complete_trade_date": "2026-05-15",
			"missing_ranges": [],
			"last_verified_at": "2026-05-15T09:29:00Z",
			"next_recommended_action": null,
			"detail": {}
		}
	],
	"planner_hint": {
		"recommended_tier": "hot",
		"recommended_actions": []
	}
}
```

### 7.4 `GET /api/soc/dataops/coverage/summary/`

**Purpose**: Tóm tắt coverage/freshness theo dataset để operator nhìn ngay gap lớn nhất.

**Response shape**:

```json
{
	"datasets": [
		{
			"dataset": "daily_prices",
			"fresh": 0,
			"warm": 0,
			"stale": 0,
			"missing": 0,
			"error": 0
		}
	],
	"top_gaps": [
		{
			"symbol": "HPG",
			"dataset": "intraday_bars",
			"freshness_state": "missing",
			"next_recommended_action": "hydrate_intraday_bars"
		}
	],
	"updated_at": "2026-05-15T10:00:00Z"
}
```

### 7.5 `GET /api/soc/dataops/coverage/<symbol>/`

**Purpose**: Coverage chi tiết theo dataset cho một symbol.

**Response shape**:

```json
{
	"symbol": "FPT",
	"datasets": [
		{
			"dataset": "session_facts",
			"freshness_state": "fresh",
			"latest_available_at": "2026-05-15T09:20:00Z",
			"latest_complete_trade_date": "2026-05-15",
			"missing_ranges": [],
			"next_recommended_action": null,
			"detail": {}
		}
	]
}
```

### 7.6 `POST /api/soc/dataops/planner/preview/`

**Purpose**: Preview plan items trước khi chạy.

**Request shape**:

```json
{
	"symbols": ["FPT", "HPG"],
	"datasets": ["daily_prices", "session_facts"],
	"mode": "missing_only",
	"force_refresh": false,
	"reason": "manual_preview"
}
```

**Response shape**:

```json
{
	"mode": "missing_only",
	"items": [
		{
			"symbol": "HPG",
			"dataset": "session_facts",
			"provider_chain": ["vnbroker"],
			"requested_window": {"trade_date": "2026-05-15"},
			"reason": "missing",
			"overwrite_existing": false,
			"coverage_before": "missing"
		}
	],
	"skipped": [
		{
			"symbol": "FPT",
			"dataset": "daily_prices",
			"reason": "coverage_ok"
		}
	],
	"summary": {
		"planned_items": 1,
		"skipped_items": 1
	}
}
```

### 7.7 `POST /api/soc/dataops/planner/run/`

**Purpose**: Enqueue hoặc chạy một planner batch có audit trail.

**Request shape**:

```json
{
	"symbols": ["FPT", "HPG"],
	"datasets": ["daily_prices"],
	"mode": "missing_only",
	"force_refresh": false,
	"execution_mode": "async",
	"reason": "operator_manual_run"
}
```

**Response shape**:

```json
{
	"queued": true,
	"run_id": "md-run-123",
	"plan_summary": {
		"planned_items": 2,
		"skipped_items": 4
	},
	"status": "queued"
}
```

### 7.8 `GET /api/soc/dataops/queue-tiers/`

**Purpose**: Quan sát phân bổ symbol theo queue tier và cadence hiện hành.

**Response shape**:

```json
{
	"tiers": [
		{
			"tier": "hot_user_demand",
			"symbol_count": 0,
			"poll_interval_seconds": 0,
			"max_batch_size": 0,
			"examples": ["FPT", "HPG"]
		}
	],
	"updated_at": "2026-05-15T10:00:00Z"
}
```

### 7.9 `POST /api/soc/dataops/runtime-config/`

**Purpose**: Update runtime config cho planner/tiers/cadence bằng operator flow chuẩn.

**Request shape**:

```json
{
	"config_payload": {
		"decay_days": 7,
		"hot_user_demand": {"poll_interval_seconds": 30, "max_batch_size": 50},
		"warm_liquid_market": {"poll_interval_seconds": 120, "max_batch_size": 100}
	}
}
```

**Response shape**:

```json
{
	"config": {},
	"ownership": {
		"domain": "dataops_market_data",
		"mode": "native-write",
		"can_apply": true
	},
	"updated_at": "2026-05-15T10:00:00Z"
}
```

### 7.10 `GET /api/soc/dataops/run-logs/`

**Purpose**: Run history dành riêng cho planner/ingest batches của global market-data SSOT.

**Response shape**:

```json
{
	"count": 0,
	"next": null,
	"previous": null,
	"results": [
		{
			"run_id": "md-run-123",
			"status": "success",
			"mode": "missing_only",
			"reason": "operator_manual_run",
			"started_at": "2026-05-15T10:00:00Z",
			"finished_at": "2026-05-15T10:01:00Z",
			"summary": {
				"planned_items": 10,
				"inserted": 5,
				"updated": 0,
				"skipped_existing": 5,
				"failed": 0
			}
		}
	]
}
```

### 7.11 UI contract cho `SOC Data Ops`

Panel `SOC Data Ops` phải được tách thành 5 blocks rõ ràng, không gói toàn bộ vào một JSON editor như `VnbrokerPanel` hiện tại:

1. `Registry Summary` — cards + table filters bám `global-registry/summary` và `global-registry/symbols`.
2. `Coverage Board` — dataset freshness matrix bám `coverage/summary` và `coverage/<symbol>`.
3. `Queue Tier Board` — cadence/tier visibility bám `queue-tiers`.
4. `Manual Planner Builder` — form preview/run bám `planner/preview` và `planner/run`.
5. `Run History` — paginated log table bám `run-logs`.

### 7.12 UI state rules

- `SOCPage` tab `dataops` phải mount panel market-data SSOT chuyên biệt, không reuse trực tiếp `VnbrokerPanel` làm final surface.
- Mọi manual action phải có `preview` trước `run`, trừ explicit quick-run flow có confirmation.
- `Summary`, `Coverage`, `Queue tiers`, và `Run history` phải read-only nếu ownership không cho write.
- Text mới phải qua i18n tiếng Việt đầy đủ dấu.

---

## 8. Read-path invariants

### 8.1 Bắt buộc

- Watchlist UI không được gọi provider trực tiếp để hydrate giá/history riêng cho user.
- Dashboard không được xem watchlist như data silo.
- Stock detail không được tạo crawl path riêng vì user vừa mở màn hình.
- AI/advisory/alerts chỉ được consume shared global data layer.

### 8.2 Cho phép

- Read-through cache trên shared global data.
- Background promotion/warm-up khi symbol mới được quan tâm.
- Manual operator run có audit để lấp gap coverage.

---

## 9. Cấm tuyệt đối

- per-user universe truth song song với global matrix
- full overwrite crawl không kiểm coverage
- direct provider access bypass `market_data.vnbroker_adapter`
- dùng `ScrapeMatrix` như persistent source of truth của universe
