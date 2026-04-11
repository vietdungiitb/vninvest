# P3.1 Provider Failover - Chi tiết Thiết kế

## 🎯 Vấn đề cần giải quyết

Hiện tại, advisory generation có vấn đề:

```
User A: "Generate advisory for MWG"
  ├─ Backend: Use OpenAI (primary provider)
  ├─ OpenAI: 429 Too Many Requests (rate-limited)
  ├─ Retry logic: 3 retries with backoff
  ├─ All retries fail: still 429
  └─ Result: ❌ Advisory skipped — user gets nothing

User B: Cùng lúc, request cho VCB
  └─ kết quả: cũng skipped (OpenAI still in cooldown 120s)
```

**Root cause**: Khi OpenAI hit rate-limit, toàn bộ system đơm phơ 120 giây. Không có fallback nào.

---

## 💡 Giải pháp: Provider Failover

```
User A: "Generate advisory for MWG"
  ├─ Try Provider 1 (OpenAI)
  │  └─ 429 → fail
  ├─ Try Provider 2 (Claude) ◄─ AUTO FAILOVER
  │  └─ success ✅ → return result
  └─ Result: User gets advisory, no 120s downtime

User B: meanwhile, also gets advisory using Gemini or OpenClaw
```

**Lợi ích**:
- ✅ Higher availability (99% instead of 95%)
- ✅ Better UX (user không đợi 2 min)
- ✅ Cost optimization (dùng cheaper provider as fallback)
- ✅ Load balancing (distribute across providers)

---

## 🔄 Failover Strategy

### 1. Primary vs Fallback Providers

```python
# ai_options.py (new section)

ADVISORY_PROVIDER_FAILOVER_CHAIN = {
    # Primary → [Fallback 1, Fallback 2, ...]
    'openclaw': ['openai', 'claude', 'gemini'],
    'openai': ['claude', 'gemini', 'openclaw'],
    'claude': ['gemini', 'openai', 'openclaw'],
    'gemini': ['openai', 'claude', 'openclaw'],
    'copilot': ['openai', 'claude', 'gemini'],  # copilot is rarely primary
}

# Configurable via env var:
# ADVISORY_PROVIDER_FAILOVER_CHAIN_JSON='{"openai": ["claude", "gemini"]}'
```

**Logic**:
- Nếu primary provider fail → thử fallback theo thứ tự
- Nếu tất cả fail → báo error như hiện tại
- Nếu success ở bất kỳ provider nào → dùng luôn

### 2. Failure Detection Types

```python
class ProviderFailure:
    """Classify what kind of failure"""
    
    @staticmethod
    def classify(exception: Exception) -> str:
        exc_str = str(exception).lower()
        
        if '429' in exc_str or 'too many requests' in exc_str:
            return 'rate_limited'  # Rate limit → safe to failover
        
        elif '401' in exc_str or 'unauthorized' in exc_str:
            return 'auth_failed'   # Auth error → skip provider, don't retry
        
        elif '503' in exc_str or 'service unavailable' in exc_str:
            return 'service_down'  # Provider down → failover
        
        elif '408' in exc_str or 'timeout' in exc_str:
            return 'timeout'       # Network issue → failover + retry
        
        else:
            return 'unknown'       # Unknown error → don't failover (log & skip)
```

**Sau khi detect**:
- `rate_limited`, `service_down`, `timeout` → **FAILOVER**
- `auth_failed`, `unknown` → **SKIP** (không retry)

### 3. Failover Execution Flow

```python
def generate_whale_text_with_failover(
    provider: str,
    model: str,
    api_key: str,
    symbol: str,
    **kwargs
) -> dict:
    """Try primary provider, fallback if necessary"""
    
    # Step 1: Resolve failover chain
    failover_chain = ADVISORY_PROVIDER_FAILOVER_CHAIN.get(provider, [])
    providers_to_try = [provider] + failover_chain  # [primary, fallback1, fallback2]
    
    last_error = None
    
    # Step 2: Try each provider in sequence
    for attempt_provider in providers_to_try:
        try:
            # Get config for this provider
            attempt_model = get_default_model(attempt_provider) if attempt_provider != provider else model
            attempt_key = _resolve_api_key_for_provider(attempt_provider, api_key)
            
            # Call AI service
            result = generate_whale_text_internal(
                provider=attempt_provider,
                model=attempt_model,
                api_key=attempt_key,
                symbol=symbol,
                **kwargs
            )
            
            # Success!
            if attempt_provider != provider:
                # Record failover event
                _record_provider_failover(provider, attempt_provider, kwargs['user_id'])
            
            return result
        
        except Exception as exc:
            failure_type = ProviderFailure.classify(exc)
            last_error = exc
            
            # Only failover on certain errors
            if failure_type not in ['rate_limited', 'service_down', 'timeout']:
                logger.warning(f'Non-failover error from {attempt_provider}: {exc}')
                raise  # Don't try next provider
            
            logger.info(
                f'Failover: {provider}→{attempt_provider} ({failure_type}) symbol={symbol}'
            )
            
            # Continue to next provider
            continue
    
    # Step 3: All providers failed
    logger.error(f'All providers exhausted for {symbol}: {last_error}')
    raise last_error
```

---

## 📊 Observability & Tracking

### Cache Keys (new)

```python
# Failover event tracking
advisory:failover-count:{primary_provider}:{date}         # 25h TTL
advisory:failover-target:{primary_provider}:{date}       # Counter per target
advisory:provider-success-rate:{provider}:{date}         # %age success

# Per-user failover history (optional)
advisory:failover-user-history:{user_id}                 # [... event list]
```

### Metrics Endpoint Extended

```json
{
  "...existing fields...",
  
  "failover_tracking": {
    "failovers_today": 12,
    "by_source_provider": {
      "openai": {
        "failover_count": 5,
        "success_after_failover_count": 5,
        "primary_failures": {
          "rate_limited": 3,
          "service_down": 2,
          "timeout": 0
        },
        "fallback_targets_used": {
          "claude": 3,
          "gemini": 2
        }
      },
      "claude": {
        "failover_count": 2,
        "success_after_failover_count": 2,
        ...
      }
    },
    "failover_success_rate": 0.92,  # 11/12 failovers had success
  },
  
  "provider_health": {
    "openai": {
      "success_rate_pct": 0.94,
      "last_failure": "2026-04-11T15:45:23Z",
      "failure_type": "rate_limited",
      "attempts_today": 73,
      "successful_attempts": 68
    },
    "claude": {
      "success_rate_pct": 0.99,
      "last_failure": null,
      "attempts_today": 45
    }
  }
}
```

### Audit Log Enhancement

```python
# AdvisoryAggregateAuditLog.metadata_json additions:
{
  "latency_ms": 1245.5,
  "ai_provider": "claude",           # ◄─ who actually handled it
  "ai_provider_primary": "openai",   # ◄─ who was requested
  "failover_occurred": True if ai_provider != ai_provider_primary else False,
  "failover_reason": "rate_limited",
  "failover_chain_attempted": ["openai", "claude", "gemini"],
  "failover_attempt_count": 1,       # How many tries before success
}
```

---

## 🔑 Key Design Decisions

| Aspect | Decision | Tại sao |
|--------|----------|----------|
| **Fallback Order** | Configurable via env var | Dễ tunning per deployment |
| **Failure Types** | Classify into 5 types | Không phải lúc nào cũng failover (vd: auth fail) |
| **Retry vs Failover** | Separate logic | Retry 3x cùng provider, rồi mới failover |
| **Same Model?** | Use provider's default model | Không lẫn lộn config/API key |
| **Tracking** | Daily counters + audit log | Enough for metrics, không spam Redis |
| **User Notification** | Silent failover | Better UX (user không biết có đấu tranh phía sau) |

---

## 🛠️ Implementation Roadmap

### Phase 1: Infrastructure (1 hour)
```
1. Update ai_options.py: Add ADVISORY_PROVIDER_FAILOVER_CHAIN
2. Create ProviderFailure.classify() in ai_service.py
3. Add failover tracking Redis keys
4. Update AdvisoryAggregateAuditLog schema (metadata_json)
```

### Phase 2: Failover Logic (2 hours)
```
1. Refactor generate_whale_text() → internal + wrapper
2. Implement generate_whale_text_with_failover()
3. Add _record_provider_failover() tracking function
4. Update tasks.py to call new wrapper
```

### Phase 3: Observability (1 hour)
```
1. Extend /advisory-metrics/ endpoint with failover stats
2. Add provider health tracking section
3. Create Prometheus/Grafana alerts for high failover rate
```

### Phase 4: Testing & Verification (1 hour)
```
1. Unit tests for ProviderFailure.classify()
2. Integration test: mock 429, verify failover to claude
3. E2E: simulate provider down, verify advisory still generated
4. Load test: verify failover doesn't increase latency too much
```

---

## ⚠️ Edge Cases & Gotchas

### Case 1: Cascading Failures
```
Q: Nếu OpenAI + Claude cùng 429 thì sao?
A: Continue to Gemini. Nếu tất cả 429 → timeout, user skipped
   (tương như hiện tại nhưng đã thử hết)
```

### Case 2: Different API Keys
```
Q: Mỗi provider cần API key khác nhau, làm sao?
A: runtime_cfg.pop('api_key') chỉ lấy key cho primary provider
   Cần thêm logic: getattr(settings, f'{provider.upper()}_API_KEY')
```

### Case 3: Model Compatibility
```
Q: Cost tracking: nếu fallback Claude, token cost sẽ khác?
A: Yes. Cần track: 
   - Requested provider: OpenAI, gpt-4o
   - Actual provider: Claude, sonnet
   - Actual token cost: different pricing
```

### Case 4: User Preferences
```
Q: User set "prefer OpenAI only" thì có failover không?
A: Thêm env var: ADVISORY_ALLOW_AUTO_FAILOVER=False (per-user setting)
   Nếu False → skip failover, use existing retry + skip behavior
```

---

## 📈 Success Metrics (H3 observability)

Sau khi implement P3.1, ta sẽ track:

| Metric | Target | Alert |
|--------|--------|-------|
| **Failover Rate** | < 5% of requests | > 10% → alert |
| **Failover Success Rate** | > 90% | < 80% → critical |
| **P95 Latency (with failover)** | < 2500ms | > 3500ms → warn |
| **Provider Health Score** | Per-provider | < 0.9 or < 0.8 → action |

---

## 🚀 Rollout Strategy

1. **Dev**: Test failover locally with mock 429
2. **Staging**: Deploy, verify advisory metrics endpoint
3. **Production**:
   - Day 1: Deploy, observe failover rate < 1%
   - Day 2: Enable monitoring alerts
   - Day 3: Can be used for incident response (manual failover if needed)

---

Đây là chi tiết P3.1. Bạn có muốn tôi:
- **A)** Proceed với implementation dựa trên design này?
- **B)** Adjust chiến lược nào đó trước khi implement?
- **C)** Skip P3.1, focus vào P3.2 (ML-based latency prediction)?

Chọn nào? 🎯
