# Advisory Observability Architecture - Chi tiết Cơ chế

## 📐 Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React)                              │
│           http://localhost:8080/stocks/{symbol}                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │  API Requests   │
        │  (polling)      │
        └────────┬────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                    Django Backend                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Whale Advisory Generation Task (Celery)                │   │
│  │  generate_whale_advisory_task()                          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  1. Budget Check                                         │   │
│  │     └─ acquire per-user lock                            │   │
│  │                                                           │   │
│  │  2. Provider Rate-Limit Check                           │   │
│  │     └─ cache.get('advisory:provider-ratelimit:{provider}')
│  │                                                           │   │
│  │  3. Model Resolution [P2: Multi-Model Routing]          │   │
│  │     └─ _resolve_model_for_budget()                     │   │
│  │        if remaining_budget < 20% of total_budget:       │   │
│  │           downgrade to cheap model (gpt-3.5 vs gpt-4o)  │   │
│  │           increment: advisory:budget-downgrade-count    │   │
│  │                                                           │   │
│  │  4. Advisory Generation via AI                          │   │
│  │     ├─ Latency Tracking: start_advisory_session()     │   │
│  │     ├─ Component Generation (chart, volatility, etc)   │   │
│  │     └─ Token Cost Tracking: record_advisory_token_usage()
│  │                                                           │   │
│  │  5. Result Persistence                                  │   │
│  │     ├─ Save WhaleAdvisory model                        │   │
│  │     ├─ Record AdvisoryTokenLog (for quota)            │   │
│  │     └─ Create AdvisoryAggregateAuditLog (for metrics)  │   │
│  │                                                           │   │
│  │  6. Error Handling                                      │   │
│  │     if 429 (Too Many Requests):                         │   │
│  │        ├─ cache.set('advisory:provider-ratelimit')     │   │
│  │        ├─ increment: advisory:429-count:{provider}     │   │
│  │        └─ retry up to 3x with exponential backoff      │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Redis Cache Layer (Multi-Purpose)                       │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  - advisory:gen-lock:{user_id}              [90s TTL]   │   │
│  │  - advisory:provider-ratelimit:{provider}   [120s TTL]  │   │
│  │  - advisory:429-count:{provider}:{date}     [90k s TTL] │   │
│  │  - advisory:budget-downgrade-count:{date}   [90k s TTL] │   │
│  │  - advisory:prompt-cache:components:{md5}   [15m TTL]   │   │
│  │  - vnstock:timeout-counter:price_board                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Audit Trail)                                │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  - AdvisoryAggregateAuditLog                            │   │
│  │    ├─ metadata_json: {latency_ms, token_cost, ...}     │   │
│  │    ├─ created_at: indexed for time-windowed queries    │   │
│  │    └─ reason: auto_generation, manual_refresh, etc.    │   │
│  │                                                           │   │
│  │  - AdvisoryTokenLog (per-user quota tracking)           │   │
│  │    ├─ tokens_used: prompt + completion tokens           │   │
│  │    └─ created_at: indexed by date for daily sum()      │   │
│  │                                                           │   │
│  │  - WhaleAdvisory (advisory result)                      │   │
│  │    ├─ ai_summary, ai_detail: text recommendations      │   │
│  │    ├─ ai_provider, ai_model: tracking which provider   │   │
│  │    └─ severity: urgent/warning/info                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │  Admin Monitoring Endpoints        │
        ├───────────────────────────────────┤
        │                                   │
        │  /api/admin-ops/runtime-kpi/     │ (overall health)
        │  /api/admin-ops/runtime-kpi/     │ (whale pipeline)
        │    advisory-metrics/  ◄── [P2]  │ (advisory-specific)
        │                                   │
        └───────────────────────────────────┘
```

---

## 🔄 Luồng xử lý chi tiết (Detailed Flow)

### Phase 1: Budget & Provider Check
```python
# 1. Per-user generation lock (prevent concurrent budget overruns)
_gen_lock_key = f'advisory:gen-lock:{user_id}'
_lock_acquired = cache.add(_gen_lock_key, 1, timeout=90)

if not _lock_acquired:
    return {'status': 'skipped', 'reason': 'concurrent_generation_active'}

try:
    # 2. Get remaining budget for user
    remaining_budget = _get_remaining_advisory_budget(user_cfg)
    
    # 3. Check if provider is in cooldown (from previous 429)
    if cache.get(f'advisory:provider-ratelimit:{provider}'):
        return {'status': 'skipped', 'reason': 'provider_rate_limit_cooldown'}
        
finally:
    # Always release lock after budget check
    cache.delete(_gen_lock_key)
```

**Lý do dùng lock**: Nếu user trigger 2 refresh cùng lúc, ca sẽ:
- Task 1: acquire lock → check budget (3000 tokens) → pass
- Task 2: try acquire lock → fail ngay tức khắc
- Task 1 sinh advisory chi 2500 token → budget còn 500
- Task 2 không tranh budget của Task 1

### Phase 2: Model Resolution [P2 - Multi-Model Routing]

```python
def _resolve_model_for_budget(provider, model, remaining_budget, total_budget):
    """
    Nếu remaining_budget < 20% of total_budget:
       Downgrade về model rẻ hơn
    """
    if remaining_budget is None or total_budget is None:
        return model
    
    threshold_pct = 20.0  # env: ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT
    threshold_tokens = total_budget * (threshold_pct / 100.0)
    
    # Ví dụ: total=10000, remaining=1500 => 1500 < (10000 * 0.20=2000) => downgrade
    if remaining_budget > threshold_tokens:
        return model  # Budget ok, keep original model
    
    # Downgrade logic
    cheap_model_map = {
        'openai': 'gpt-3.5-turbo',        # vs gpt-4o: 10x cheaper
        'claude': 'claude-3-haiku',        # vs sonnet: 8x cheaper
        'gemini': 'gemini-1.5-flash',     # vs pro: 4x cheaper
        'copilot': 'openai/gpt-4.1-mini',
        'openclaw': 'default',
    }
    cheap_model = cheap_model_map.get(provider, model)
    
    if cheap_model and cheap_model != model:
        # Increment counter cho observability
        cache.incr(f'advisory:budget-downgrade-count:{date.today()}')
        
        logger.info(f'Model downgraded {model}→{cheap_model}')
        return cheap_model
    
    return model
```

**Lợi ích**:
- **Cost saving**: Dùng gpt-3.5 thay gpt-4o khi budget thấp → tiết kiệm 90%
- **Fairness**: User với budget cao vẫn dùng best model; budget thấp vẫn được advisory
- **Observability**: `advisory:budget-downgrade-count` theo dõi bao nhiêu lần trigger

---

### Phase 3: Advisory Generation + Latency Tracking

```python
# ── Session initialization ────────────────────
start_advisory_session()  # session_start_time = time.now()

try:
    # ── Component generation (volatility, momentum, etc) ────
    start_advisory_phase('volatility_analysis')
    volatility_result = calculate_volatility(...)
    end_advisory_phase('volatility_analysis')
    
    # ── AI generation ────────────────────────────────────────
    start_advisory_phase('provider_generation')
    
    if use_concise:
        summary_resp = generate_advisory_concise(
            provider=provider,
            model=model,  # ◄─ có thể đã downgrade ở Phase 2
            ...
        )
    else:
        summary_resp = generate_whale_text(...)
    
    end_advisory_phase('provider_generation')
    
    # ── Record token usage ──────────────────────────────────
    record_advisory_token_usage(
        tokens=summary_resp['prompt_tokens'],
        source='ai_generation'
    )
    
finally:
    # ── Session finalization ────────────────────────────────
    metrics_payload = end_advisory_session()
    # metrics_payload = {
    #     'latency_ms': 1234.5,
    #     'token_cost': 350,
    #     'token_breakdown': {
    #         'volatility_analysis': 100,
    #         'ai_generation': 250
    #     },
    #     ...
    # }
```

**Observability từ observability.py**:
- Mỗi phase có start/end time riêng
- Tính tổng latency: `end_time - session_start_time`
- Breakdown token per component

---

### Phase 4: Error Handling (429 Rate-Limit)

```python
try:
    resp = _openai_compatible_completion(...)
except Exception as exc:
    exc_str = str(exc)
    
    if '429' in exc_str or 'Too Many Requests' in exc_str:
        # ── Rate-limit handling ────────────────────────────
        _rl_key = f'advisory:provider-ratelimit:{provider}'
        _rl_seconds = 120  # env: AI_PROVIDER_RATELIMIT_PAUSE_SECONDS
        
        # 1. Set per-provider cooldown (dùng để skip trong loop)
        cache.set(_rl_key, 1, timeout=_rl_seconds)
        
        # 2. Increment daily 429 counter (dùng cho metrics)
        _429_counter_key = f'advisory:429-count:{provider}:{date.today()}'
        cache.incr(_429_counter_key)  or cache.set(..., 1)
        
        logger.warning(f'429 for {provider}: {_rl_seconds}s cooldown')
        
        # 3. Retry logic đã có sẵn trong _openai_compatible_completion:
        #    for attempt in range(3):
        #        try: return call()
        #        except 429:
        #            wait exponential backoff
        #            if attempt < 2: retry
        #            else: raise
    else:
        logger.error(f'AI error: {exc}')
        raise
```

**Cache keys cho metrics**:
- `advisory:provider-ratelimit:{provider}`: TTL=120s (live indicator)
- `advisory:429-count:{provider}:{date}`: TTL=~25h (daily counter)

---

## 📊 Advisory Metrics Endpoint [P2 - NEW]

### Endpoint: `GET /api/admin-ops/runtime-kpi/advisory-metrics/`

```bash
curl -H "Authorization: Bearer <token>" \
  'http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/?latency_window_hours=24&provider_window_days=7'
```

### Response Structure

```json
{
  "sampled_at": 1712847600.5,
  
  "windows": {
    "latency_hours": 24,
    "provider_days": 7
  },
  
  "latency": {
    "p50_ms": 1245.3,
    "p95_ms": 3820.5,
    "sample_count": 142
  },
  
  "token_burn": {
    "today_tokens": 45000,
    "total_configured_budget": 180000,
    "burn_pct": 25.0
  },
  
  "provider_distribution": {
    "openclaw": 45,
    "openai": 28,
    "claude": 18,
    "gemini": 9,
    "copilot": 0
  },
  
  "ratelimit_cooldowns_active": {
    "openclaw": false,
    "openai": true,      ◄─ currently in cooldown
    "claude": false,
    "gemini": false,
    "copilot": false
  },
  
  "ratelimit_429_counts_today": {
    "openclaw": 0,
    "openai": 3,         ◄─ 3 times hit 429 today
    "claude": 0,
    "gemini": 0,
    "copilot": 0
  },
  
  "budget_downgrade_count_today": 7,  ◄─ 7 tasks downgraded to cheap model
  
  "advisory_counts_today": {
    "total": 42,
    "by_source_tokens": {
      "auto_generation": 28000,
      "manual_refresh": 15000,
      "whale_signal": 2000
    }
  }
}
```

### Metrics Calculation Logic

```python
# 1. LATENCY PERCENTILES
latency_window_start = now - timedelta(hours=24)
audit_logs = AdvisoryAggregateAuditLog.objects.filter(
    created_at__gte=latency_window_start
).values_list('metadata_json', flat=True)

latencies_ms = []
for meta in audit_logs:
    if meta.get('latency_ms'):
        latencies_ms.append(float(meta['latency_ms']))

p50 = statistics.median(latencies_ms)
p95 = sorted_latencies[int(len * 0.95)]

# 2. TOKEN BURN TODAY
today = date.today()
token_burn = AdvisoryTokenLog.objects.filter(
    created_at__date=today
).aggregate(Sum('tokens_used'))['tokens_used__sum']

total_budget = UserConfig.objects.filter(
    advisory_max_tokens_per_day__gt=0
).aggregate(Sum('advisory_max_tokens_per_day'))['advisory_max_tokens_per_day__sum']

burn_pct = (token_burn / total_budget) * 100

# 3. PROVIDER DISTRIBUTION
provider_window_start = now - timedelta(days=7)
for meta in AdvisoryAggregateAuditLog.objects.filter(
    created_at__gte=provider_window_start
):
    provider = meta.metadata_json.get('ai_provider')
    provider_dist[provider] = provider_dist.get(provider, 0) + 1

# 4. RATE-LIMIT STATUS
for provider in ['openclaw', 'openai', 'claude', 'gemini', 'copilot']:
    is_active = bool(cache.get(f'advisory:provider-ratelimit:{provider}'))
    count_today = int(cache.get(f'advisory:429-count:{provider}:{today}') or 0)
    ratelimit_cooldowns[provider] = is_active
    ratelimit_429_counts[provider] = count_today

# 5. BUDGET DOWNGRADE COUNT
budget_downgrade_count = cache.get(f'advisory:budget-downgrade-count:{today}') or 0
```

---

## 🎯 Alerting Thresholds (Suggested)

```yaml
# Prometheus/Grafana Alert Rules

- alert: HighAdvisoryLatency
  expr: advisory_metrics_p95_ms > 5000
  for: 10m
  annotations:
    summary: "Advisory P95 latency > 5s"

- alert: HighTokenBurnRate
  expr: advisory_metrics_burn_pct > 80
  for: 5m
  annotations:
    summary: "Advisory token burn > 80% of daily budget"

- alert: ProviderRateLimited
  expr: advisory_429_count > 5
  for: 1m
  annotations:
    summary: "Provider {{ $labels.provider }} receive 429"

- alert: FrequentModelDowngrade
  expr: advisory_budget_downgrade_count > 20
  for: 30m
  annotations:
    summary: "Many advisory tasks downgrading to cheap model"
```

---

## 🔗 Data Flow: Từ Generation → Metrics

```
┌─ Celery Task: generate_whale_advisory_task()
│
├─ Budget & RateLimit Check
│  └─ cache: advisory:gen-lock, advisory:provider-ratelimit
│
├─ P2: Model Resolution
│  └─ cache incr: advisory:budget-downgrade-count
│
├─ AI Generation
│  ├─ start_advisory_session() → session_start_time
│  ├─ start_advisory_phase() × N
│  ├─ end_advisory_phase() × N
│  └─ end_advisory_session() → metrics_payload {latency_ms, ...}
│
├─ Error: 429
│  ├─ cache.set: advisory:provider-ratelimit
│  └─ cache incr: advisory:429-count
│
├─ Persistence
│  ├─ DB: WhaleAdvisory, AdvisoryTokenLog
│  └─ DB: AdvisoryAggregateAuditLog
│     └─ metadata_json: latency_ms, token_cost, ai_provider, ...
│
└─ Metrics Query
   ├─ REST: GET /api/admin-ops/runtime-kpi/advisory-metrics/
   ├─ Query Cache: advisory:provider-ratelimit, advisory:429-count, etc.
   ├─ Query DB: AdvisoryAggregateAuditLog.objects.filter(created_at__gte=...)
   └─ Response: JSON {latency, burn, provider_dist, ...}
```

---

## 🚀 Tiếp theo (P3 & Beyond)

| ID | Feature | Status | Mô tả |
|----|---------|--------|--------|
| P2.1 | Multi-model routing | ✅ DONE | Budget < 20% → downgrade model |
| P2.2 | Advisory metrics endpoint | ✅ DONE | Latency, burn, provider dist |
| P3.1 | Regional provider failover | 📋 TODO | If OpenAI 429 → auto-switch Claude |
| P3.2 | ML-based latency prediction | 📋 TODO | Estimate generation time before pick model |
| P3.3 | Grafana integration | 📋 TODO | Export metrics to Prometheus scrape |
| P3.4 | User-level SLO dashboard | 📋 TODO | Per-user latency tracking |

---

## 🔑 Key Cache Keys (Reference)

```python
# Generation locks
advisory:gen-lock:{user_id}                           # NX lock, 90s TTL

# Rate-limit tracking
advisory:provider-ratelimit:{provider}                # 120s TTL (live)
advisory:429-count:{provider}:{YYYY-MM-DD}          # ~25h TTL (daily)

# Downgrade tracking
advisory:budget-downgrade-count:{YYYY-MM-DD}        # ~25h TTL (daily)

# Prompt caching
advisory:prompt-cache:components:{md5_hash}         # 15m TTL (reuse prompts)

# Component circuit breaker
vnstock:timeout-counter:price_board                 # No TTL (persistent counter)
```

---

Đây là cơ chế hoàn chỉnh từ A→Z. Bây giờ tôi sẽ tiếp tục **P3** items! 🚀
