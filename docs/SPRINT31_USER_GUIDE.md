# Hướng Dẫn Sử Dụng & Giải Thích Chi Tiết Sprint 31
## Whale Alerts Professionalization (Phase 0 + Phase 1 Kickoff)

**Ngày triển khai:** 2026-04-10  
**Trạng thái:** Production Ready - Tất cả gates A-H ✅ GREEN

---

## 1. Tính Năng Người Dùng Mới (User Features)

### 1.1 Whale Hub Trust Chips (UX Trust Hardening)
```
📊 Live/Recovered chip: Dữ liệu real-time hay snapshot recovery
🎯 Threshold Source: user_default vs symbol_override  
⏱️ Freshness Bucket: live_0_15s, recovered_5m, stale_15m+
🔥 Abnormality Score: 0-100 (màu: rose/amber/cyan/slate)
📈 Session Percentile: p75, p98 (top X% phiên)
```

**Vị trí hiển thị:**
- Dashboard Realtime Panel
- WhaleAlertsHub aggregate cards  
- WhaleAdvisory cards

### 1.2 Aggregate Window Filter v2
```
API: GET /api/realtime/whale-feed/aggregate/?window=5m|15m|1h|session|5d
FE: Dropdown selector → auto-refetch

Window Semantics (VN market time):
- 5m/15m/1h: N minutes trước now  
- session: Market open → now
- 5d: Market open 4 trading days ago → now
```

**Cursor deterministic per window** - pagination stable khi switch window.

### 1.3 Phase 1: Campaigns Tab (Whale Hub)
```
Tabs: Live Tape ↔ Campaigns
Campaign Card:
├── Symbol + Side Bias + Strength (0-100)
├── Duration + Event Count  
├── Total Matched Value
├── Source Mix pie chart
└── Pin/Investigate button

Campaign Detail Modal:
├── Timeline (bars theo thời gian)
├── Full event list w/ metadata  
├── Confidence breakdown
└── Co-observation: whale + dark flow
```

---

## 2. API Contracts Mới

### 2.1 Whale Symbol Summary
```
GET /api/realtime/whale-symbol-summary/<symbol>/
Response:
{
  "symbol": "FPT",
  "latest_campaign": {...},
  "campaign_count_session": 5, 
  "buy_bias": 65.5,
  "net_value_today": 120e9,
  "abnormality_summary": "Score: 72.3, ADV: 2.1x",
  "baseline": {...},
  "source_quality": {"freshness_bucket": "<5m"}
}
```

### 2.2 Aggregate Feed v2 (Window Filter)
```
GET /api/realtime/whale-feed/aggregate/?window=1h&amp;sort=matched_value
Response includes:
+ window echo-back in filters
+ deterministic cursor per window  
+ source_mix counts (stream/db/vnstock)
```

---

## 3. Hoạt Động Nội Bộ (Technical Deep Dive)

### 3.1 Threshold Resolver Unification
```
backend/portfolio/tasks.py: collect_and_publish_realtime()
└── per-symbol override map ưu tiên > user default
    ├── TrackedSymbol.whale_alert_threshold_million → symbol_override
    └── UserConfig.whale_alert_threshold → user_default
```

### 3.2 Market-Time Normalization
```
backend/portfolio/order_flow.py + whale_feed_helpers.py
- _today() / _now_time() → VN local market timezone
- Windows: 5m/15m/30m/1h theo giờ VN (9h-15h)
- Session: market-open → now (không phải UTC)
```

### 3.3 Abnormality Scoring Engine
```
backend/portfolio/baseline_service.py (287 lines)
1. get_symbol_baseline() → ADV, liquidity_tier (HIGH/MEDIUM/LOW)
2. get_session_percentile() → pXX trong session window  
3. calculate_abnormality_score() → 0-100:
   - 3x+ ADV ≥80
   - 1.5x+ ADV ≥50
   - Top 10% percentile +15pt
   - Low liquidity +10pt
```

**Payload enrichment** trong `_build_aggregate_event_payload()`:
```
+ abnormality_score
+ session_percentile  
+ baseline_context: {adv_multiple, liquidity_tier, triggers[]}
```

### 3.4 Duplicate Policy (Highest Threshold Wins)
```
backend/portfolio/realtime/compute.py
- Same trade_id → giữ event có threshold cao nhất
- No duplicate WS spam trong 5s poll cycle
```

### 3.5 Observability Baseline
```
Metrics exposed:
/api/admin-ops/runtime-kpi/whale-pipeline/
├── freshness_median/p95
├── dedup_hit_ratio  
├── snapshot_recovery_ratio
├── source_mix_ratio (stream/db/vnstock)
└── health_summary
```

---

## 4. Hướng Dẫn Sử Dụng

### 4.1 Truy Cập Whale Hub
```
1. Dashboard → Whale Alerts Hub
2. Tabs: Live Tape | Campaigns  
3. Scope: Tracked / Watchlist Groups
4. Window Filter: 5m/15m/1h/Session/5d
5. Sort: ts (mặc định) / matched_value
```

### 4.2 Đọc Trust Metadata
```
🔴 Rose (80+): Rất bất thường
🟡 Amber (60-80): Bất thường  
🟢 Cyan (40-60): Bình thường
⚪ Slate (<40): Thường

pXX chip: Top X% phiên
Live/Recovered: Nguồn dữ liệu
Threshold Source: User hay symbol override
```

### 4.3 Campaigns Workflow
```
1. Switch → Campaigns tab
2. Filter: side, strength range, time window
3. Click campaign → Detail Modal:
   ├── Timeline visualization
   ├── Full events list  
   ├── Confidence breakdown
   └── Co-observation (whale + dark flow)
4. Pin → Triage queue cho investigation
```

### 4.4 Symbol Intelligence
```
1. Whale Hub → Symbol summary (right panel)
2. Hoặc API: /api/realtime/whale-symbol-summary/FPT/
   ├── Latest campaign info
   ├── Buy/sell bias session
   ├── Net flow today
   └── Abnormality context
```

---

## 5. Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Không thấy whale orders | Threshold quá cao | Giảm UserConfig.whale_alert_threshold |
| Window filter giống nhau | Timezone chưa VN | Kiểm tra backend/portfolio/order_flow.py |
| Trust chips trống | Payload chưa enrich | Rerun regression: `ApiRouteSmokeTests -k whale` |
| Campaigns empty | Gap quá chặt | Tăng campaign_gap_minutes query param |

---

## 6. Performance Notes

```
✅ p95 aggregate <500ms (Redis stream)
✅ Symbol summary <200ms (baseline cache 24h TTL)  
✅ Campaign grouping deterministic O(n log n)
✅ Regression suite: 56/56 (100%) sau fixes
```

**Sprint 31 transforms Whale Alerts từ raw events → professional intelligence.**

