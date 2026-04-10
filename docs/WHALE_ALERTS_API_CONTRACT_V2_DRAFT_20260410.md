# Whale Alerts API Contract V2 Draft

Ngay: 2026-04-10
Trang thai: Draft
Pham vi: API contract de nang cap `/whale-alerts` thanh workspace intelligence chuyen nghiep

## 1. Muc tieu contract v2

Contract v2 can giai quyet 4 nhom van de:

1. Event semantics ro rang
2. Feed filters/workflow manh hon
3. Grouping/campaign support
4. Explainability/trust metadata

## 2. Core Entities

### 2.1 WhaleEvent

Don vi raw/normalized whale signal hien tren live tape.

```json
{
  "event_id": "whale:FPT:2026-04-10T09:15:00+07:00:buy:3200000000:1000000000",
  "symbol": "FPT",
  "ts": "2026-04-10T09:15:00+07:00",
  "side": "buy",
  "matched_value": 3200000000,
  "volume": 42000,
  "threshold": 1000000000,
  "threshold_source": "symbol_override",
  "size_class": "whale",
  "source": "redis_stream",
  "source_layer": "live",
  "recovered": false,
  "event_score": 78.4,
  "display_score": 74.1,
  "severity": "high",
  "abnormality_score": 82.2,
  "actionability_score": 69.5,
  "freshness_bucket": "live_0_15s",
  "baseline_context": {
    "session_percentile": 98.1,
    "adv_relative": 1.7,
    "liquidity_stress": 0.62
  },
  "why_triggered": [
    "3.2x threshold",
    "98th percentile intraday block",
    "buy-side persistence"
  ],
  "next_checks": [
    "check depth wall near current price",
    "compare with dark flow for same symbol"
  ],
  "contract_version": "2.0"
}
```

### 2.2 WhaleCampaign

Nhom event cung y nghia.

```json
{
  "campaign_id": "camp:FPT:buy:2026-04-10T09:10:00+07:00",
  "symbol": "FPT",
  "campaign_type": "accumulation_wave",
  "side_bias": "buy",
  "started_at": "2026-04-10T09:10:00+07:00",
  "updated_at": "2026-04-10T09:17:30+07:00",
  "duration_seconds": 450,
  "event_count": 5,
  "total_matched_value": 11800000000,
  "campaign_strength": 84.6,
  "confidence": "high",
  "top_event_ids": ["..."],
  "summary": "Persistent buy-side whale activity in short window",
  "trust": {
    "source_quality": "high",
    "freshness_bucket": "live_15_30s"
  },
  "contract_version": "2.0"
}
```

### 2.3 WhaleSymbolSummary

Tom tat nhanh cho symbol card / triage.

```json
{
  "symbol": "FPT",
  "latest_event_at": "2026-04-10T09:17:30+07:00",
  "latest_campaign_id": "camp:FPT:buy:2026-04-10T09:10:00+07:00",
  "current_bias": "buy",
  "campaign_count_session": 2,
  "buy_campaign_count": 2,
  "sell_campaign_count": 0,
  "net_whale_value_session": 14500000000,
  "abnormality_summary": {
    "latest": 82.2,
    "session_peak": 90.1
  },
  "trust_summary": {
    "freshness_bucket": "live_0_15s",
    "source_quality": "high"
  },
  "contract_version": "2.0"
}
```

## 3. Endpoint Proposals

### 3.1 Aggregate Live Tape

`GET /api/realtime/whale-feed/aggregate/`

Them params:

- `window=5m|15m|1h|session|5d`
- `side=buy|sell|all`
- `severity=low|medium|high|extreme|all`
- `freshness=live|warm|recovered|all`
- `threshold_source=user_default|symbol_override|all`
- `source=redis_stream|intraday_tick_db|vnstock|all`
- `view=events|campaigns`

Response top-level:

```json
{
  "results": [],
  "next_cursor": null,
  "has_more": false,
  "server_time": "2026-04-10T09:18:00+07:00",
  "source_mix": {
    "redis_stream": 8,
    "intraday_tick_db": 2,
    "vnstock": 0
  },
  "filters": {},
  "meta": {
    "contract_version": "2.0",
    "result_type": "events"
  }
}
```

### 3.2 Campaign Board

`GET /api/realtime/whale-campaigns/`

Params:

- `scope`
- `watchlist_group_ids`
- `window`
- `side`
- `confidence`
- `sort=updated_at|campaign_strength|total_matched_value`

### 3.3 Symbol Summary

`GET /api/realtime/whale-symbol-summary/<symbol>/`

Dung cho quick-investigate cards va hub side-panels.

### 3.4 Investigation Endpoint

`GET /api/portfolio/whale-investigation/<symbol>/`

Tong hop mot payload investigation:

- latest events
- latest campaigns
- dark flow snapshot
- reversal snapshot
- trust summary
- related checks

### 3.5 Whale History

`GET /api/portfolio/whale-history/`

Params:

- `symbol`
- `days=30|60|90`
- `bucket=day|week`

## 4. Backward Compatibility

### Nguyen tac

1. Khong vo contract v1 ngay lap tuc.
2. Co the them `contract_version=2` hoac endpoint moi.
3. FE rollout theo feature flag.

### Phuong an de xuat

- Giai doan 1: enrich v1 payload bang optional fields.
- Giai doan 2: mo v2 response mode.
- Giai doan 3: Whale Hub v2 consume v2 contract.

## 5. Required Backend Changes

1. Event builder phai support trust + abnormality metadata.
2. Aggregate service phai support filters va windows.
3. Campaign grouping service phai co cache/persistence strategy.
4. Symbol summary service phai tong hop nhanh va deterministic.

## 6. Required Frontend Changes

1. Whale Hub FE parser dung adapter layer thay vi doc thang payload.
2. Feed cards support source/freshness/threshold source chips.
3. Tabs `events` va `campaigns` can chia state ro rang.
4. Investigation view can dung payload unified.

## 7. Open Questions

1. Campaign nen duoc materialize vao DB hay tinh on-read voi cache?
2. `window=5d` co nen doc tu IntradayTick history hay bang aggregate table rieng?
3. `actionability_score` nen do BE tinh hoan toan hay cho FE map them theo risk mode?
4. Co nen tach `severity` cua WhaleEvent va `severity` cua Advisory thanh hai he thong doc lap?

## 8. Recommendation

Nen thuc hien contract v2 theo 2 dot:

1. Dot 1: enrich event feed + window filters + trust metadata
2. Dot 2: campaign endpoints + investigation endpoints + FE workspace v2
